import send from '@polka/send';
import type { Statement } from 'better-sqlite3';
import type { Middleware } from 'polka';
import { db, deniedDash, getProjectByNameStmt } from '../../../db';
import type { Issue, ProjectInternal, ReqQueryData } from '../../../types';
import {
  AppError, ISSUE_SORT_VALUES, logger, Status,
} from '../../../utils';

const MAX_STRING_LENGTH = 175;

interface IssueRow {
  message: string | null | undefined;
  uri: string | null | undefined;
}

/** Trim issue properties that exceed limits to reduce superfluous data size. */
export function trimIssues<T extends IssueRow>(rows: T[]): T[] {
  return rows.map((row) => {
    if (row.message && row.message.length > MAX_STRING_LENGTH) {
      // eslint-disable-next-line no-param-reassign
      row.message = row.message.slice(0, MAX_STRING_LENGTH);
    }
    if (row.uri && row.uri.length > MAX_STRING_LENGTH) {
      // eslint-disable-next-line no-param-reassign
      row.uri = row.uri.slice(0, MAX_STRING_LENGTH);
    }
    return row;
  });
}

const getIssuesLastSeenStmt = db.prepare(`
  WITH
    cte_data AS (
      SELECT
        id,
        ts_last,
        ts_first,
        event_c,
        sess_c,
        ignore,
        done,
        name,
        message,
        uri,
        (SELECT name FROM project WHERE project.id = issue.project_id) AS project_name
      FROM issue
    ),
    cte_count AS (
      SELECT COUNT(*) AS result_c FROM cte_data
    )
  SELECT *
  FROM cte_data
  CROSS JOIN cte_count
  ORDER BY ts_last DESC
  LIMIT @limit OFFSET @offset
`);
// The row order in the DB is essentially by ts_first anyway so we can get away
// with not using ORDER BY. Query exec time with = ~23ms, without = ~1.5ms!
const getIssuesFirstSeenStmt = db.prepare(`
  WITH
    cte_data AS (
      SELECT
        id,
        ts_last,
        ts_first,
        event_c,
        sess_c,
        ignore,
        done,
        name,
        message,
        uri,
        (SELECT name FROM project WHERE project.id = issue.project_id) AS project_name
      FROM issue
    ),
    cte_count AS (
      SELECT COUNT(*) AS result_c FROM cte_data
    )
  SELECT *
  FROM cte_data
  CROSS JOIN cte_count
  -- ORDER BY ts_first
  LIMIT @limit OFFSET @offset
`);
const getIssuesEventCountStmt = db.prepare(`
  WITH
    cte_data AS (
      SELECT
        id,
        ts_last,
        ts_first,
        event_c,
        sess_c,
        ignore,
        done,
        name,
        message,
        uri,
        (SELECT name FROM project WHERE project.id = issue.project_id) AS project_name
      FROM issue
    ),
    cte_count AS (
      SELECT COUNT(*) AS result_c FROM cte_data
    )
  SELECT *
  FROM cte_data
  CROSS JOIN cte_count
  ORDER BY event_c DESC, ts_last DESC
  LIMIT @limit OFFSET @offset
`);
const getIssuesSessCountStmt = db.prepare(`
  WITH
    cte_data AS (
      SELECT
        id,
        ts_last,
        ts_first,
        event_c,
        sess_c,
        ignore,
        done,
        name,
        message,
        uri,
        (SELECT name FROM project WHERE project.id = issue.project_id) AS project_name
      FROM issue
    ),
    cte_count AS (
      SELECT COUNT(*) AS result_c FROM cte_data
    )
  SELECT *
  FROM cte_data
  CROSS JOIN cte_count
  ORDER BY sess_c DESC, ts_last DESC
  LIMIT @limit OFFSET @offset
`);
const getProjectIssuesLastSeenStmt = db.prepare(`
  WITH
    cte_data AS (
      SELECT
        id,
        ts_last,
        ts_first,
        event_c,
        sess_c,
        ignore,
        done,
        name,
        message,
        uri,
        @project_name AS project_name
      FROM issue
      WHERE project_id = @project_id
    ),
    cte_count AS (
      SELECT COUNT(*) AS result_c FROM cte_data
    )
  SELECT *
  FROM cte_data
  CROSS JOIN cte_count
  ORDER BY ts_last DESC
  LIMIT @limit OFFSET @offset
`);
const getProjectIssuesFirstSeenStmt = db.prepare(`
  WITH
    cte_data AS (
      SELECT
        id,
        ts_last,
        ts_first,
        event_c,
        sess_c,
        ignore,
        done,
        name,
        message,
        uri,
        @project_name AS project_name
      FROM issue
      WHERE project_id = @project_id
    ),
    cte_count AS (
      SELECT COUNT(*) AS result_c FROM cte_data
    )
  SELECT *
  FROM cte_data
  CROSS JOIN cte_count
  -- ORDER BY ts_first
  LIMIT @limit OFFSET @offset
`);
const getProjectIssuesEventCountStmt = db.prepare(`
  WITH
    cte_data AS (
      SELECT
        id,
        ts_last,
        ts_first,
        event_c,
        sess_c,
        ignore,
        done,
        name,
        message,
        uri,
        @project_name AS project_name
      FROM issue
      WHERE project_id = @project_id
    ),
    cte_count AS (
      SELECT COUNT(*) AS result_c FROM cte_data
    )
  SELECT *
  FROM cte_data
  CROSS JOIN cte_count
  ORDER BY event_c DESC, ts_last DESC
  LIMIT @limit OFFSET @offset
`);
const getProjectIssuesSessCountStmt = db.prepare(`
  WITH
    cte_data AS (
      SELECT
        id,
        ts_last,
        ts_first,
        event_c,
        sess_c,
        ignore,
        done,
        name,
        message,
        uri,
        @project_name AS project_name
      FROM issue
      WHERE project_id = @project_id
    ),
    cte_count AS (
      SELECT COUNT(*) AS result_c FROM cte_data
    )
  SELECT *
  FROM cte_data
  CROSS JOIN cte_count
  ORDER BY sess_c DESC, ts_last DESC
  LIMIT @limit OFFSET @offset
`);

