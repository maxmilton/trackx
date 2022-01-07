import type { Middleware } from 'polka';
import { addMeta, db, deniedDash } from '../../../../db';
import type {
  ProjectInternal,
  ReqBodyData,
  ReqQueryData,
} from '../../../../types';
import {
  AppError, logger, Status, uidShort,
} from '../../../../utils';

const getProjectKeyByNameStmt = db.prepare(
  'SELECT id, key FROM project WHERE name = ?',
);
const setNewProjectKeyStmt = db.prepare(
  'UPDATE project SET key = ? WHERE name = ?',
);

function setNewProjectKey(projectName: string): void {
  const project = getProjectKeyByNameStmt.get(projectName) as
    | ProjectInternal
    | undefined;

  if (!project) {
    throw new AppError('Project not found', Status.NOT_FOUND);
  }

  const newKey = uidShort();
  setNewProjectKeyStmt.run(newKey, projectName);

  // Record key change for debugging, may be useful together with denied request logs
  addMeta(
    `key-change-${project.key}`,
    `{"project_id":${project.id},"ts":${Date.now()},"to":"${newKey}"}`,
  );
}

export const post: Middleware = (req, res, next) => {
  try {
    const { name } = req.params;

    if (name.length > 40 || !/^[\d_a-z-]+$/.test(name)) {
      throw new AppError('Invalid name', Status.UNPROCESSABLE_ENTITY);
    }

    const query = req.query as ReqQueryData;

    if (Object.keys(query).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    const body = req.body as ReqBodyData;

    if (typeof body !== 'object' || Object.keys(body).length > 0) {
      throw new AppError('Unexpected property', Status.BAD_REQUEST);
    }

    setNewProjectKey(name);
    res.end();
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
