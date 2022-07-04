import send from '@polka/send';
import { execFile } from 'child_process';
import fs from 'fs';
import type { Middleware } from 'polka';
import { db, deniedDash } from '../../db';
import type {
  ReqQueryData,
  Stats,
  StatsDBTableInfo,
  TimeSeriesData,
} from '../../types';
import {
  AppError,
  config,
  humanizeFileSize,
  humanizeTime,
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
const getDailyDeniedEvents = db
  .prepare("SELECT ts, c FROM daily_denied WHERE ts > ? AND type = 'event'")
  .raw();
const getDailyDeniedPings = db
  .prepare("SELECT ts, c FROM daily_denied WHERE ts > ? AND type = 'ping'")
  .raw();

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

  for (let index = 0; index < steps; index++) {
    const ts = date.getTime() / 1000 + index * offset;
    time.push(Math.trunc(ts));
    series1.push(rowsMap[ts] || 0);
    series2.push(rows2Map[ts] || null);
  }

  return [time, series1, series2];
}

function avgCount(counts: number[]): number {
  return Math.trunc(counts.reduce((a, b) => a + b, 0) / counts.length);
}

function getStats(): Partial<Stats> {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0); // start of today; 12:00am
  date.setUTCDate(date.getUTCDate() - 30); // 30 days ago
  const ts = date.getTime() / 1000;

  return db.transaction(() => {
    const sessionData = getSessionCountStmt.get();
    const issueData = getIssueCountStmt.get();

    // FIXME: Don't run non-database computations within the transaction; move
    // remapGraphData and avgCount out of the transaction

    const daily_events = remapGraphData(
      getDailyEventsStmt.all(ts),
      getDailyDeniedEvents.all(ts),
    );
    const daily_pings = remapGraphData(
      getDailyPingsStmt.all(ts),
      getDailyDeniedPings.all(ts),
    );
    const daily_dash = remapGraphData(getDailyDashStmt.all(ts), []);

    return {
      session_c: sessionData.session_c || 0,
      session_e_c: sessionData.session_e_c || 0,
      event_c: getEventCountStmt.get() || 0,
      issue_c: issueData.issue_c || 0,
      issue_done_c: issueData.issue_done_c || 0,
      issue_ignore_c: issueData.issue_ignore_c || 0,
      project_c: getProjectCountStmt.get() || 0,
      ping_c_30d_avg: avgCount(daily_pings[1] as number[]),
      event_c_30d_avg: avgCount(daily_events[1] as number[]),
      dash_c_30d_avg: avgCount(daily_dash[1] as number[]),
      daily_events,
      daily_pings,
      daily_dash: [daily_dash[0], daily_dash[1]] as TimeSeriesData,
    };
  })();
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

const DB_QUERY = [
  'BEGIN TRANSACTION;',
  "SELECT SUM(pgsize) FROM dbstat('main',1);",

  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='project';",
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='session';",
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='issue';",
  config.DB_COMPRESSION
    ? "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='_event_zstd';"
    : "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='event';",
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='daily_denied';",
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='daily_events';",
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='daily_pings';",
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='daily_dash';",
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='meta';",

  // "issue_fts" is a virtual table, so it doesn't have a size itself
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='issue_fts_config';",
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='issue_fts_data';",
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='issue_fts_docsize';",
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='issue_fts_idx';",

  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='session_graph';",
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='session_issue';",
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='issue_ts_last_idx';",
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='issue_list_idx';",
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='issue_state_idx';",
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='event_graph_idx';",
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='event_list_idx';",

  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='sqlite_autoindex_issue_1';",
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='sqlite_autoindex_project_1';",
  "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='sqlite_autoindex_project_2';",

  config.DB_COMPRESSION
    ? "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='_zstd_dicts';"
    : '',
  config.DB_COMPRESSION
    ? "SELECT SUM(pgsize) FROM dbstat('main',1) WHERE name='_data_dict_idx';"
    : '',
  'COMMIT;',
].join('');

