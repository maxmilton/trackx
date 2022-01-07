import type { EventMeta, EventType } from 'trackx/types';

export interface TrackXAPIConfig {
  /**
   * User accounts.
   *
   * Emails are case-insensitive at login but MUST BE lowercase here. Generate
   * a user salt and password hash with the CLI tool. For more details run the
   * CLI with `trackx adduser --help`.
   */
  readonly USERS: {
    readonly [email: string]: readonly [salt: string, passwordHash: string];
  };

  /**
   * Root path resolution directory.
   *
   * Base directory that relative paths in your configuration should resolve
   * from. When the value is itself relative, it is resolved relative to the
   * current working directory.
   *
   * @default process.cwd()
   */
  readonly ROOT_DIR?: string;
  readonly HOST: string;
  readonly PORT: number;
  readonly DB_PATH: string;
  /**
   * Path to `libsqlite_zstd.so` library file to use for database compression.
   *
   * @see  https://github.com/phiresky/sqlite-zstd/releases/latest
   */
  readonly DB_ZSTD_PATH?: string | undefined;
  /**
   * Path to an SQL file to use as the initial schema for the database.
   */
  readonly DB_INIT_SQL_PATH?: string | undefined;
  /**
   * Database compression level.
   *
   * There is a CPU, memory, and write performance overhead when compression is
   * enabled. For most users this will be acceptable but for users with high
   * event or session volume compression should be disabled.
   *
   * Set to `0` to disable. **Warning:** Once enabled, compression cannot
   * easily be disabled (you'll need to run some custom SQL queries)!
   *
   * When 1 or higher the event table's data column (only) will be compressed
   * using zstd to save disk space. Other tables and columns remain uncompressed
   * for better read/write performance.
   *
   * Valid values are `-5` through to `22`. Where `0` means compression is
   * disabled, negative values will increase speed at the cost of compression
   * ratio, and higher positive values will be slower with better compression.
   * @see https://facebook.github.io/zstd/zstd_manual.html#Chapter1
   *
   * You can change the value but data that is already compressed will not be
   * recompressed; only new data will be compressed at the new level.
   */

  readonly DB_COMPRESSION?: number | undefined;
  /**
   * TrackX API endpoint where internal error event reports and pings are sent.
   * It should include the project key of the internal trackx-backend project.
   *
   * @example `http://127.0.0.1:8080/v1/cuyk9nmavqs`
   */
  readonly REPORT_API_ENDPOINT: string;
  /**
   * The URL origin of the frontend dash web application.
   *
   * Dash API requests which don't come from this origin will be denied.
   */
  readonly DASH_ORIGIN: string;

  /**
   * Maximum number of bytes for an event's total data.
   *
   * Helps to control the growth of your database size. If the final payload to
   * be written to the database exceeds this limit, first some data may be
   * removed e.g., stack frame source, in an attempt to reduce the size, or if
   * the payload still exceeds the limit the event will be denied.
   */
  readonly MAX_EVENT_BYTES: number;
  /**
   * The maximum number of characters allowed in a raw stack trace.
   *
   * Very long stack traces can cause excessive resource consumption so this
   * helps filtering out abnormally large events. If the number of characters
   * in an incoming event stack exceeds this limit the event will be denied.
   */
  readonly MAX_STACK_CHARS: number;
  /**
   * The maximum number of stack trace frames to keep.
   *
   * Typically only the topmost frames are significant in diagnosing errors so
   * trimming insignificant frames can help reduce the size of your database.
   * If the number of frames exceeds this limit the event will still be accepted
   * but any frames over this limit will be removed.
   */
  readonly MAX_STACK_FRAMES: number;
  /**
   * The maximum number of characters allowed in the "user-agent" header.
   *
   * Although very long user-agent strings are seen in the wild, browsers
   * normally set reasonably short string. Long user-agents are rare and could
   * be a sign of ancient software, abuse, or a security risk. If the number of
   * characters exceeds this limit the request will be denied.
   */
  readonly MAX_UA_CHARS: number;
  /**
   * The maximum number of characters allowed in URIs.
   *
   * If an incoming URI exceeds this limit the request will be denied.
   */
  readonly MAX_URI_CHARS: number;
  /**
   * @remarks Currently not used. Reserved for future use to control when
   * fetching remote source maps to enhance stack traces.
   */
  readonly NET_MAX_FILE_BYTES: number;
  /**
   * @remarks Currently not used. Reserved for future use to control when
   * fetching remote source maps to enhance stack traces.
   */
  readonly NET_RETRY: number;
  /**
   * @remarks Currently not used. Reserved for future use to control when
   * fetching remote source maps to enhance stack traces.
   */
  readonly NET_TIMEOUT: number;
  /** Session time to live in milliseconds. Sessions will last this long. */
  readonly SESSION_TTL: number;
}

export type ReqBodyData = Record<string, unknown>;
export type ReqQueryData = Record<string, unknown>;

export type TimeSeriesData = [time: number[], ...series: (number | null)[][]];

