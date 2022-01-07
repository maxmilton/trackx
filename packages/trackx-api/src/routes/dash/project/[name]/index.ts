import send from '@polka/send';
import type { Middleware } from 'polka';
import { db, deniedDash, getProjectByNameStmt } from '../../../../db';
import type {
  ProjectInternal,
  ReqBodyData,
  ReqQueryData,
} from '../../../../types';
import {
  AppError,
  FORBIDDEN_PROJECT_NAMES,
  isNotASCII,
  isNotOrigin,
  logger,
  Status,
} from '../../../../utils';

const getProjectStmt = db.prepare(`
  SELECT key, origin, name, scrape, tags
  FROM project
  WHERE name = ?
`);
const setProjectStmt = db.prepare(`
  UPDATE project
  SET
    origin = @origin,
    name = @name,
    scrape = @scrape,
    tags = @tags
  WHERE name = ?
`);
const delProjectStmt = db.prepare('DELETE FROM project WHERE id = ?');

export function taggedInternal(tags: string | undefined): boolean | undefined {
  return tags?.split(',').includes('trackx-internal');
}

function getProject(projectName: string): ProjectInternal {
  const project = getProjectStmt.get(projectName) as
    | ProjectInternal
    | undefined;

  if (!project) {
    throw new AppError('Project not found', Status.NOT_FOUND);
  }

  project.scrape = !!project.scrape;
  return project;
}

function setProject(
  projectName: string,
  data: Omit<ProjectInternal, 'id' | 'key'>,
) {
  const project = getProjectByNameStmt.get(projectName) as ProjectInternal;

  if (!project) {
    throw new AppError('Project not found', Status.NOT_FOUND);
  }

  const newInternalTag = taggedInternal(data.tags);

  if (taggedInternal(project.tags)) {
    if (!newInternalTag) {
      throw new AppError(
        'Removing "trackx-internal" tag not allowed',
        Status.FORBIDDEN,
      );
    }
  } else if (newInternalTag) {
    throw new AppError(
      'Adding "trackx-internal" tag not allowed',
      Status.FORBIDDEN,
    );
  }

  setProjectStmt.run(projectName, data);

  // TODO: Should name changes be logged in a meta entry?
}

function delProject(projectName: string) {
  const project = getProjectByNameStmt.get(projectName) as ProjectInternal;

  if (!project) {
    throw new AppError('Project not found', Status.NOT_FOUND);
  }

  if (taggedInternal(project.tags)) {
    throw new AppError('Cannot delete internal project', Status.FORBIDDEN);
  }

  delProjectStmt.run(project.id);

  // TODO: Should this be logged in a meta entry?
}

export const options: Middleware = (_req, res) => {
  res.writeHead(Status.NO_CONTENT, {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,PUT,DELETE',
  });
  res.end();
};

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

    const data = getProject(name);
    send(res, Status.OK, data);
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
  }
};

export const put: Middleware = (req, res, next) => {
  try {
    const {
      origin, name, scrape, tags, ...rest
    } = req.body as ReqBodyData;

    if (Object.keys(rest).length > 0) {
      throw new AppError('Unexpected property', Status.BAD_REQUEST);
    }

    const query = req.query as ReqQueryData;

    if (Object.keys(query).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    const pName = req.params.name;

    // TODO: Reuse validation with POST packages/trackx-api/src/routes/dash/project/index.ts
    // TODO: Include the same validation on the frontend too

    if (
      !name
      || typeof name !== 'string'
      || pName.length > 40
      || name.length > 40
      || !/^[\d_a-z-]+$/.test(pName)
      || !/^[\d_a-z-]+$/.test(name)
    ) {
      throw new AppError('Invalid name', Status.UNPROCESSABLE_ENTITY);
    }

    if (FORBIDDEN_PROJECT_NAMES.includes(name)) {
      throw new AppError(`Name "${name}" is forbidden`, Status.CONFLICT);
    }

    if (
      !origin
      || typeof origin !== 'string'
      || origin.length > 1024
      || (origin !== '*' && origin.split(',').some(isNotOrigin))
    ) {
      throw new AppError('Invalid origin', Status.UNPROCESSABLE_ENTITY);
    }

    if (tags !== undefined) {
      if (
        typeof tags !== 'string'
        || tags.length > 1024
        || isNotASCII(tags)
        || tags.split(',').some((t) => !t.trim())
      ) {
        throw new AppError('Invalid tags', Status.UNPROCESSABLE_ENTITY);
      }
    }

    if (scrape !== undefined) {
      if (typeof scrape !== 'boolean') {
        throw new AppError('Invalid scrape value', Status.UNPROCESSABLE_ENTITY);
      }
    }

    setProject(pName, {
      origin,
      name,
      scrape: scrape ? 1 : 0,
      tags: tags || undefined,
    });
    res.end();
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
  }
};

export const del: Middleware = (req, res, next) => {
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

    if (typeof body !== 'undefined') {
      throw new AppError('Unexpected property', Status.BAD_REQUEST);
    }

    delProject(name);
    res.end();
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
