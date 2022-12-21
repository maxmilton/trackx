import { Cookie } from '@trackx/cookie';
import type { Middleware, Request } from 'polka';
import { deniedDash } from '../../db';
import type { ReqQueryData } from '../../types';
import {
  AppError, config, logger, sessions, Status,
} from '../../utils';

interface SessionRequest extends Request {
  sessId?: string;
}

function uriToOrigin(uri: string) {
  try {
    return new URL(uri).origin;
  } catch {
    /* No op */
  }
  return '';
}

export const session: Middleware = (req: SessionRequest, _res, next) => {
  try {
    const { origin, referer } = req.headers;

    // Validate origin to mitigate simple CSRF attacks
    // Fallback to origin of referer if an origin header was not sent -- for
    // compatibility with old browsers, "safe" fetch methods (GET, HEAD), and
    // "no-cors" mode fetch
    if (
      (!origin && !referer)
      || (origin || uriToOrigin(referer!)) !== config.DASH_ORIGIN
    ) {
      throw new AppError('Forbidden', Status.FORBIDDEN);
    }

    if (
      req.sessId
      || req.originalUrl === '/dash/login'
      || req.originalUrl === '/dash/logout'
    ) {
      void next();
      return;
    }

    const hCookie = req.headers.cookie;

    if (
      !hCookie
      || typeof hCookie !== 'string'
      || hCookie.length !== 24 // "id=" + 21 character session ID
    ) {
      throw new AppError('Unauthorized', Status.UNAUTHORIZED);
    }

    const cookie = Cookie.parse(hCookie);

    if (!cookie || cookie.key !== 'id' || !sessions.has(cookie.value)) {
      throw new AppError('Unauthorized', Status.UNAUTHORIZED);
    }

    const sessCookie = sessions.get(cookie.value)!;

    if (sessCookie.TTL() <= 0) {
      sessions.delete(cookie.value);
      throw new AppError('Unauthorized', Status.UNAUTHORIZED);
    }

    req.sessId = cookie.value;
    void next();
  } catch (error) {
    if (
      error instanceof AppError
      && (error.status === Status.FORBIDDEN
        || error.status === Status.UNAUTHORIZED)
    ) {
      logger.warn(error.message);
    } else {
      logger.error(error);
    }
    void next(error || new Error(error));

    if (error instanceof AppError && error.status !== Status.UNAUTHORIZED) {
      deniedDash();
    }
  }
};

export const get: Middleware = (req, res, next) => {
  try {
    const query = req.query as ReqQueryData;

    if (Object.keys(query).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    // Session has already been validated by this point
    res.end();
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
