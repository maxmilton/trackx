import send from '@polka/send';
import type { Middleware } from 'polka';
import { db, deniedDash } from '../../db';
import type { Logs, ReqQueryData } from '../../types';
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

function getLogs(): Logs {
  return db.transaction(() => ({
    denied_event: getDeniedEventsStmt.all(),
    denied_ping: getDeniedPingsStmt.all(),
    denied_dash: getDeniedDashReqsStmt.all(),
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
