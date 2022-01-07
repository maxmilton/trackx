import send from '@polka/send';
import type { Statement } from 'better-sqlite3';
import type { Middleware } from 'polka';
import { db, deniedDash, getProjectByNameStmt } from '../../../../db';
import type {
  ProjectInternal,
  ReqQueryData,
  SessionsCount,
  SessionsData,
} from '../../../../types';
import {
  AppError,
  logger,
  SECONDS_IN_DAY,
  SECONDS_IN_HOUR,
  Status,
} from '../../../../utils';

const SESSION_PERIOD_VALUES = ['day', '7d', '30d', 'month', '6mo', '12mo'];

// Sessions are pre-aggregated by hour in session_graph (also note that session
// timestamps are in seconds not milliseconds like events and issues!)
const getSessionGraphHourlyStmt = db
  .prepare(
    'SELECT ts, c, e FROM session_graph WHERE project_id = ? AND (ts BETWEEN ? AND ?)',
  )
  .raw();
const getSessionGraphDailyStmt = db
  .prepare(
    `
  SELECT
    (ts / ${SECONDS_IN_DAY}) * ${SECONDS_IN_DAY},
    SUM(c),
    SUM(e)
  FROM session_graph
  WHERE project_id = ?
    AND (ts BETWEEN ? AND ?)
  GROUP BY ts / ${SECONDS_IN_DAY}
`,
  )
  .raw();
const getSessionGraphMonthlyStmt = db
  .prepare(
    `
  SELECT
    strftime('%s', strftime('%Y-%m-01', ts, 'unixepoch')),
    SUM(c),
    SUM(e)
  FROM session_graph
  WHERE project_id = ?
    AND (ts BETWEEN ? AND ?)
  GROUP BY strftime('%Y%m', ts, 'unixepoch')
`,
  )
  .raw();
const getSessionTotalStmt = db
  .prepare(
    'SELECT SUM(c), SUM(e) FROM session_graph WHERE project_id = ? AND (ts BETWEEN ? AND ?)',
  )
  .raw();