export interface StackFrame {
  file: string;
  line?: number | undefined;
  column?: number | undefined;
  callee: string;
  fileRelative?: string;
  start?: number;
  offset?: number;
  source?: string[];
  hide?: boolean | undefined;
}

export interface ProjectInternal {
  readonly id: number;
  key: string;
  /**
   * CSV list of HTTP origins to accept requests from or `'*'` for any origin.
   * @see <https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Origin>
   */
  origin: string;
  name: string;
  /**
   * Enable enhanced stack traces. Fetch code and source maps from project.
   *
   * @remarks Stored as 0 or 1 in SQLite.
   */
  scrape: boolean | 0 | 1;
  /** CSV list of tags. */
  tags?: string | undefined;
}

export interface Project extends ProjectInternal {
  scrape: boolean;
}

export type ProjectList = {
  name: Project['name'];
  tags?: Project['tags'];
  issue_c: number | null;
  session_c: number | null;
}[];

export interface ProjectOverview {
  issues: Issue[];
  uris: Array<{
    uri: string;
    uri_c: number;
    ts_last: number;
    ts_first: number;
  }>;
}

export interface EventInternal {
  readonly id: number;
  project_id: number;
  issue_id: number;
  /**
   * Timestamp in _milliseconds_ elapsed since the Unix epoch. Indicates the time
   * the event was processed by the backend.
   */
  ts: number;
  type: EventType;
  data: {
    name?: string | undefined;
    message?: string | undefined;
    uri?: string | undefined;
    stack?: StackFrame[] | undefined;
    stack_raw?: string | undefined;
    os?: string | undefined;
    os_v?: string | undefined;
    agent?: string | undefined;
    agent_v?: string | undefined;
    meta: EventMeta & {
      /**
       * Event payload byte size was over limit. Data may have been trimmed to
       * reduce size e.g., StackFrame.source removed.
       */
      _oversize?: boolean;
    };
  };
}

export interface Event extends EventInternal {
  /** Pagination helper to indicate current event is first/oldest of the issue. */
  is_first?: boolean;
  /** Pagination helper to indicate current event is last/latest of the issue. */
  is_last?: boolean;
}

export interface IssueInternal {
  readonly id: number;
  /**
   * Hashed event data fingerprint. Used to judge uniqueness between events for
   * grouping into issues.
   */
  hash: Buffer;
  project_id: number;
  /** Timestamp in milliseconds elapsed since Unix epoch. */
  ts_last: number;
  /** Timestamp in milliseconds elapsed since Unix epoch. */
  ts_first: number;
  event_c: number;
  sess_c: number;
  /** @remarks Stored as 0 or 1 in SQLite. */
  ignore: boolean | 0 | 1;
  /** @remarks Stored as 0 or 1 in SQLite. */
  done: boolean | 0 | 1;
  name: string | null | undefined;
  message: string | null | undefined;
  /** The canonical location URI where events originate from. */
  uri: string | null | undefined;
}

export interface Issue extends Omit<IssueInternal, 'project_id'> {
  ignore: boolean;
  done: boolean;
  project_name: string;
  /** The total number count of issues in the search or sort result. */
  result_c: number;
}

export interface SessionInternal {
  /**
   * TrackX session ID.
   *
   * A binary hash created using (pseudocode):
   * `hash(daily_salt + request_origin + ip_address + user_agent)`.
   */
  id: Buffer;
  project_id: number;
  /** Timestamp as _seconds_ elapsed since Unix epoch. */
  ts: number;
  /**
   * Session has at least one event.
   *
   * @remarks Stored as 0 or 1 in SQLite.
   */
  e?: boolean | 0 | 1;
}

export interface Session extends SessionInternal {
  /** Session has at least one event. */
  e?: boolean;
}

export type SessionsCount = [sessions: number, withError: number];

export interface SessionsData {
  graph: TimeSeriesData;
  period: [current: SessionsCount, previous: SessionsCount];
}

export type StatsDBTableInfo = [name: string, size: string, percent: string];

export interface Stats {
  ping_c_30d_avg: number;
  session_c: number;
  session_e_c: number;
  event_c: number;
  event_c_30d_avg: number;
  issue_c: number;
  issue_done_c: number;
  issue_ignore_c: number;
  project_c: number;
  daily_events: TimeSeriesData;
  daily_pings: TimeSeriesData;
  api_v: string;
  api_uptime: number;
  dash_session_c: number;
  db_size: string;
  dbwal_size: string;
  db_tables: StatsDBTableInfo[];
}

// FIXME: Remove; temp for development of event ingest pipeline
export type EventPerfLog = [
  id: string,
  msTotal: string,
  msRaw: string,
  msEnahnce: string,
  size: string,
  frames: string,
];

export interface Logs {
  denied_event: [ts: number, key: string, c: number][];
  denied_ping: [ts: number, key: string, c: number][];
  denied_dash: [ts: number, c: number][];

  // FIXME: Remove; temp for development of event ingest pipeline
  perf_event: EventPerfLog[];
}
