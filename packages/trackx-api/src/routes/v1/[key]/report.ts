// TODO: Add per-project filter support (to combat excessive false positives,
// especially for CSP reports)
//  ↳ Would probably also be useful for events
//  ↳ A similar deny-list would be useful for pings too
//  ↳ Should there be a default filter? Maybe as an option?
//  ↳ Filter out browser extensions
//    ↳ chrome-extension:// (Chromium)
//    ↳ moz-extension:// (Firefox)
//    ↳ extension:// (Edge)
//  ↳ Should the events be completely ignored or just marked as filtered?

// TODO: Better fingerprinting for smarter grouping

import { isIP } from 'net';
import type { Middleware } from 'polka';
import { EventType } from 'trackx/types';
import type UAParser from 'ua-parser-js';
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
  COEPReport,
  COOPReport,
  CrashReport,
  CSPReport,
  DeprecatedCSPReport,
  DeprecationReport,
  DocumentPolicyReport,
  EventInternal,
  ExpectCTReport,
  InterventionReport,
  IssueInternal,
  NetworkErrorReport,
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
  'application/json',
  'text/plain',
];

function addReport(
  project_id: number,
  project_key: string,
  origin: string,
  ip: string,
  ua: string,
  reportType: string,
  rawBody: object,
  uaBrowser: UAParser.IBrowser,
  uaOS: UAParser.IOS,
) {
  // TODO: Extract only the relevant data from the payload and discard the
  // rest, especially that which may contain PII e.g., user-agent

  // TODO: Regardless of report type, validate the data before saving to DB

  let type;
  let body;
  let name;
  let message;
  let uri;
  /** The unique and reproducible data used to group similar events together. */
  let fingerprintSegments = '';

  switch (reportType) {
    // Reporting API v0 and v1
    // https://web.dev/reporting-api/#use-cases-and-report-types
    case 'coep':
      type = EventType.COEPReport;
      body = rawBody as COEPReport;
      name = 'COEP Violation';
      uri = body.url;
      fingerprintSegments += `${body.body.type}:${body.body.blockedURL}:${body.body.destination}`;
      break;
    case 'coop':
      type = EventType.COOPReport;
      body = rawBody as COOPReport;
      name = 'COOP Violation';
      uri = body.url;
      fingerprintSegments += `${body.body.type}:${body.body.effectivePolicy}:${body.body.property}:${body.body.sourceFile}:${body.body.lineNumber}:${body.body.columnNumber}`;
      break;
    case 'crash':
      type = EventType.CrashReport;
      body = rawBody as CrashReport;
      name = 'Browser Crash';
      message = body.body.reason;
      uri = body.url;
      fingerprintSegments += `${uri}:${body.body.reason}`;
      break;
    case 'csp-violation':
      type = EventType.CSPReport;
      body = rawBody as CSPReport;
      name = 'CSP Violation';
      message = `${body.body.effectiveDirective} directive blocked ${
        body.body.blockedURL || body.body.blockedURI
      }`;
      uri = body.url;
      // TODO: Fix grouping; Firefox modifies the originalPolicy value and has
      // a different columnNumber leading to a different fingerprint
      //  ↳ Will we need to normalise the CSP policy?
      fingerprintSegments += `${body.body.effectiveDirective}:${
        body.body.blockedURI || body.body.blockedURL
      }:${body.body.sourceFile}:${body.body.lineNumber}:${
        body.body.columnNumber
      }`;
      break;
    case 'deprecation':
      type = EventType.DeprecationReport;
      body = rawBody as DeprecationReport;
      name = 'Browser Deprecation';
      message = body.body.message;
      uri = body.url;
      fingerprintSegments += `${body.body.id}:${body.body.sourceFile}:${body.body.lineNumber}:${body.body.columnNumber}`;
      break;
    case 'document-policy-violation':
      type = EventType.DocumentPolicyReport;
      body = rawBody as DocumentPolicyReport;
      name = 'Document Policy Violation';
      message = body.body.message;
      uri = body.url;
      fingerprintSegments += `${body.body.policyId}:${body.body.sourceFile}:${body.body.lineNumber}:${body.body.columnNumber}`;
      break;
    case 'intervention':
      type = EventType.InterventionReport;
      body = rawBody as InterventionReport;
      name = 'Browser Intervention';
      message = body.body.message;
      uri = body.url;
      fingerprintSegments += `${body.body.id}:${body.body.sourceFile}:${body.body.lineNumber}:${body.body.columnNumber}`;
      break;
    case 'network-error':
      type = EventType.NELReport;
      body = rawBody as NetworkErrorReport;
      uri = body.url;
      name = 'Network Error';
      message = `${body.body.type} for ${body.body.method} ${
        body.body.url || body.body.referrer
      }`;
      fingerprintSegments += `${body.body.type}:${body.body.phase}:${
        body.body.method
      }:${body.body.status_code}:${body.body.url || body.body.referrer}`;
      break;
    // Chrome may send reports with Content-Type text/plain, so it's safest to
    // handle these reports in a generic way rather than rely on Content-Type
    default:
      // Content Security Policy Level 2 and 3 Reports
      // https://www.w3.org/TR/CSP2/
      // https://www.w3.org/TR/CSP3/
      // @ts-expect-error - FIXME:!
      if (rawBody['csp-report']) {
        type = EventType.CSPReport;
        body = (rawBody as DeprecatedCSPReport)['csp-report'];
        uri = body['document-uri'];
        name = 'CSP Violation';
        message = `${
          body['effective-directive'] || body['violated-directive']
        } directive blocked ${body['blocked-uri']}`;
        // TODO: Fix grouping; Firefox modifies the original-policy value and
        // has a different column-number leading to a different fingerprint
        //  ↳ Will we need to normalise the CSP policy?
        fingerprintSegments += `${
          body['effective-directive'] || body['violated-directive']
        }:${body['blocked-uri']}:${body['source-file']}:${
          body['line-number']
        }:${body['column-number']}`;
        // Certificate Transparency Reports
        // https://datatracker.ietf.org/doc/draft-ietf-httpbis-expect-ct/
        // @ts-expect-error - FIXME:!
      } else if (rawBody['expect-ct-report']) {
        type = EventType.CTReport;
        body = (rawBody as ExpectCTReport)['expect-ct-report'];
        uri = `${body.scheme || 'https'}://${body.hostname || body.host}:${
          body.port
        }`;
        name = 'Expect-CT Violation';
        // TODO: Set message to something meaningful
        // message = '';
        fingerprintSegments += `${uri}:${body['served-certificate-chain']}:${body['validated-certificate-chain']}`;
      } else {
        // TODO: Should there be a per-project option to reject unknown reports?

        type = EventType.UnknownReport;
        body = rawBody;
        // @ts-expect-error - FIXME:!
        uri = body.url || body['document-uri'] || body.document_uri;
      }
      break;
  }

  const eventData: Omit<EventInternal, 'id'> = {
    project_id,
    // @ts-expect-error - set later
    issue_id: undefined,
    // @ts-expect-error - FIXME:!
    ts: Date.now() - (body.age || 0),
    type,
    data: {
      name,
      message,
      uri,
      os: uaOS.name,
      os_v: uaOS.version,
      agent: uaBrowser.name,
      agent_v: uaBrowser.version,
      // @ts-expect-error - FIXME:!
      meta: body.body || body || {}, // TODO: Better storage/presentation of data?
    },
  };

  const payloadBytes = byteSize(eventData);

  if (payloadBytes > config.MAX_EVENT_BYTES) {
    logger.warn('Event size exceeds byte limit', payloadBytes);
    deniedEvent(project_key);
    return;
  }

  const fingerprint = `${eventData.project_id}:${eventData.type}:${
    // @ts-expect-error - FIXME:!
    fingerprintSegments || JSON.stringify(body.body || body || uri)
  }`;
  const fingerprintHash = hash(Buffer.from(fingerprint));

  db.transaction(() => {
    const existingIssue = matchingIssueHashStmt.get(fingerprintHash);

    if (existingIssue?.ignore) return;

    const salt = getDailySalt();
    const sessionId = hash(Buffer.from(salt + origin + ip + ua));
    const existingSession = existingSessionStmt.get(sessionId, project_id);

    if (existingIssue) {
      eventData.issue_id = existingIssue.id;

      const existingSessionIdx = existingSessionIdxStmt.get(
        sessionId,
        eventData.issue_id,
      );

      if (!existingSession) {
        const sessionData: SessionInternal = {
          id: sessionId,
          project_id,
          ts: Math.trunc(eventData.ts / 1000),
          e: 1,
        };
        addSessionStmt.run(sessionData);
        addSessionGraphHitStmt.run(sessionData);
      } else if (existingSession.e === 0) {
        updateSessionStmt.run(sessionId, project_id);
        updateSessionGraphStmt.run(project_id, existingSession.ts);
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
        project_id,
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
          project_id,
          ts: Math.trunc(eventData.ts / 1000),
          e: 1,
        };
        addSessionStmt.run(sessionData);
        addSessionGraphHitStmt.run(sessionData);
      } else if (existingSession.e === 0) {
        updateSessionStmt.run(sessionId, project_id);
        updateSessionGraphStmt.run(project_id, existingSession.ts);
      }

      addSessionIdxStmt.run(sessionId, issue_id);
    }

    // @ts-expect-error - data stored as string in DB
    eventData.data = JSON.stringify(eventData.data);

    addEventStmt.run(eventData);
    incrementDailyEvents();
  })();
}

