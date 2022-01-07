----------------------------
-- MASTER DATABASE SCHEMA --
----------------------------

-- https://docs.trackx.app/#/advanced-guides/architecture.md#database

BEGIN TRANSACTION;

CREATE TABLE project (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  origin TEXT,
  name TEXT UNIQUE NOT NULL,
  scrape INTEGER DEFAULT 1, -- BOOLEAN
  tags TEXT
) STRICT;

CREATE TABLE issue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash BLOB UNIQUE,
  project_id INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  ts_last INTEGER,
  ts_first INTEGER,
  event_c INTEGER DEFAULT 1,
  sess_c INTEGER,
  ignore INTEGER DEFAULT 0, -- BOOLEAN
  done INTEGER DEFAULT 0, -- BOOLEAN
  name TEXT,
  message TEXT,
  uri TEXT
) STRICT;

-- https://www.sqlite.org/fts5.html#trigramidx
CREATE VIRTUAL TABLE issue_fts USING fts5(
  name,
  message,
  uri,
  id UNINDEXED,
  project_id UNINDEXED,
  ts_last UNINDEXED,
  ts_first UNINDEXED,
  event_c UNINDEXED,
  sess_c UNINDEXED,
  ignore UNINDEXED,
  done UNINDEXED,
  content='issue',
  tokenize='trigram',
  content_rowid='id'
);

CREATE TRIGGER issue_ai AFTER INSERT ON issue BEGIN
  INSERT INTO issue_fts (rowid, name, message, uri)
  VALUES (new.id, new.name, new.message, new.uri);
END;

CREATE TRIGGER issue_ad AFTER DELETE ON issue BEGIN
  INSERT INTO issue_fts (issue_fts, rowid, name, message, uri)
  VALUES ('delete', old.id, old.name, old.message, old.uri);
END;

-- XXX: All the columns we search index have immutable data (including rowid) so
-- an update trigger is not required. We should strive to keep it that way as
-- issues are frequently updated and the trigger would add significant overhead.

-- CREATE TRIGGER issue_au AFTER UPDATE ON issue BEGIN
--   INSERT INTO issue_fts (issue_fts, rowid, name, message, uri)
--   VALUES ('delete', old.id, old.name, old.message, old.uri);
--   INSERT INTO issue_fts (rowid, name, message, uri)
--   VALUES (new.id, new.name, new.message, new.uri);
-- END;

CREATE TABLE event (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  issue_id INTEGER NOT NULL REFERENCES issue(id) ON DELETE CASCADE,
  ts INTEGER,
  type INTEGER,
  data TEXT
) STRICT;

CREATE TABLE session (
  id BLOB NOT NULL,
  project_id INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  ts INTEGER,
  e INTEGER DEFAULT 0, -- BOOLEAN
  PRIMARY KEY(id, project_id)
) WITHOUT ROWID, STRICT;

CREATE TABLE session_issue (
  id BLOB NOT NULL, -- REFERENCES session(id)
  issue_id INTEGER NOT NULL REFERENCES issue(id) ON DELETE CASCADE,
  PRIMARY KEY(id, issue_id)
) WITHOUT ROWID, STRICT;

CREATE TABLE session_graph (
  project_id INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  ts INTEGER NOT NULL,
  c INTEGER,
  e INTEGER,
  PRIMARY KEY(project_id, ts)
) WITHOUT ROWID, STRICT;

CREATE TABLE daily_denied (
  ts INTEGER NOT NULL,
  type TEXT NOT NULL,
  key TEXT NOT NULL,
  c INTEGER,
  PRIMARY KEY(ts, type, key)
) WITHOUT ROWID, STRICT;

CREATE TABLE daily_events (ts INTEGER PRIMARY KEY NOT NULL, c INTEGER) WITHOUT ROWID, STRICT;
CREATE TABLE daily_pings (ts INTEGER PRIMARY KEY NOT NULL, c INTEGER) WITHOUT ROWID, STRICT;
CREATE TABLE meta (k TEXT PRIMARY KEY NOT NULL, v ANY) WITHOUT ROWID, STRICT;

-- TODO: Add documentation explaining which indexes can be dropped in very high
-- throughput instances or systems with limited resources and the trade-offs

-- TODO: Look into solutions to reduce number of indexes for higher write
-- throughput + test the actual impact including CPU and memory usage

CREATE INDEX issue_ts_last_idx ON issue(ts_last DESC);
CREATE INDEX issue_list_idx ON issue(project_id, ts_last DESC);
CREATE INDEX issue_state_idx ON issue(project_id, ignore, done);
CREATE INDEX event_graph_idx ON event(issue_id, ts);
CREATE INDEX event_list_idx ON event(issue_id, id DESC);

-- TODO: Add documentation about how to turn on DB event data compression
-- including indexing on the _event_zstd table instead of event

-- CREATE INDEX event_graph_idx ON _event_zstd(issue_id, ts);
-- CREATE INDEX event_list_idx ON _event_zstd(issue_id, id DESC);

COMMIT;
