// https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md

import SqliteDB from 'better-sqlite3';
import { config, generateSalt, logger } from './utils';

export const db = new SqliteDB(config.DB_PATH, {
  // XXX: Logging significantly slows down query performance so its recommended
  // to comment this out when generating > 100_000 mocks from the test page
  verbose: process.env.NODE_ENV === 'development' ? logger.debug : undefined,
  fileMustExist: true,
});

// console.log(db.pragma('compile_options'));
// console.log(db.pragma('integrity_check'));
// console.log(db.pragma('quick_check'));
// console.log(db.pragma('foreign_key_check'));

// TODO: Fix DB crashing with sqlite-zstd + trusted_schema off
if (!config.DB_COMPRESSION) {
  db.pragma('trusted_schema = OFF');
}
db.pragma('journal_mode = WAL');
// TODO: Remove if we don't see any improvements when profiling performance
// especially when the DB file size is larger than mmap_size
//  ↳ Otherwise would it make sense to have it a as a config option?
// XXX: Should be safe to use with a value higher than max physical memory
db.pragma('mmap_size = 1073741824'); // 1 GiB
if (process.env.NODE_ENV !== 'production') {
  db.pragma('temp_store = MEMORY');
}

// Enforce stricter limits for better security
// https://www.sqlite.org/security.html#untrusted_sql_inputs
// db.limit('SQLITE_LIMIT_LENGTH', Math.max(1_000_000, config.MAX_EVENT_BYTES));
// db.limit('SQLITE_LIMIT_SQL_LENGTH', 100_000);
// db.limit('SQLITE_MAX_COLUMN', 100); // TODO: Seems way too large
// db.limit('SQLITE_LIMIT_EXPR_DEPTH', 10);
// db.limit('SQLITE_LIMIT_COMPOUND_SELECT', 3);
// db.limit('SQLITE_LIMIT_VDBE_OP', 25_000);
// db.limit('SQLITE_MAX_FUNCTION_ARG', 8);
// db.limit('SQLITE_LIMIT_ATTACHED', 0);
// db.limit('SQLITE_LIMIT_LIKE_PATTERN_LENGTH', 50); // TODO: Too small for search?
// db.limit('SQLITE_LIMIT_VARIABLE_NUMBER', 10);
// db.limit('SQLITE_LIMIT_TRIGGER_DEPTH', 10);
db.pragma('recursive_triggers = OFF');

if (config.DB_COMPRESSION) {
  db.loadExtension(config.DB_ZSTD_PATH!);
}

function scheduledTasks() {
  logger.info('Running scheduled tasks...');

  // https://www.sqlite.org/lang_analyze.html#req
  db.pragma('analysis_limit = 400');
  db.pragma('optimize');

  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  deleteOldDailySalt();
}

setInterval(() => {
  scheduledTasks();
}, 21_600_000); // 6 hours = 1000ms * 60s * 60m * 6h

const addMetaStmt = db.prepare('INSERT INTO meta(k, v) VALUES (?, ?)');
const addMetaSafeStmt = db.prepare(
  'INSERT OR IGNORE INTO meta(k, v) VALUES (?, ?)',
);

export function addMeta(
  k: string,
  v: string | number | bigint | Buffer | null | undefined,
): void {
  addMetaStmt.run(k, v);
}
/**
 * Try to add meta entry and silently do nothing on conflicting k value.
 *
 * Helpful for adding meta entries that are not critical to the operation of
 * the app. Conflicts will not cause a transaction to roll back.
 */
export function addMetaSafe(
  k: string,
  v: string | number | bigint | Buffer | null | undefined,
): void {
  addMetaSafeStmt.run(k, v);
}

const incrementDeniedEventsStmt = db.prepare(`
  INSERT INTO daily_denied(ts, type, key, c)
    VALUES(strftime('%s', date('now')), 'event', ?, 1)
    ON CONFLICT(ts, type, key) DO UPDATE SET c = c + 1
`);
const incrementDeniedPingsStmt = db.prepare(`
  INSERT INTO daily_denied(ts, type, key, c)
    VALUES(strftime('%s', date('now')), 'ping', ?, 1)
    ON CONFLICT(ts, type, key) DO UPDATE SET c = c + 1
`);
const incrementDeniedDashReqsStmt = db.prepare(`
  INSERT INTO daily_denied(ts, type, key, c)
    VALUES(strftime('%s', date('now')), 'dash', '', 1)
    ON CONFLICT(ts, type, key) DO UPDATE SET c = c + 1
`);

