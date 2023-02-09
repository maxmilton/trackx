import send from '@polka/send';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import type { Middleware } from 'polka';
import { db, deniedDash } from '../../db';
import type {
  DBStats,
  DBStatsTable,
  ReqQueryData,
  Stats,
  TimeSeriesData,
} from '../../types';
import {
  AppError,
  config,
  humanizeFileSize,
  logger,
  sessions,
  Status,
} from '../../utils';

const getProjectCountStmt = db.prepare('SELECT COUNT(*) FROM project').pluck();
const getSessionCountStmt = db.prepare(`
  SELECT
    SUM(c) as session_c,
    SUM(e) as session_e_c
  FROM session_graph
`);
const getEventCountStmt = db.prepare('SELECT COUNT(*) FROM event').pluck();
const getIssueCountStmt = db.prepare(`
  SELECT
    COUNT(*) as issue_c,
    SUM(done) as issue_done_c,
    SUM(ignore) as issue_ignore_c
  FROM issue
`);
const getDailyEventsStmt = db
  .prepare('SELECT ts, c FROM daily_events WHERE ts > ?')
  .raw();
const getDailyPingsStmt = db
  .prepare('SELECT ts, c FROM daily_pings WHERE ts > ?')
  .raw();
const getDailyDashStmt = db
  .prepare('SELECT ts, c FROM daily_dash WHERE ts > ?')
  .raw();
const getDailyDeniedEventsStmt = db
  .prepare("SELECT ts, c FROM daily_denied WHERE ts > ? AND type = 'event'")
  .raw();
const getDailyDeniedPingsStmt = db
  .prepare("SELECT ts, c FROM daily_denied WHERE ts > ? AND type = 'ping'")
  .raw();
const getDailyDeniedDashStmt = db
  .prepare("SELECT ts, c FROM daily_denied WHERE ts > ? AND type = 'dash'")
  .raw();

const getAllStatsData = db.transaction((ts: number) => ({
  session: getSessionCountStmt.get(),
  issue: getIssueCountStmt.get(),
  event_c: getEventCountStmt.get(),
  project_c: getProjectCountStmt.get(),
  daily_events: getDailyEventsStmt.all(ts),
  daily_events_denied: getDailyDeniedEventsStmt.all(ts),
  daily_pings: getDailyPingsStmt.all(ts),
  daily_pings_denied: getDailyDeniedPingsStmt.all(ts),
  daily_dash: getDailyDashStmt.all(ts),
  daily_dash_denied: getDailyDeniedDashStmt.all(ts),
}));

function remapGraphData(
  rows: [number, number][],
  rows2: [number, number][],
): TimeSeriesData {
  const date = new Date();
  const steps = 30; // days, including today
  const offset = 86_400; // seconds in 1 day; 60s * 60m * 24h
  const rowsMap = Object.fromEntries(rows);
  const rows2Map: Record<number, number> = {};
  const time = [];
  const series1 = [];
  const series2 = [];

  for (const row of rows2) {
    const val = rows2Map[row[0]];
    rows2Map[row[0]] = val ? val + row[1] : row[1];
  }

  date.setUTCDate(date.getUTCDate() - (steps - 1));
  date.setUTCHours(0, 0, 0, 0);
  const ts0 = Math.trunc(date.getTime() / 1000);

  for (let index = 0; index < steps; index++) {
    const ts = ts0 + index * offset;
    time.push(ts);
    series1.push(rowsMap[ts] || 0);
    series2.push(rows2Map[ts] || null);
  }

  return [time, series1, series2];
}

function averageCount(counts: number[]): number {
  return Math.trunc(counts.reduce((a, b) => a + b, 0) / counts.length);
}

