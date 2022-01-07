import send from '@polka/send';
import type { Middleware } from 'polka';
import { db, deniedDash, getProjectByNameStmt } from '../../../../db';
import type {
  Issue,
  ProjectInternal,
  ProjectOverview,
  ReqQueryData,
} from '../../../../types';
import { AppError, logger, Status } from '../../../../utils';
import { trimIssues } from '../../issue/all';

const getIssuesLatestStmt = db.prepare(`
  SELECT id, ts_last, name, message, uri
  FROM issue
  WHERE project_id = ? AND ignore = 0 AND done = 0
  ORDER BY ts_last DESC
  LIMIT 10
`);
// TODO: This data is currently used as a filler so we have something more to
// show on the project overview page... if we keep this, it may be worth
// optimising the query/data since no index covers the GROUP BY and the data is
// not available anywhere else in a higher performance way
//  ↳ If we start seeing slow queries it may be worth splitting this query into
//    a separate fetch on the frontend so it will show whatever data it can
//    first... but the order of fetches need to be correct since there's only a
//    single backend and since all parts of requests including the DB queries
//    are processed sequentially the results come back in the order they're made
//    ↳ We could perform long running read only queries in a separate thread
//      ↳ https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/threads.md
//  ↳ This is a particular scenario where the high performance ad hoc queries
//    of a columar DB like clickhouse would do really well
//  ↳ It's worth exploring other data that might be more useful to replace this
//    ↳ Project releases? Maybe as a future feature... but is it worth the
//      complexity? A big goal for TrackX is the inherent simplicity
//  ↳ If we did keep this, should clients allow for custom set uri values? Not
//    all projects will be web browser based with URLs (so window.location.href
//    might not make sense, although in theory consumers could set that value
//    to whatever when not in a traditional web browser environment)
const getIssueUriFreqStmt = db.prepare(`
  SELECT
    uri,
    COUNT(*) as uri_c,
    MAX(ts_last) as ts_last,
    MIN(ts_first) as ts_first
  FROM issue
  WHERE project_id = ? AND ignore = 0 AND done = 0
  GROUP BY uri
  ORDER BY uri_c DESC
  LIMIT 10
`);

function getProjectOverview(projectName: string): ProjectOverview {
  const project = getProjectByNameStmt.get(projectName) as
    | ProjectInternal
    | undefined;

  if (!project) {
    throw new AppError('Project not found', Status.NOT_FOUND);
  }

  const issues = getIssuesLatestStmt.all(project.id) as Issue[];
  const uris = getIssueUriFreqStmt.all(project.id);

  return {
    issues: trimIssues(issues),
    uris,
  };
}

export const get: Middleware = (req, res, next) => {
  try {
    const { name } = req.params;

    if (name.length > 40 || !/^[\d_a-z-]+$/.test(name)) {
      throw new AppError('Invalid name', Status.UNPROCESSABLE_ENTITY);
    }

    const query = req.query as ReqQueryData;

    if (Object.keys(query).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    const data = getProjectOverview(name);
    send(res, Status.OK, data);
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
