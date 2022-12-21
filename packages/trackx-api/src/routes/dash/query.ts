/**
 * @fileoverview Run arbitrary SQL query against the DB. This is obviously a
 * massive security hole and must only be used in development builds.
 */

import send from '@polka/send';
import type { Middleware } from 'polka';
import { db, deniedDash } from '../../db';
import type { ReqBodyData, ReqQueryData } from '../../types';
import {
  AppError,
  byteSize,
  humanizeFileSize,
  logger,
  Status,
  toBoolean,
} from '../../utils';

function adHocQuery(
  sql: string,
  opts: {
    exec: boolean | undefined;
    expand: boolean | undefined;
    pluck: boolean | undefined;
    raw: boolean | undefined;
    single: boolean | undefined;
  },
) {
  if (opts.exec) {
    db.exec(sql);
    return null;
  }
  const stmt = db.prepare(sql);
  if (opts.pluck) stmt.pluck();
  if (opts.expand) stmt.expand();
  if (opts.raw) stmt.raw();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return stmt.reader ? (opts.single ? stmt.get() : stmt.all()) : stmt.run();
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
    let {
      exec,
      expand,
      pluck,
      raw,
      single,
      // eslint-disable-next-line prefer-const
      ...rest
    } = req.query as ReqQueryData;
    const sql = req.body as ReqBodyData;

    if (Object.keys(rest).length > 0) {
      throw new AppError(`Unexpected param ${rest}`, Status.BAD_REQUEST);
    }

    if (exec !== undefined) {
      if (typeof exec === 'string') {
        exec = toBoolean(exec);
      }
      if (typeof exec !== 'boolean') {
        throw new AppError('Invalid exec param', Status.UNPROCESSABLE_ENTITY);
      }
    }

    if (expand !== undefined) {
      if (typeof expand === 'string') {
        expand = toBoolean(expand);
      }

      if (typeof expand !== 'boolean') {
        throw new AppError('Invalid expand param', Status.UNPROCESSABLE_ENTITY);
      }
    }

    if (pluck !== undefined) {
      if (typeof pluck === 'string') {
        pluck = toBoolean(pluck);
      }

      if (typeof pluck !== 'boolean') {
        throw new AppError('Invalid pluck param', Status.UNPROCESSABLE_ENTITY);
      }
    }

    if (raw !== undefined) {
      if (typeof raw === 'string') {
        raw = toBoolean(raw);
      }

      if (typeof raw !== 'boolean') {
        throw new AppError('Invalid raw param', Status.UNPROCESSABLE_ENTITY);
      }
    }

    if (
      (exec && (expand || pluck || raw))
      || (expand && (pluck || raw))
      || (pluck && raw)
    ) {
      throw new AppError(
        'expand, pluck, and raw are mutually exclusive',
        Status.UNPROCESSABLE_ENTITY,
      );
    }

    if (single !== undefined) {
      if (typeof single === 'string') {
        single = toBoolean(single);
      }

      if (typeof single !== 'boolean') {
        throw new AppError('Invalid single param', Status.UNPROCESSABLE_ENTITY);
      }
    }

    // sql length is limited to the @polka/parse maximum parse limit
    if (!sql || typeof sql !== 'string') {
      throw new AppError('Invalid sql format', Status.UNPROCESSABLE_ENTITY);
    }

    logger.warn('AD HOC QUERIES ARE A SECURITY RISK. FOR DEVELOPMENT ONLY.');
    logger.debug(`SQL payload ${humanizeFileSize(byteSize(sql))}`);

    const data = adHocQuery(sql, {
      exec,
      expand,
      pluck,
      raw,
      single,
    });
    send(res, Status.OK, data);
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
