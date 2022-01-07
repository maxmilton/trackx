-- This SQL will revert event.data from compressed back to uncompressed

-- TIPS:
--  1. Make sure the schema is correct as this file may be out of date!
--  2. Recreate the event_issue_id_idx and event_graph_idx indexes

BEGIN TRANSACTION;

CREATE TEMPORARY TABLE event_tmp (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  issue_id INTEGER NOT NULL REFERENCES issue(id) ON DELETE CASCADE,
  ts INTEGER NOT NULL,
  type INTEGER,
  data TEXT
);

INSERT INTO event_tmp SELECT id,project_id,issue_id,ts,type,data FROM event;

DROP VIEW event;
DROP TABLE _event_zstd;
DROP TABLE _zstd_configs;
DROP TABLE _zstd_dicts;

CREATE TABLE event (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  issue_id INTEGER NOT NULL REFERENCES issue(id) ON DELETE CASCADE,
  ts INTEGER NOT NULL,
  type INTEGER,
  data TEXT
) STRICT;

INSERT INTO event SELECT id,project_id,issue_id,ts,type,data FROM event_tmp;

DROP TABLE event_tmp;

COMMIT;
