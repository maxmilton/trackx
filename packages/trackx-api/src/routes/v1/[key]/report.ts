import { isIP } from 'net';
import type { Middleware } from 'polka';
import { EventType } from 'trackx/types';
import {
  addEventStmt,
  addIssueStmt,
  addSessionGraphHitStmt,
  addSessionIdxStmt,
  addSessionStmt,
  db,
  deniedEvent,
  existingSessionIdxStmt,
  existingSessionStmt,
  getDailySalt,
  getProjectByKeyStmt,
  incrementDailyEvents,
  matchingIssueHashStmt,
  updateIssueSessStmt,
  updateIssueStmt,
  updateSessionGraphStmt,
  updateSessionStmt,
} from '../../../db';
import type {
  EventInternal,
  IssueInternal,
  ProjectInternal,
  SessionInternal,
} from '../../../types';
import {
  AppError,
  byteSize,
  config,
  getIpAddress,
  hash,
  isNotASCII,
  logger,
  Status,
  uaParser,
  UID_SHORT_LENGTH,
} from '../../../utils';

const VALID_MIME_TYPES = [
  'application/reports+json',
  'application/csp-report',
  'application/expect-ct-report+json',
];

function addReport(
  key: string,
  origin: string,
  ip: string,
  ua: string,
  mimeType: string,
  // body: Record<string, unknown>,
  body: object,
) {
  const project = getProjectByKeyStmt.get(key) as ProjectInternal | undefined;

  if (!project) {
    throw new AppError('Invalid key', Status.FORBIDDEN);
  }

  if (!project.origin.split(',').includes(origin) && project.origin !== '*') {
    throw new AppError('Invalid origin', Status.FORBIDDEN);
  }

  // FIXME: Extract only the relevant data from the payload and discard the
  // rest, especially that which may contain PII e.g., user-agent

  // TODO: Regardless of report type, validate the data before saving to DB

  // XXX: REF: https://report-uri.com
  // XXX: REF: https://web.dev/reporting-api/

  let type = EventType.UnknownReport;
  let uri: string | undefined;
  let name: string | undefined;
  let message: string | undefined;

  // TODO: Extract the relevant data points e.g., name, message, uri
  switch (mimeType) {
    // Reporting API v0 and v1
    case 'application/reports+json':
      if (Array.isArray(body)) {
        // FIXME: Handle multiple reports in a single payload
        // FIXME: Detect type of report
        //  ↳ https://web.dev/reporting-api/#use-cases-and-report-types
        //  ↳ CSP violation (Level 3 only)
        //  ↳ COOP violation -- https://web.dev/coop-coep/#example-coop-report
        //  ↳ COEP violation -- https://web.dev/coop-coep/#example-coep-report
        //  ↳ Document Policy violation
        //  ↳ Deprecation warning
        //  ↳ Intervention
        //  ↳ Crash
        // FIXME:!
      } else {
        // @ts-expect-error - FIXME:!
        uri = body['document-uri'] || body.document_uri;
      }
      break;
    // Content Security Policy Level 2 and 3 Reports
    // https://www.w3.org/TR/CSP2/
    // https://www.w3.org/TR/CSP3/
    case 'application/csp-report':
      // @ts-expect-error - FIXME:!
      if (body['csp-report']) {
        type = EventType.CSPReport;
        // @ts-expect-error - FIXME:!
        // eslint-disable-next-line no-param-reassign
        body = body['csp-report'];
        // @ts-expect-error - FIXME:!
        uri = body['document-uri'];
        name = 'CSP Violation';
      } else {
        throw new AppError('Invalid report', Status.BAD_REQUEST);
      }
      break;
    // Certificate Transparency Reports
    // https://datatracker.ietf.org/doc/draft-ietf-httpbis-expect-ct/
    case 'application/expect-ct-report+json':
      // @ts-expect-error - FIXME:!
      if (body['expect-ct-report']) {
        type = EventType.CTReport;
        // @ts-expect-error - FIXME:!
        // eslint-disable-next-line no-param-reassign
        body = body['expect-ct-report'];
        // @ts-expect-error - FIXME:!
        uri = `${body.scheme || 'https'}://${body.host}:${body.port}`;
        name = 'Certificate Transparency Report';
      } else {
        throw new AppError('Invalid report', Status.BAD_REQUEST);
      }
      break;
    default:
      throw new AppError('Invalid report', Status.BAD_REQUEST);
  }

  const parser = uaParser.setUA(ua);
  const uaBrowser = parser.getBrowser();
  const uaOs = parser.getOS();

  const eventData: Omit<EventInternal, 'id'> = {
    project_id: project.id,
    // @ts-expect-error - set later
    issue_id: undefined,
    ts: Date.now(),
    type,
    data: {
      name,
      message,
      uri,
      os: uaOs.name,
      os_v: uaOs.version,
      agent: uaBrowser.name,
      agent_v: uaBrowser.version,
      // body_raw: body,
      meta: {
        body,
      },
    },
  };

  const payloadBytes = byteSize(eventData);

  if (payloadBytes > config.MAX_EVENT_BYTES) {
    logger.warn('Event size exceeds byte limit', payloadBytes);
    deniedEvent(key);
    return;
  }

  // FIXME:!
  const fingerprint = `${eventData.project_id}:${
    eventData.type
  }:${JSON.stringify(body)}`;
  const fingerprintHash = hash(Buffer.from(fingerprint));

  const existingIssue = matchingIssueHashStmt.get(fingerprintHash);

  if (existingIssue?.ignore) {
    return;
  }

  db.transaction(() => {
    const salt = getDailySalt();
    const sessionId = hash(Buffer.from(salt + origin + ip + ua));
    const existingSession = existingSessionStmt.get(sessionId, project.id);

    if (existingIssue) {
      eventData.issue_id = existingIssue.id;

      const existingSessionIdx = existingSessionIdxStmt.get(
        sessionId,
        eventData.issue_id,
      );

      if (!existingSession) {
        const sessionData: SessionInternal = {
          id: sessionId,
          project_id: project.id,
          ts: Math.trunc(eventData.ts / 1000),
          e: 1,
        };
        addSessionStmt.run(sessionData);
        addSessionGraphHitStmt.run(sessionData);
      } else if (existingSession.e === 0) {
        updateSessionStmt.run(sessionId, project.id);
        updateSessionGraphStmt.run(project.id, existingSession.ts);
      }

      if (!existingSessionIdx) {
        addSessionIdxStmt.run(sessionId, existingIssue.id);
        updateIssueSessStmt.run(existingIssue.id);
      }

      updateIssueStmt.run(eventData.ts, existingIssue.id);
    } else {
      const issueData: Omit<
      IssueInternal,
      'id' | 'event_c' | 'ignore' | 'done'
      > = {
        hash: fingerprintHash,
        project_id: project.id,
        ts_last: eventData.ts,
        ts_first: eventData.ts,
        sess_c: 1,
        name: eventData.data.name,
        message: eventData.data.message,
        uri: eventData.data.uri,
      };
      const issue_id = addIssueStmt.run(issueData).lastInsertRowid;

      eventData.issue_id = issue_id as number;

      if (!existingSession) {
        const sessionData: SessionInternal = {
          id: sessionId,
          project_id: project.id,
          ts: Math.trunc(eventData.ts / 1000),
          e: 1,
        };
        addSessionStmt.run(sessionData);
        addSessionGraphHitStmt.run(sessionData);
      } else if (existingSession.e === 0) {
        updateSessionStmt.run(sessionId, project.id);
        updateSessionGraphStmt.run(project.id, existingSession.ts);
      }

      addSessionIdxStmt.run(sessionId, issue_id);
    }

    // @ts-expect-error - data stored as string in DB
    eventData.data = JSON.stringify(eventData.data);

    addEventStmt.run(eventData);

    incrementDailyEvents();
  })();
}

