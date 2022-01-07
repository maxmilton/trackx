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
import type { RawBodyRequest } from '../../../parser';
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

interface IncomingReportData {
  name: string;
  meta: {
    body: any;
    headers: any;
    params: any;
  };
}

function addReport(
  key: string,
  origin: string,
  ip: string,
  ua: string,
  contentType: string,
  payload: IncomingReportData,
) {
  const project = getProjectByKeyStmt.get(key) as ProjectInternal | undefined;

  if (!project) {
    throw new AppError('Invalid key', Status.FORBIDDEN);
  }

  if (!project.origin.split(',').includes(origin) && project.origin !== '*') {
    throw new AppError('Invalid origin', Status.FORBIDDEN);
  }

  // FIXME: Extract only the relevant data from the payload
  //  ↳ REF: https://report-uri.com

  // TODO: Regardless of report type, validate the data before saving to DB

  // XXX: REF: https://web.dev/reporting-api/

  // TODO: Extract the relevant data points e.g., name, message, uri
  switch (contentType) {
    // Reporting API v1
    case 'application/reports+json':
      // - Single report per payload
      // - May be one of many different types of report
      // - Data structure differs depending on report type
      break;
    // CSP Level 2 Reports
    case 'application/csp-report':
      // - Can contain multiple reports per payload
      // - Standardised report data structure
      break;
    // Certificate Transparency Reports
    case 'application/expect-ct-report+json':
      // TODO: Need more research!
      break;
    // TODO: Apparenently some older browsers use 'application/json' for CSP reports
    case 'application/json':
      break;
    default:
      // TODO: Need to determine if there's an actual report in the body or
      // else reject the request
      break;
  }

  const parser = uaParser.setUA(ua);
  const uaBrowser = parser.getBrowser();
  const uaOs = parser.getOS();

  const eventData: Omit<EventInternal, 'id'> = {
    project_id: project.id,
    // @ts-expect-error - set later
    issue_id: undefined,
    ts: Date.now(),
    // FIXME: Can one payload contain multiple reports? Will we need to multiplex?
    type: payload.meta.body?.['csp-report']
      ? EventType.CSPReport
      : EventType.UnknownReport,
    data: {
      name: payload.name,
      message: undefined,
      uri: undefined,
      os: uaOs.name,
      os_v: uaOs.version,
      agent: uaBrowser.name,
      agent_v: uaBrowser.version,
      meta: payload.meta,
    },
  };

  // TODO: TEMP; remove, improve, or clean up
  const uri = payload.meta.body?.['csp-report']?.['document-uri'];
  eventData.data.uri = uri;

  const payloadBytes = byteSize(eventData);

  if (payloadBytes > config.MAX_EVENT_BYTES) {
    logger.warn('Event size exceeds byte limit', payloadBytes);
    deniedEvent(key);
    return;
  }

  // FIXME:!
  const fingerprint = `${eventData.project_id}:${eventData.type}:${
    eventData.data.name
  }:${eventData.data.message}:${JSON.stringify(payload.meta.body)}`;
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
export const post: Middleware = (req: RawBodyRequest, res, next) => {
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

    let body = req.rawbody;

    if (!body || typeof body !== 'string') {
      throw new AppError('Invalid body', Status.BAD_REQUEST); // UNPROCESSABLE_ENTITY
    } else {
      try {
        body = JSON.parse(body);
      } catch {
        /* No op */
      }
    }

    const ip = getIpAddress(req);

    if (!ip || typeof ip !== 'string' || !isIP(ip)) {
      throw new AppError('Invalid IP', Status.BAD_REQUEST);
    }

    const ua = req.headers['sec-ch-ua'] || req.headers['user-agent'];

    if (
      !ua
      || typeof ua !== 'string'
      || ua.length > config.MAX_UA_CHARS
      || isNotASCII(ua)
    ) {
      throw new AppError('Invalid user agent', Status.BAD_REQUEST);
    }

    const contentType = req.headers['content-type'];

    if (!contentType || typeof contentType !== 'string') {
      throw new AppError('Invalid content type', Status.BAD_REQUEST);
    }

    // XXX: While we're getting a grasp for how browser reports work, we're
    // simply saving a bunch of data for analysis

    addReport(key, origin, ip, ua, contentType, {
      name: 'Browser Report', // FIXME:!
      meta: {
        // FIXME: REMOVE; FOR EARLY TESTING ONLY, may contain PII so this
        // must not be included in public releases!!
        body,
        // FIXME: REMOVE; FOR EARLY TESTING ONLY, may contain PII so this
        // must not be included in public releases!!
        headers: req.headers,
        // FIXME: REMOVE; FOR EARLY TESTING ONLY, may contain PII so this
        // must not be included in public releases!!
        params: req.query,
      },
    });

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
