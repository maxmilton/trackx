import send from '@polka/send';
import type { Middleware } from 'polka';
import { db, deniedDash } from '../../../db';
import type {
  ProjectList,
  ProjectListSimple,
  ReqQueryData,
} from '../../../types';
import { AppError, logger, Status } from '../../../utils';

const getProjectListStmt = db.prepare(`
  WITH
    cte_issue AS (
      SELECT
        project_id,
        COUNT(*) AS issue_c
      FROM issue
      WHERE ignore = 0 AND done = 0
      GROUP BY project_id
    ),
    cte_session AS (
      SELECT
        project_id,
        SUM(c) AS session_c
      FROM session_graph
      GROUP BY project_id
    )
  SELECT
    project.name,
    project.tags,
    cte_issue.issue_c,
    cte_session.session_c
  FROM project
  LEFT JOIN cte_issue ON cte_issue.project_id = project.id
  LEFT JOIN cte_session ON cte_session.project_id = project.id
`);
const getProjectNamesStmt = db.prepare('SELECT name FROM project').pluck();

function getProjectList(): ProjectList {
  return getProjectListStmt.all() as ProjectList;
}

function getProjectNames() {
  return getProjectNamesStmt.all() as ProjectListSimple;
}

export const get: Middleware = (req, res, next) => {
  try {
    const { type, ...queryRest } = req.query as ReqQueryData;

    if (Object.keys(queryRest).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    if (type !== undefined) {
      if (type !== 'simple') {
        throw new AppError('Invalid type param', Status.UNPROCESSABLE_ENTITY);
      }
    }

    const data = type === 'simple' ? getProjectNames() : getProjectList();

    send(res, Status.OK, data);
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