export function deniedEvent(projectKey: string): void {
  incrementDeniedEventsStmt.run(projectKey);
}
export function deniedPing(projectKey: string): void {
  incrementDeniedPingsStmt.run(projectKey);
}
export function deniedDash(): void {
  incrementDeniedDashReqsStmt.run();
}

const incrementDailyEventsStmt = db.prepare(`
  INSERT INTO daily_events(ts, c) VALUES(strftime('%s', date('now')), 1)
    ON CONFLICT(ts) DO UPDATE SET c = c + 1
`);
const incrementDailyPingsStmt = db.prepare(`
  INSERT INTO daily_pings(ts, c) VALUES(strftime('%s', date('now')), 1)
    ON CONFLICT(ts) DO UPDATE SET c = c + 1
`);

export function incrementDailyEvents(): void {
  incrementDailyEventsStmt.run();
}
export function incrementDailyPings(): void {
  incrementDailyPingsStmt.run();
}

const getDailySaltStmt = db
  .prepare("SELECT v FROM meta WHERE k = strftime('salt%Y%m%d', 'now')")
  .pluck();
const setDailySaltStmt = db.prepare(
  "INSERT INTO meta(k, v) VALUES(strftime('salt%Y%m%d', 'now'), ?)",
);
const deleteOldDailySaltStmt = db.prepare(`
  DELETE FROM meta
  WHERE k LIKE 'salt%'
    AND k < strftime('salt%Y%m%d', 'now', '-1 day')
`);

export function getDailySalt(): string {
  const salt = getDailySaltStmt.get() as string;

  if (salt) return salt;

  const newSalt = generateSalt(12);
  setDailySaltStmt.run(newSalt);
  return newSalt;
}
export function deleteOldDailySalt(): void {
  deleteOldDailySaltStmt.run();
}

export const existingSessionStmt = db.prepare(
  'SELECT e, ts FROM session WHERE id = ? AND project_id = ?',
);
export const existingSessionIdxStmt = db
  .prepare('SELECT 1 FROM session_issue WHERE id = ? AND issue_id = ?')
  .pluck();
export const addSessionIdxStmt = db.prepare(
  'INSERT INTO session_issue (id, issue_id) VALUES (?, ?)',
);
export const updateSessionStmt = db.prepare(
  'UPDATE session SET e = 1 WHERE id = ? AND project_id = ?',
);
export const updateSessionGraphStmt = db.prepare(`
  UPDATE session_graph SET e = e + 1
  WHERE project_id = ?
    AND ts = strftime('%s', strftime('%Y-%m-%d %H:00', ?, 'unixepoch'))
`);
export const updateIssueSessStmt = db.prepare(
  'UPDATE issue SET sess_c = sess_c + 1 WHERE id = ?',
);
export const getProjectByKeyStmt = db.prepare(
  'SELECT id, origin, scrape FROM project WHERE key = ?',
);
export const getProjectByNameStmt = db.prepare(
  'SELECT id, tags FROM project WHERE name = ?',
);
export const addSessionStmt = db.prepare(`
  INSERT INTO session (
    id,
    project_id,
    ts,
    e
  )
  VALUES (
    @id,
    @project_id,
    @ts,
    @e
  )
`);
export const addSessionGraphHitStmt = db.prepare(`
  INSERT INTO session_graph (
    project_id,
    ts,
    c,
    e
  )
  VALUES (
    @project_id,
    strftime('%s', strftime('%Y-%m-%d %H:00', @ts, 'unixepoch')),
    1,
    @e
  )
    ON CONFLICT(project_id, ts) DO UPDATE SET c = c + 1, e = e + @e
`);
export const addEventStmt = db.prepare(`
  INSERT INTO event (
    project_id,
    issue_id,
    ts,
    type,
    data
  )
  VALUES (
    @project_id,
    @issue_id,
    @ts,
    @type,
    @data
  )
`);
export const addIssueStmt = db.prepare(`
  INSERT INTO issue (
    hash,
    project_id,
    ts_last,
    ts_first,
    sess_c,
    name,
    message,
    uri
  )
  VALUES (
    @hash,
    @project_id,
    @ts_last,
    @ts_first,
    @sess_c,
    @name,
    @message,
    @uri
  )
`);
export const matchingIssueHashStmt = db.prepare(
  'SELECT id, ignore FROM issue WHERE hash = ?',
);
export const updateIssueStmt = db.prepare(`
  UPDATE issue
  SET
    ts_last = ?,
    event_c = event_c + 1,
    done = 0
  WHERE id = ?
`);
