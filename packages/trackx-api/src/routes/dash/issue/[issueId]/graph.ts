import send from '@polka/send';
import type { Middleware } from 'polka';
import { db, deniedDash } from '../../../../db';
import type { ReqQueryData, TimeSeriesData } from '../../../../types';
import {
  AppError,
  logger,
  SECONDS_IN_DAY,
  SECONDS_IN_HOUR,
  Status,
} from '../../../../utils';

// Note that event (and issue) timestamps are in milliseconds not seconds like
// all other timestamps in the database
const getEventGarphHourlyStmt = db
  .prepare(
    `
  SELECT
    (ts / ${SECONDS_IN_HOUR * 1000}) * ${SECONDS_IN_HOUR},
    COUNT(*)
  FROM event
  WHERE issue_id = ? AND ts >= ?
  GROUP BY ts / ${SECONDS_IN_HOUR * 1000}
`,
  )
  .raw();
const getEventGraphDailyStmt = db
  .prepare(
    `
  SELECT
    (ts / ${SECONDS_IN_DAY * 1000}) * ${SECONDS_IN_DAY},
    COUNT(*)
  FROM event
  WHERE issue_id = ? AND ts >= ?
  GROUP BY ts / ${SECONDS_IN_DAY * 1000}
`,
  )
  .raw();

function getEventGraph(
  issue_id: string,
  period: '24h' | '30d',
): TimeSeriesData {
  const date = new Date();
  let steps;
  let offset;
  let stmt;

  switch (period) {
    case '24h':
      steps = 24; // 24 hours, including current hour
      offset = SECONDS_IN_HOUR;
      stmt = getEventGarphHourlyStmt;
      date.setUTCHours(date.getUTCHours() - (steps - 1));
      date.setUTCMinutes(0, 0, 0);
      break;
    case '30d':
      steps = 30; // 30 days, including today
      offset = SECONDS_IN_DAY;
      stmt = getEventGraphDailyStmt;
      date.setUTCDate(date.getUTCDate() - (steps - 1));
      date.setUTCHours(0, 0, 0, 0);
      break;
    default:
      throw new AppError('Invalid period');
  }

  const ts0 = date.getTime();
  const start = Math.trunc(ts0 / 1000);
  const rows = stmt.all(issue_id, ts0);
  const rowsMap = Object.fromEntries(rows);
  const time = [];
  const series = [];

  for (let index = 0; index < steps; index++) {
    const ts = start + index * offset;
    time.push(ts);
    series.push(rowsMap[ts] || 0);
  }

  return [time, series];
}

export const get: Middleware = (req, res, next) => {
  try {
    const { issueId } = req.params;

    if (issueId.length > 9 || !Number.isInteger(+issueId) || +issueId < 1) {
      throw new AppError('Invalid id', Status.UNPROCESSABLE_ENTITY);
    }

    const { period, ...rest } = req.query as ReqQueryData;

    if (Object.keys(rest).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    if (
      !period
      || typeof period !== 'string'
      || (period !== '24h' && period !== '30d')
    ) {
      throw new AppError('Invalid period', Status.UNPROCESSABLE_ENTITY);
    }

    const data = getEventGraph(issueId, period);
    send(res, Status.OK, data);
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
