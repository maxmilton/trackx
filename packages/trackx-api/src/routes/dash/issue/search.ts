import send from '@polka/send';
import type { Statement } from 'better-sqlite3';
import type { Middleware } from 'polka';
import { db, deniedDash, getProjectByNameStmt } from '../../../db';
import type { Issue, ProjectInternal, ReqQueryData } from '../../../types';
import {
  AppError, ISSUE_SORT_VALUES, logger, Status,
} from '../../../utils';
import { trimIssues } from './all';

const getSearchResultsRankStmt = db.prepare(`
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
        (SELECT name FROM project WHERE project.id = project_id) AS project_name,
        rank
      FROM issue_fts
      WHERE issue_fts MATCH @q
    ),
    cte_count AS (
      SELECT COUNT(*) AS result_c FROM cte_data
    )
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
    project_name,
    result_c
  FROM cte_data
  CROSS JOIN cte_count
  ORDER BY rank
  LIMIT @limit OFFSET @offset
`);
const getSearchResultsLastSeenStmt = db.prepare(`
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
        (SELECT name FROM project WHERE project.id = issue_fts.project_id) AS project_name
      FROM issue_fts
      WHERE issue_fts MATCH @q
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
const getSearchResultsFirstSeenStmt = db.prepare(`
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
        (SELECT name FROM project WHERE project.id = issue_fts.project_id) AS project_name
      FROM issue_fts
      WHERE issue_fts MATCH @q
    ),
    cte_count AS (
      SELECT COUNT(*) AS result_c FROM cte_data
    )
  SELECT *
  FROM cte_data
  CROSS JOIN cte_count
  ORDER BY ts_first
  LIMIT @limit OFFSET @offset
`);
const getSearchResultsEventCountStmt = db.prepare(`
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
        (SELECT name FROM project WHERE project.id = issue_fts.project_id) AS project_name
      FROM issue_fts
      WHERE issue_fts MATCH @q
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
const getSearchResultsSessCountStmt = db.prepare(`
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
        (SELECT name FROM project WHERE project.id = issue_fts.project_id) AS project_name
      FROM issue_fts
      WHERE issue_fts MATCH @q
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
const getProjectSearchResultsRankStmt = db.prepare(`
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
        @project_name AS project_name,
        rank
      FROM issue_fts
      WHERE issue_fts MATCH @q AND project_id = @project_id
    ),
    cte_count AS (
      SELECT COUNT(*) AS result_c FROM cte_data
    )
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
    project_name,
    result_c
  FROM cte_data
  CROSS JOIN cte_count
  ORDER BY rank
  LIMIT @limit OFFSET @offset
`);
const getProjectSearchResultsLastSeenStmt = db.prepare(`
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
      FROM issue_fts
      WHERE issue_fts MATCH @q AND project_id = @project_id
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
const getProjectSearchResultsFirstSeenStmt = db.prepare(`
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
      FROM issue_fts
      WHERE issue_fts MATCH @q AND project_id = @project_id
    ),
    cte_count AS (
      SELECT COUNT(*) AS result_c FROM cte_data
    )
  SELECT *
  FROM cte_data
  CROSS JOIN cte_count
  ORDER BY ts_first
  LIMIT @limit OFFSET @offset
`);
const getProjectSearchResultsEventCountStmt = db.prepare(`
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
      FROM issue_fts
      WHERE issue_fts MATCH @q AND project_id = @project_id
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
const getProjectSearchResultsSessCountStmt = db.prepare(`
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
      FROM issue_fts
      WHERE issue_fts MATCH @q AND project_id = @project_id
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

function getSearchResults({
  limit,
  offset,
  q,
  sort,
}: {
  limit: number;
  offset: number;
  q: string;
  sort: string;
}): Issue[] {
  let stmt: Statement;

  switch (sort) {
    case 'rank':
      stmt = getSearchResultsRankStmt;
      break;
    case 'last_seen':
      stmt = getSearchResultsLastSeenStmt;
      break;
    case 'first_seen':
      stmt = getSearchResultsFirstSeenStmt;
      break;
    case 'event_count':
      stmt = getSearchResultsEventCountStmt;
      break;
    case 'sess_count':
      stmt = getSearchResultsSessCountStmt;
      break;
    default:
      throw new AppError('Invalid sort value');
  }

  const rows = stmt.all({
    limit,
    offset,
    q,
  }) as Issue[];

  return trimIssues(rows);
}

function getProjectSearchResults({
  limit,
  offset,
  q,
  sort,
  project_name,
}: {
  limit: number;
  offset: number;
  q: string;
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
    case 'rank':
      stmt = getProjectSearchResultsRankStmt;
      break;
    case 'last_seen':
      stmt = getProjectSearchResultsLastSeenStmt;
      break;
    case 'first_seen':
      stmt = getProjectSearchResultsFirstSeenStmt;
      break;
    case 'event_count':
      stmt = getProjectSearchResultsEventCountStmt;
      break;
    case 'sess_count':
      stmt = getProjectSearchResultsSessCountStmt;
      break;
    default:
      throw new AppError('Invalid sort value');
  }

  const rows = stmt.all({
    limit,
    offset,
    q,
    project_name,
    project_id: project.id,
  }) as Issue[];

  return trimIssues(rows);
}

export const get: Middleware = (req, res, next) => {
  try {
    const {
      q,
      limit,
      offset,
      sort = 'rank',
      project,
      ...rest
    } = req.query as ReqQueryData;

    if (Object.keys(rest).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    if (!q || typeof q !== 'string' || q.length > 100) {
      throw new AppError('Invalid q', Status.UNPROCESSABLE_ENTITY);
    }

    let limitValue;

    if (limit !== undefined) {
      if (typeof limit !== 'string' || limit.length > 4) {
        throw new AppError('Invalid limit', Status.BAD_REQUEST);
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
        throw new AppError('Invalid offset', Status.BAD_REQUEST);
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
      ? getProjectSearchResults({
        limit: limitValue || 10,
        offset: offsetValue || 0,
        q,
        sort,
        project_name: project,
      })
      : getSearchResults({
        limit: limitValue || 10,
        offset: offsetValue || 0,
        q,
        sort,
      });

    send(res, Status.OK, data);
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
