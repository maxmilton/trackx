import send from '@polka/send';
import { isIP } from 'node:net';
import type { Middleware } from 'polka';
import {
  addSessionGraphHitStmt,
  addSessionStmt,
  db,
  deniedPing,
  getDailySalt,
  getProjectByKeyStmt,
  incrementDailyPings,
} from '../../../db';
import type {
  ProjectInternal,
  ReqQueryData,
  SessionInternal,
} from '../../../types';
import {
  AppError,
  config,
  getIpAddress,
  hash,
  isNotASCII,
  logger,
  Status,
  UID_SHORT_LENGTH,
} from '../../../utils';

// white 1x1 pixel GIF (35 bytes)
const pixel = Buffer.from(
  'R0lGODlhAQABAID/AP///wAAACwAAAAAAQABAAACAkQBADs=',
  'base64',
);

// // transparent 1x1 pixel GIF (42 bytes)
// const pixel = Buffer.from(
//   'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
//   'base64',
// );

const existingSessionStmt = db
  .prepare('SELECT 1 FROM session WHERE id = ? AND project_id = ?')
  .pluck();

function addSession(key: string, origin: string, ip: string, ua: string) {
  const project = getProjectByKeyStmt.get(key) as ProjectInternal | undefined;

  if (!project) {
    throw new AppError('Invalid key', Status.FORBIDDEN);
  }

  if (!project.origin.split(',').includes(origin) && project.origin !== '*') {
    throw new AppError('Invalid origin', Status.FORBIDDEN);
  }

  db.transaction(() => {
    const salt = getDailySalt();
    const sessionId = hash(Buffer.from(salt + origin + ip + ua));
    const existingSession = existingSessionStmt.get(sessionId, project.id);

    if (!existingSession) {
      const sessionData: SessionInternal = {
        id: sessionId,
        project_id: project.id,
        ts: Math.trunc(Date.now() / 1000),
        e: 0,
      };
      addSessionStmt.run(sessionData);
      addSessionGraphHitStmt.run(sessionData);
    }

    incrementDailyPings();
  })();
}

const pingMiddleware: Middleware = (req, res, next) => {
  try {
    // eslint-disable-next-line prefer-destructuring
    const origin = req.headers.origin;

    if (!origin) {
      throw new AppError('Invalid origin', Status.FORBIDDEN);
    }

    // eslint-disable-next-line prefer-destructuring
    const key = req.params.key;

    if (key.length !== UID_SHORT_LENGTH || !/^[\da-z]+$/.test(key)) {
      throw new AppError('Invalid key', Status.FORBIDDEN);
    }

    const ip = getIpAddress(req);

    if (!ip || typeof ip !== 'string' || !isIP(ip)) {
      throw new AppError('Invalid IP', Status.BAD_REQUEST);
    }

    // eslint-disable-next-line prefer-destructuring
    const accept = req.headers.accept;

    if (accept !== undefined) {
      if (typeof accept !== 'string') {
        throw new AppError('Invalid accept', Status.FORBIDDEN);
      }
    }

    const ua = req.headers['user-agent'];

    if (
      !ua
      || typeof ua !== 'string'
      || ua.length > config.MAX_UA_CHARS
      || isNotASCII(ua)
    ) {
      throw new AppError('Invalid user agent', Status.BAD_REQUEST);
    }

    const query = req.query as ReqQueryData;

    if (Object.keys(query).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    addSession(key, origin, ip, ua);

    if (req.method === 'GET' && accept?.includes('image')) {
      send(res, Status.OK, pixel, {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'image/gif',
        Pragma: 'no-cache',
        Expires: '0',
      });
    } else {
      res.writeHead(Status.OK, {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: 0,
      });
      res.end('ok');
    }
  } catch (error) {
    // DO NOT logger.error here otherwise it may cause an infinite loop
    logger.warn(error);
    void next(error || new Error(error));

    const projectKey = req.params.key;

    deniedPing(
      projectKey.length === UID_SHORT_LENGTH && /^[\da-z]+$/.test(projectKey)
        ? projectKey
        : 'invalid',
    );
  }
};

export const get = pingMiddleware;
export const post = pingMiddleware;