function getStats(): Partial<Stats> {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0); // start of today; 12:00am
  date.setUTCDate(date.getUTCDate() - 30); // 30 days ago
  const ts = date.getTime() / 1000;

  const data = getAllStatsData(ts);
  const daily_events = remapGraphData(
    data.daily_events,
    data.daily_events_denied,
  );
  const daily_pings = remapGraphData(data.daily_pings, data.daily_pings_denied);
  const daily_dash = remapGraphData(data.daily_dash, data.daily_dash_denied);

  return {
    session_c: data.session.session_c || 0,
    session_e_c: data.session.session_e_c || 0,
    event_c: data.event_c || 0,
    issue_c: data.issue.issue_c || 0,
    issue_done_c: data.issue.issue_done_c || 0,
    issue_ignore_c: data.issue.issue_ignore_c || 0,
    project_c: data.project_c || 0,
    ping_c_30d_avg: averageCount(daily_pings[1] as number[]),
    event_c_30d_avg: averageCount(daily_events[1] as number[]),
    dash_c_30d_avg: averageCount(daily_dash[1] as number[]),
    daily_events,
    daily_pings,
    daily_dash,
  };
}

function execCmd(cmd: string, args?: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (error, stdout, stderr) => {
      if (error || stderr) {
        reject(error || stderr);
      }
      resolve(stdout);
    });
  });
}

const tablePercent = (table: number, total: number) => `${((table / total) * 100).toFixed(2)}%`;

const humanizeSize = (stats: fs.Stats) => humanizeFileSize(stats.size);

const DB_STATS_QUERY = 'SELECT name, SUM(pgsize) AS size FROM dbstat GROUP BY name;';

async function getTableSizes() {
  try {
    // Because the better-sqlite3 npm module doesn't have the compile-time
    // SQLITE_ENABLE_DBSTAT_VTAB option enabled, to get table size data we need
    // to use the system sqlite3 CLI client which does support DBSTAT
    const output = await execCmd('/usr/bin/sqlite3', [
      '-safe',
      '-readonly',
      '-json',
      '-noheader',
      '-nullvalue',
      '0',
      '-cmd',
      '.eqp off',
      config.DB_PATH,
      DB_STATS_QUERY,
    ]);

    const data = (JSON.parse(output) as { name: string; size: number }[]).sort(
      (a, b) => b.size - a.size,
    );
    const total = data.reduce((acc, row) => acc + row.size, 0);

    for (const row of data) {
      // FIXME: Better types rather than casting to unknown
      (row as unknown as DBStatsTable).percent = tablePercent(row.size, total);
      (row as unknown as DBStatsTable).size = humanizeFileSize(row.size);
    }

    return data as unknown as DBStatsTable[];
  } catch (error) {
    logger.error(error);
    return [];
  }
}

export const get: Middleware = async (req, res, next) => {
  try {
    const { type, ...restQuery } = req.query as ReqQueryData;

    if (Object.keys(restQuery).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    if (type !== undefined) {
      if (type !== 'db') {
        throw new AppError('Invalid type param', Status.UNPROCESSABLE_ENTITY);
      }
    }

    let data;

    if (type === 'db' && config.ENABLE_DB_TABLE_STATS) {
      // TODO: Consider moving DB table stats to trackx-cli

      // FIXME: Generating DB table stats is slow in general and extremely slow
      // on systems with slower storage devices
      //  ↳ https://github.com/maxmilton/trackx/issues/158

      const t0 = performance.now();
      data = {} as DBStats;
      data.db_tables = await getTableSizes();
      const t1 = performance.now();
      const [dbFileSize, dbWalFileSize] = await Promise.all([
        fs.promises.stat(config.DB_PATH).then(humanizeSize),
        fs.promises.stat(`${config.DB_PATH}-wal`).then(humanizeSize),
      ]);
      data.db_size = dbFileSize;
      data.db_size_wal = dbWalFileSize;
      const t2 = performance.now();
      res.setHeader(
        'Server-Timing',
        `db;dur=${Math.round(t1 - t0)},fs;dur=${(t2 - t1).toFixed(2)}`,
      );
    } else {
      const dbFile = fs.promises.stat(config.DB_PATH);
      const dbWalFile = fs.promises.stat(`${config.DB_PATH}-wal`);
      data = getStats();
      data.dash_session_c = sessions.size;
      data.api_v = process.env.APP_RELEASE!;
      data.api_uptime = Math.floor(process.uptime());
      // eslint-disable-next-line unicorn/no-await-expression-member
      data.db_size = humanizeFileSize((await dbFile).size + (await dbWalFile).size);
    }

    send(res, Status.OK, data);
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