// Browser report ingest
// - https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
// - https://developer.mozilla.org/en-US/docs/Web/API/Reporting_API
// - https://developers.google.com/web/updates/2018/09/reportingapi
// - Report types
//   - CSP violations
//   - Deprecations
//   - Browser interventions
//   - Feature Policy violations
//   - Network Error Logging (NEL)
//   - Crash reports
export const post: Middleware = (req, res, next) => {
  try {
    // eslint-disable-next-line prefer-destructuring
    const origin = req.headers.origin;

    if (!origin) {
      throw new AppError('Invalid origin', Status.FORBIDDEN);
    }

    // eslint-disable-next-line prefer-destructuring
    const key = req.params.key;

    if (key.length !== UID_SHORT_LENGTH || !/^[\da-z]+$/.test(key)) {
      throw new AppError('Invalid key', Status.FORBIDDEN);
    }

    const ip = getIpAddress(req);

    if (!ip || typeof ip !== 'string' || !isIP(ip)) {
      throw new AppError('Invalid IP', Status.BAD_REQUEST);
    }

    const ua = req.headers['user-agent'];

    if (
      !ua
      || typeof ua !== 'string'
      || ua.length > config.MAX_UA_CHARS
      || isNotASCII(ua)
    ) {
      throw new AppError('Invalid user agent', Status.BAD_REQUEST);
    }

    const contentType = req.headers['content-type'];
    let mimeType;

    if (!contentType || typeof contentType !== 'string') {
      throw new AppError('Invalid content type', Status.BAD_REQUEST);
    } else {
      // eslint-disable-next-line prefer-destructuring
      mimeType = contentType.split(';')[0];

      if (!VALID_MIME_TYPES.includes(mimeType)) {
        throw new AppError('Invalid content type', Status.UNPROCESSABLE_ENTITY);
      }
    }

    // Body added by the raw parser in packages/trackx-api/src/parser.ts
    let body = req.body as unknown;

    if (!body || typeof body !== 'string') {
      throw new AppError('Invalid body', Status.BAD_REQUEST);
    }
    try {
      body = JSON.parse(body);
    } catch {
      throw new AppError('Invalid body', Status.BAD_REQUEST);
    }
    if (typeof body !== 'object' || body === null) {
      throw new AppError('Invalid body', Status.BAD_REQUEST);
    }

    addReport(key, origin, ip, ua, mimeType, body);

    res.writeHead(Status.OK, {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: 0,
    });
    res.end('ok');
  } catch (error) {
    // DO NOT logger.error here otherwise it may cause an infinite loop
    logger.warn(error);
    void next(error || new Error(error));

    const projectKey = req.params.key;

    deniedEvent(
      projectKey.length === UID_SHORT_LENGTH && /^[\da-z]+$/.test(projectKey)
        ? projectKey
        : 'invalid',
    );
  }
};