async function getTableSizes() {
  try {
    // Because the better-sqlite3 npm module doesn't have the compile-time
    // SQLITE_ENABLE_DBSTAT_VTAB option enabled, to get table size data we need
    // to use the system sqlite3 CLI client which does support DBSTAT
    const output = await execCmd('/usr/bin/sqlite3', [
      '-safe',
      '-readonly',
      '-list',
      '-noheader',
      '-nullvalue',
      '0',
      '-cmd',
      '.eqp off',
      config.DB_PATH,
      DB_QUERY,
    ]);
    const data = output.toString().split('\n');
    const total = +data[0];
    const project = +data[1];
    const session = +data[2];
    const issue = +data[3];
    const event = +data[4];
    const daily_denied = +data[5];
    const daily_events = +data[6];
    const daily_pings = +data[7];
    const daily_dash = +data[8];
    const meta = +data[9];
    const issue_fts = +data[10] + +data[11] + +data[12] + +data[13];
    const session_graph = +data[14];
    const session_issue = +data[15];
    const issue_ts_last_idx = +data[16];
    const issue_list_idx = +data[17];
    const issue_state_idx = +data[18];
    const event_graph_idx = +data[19];
    const event_list_idx = +data[20];
    const sqlite_autoindex_issue_1 = +data[21];
    const sqlite_autoindex_project_1 = +data[22];
    const sqlite_autoindex_project_2 = +data[23];

    const tablesInfo = [
      /* prettier-ignore */
      [project, ['project', humanizeFileSize(project), tablePercent(project, total)]],
      /* prettier-ignore */
      [session, ['session', humanizeFileSize(session), tablePercent(session, total)]],
      /* prettier-ignore */
      [issue, ['issue', humanizeFileSize(issue), tablePercent(issue, total)]],
      /* prettier-ignore */
      [event, ['event', humanizeFileSize(event), tablePercent(event, total)]],
      /* prettier-ignore */
      [daily_denied, ['daily_denied', humanizeFileSize(daily_denied), tablePercent(daily_denied, total)]],
      /* prettier-ignore */
      [daily_events, ['daily_events', humanizeFileSize(daily_events), tablePercent(daily_events, total)]],
      /* prettier-ignore */
      [daily_pings, ['daily_pings', humanizeFileSize(daily_pings), tablePercent(daily_pings, total)]],
      /* prettier-ignore */
      [daily_dash, ['daily_dash', humanizeFileSize(daily_dash), tablePercent(daily_dash, total)]],
      /* prettier-ignore */
      [meta, ['meta', humanizeFileSize(meta), tablePercent(meta, total)]],
      /* prettier-ignore */
      [issue_fts, ['issue_fts*', humanizeFileSize(issue_fts), tablePercent(issue_fts, total)]],
      /* prettier-ignore */
      [session_graph, ['session_graph', humanizeFileSize(session_graph), tablePercent(session_graph, total)]],
      /* prettier-ignore */
      [session_issue, ['session_issue', humanizeFileSize(session_issue), tablePercent(session_issue, total)]],
      /* prettier-ignore */
      [issue_ts_last_idx, ['issue_ts_last_idx', humanizeFileSize(issue_ts_last_idx), tablePercent(issue_ts_last_idx, total)]],
      /* prettier-ignore */
      [issue_list_idx, ['issue_list_idx', humanizeFileSize(issue_list_idx), tablePercent(issue_list_idx, total)]],
      /* prettier-ignore */
      [issue_state_idx, ['issue_state_idx', humanizeFileSize(issue_state_idx), tablePercent(issue_state_idx, total)]],
      /* prettier-ignore */
      [event_graph_idx, ['event_graph_idx', humanizeFileSize(event_graph_idx), tablePercent(event_graph_idx, total)]],
      /* prettier-ignore */
      [event_list_idx, ['event_list_idx', humanizeFileSize(event_list_idx), tablePercent(event_list_idx, total)]],
      /* prettier-ignore */
      [sqlite_autoindex_issue_1, ['sqlite_autoindex_issue_1', humanizeFileSize(sqlite_autoindex_issue_1), tablePercent(sqlite_autoindex_issue_1, total)]],
      /* prettier-ignore */
      [sqlite_autoindex_project_1, ['sqlite_autoindex_project_1', humanizeFileSize(sqlite_autoindex_project_1), tablePercent(sqlite_autoindex_project_1, total)]],
      /* prettier-ignore */
      [sqlite_autoindex_project_2, ['sqlite_autoindex_project_2', humanizeFileSize(sqlite_autoindex_project_2), tablePercent(sqlite_autoindex_project_2, total)]],
    ] as [number, StatsDBTableInfo][];

    if (config.DB_COMPRESSION) {
      const zstd_dicts = +data[23];
      const data_dict_idx = +data[24];

      tablesInfo.push(
        /* prettier-ignore */
        [zstd_dicts, ['_zstd_dicts', humanizeFileSize(zstd_dicts), tablePercent(zstd_dicts, total)]],
        /* prettier-ignore */
        [data_dict_idx, ['_data_dict_idx', humanizeFileSize(data_dict_idx), tablePercent(data_dict_idx, total)]],
      );
    }

    return tablesInfo.sort((a, b) => b[0] - a[0]).map((row) => row[1]);
  } catch (error) {
    logger.error(error);
    return [];
  }
}

export const get: Middleware = async (req, res, next) => {
  try {
    const query = req.query as ReqQueryData;

    if (Object.keys(query).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    const [dbFileSize, dbWalFileSize] = await Promise.all([
      fs.promises.stat(config.DB_PATH).then(humanizeSize),
      fs.promises.stat(`${config.DB_PATH}-wal`).then(humanizeSize),
    ]);
    const data = getStats();
    data.dash_session_c = sessions.size;
    data.api_v = process.env.APP_RELEASE!;
    data.api_uptime = Math.floor(process.uptime());
    data.db_size = dbFileSize;
    data.dbwal_size = dbWalFileSize;
    // data.db_tables = tableSizes;

    // FIXME: Generating DB table stats is extremely slow on systems with slow disks
    //  ↳ https://github.com/maxmilton/trackx/issues/158
    if (config.ENABLE_DB_TABLE_STATS) {
      const t0 = performance.now();
      data.db_tables = await getTableSizes();
      const t1 = performance.now();
      logger.info(`Generated DB table stats in ${humanizeTime(t1 - t0)}`);
    }

    send(res, Status.OK, data);
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
