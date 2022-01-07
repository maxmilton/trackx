import send from '@polka/send';
import type { Middleware } from 'polka';
import { db, deniedDash } from '../../db';
import type {
  EventPerfLog,
  Logs,
  ReqBodyData,
  ReqQueryData,
} from '../../types';
import { AppError, logger, Status } from '../../utils';

const getDeniedEventsStmt = db
  .prepare(
    `
  SELECT date(ts, 'unixepoch'), key, c
  FROM daily_denied
  WHERE type = 'event'
  ORDER BY ts DESC
`,
  )
  .raw();
const getDeniedPingsStmt = db
  .prepare(
    `
  SELECT date(ts, 'unixepoch'), key, c
  FROM daily_denied
  WHERE type = 'ping'
  ORDER BY ts DESC
`,
  )
  .raw();
const getDeniedDashReqsStmt = db
  .prepare(
    `
  SELECT date(ts, 'unixepoch'), c
  FROM daily_denied
  WHERE type = 'dash'
  ORDER BY ts DESC
`,
  )
  .raw();

// FIXME: Remove; temp for development of event ingest pipeline
const getEventPerformanceStmt = db
  .prepare("SELECT k, v FROM meta WHERE k LIKE 'perf-event-%'")
  .raw();

// FIXME: Remove; temp for development of event ingest pipeline
function perfLogRowMapper(row: [k: string, v: string]): EventPerfLog {
  const parts = row[1].split(',');
  return [
    row[0].split('-')[2],
    `${parts[0]} ms`,
    `${(+parts[0] - +parts[1]).toFixed(2)} ms`,
    `${parts[1]} ms`,
    parts[2],
    parts[3],
  ];
}

function getLogs(): Logs {
  return db.transaction(() => ({
    denied_event: getDeniedEventsStmt.all(),
    denied_ping: getDeniedPingsStmt.all(),
    denied_dash: getDeniedDashReqsStmt.all(),
    // FIXME: Remove; temp for development of event ingest pipeline
    perf_event: getEventPerformanceStmt
      .all()
      .map(perfLogRowMapper)
      .sort((a, b) => +b[0] - +a[0]),
  }))();
}

export const get: Middleware = (req, res, next) => {
  try {
    const query = req.query as ReqQueryData;

    if (Object.keys(query).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    const data = getLogs();
    send(res, Status.OK, data);
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};

// TODO: Remove; temporary
const getIssueIdFromEventIdStmt = db
  .prepare('SELECT issue_id FROM event WHERE id = ?')
  .pluck();

// TODO: Remove; temporary
export const post: Middleware = (req, res, next) => {
  try {
    const { type, ...qRest } = req.query as ReqQueryData;
    const { eventId, ...bRest } = req.body as ReqBodyData;

    if (Object.keys(qRest).length > 0 || Object.keys(bRest).length > 0) {
      throw new AppError('Unexpected data', Status.BAD_REQUEST);
    }

    if (!type || typeof type !== 'string' || type !== 'issue-from-event') {
      throw new AppError('Invalid type', Status.UNPROCESSABLE_ENTITY);
    }

    if (!eventId || typeof eventId !== 'number') {
      throw new AppError('Invalid event ID', Status.UNPROCESSABLE_ENTITY);
    }

    const issueId = getIssueIdFromEventIdStmt.get(+eventId);
    const data = JSON.stringify(issueId);
    send(res, Status.OK, data);
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
