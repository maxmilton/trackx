import type { Middleware } from 'polka';
import { db, deniedDash } from '../../../db';
import type {
  ProjectInternal,
  ReqBodyData,
  ReqQueryData,
} from '../../../types';
import {
  AppError,
  FORBIDDEN_PROJECT_NAMES,
  isNotASCII,
  isNotOrigin,
  logger,
  Status,
  uidShort,
} from '../../../utils';
import { taggedInternal } from './[name]/index';

const addProjectStmt = db.prepare(`
  INSERT INTO project (
    key,
    origin,
    name,
    scrape,
    tags
  )
  VALUES (
    ?,
    @origin,
    @name,
    @scrape,
    @tags
  )
`);

function addProject(data: Omit<ProjectInternal, 'id' | 'key'>) {
  addProjectStmt.run(uidShort(), data);
}

export const options: Middleware = (_req, res) => {
  res.writeHead(Status.NO_CONTENT, {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST',
  });
  res.end();
};

export const post: Middleware = (req, res, next) => {
  try {
    const query = req.query as ReqQueryData;

    if (Object.keys(query).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    const {
      origin, name, scrape, tags, ...rest
    } = req.body as ReqBodyData;

    if (Object.keys(rest).length > 0) {
      throw new AppError('Unexpected field', Status.BAD_REQUEST);
    }

    // TODO: Reuse validation with PUT packages/trackx-api/src/routes/dash/project/[name]/index.ts
    // TODO: Include the same validation on the frontend too

    if (
      !name
      || typeof name !== 'string'
      || name.length > 40
      || !/^[\d_a-z-]+$/.test(name)
    ) {
      throw new AppError('Invalid name value', Status.UNPROCESSABLE_ENTITY);
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
      throw new AppError('Invalid origin value', Status.UNPROCESSABLE_ENTITY);
    }

    if (tags !== undefined) {
      if (
        typeof tags !== 'string'
        || tags.length > 1024
        || isNotASCII(tags)
        || tags.split(',').some((t) => !t.trim())
      ) {
        throw new AppError('Invalid tags value', Status.UNPROCESSABLE_ENTITY);
      }

      if (taggedInternal(tags)) {
        throw new AppError(
          '"trackx-internal" tag not allowed',
          Status.FORBIDDEN,
        );
      }
    }

    if (scrape !== undefined) {
      if (typeof scrape !== 'boolean') {
        throw new AppError('Invalid scrape value', Status.UNPROCESSABLE_ENTITY);
      }
    }

    addProject({
      origin,
      name,
      scrape: scrape ? 1 : 0,
      tags: tags || undefined,
    });
    res.end();
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
