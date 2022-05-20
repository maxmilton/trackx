# Architecture

TODO: Write detailed overview of the architecture:

- Show diagram of the stack — Docker, Nginx, Node.js
- There's no message queue in the ingest pipeline, which means it's simple and efficient for all but the highest loads, but for very very high concurrent loads it could lead to resource exhaustion. Those types of loads could place a message queue service in their net stack, however it's not something we support out-of-the-box.
  - Talk about how Nginx does its best to limit concurrent connections (but at the moment event inject is partially async and ends the connection while the event is still being processed) -- Huh? What did I mean?
- Security and trust model
  - DB row IDs exposed on frontend
- API routes; `/dash/*`, `/v1/[key]/{event,ping,report}`
- Link to DB schema — `packages/trackx-api/migrations/master.sql`
- Timestamps in events and issues are to millisecond precision but all others (including sessions) are in seconds
- Login is a separate lightweight app

## Database

Also see the [database compression](/advanced-guides/database-compression.md) guide.

### Tables

<!-- prettier-ignore-start -->

| Name | Description |
| --- | --- |
| `daily_denied` | Total denied requests per day and their info. |
| `daily_events` | Total event requests per day. |
| `daily_pings` | Total ping requests per day. |
| `event` | Event data. Any kind of captured error event, browser report, etc. is treated as an event and stored in this table. The table only has a handful of columns with the bulk of the data stored in the `data` column as JSON. Depending on the type of event the shape of the JSON may change.</br></br>When [database compression](/advanced-guides/database-compression.md) is active, this table is converted into a view and the actual data is stored in `_event_zstd`. |
| `issue` | Issue data. Events which have a matching fingerprint hash are grouped into an issue. |
| `issue_fts*` | A number of tables and indexes that power the issue [full-text search engine](https://www.sqlite.org/fts5.html). The exact tables and indexes depend on which tokenizer and options are used. By default we use the [trigram tokenizer](https://www.sqlite.org/fts5.html#trigramidx) for its substring matching.</br></br>It's normal to see this table much larger than the size of `issue`. |
| `meta` | Miscellaneous meta data. Noteworthy things that get stored in here are: daily rotating salt (for unique session ID hash), log of project key changes. |
| `project` | Project data. |
| `session` | Session data. |
| `session_graph` | Pre-aggregated count of sessions per hour for each project. Instead of generating graphs from raw session data, we keep a running count when sessions are created or updated in this table. This is a performance optimisation for fast session graphs and calculating session counts. |
| `session_issue` | Map of issues a session has seen. Used to count unique sessions on issues. |
| `_event_zstd` | The actual `event` table data (with raw compressed binary data). Created automatically and only used when [database compression](/advanced-guides/database-compression.md) is active. |
| `_zstd_configs` | Configuration for `sqlite-zstd` SQLite extension. Created automatically and only used when [database compression](/advanced-guides/database-compression.md) is active. |
| `_zstd_dicts` | Shared zstd compression dictionaries. Created automatically and only used when [database compression](/advanced-guides/database-compression.md) is active. |

<!-- prettier-ignore-end -->

### Indices

<!-- prettier-ignore-start -->

| Name | Description |
| --- | --- |
| `event_graph_idx` | Speeds up generating event graphs from raw event data, such as on an issue page. |
| `event_list_idx` | Speeds up retrieving events on the issue page's event pagination. |
| `issue_list_idx` | Speeds up listing recent issues of a specific project. |
| `issue_state_idx` | Speeds up counting number of open issues within a project. |
| `issue_ts_last_idx` | Speeds up queries that list issues or count total issues, such as on the issue listing page (which uses simple pagination). |
| `sqlite_autoindex_issue_1` | Created automatically for issue unique `hash` column. Hash is the hashed unique fingerprint of the issue. |
| `sqlite_autoindex_project_2` | Created automatically for project unique `name` column. |
| `sqlite_autoindex_project_1` | Created automatically for project unique `key` column. |
| `sqlite_autoindex__zstd_dicts_1` | Created automatically on _zstd_dicts unique `chooser_key` column and only used when [database compression](/advanced-guides/database-compression.md) is active. |
| `_data_dict_idx` | Speeds up lookup of shared compression dictionary by its name in the `_zstd_dicts` table. Created automatically and only used when [database compression](/advanced-guides/database-compression.md) is active. |

<!-- prettier-ignore-end -->