function getSessionsData(
  projectName: string,
  period: string,
  dateInput: string | undefined,
): SessionsData {
  const project = getProjectByNameStmt.get(projectName) as
    | ProjectInternal
    | undefined;

  if (!project) {
    throw new AppError('Project not found', Status.NOT_FOUND);
  }

  let date: Date;
  let steps: number;
  let offset: number;
  let stmt: Statement;
  let getTime: (end: boolean) => number;

  switch (period) {
    case 'day': {
      const dateParts = dateInput!.split('-');
      date = new Date(
        Date.UTC(+dateParts[0], +dateParts[1] - 1, +dateParts[2]),
      );
      steps = 24; // hours
      offset = SECONDS_IN_HOUR;
      stmt = getSessionGraphHourlyStmt;
      getTime = (end) => new Date(date).setUTCHours(date.getUTCHours() + (end ? steps : -steps));
      break;
    }
    case '7d':
      date = new Date();
      steps = 7; // days
      offset = SECONDS_IN_DAY;
      stmt = getSessionGraphDailyStmt;
      date.setUTCDate(date.getUTCDate() - (steps - 1));
      date.setUTCHours(0, 0, 0, 0);
      getTime = (end) => new Date(date).setUTCDate(date.getUTCDate() + (end ? steps : -steps));
      break;
    case '30d':
      date = new Date();
      steps = 30; // days
      offset = SECONDS_IN_DAY;
      stmt = getSessionGraphDailyStmt;
      date.setUTCDate(date.getUTCDate() - (steps - 1));
      date.setUTCHours(0, 0, 0, 0);
      getTime = (end) => new Date(date).setUTCDate(date.getUTCDate() + (end ? steps : -steps));
      break;
    case 'month': {
      const dateParts = dateInput!.split('-');
      // Month in Date.UTC is 0-based but by setting the day to 0 we get the
      // last day of the previous month
      date = new Date(Date.UTC(+dateParts[0], +dateParts[1], 0));
      steps = date.getUTCDate(); // number of days in the month
      offset = SECONDS_IN_DAY;
      stmt = getSessionGraphDailyStmt;
      date.setUTCDate(date.getUTCDate() - (steps - 1));
      getTime = (end) => new Date(date).setUTCMonth(date.getUTCMonth() + (end ? 1 : -1));
      break;
    }
    case '6mo': {
      const dateParts = new Date().toISOString().split('-');
      date = new Date(Date.UTC(+dateParts[0], +dateParts[1], 0));
      const dateEnd = date.getTime();
      date.setUTCMonth(date.getUTCMonth() - 5);
      date.setUTCDate(1);
      steps = 6; // months
      stmt = getSessionGraphMonthlyStmt;
      getTime = (end) => (end ? dateEnd : date.setUTCMonth(date.getUTCMonth() - 6));
      break;
    }
    case '12mo': {
      const dateParts = new Date().toISOString().split('-');
      date = new Date(Date.UTC(+dateParts[0], +dateParts[1], 0));
      const dateEnd = date.getTime();
      date.setUTCMonth(date.getUTCMonth() - 11);
      date.setUTCDate(1);
      steps = 12; // months
      stmt = getSessionGraphMonthlyStmt;
      getTime = (end) => (end ? dateEnd : date.setUTCMonth(date.getUTCMonth() - 12));
      break;
    }
    default:
      throw new AppError('Invalid period');
  }

  const start = Math.trunc(date.getTime() / 1000);
  const end = Math.trunc(getTime(true) / 1000) - 1;
  const prev = Math.trunc(getTime(false) / 1000);

  return db.transaction(() => {
    const rows = stmt.all(project.id, start, end);
    const rowsMap: Record<string, [number, number]> = {};
    const time: number[] = [];
    const series1: number[] = [];
    const series2: number[] = [];

    // eslint-disable-next-line unicorn/no-for-loop
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      rowsMap[row[0]] = [row[1], row[2]];
    }

    // Months have a variable number of days, so they're handled separately
    if (period === '6mo' || period === '12mo') {
      const startMs = start * 1000;

      for (let index = 0; index < steps; index++) {
        const next = new Date(startMs);
        next.setUTCMonth(next.getUTCMonth() + index);
        const ts = next.getTime() / 1000;
        const entry = rowsMap[ts];
        time.push(ts);

        if (entry) {
          series1.push(entry[0]);
          series2.push(entry[1]);
        } else {
          series1.push(0);
          series2.push(0);
        }
      }
    } else {
      for (let index = 0; index < steps; index++) {
        const ts = start + index * offset;
        const entry = rowsMap[ts];
        time.push(ts);

        if (entry) {
          series1.push(entry[0]);
          series2.push(entry[1]);
        } else {
          series1.push(0);
          series2.push(0);
        }
      }
    }

    const currentPeriod = getSessionTotalStmt.get(project.id, start, end);
    const previousPeriod = getSessionTotalStmt.get(project.id, prev, start - 1);

    return {
      graph: [time, series1, series2] as [number[], number[], number[]],
      period: [currentPeriod, previousPeriod] as [SessionsCount, SessionsCount],
    };
  })();
}

export const get: Middleware = (req, res, next) => {
  try {
    const { name } = req.params;

    if (name.length > 40 || !/^[\d_a-z-]+$/.test(name)) {
      throw new AppError('Invalid name', Status.UNPROCESSABLE_ENTITY);
    }

    const { period, date, ...rest } = req.query as ReqQueryData;

    if (Object.keys(rest).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    if (
      !period
      || typeof period !== 'string'
      || !SESSION_PERIOD_VALUES.includes(period)
    ) {
      throw new AppError('Invalid period', Status.UNPROCESSABLE_ENTITY);
    }

    if (date !== undefined) {
      if (
        typeof date !== 'string'
        || (period === 'month' && date.length !== 7) // 2021-11
        || (period === 'day' && date.length !== 10) // 2021-11-27
        || !Date.parse(date)
      ) {
        throw new AppError('Invalid date', Status.UNPROCESSABLE_ENTITY);
      }
    }

    const data = getSessionsData(name, period, date);
    send(res, Status.OK, data);
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