export function getIssues({
  limit,
  offset,
  sort,
}: {
  limit: number;
  offset: number;
  sort: string;
}): Issue[] {
  let stmt: Statement;

  switch (sort) {
    case 'last_seen':
      stmt = getIssuesLastSeenStmt;
      break;
    case 'first_seen':
      stmt = getIssuesFirstSeenStmt;
      break;
    case 'event_count':
      stmt = getIssuesEventCountStmt;
      break;
    case 'sess_count':
      stmt = getIssuesSessCountStmt;
      break;
    default:
      throw new AppError('Invalid sort value');
  }

  const rows = stmt.all({ limit, offset }) as Issue[];

  return trimIssues(rows);
}

export function getProjectIssues({
  limit,
  offset,
  sort,
  project_name,
}: {
  limit: number;
  offset: number;
  sort: string;
  project_name: string;
}): Issue[] {
  const project = getProjectByNameStmt.get(project_name) as
    | ProjectInternal
    | undefined;

  if (!project) {
    throw new AppError('Project not found', Status.NOT_FOUND);
  }

  let stmt: Statement;

  switch (sort) {
    case 'last_seen':
      stmt = getProjectIssuesLastSeenStmt;
      break;
    case 'first_seen':
      stmt = getProjectIssuesFirstSeenStmt;
      break;
    case 'event_count':
      stmt = getProjectIssuesEventCountStmt;
      break;
    case 'sess_count':
      stmt = getProjectIssuesSessCountStmt;
      break;
    default:
      throw new AppError('Invalid sort value');
  }

  const rows = stmt.all({
    limit,
    offset,
    project_name,
    project_id: project.id,
  }) as Issue[];

  return trimIssues(rows);
}

export const get: Middleware = (req, res, next) => {
  try {
    const {
      limit,
      offset,
      sort = 'last_seen',
      project,
      ...rest
    } = req.query as ReqQueryData;

    if (Object.keys(rest).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    let limitValue;

    if (limit !== undefined) {
      if (typeof limit !== 'string' || limit.length > 4) {
        throw new AppError('Invalid limit', Status.UNPROCESSABLE_ENTITY);
      }
      limitValue = +limit;
      if (
        !Number.isInteger(limitValue)
        || limitValue < 1
        || limitValue > 1000
      ) {
        throw new AppError('Invalid limit', Status.UNPROCESSABLE_ENTITY);
      }
    }

    let offsetValue;

    if (offset !== undefined) {
      if (typeof offset !== 'string' || offset.length > 8) {
        throw new AppError('Invalid offset', Status.UNPROCESSABLE_ENTITY);
      }
      offsetValue = +offset;
      if (!Number.isInteger(offsetValue) || offsetValue < 0) {
        throw new AppError('Invalid offset', Status.UNPROCESSABLE_ENTITY);
      }
    }

    if (
      !sort
      || typeof sort !== 'string'
      || !ISSUE_SORT_VALUES.includes(sort)
    ) {
      throw new AppError('Invalid sort', Status.UNPROCESSABLE_ENTITY);
    }

    if (project !== undefined) {
      if (
        typeof project !== 'string'
        || project.length > 40
        || !/^[\d_a-z-]+$/.test(project)
      ) {
        throw new AppError('Invalid name', Status.UNPROCESSABLE_ENTITY);
      }
    }

    const data = project
      ? getProjectIssues({
        limit: limitValue || 10,
        offset: offsetValue || 0,
        sort,
        project_name: project,
      })
      : getIssues({
        limit: limitValue || 10,
        offset: offsetValue || 0,
        sort,
      });
    send(res, Status.OK, data);
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