function prepareReports(
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

  const parser = uaParser.setUA(ua);
  const uaBrowser = parser.getBrowser();
  const uaOS = parser.getOS();

  if (mimeType === 'application/reports+json') {
    // TODO: Are Report API V0 and V1 bodies ever not an array?
    if (Array.isArray(body)) {
      for (const report of body) {
        // TODO: Better validation of individual reports

        if (report.age !== undefined) {
          if (
            typeof report.age !== 'number'
            || report.age < 0
            || report.age > 2_880_000 // 2 days * 24 hours * 60 minutes * 1000 ms
          ) {
            // FIXME:!
            // eslint-disable-next-line no-continue
            continue;
          }
        }

        if (typeof report.type !== 'string' || typeof report.url !== 'string') {
          // FIXME:!
          // eslint-disable-next-line no-continue
          continue;
        }

        addReport(
          project.id,
          key,
          origin,
          ip,
          ua,
          report.type,
          report,
          uaBrowser,
          uaOS,
        );
      }
    } else {
      throw new AppError('Invalid body', Status.BAD_REQUEST);
    }
  } else {
    addReport(
      project.id,
      key,
      origin,
      ip,
      ua,
      // @ts-expect-error - FIXME:!
      body.type || mimeType,
      body,
      uaBrowser,
      uaOS,
    );
  }
}

export const post: Middleware = (req, res, next) => {
  try {
    // FIXME: Looks like reports with Content-Type: application/reports+json are
    // not sent with an Origin or Referer header, although they do send a CORS
    // preflight OPTIONS request with an Origin. Perhaps because they can send
    // multiple reports in one request?
    //  ↳ Do we need to derive the origin from each report's URL?
    //  ↳ Report API V0 may send reports from multiple origins in one request!!
    //  ↳ Report API V1 will not send reports from multiple origins together.

    // eslint-disable-next-line prefer-destructuring
    let origin = req.headers.origin;

    if (!origin) {
      // FIXME: Temp workaround for reports with no Origin header
      if (
        !(
          req.headers['content-type'] === 'application/reports+json'
          && req.body[0] === '['
        )
      ) {
        throw new AppError('Invalid origin', Status.FORBIDDEN);
      }
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

    // FIXME: Temp workaround for reports with no Origin header
    if (!origin && Array.isArray(body)) {
      origin = new URL(body[0].url).origin;
    }
    if (!origin) {
      throw new AppError('Invalid origin', Status.FORBIDDEN);
    }

    prepareReports(key, origin, ip, ua, mimeType, body);

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
