import type { Database } from 'better-sqlite3';
import { diary, enable } from 'diary';
import { dim, red, yellow } from 'kleur/colors';
import { customAlphabet } from 'nanoid';
import crypto from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Server, Socket } from 'node:net';
import path from 'node:path';
import { format } from 'node:util';
import type { Polka, Request } from 'polka';
import type { Cookie } from 'tough-cookie';
import { sendEvent } from 'trackx/node';
import { EventType, OnErrorHandler } from 'trackx/types';
import UAParser from 'ua-parser-js';
import { XXHash3 } from 'xxhash-addon';
import type { TrackXAPIConfig } from './types';

export { Status } from '@trackx/http-status-codes';
export { nanoid as uid } from 'nanoid';

export const SECONDS_IN_HOUR = 3600; // 60s * 60m
export const SECONDS_IN_DAY = 86_400; // 60s * 60m * 24h
export const UID_SHORT_LENGTH = 11;
export const FORBIDDEN_PROJECT_NAMES = [
  '_',
  '-',
  'create',
  'delete',
  'insert',
  'new',
  'null',
  'undefined',
  'update',
  'void',
];
export const ISSUE_SORT_VALUES = [
  'last_seen',
  'first_seen',
  'event_count',
  'sess_count',
  'rank',
];

export class AppError extends Error {
  declare status: number | undefined;

  declare details: unknown;

  constructor(message: string, status?: number | undefined, details?: unknown) {
    super(message);
    this.name = 'AppError';
    // When passed to a middleware `next()`, polka will use status to set the
    // response statusCode
    this.status = status;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Log all the things!
enable('*');

export const config: TrackXAPIConfig = (() => {
  const CONFIG_PATH = path.resolve(
    __dirname,
    process.env.CONFIG_PATH || '../trackx.config.js',
  );
  // eslint-disable-next-line max-len
  // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-dynamic-require, global-require
  const rawConfig = require(CONFIG_PATH) as TrackXAPIConfig;
  // Override config values with env vars
  for (const key of Object.keys(rawConfig)) {
    if (process.env[key] !== undefined) {
      // @ts-expect-error - unavoidable string indexing
      rawConfig[key] = process.env[key];
    }
  }
  const rootDir = path.resolve(process.cwd(), rawConfig.ROOT_DIR || '.');

  return {
    ...rawConfig,
    DB_PATH: path.resolve(rootDir, rawConfig.DB_PATH),
    DB_ZSTD_PATH:
      rawConfig.DB_ZSTD_PATH && path.resolve(rootDir, rawConfig.DB_ZSTD_PATH),
    DB_INIT_SQL_PATH:
      rawConfig.DB_INIT_SQL_PATH
      && path.resolve(rootDir, rawConfig.DB_INIT_SQL_PATH),
  };
})();
const logLevel: Record<string, string> = {
  fatal: '✗ fatal ',
  error: '✗ error ',
  warn: '‼ warn  ',
  info: 'ℹ info  ',
};
if (process.env.NODE_ENV !== 'production') {
  logLevel.fatal = red('✗ fatal ');
  logLevel.error = red('✗ error ');
  logLevel.warn = yellow('‼ warn  ');
  logLevel.debug = dim('● debug ');
  logLevel.log = '◆ log   ';
}
export const logger = diary('', (event) => {
  if (process.env.NODE_ENV === 'production') {
    if (event.level === 'log' || event.level === 'debug') return;
  }

  let message: string;
  const error = event.messages[0];

  if (error instanceof Error && error.stack !== undefined) {
    const stack = error.stack.split('\n');
    stack.shift();
    message = `${error.message}\n${stack.join('\n')}`;

    if (event.level === 'error' || event.level === 'fatal') {
      sendEvent(error, {
        via: 'logger',
        level: event.level,
        status: (error as AppError).status,
        details: (error as AppError).details,
        extra: event.messages.length > 1 ? event.messages.slice(1) : undefined,
      });
    }
  } else {
    message = format(...event.messages);

    if (event.level === 'error' || event.level === 'fatal') {
      sendEvent(new Error(message), {
        via: 'logger',
        level: event.level,
      });
    }
  }

  if (process.env.NODE_ENV !== 'production' && event.level === 'debug') {
    message = dim(message);
  }

  // eslint-disable-next-line no-console
  console[event.level === 'fatal' ? 'error' : event.level](
    logLevel[event.level] + message,
  );
});
export const sessions = new Map<string, Cookie>();
export const uidShort = customAlphabet(
  '0123456789abcdefghijklmnopqrstuvwxyz',
  UID_SHORT_LENGTH,
);
const hasher = new XXHash3(Buffer.alloc(4));
export const uaParser = new UAParser(undefined, {
  // Add detection of our custom node client user-agent
  browser: [
    [/(node\.js)\/([\w.]+)/i],
    [UAParser.BROWSER.NAME, UAParser.BROWSER.VERSION],
  ],
});

export const handleError: OnErrorHandler = (payload, reason) => {
  if (process.env.NODE_ENV === 'production') {
    // "✗" is the first character in logger error/fatal formatted messages
    if (payload.message[0] === '✗') {
      // don't send duplicate event
      return null;
    }
    // dev builds use coloured output
  } else if (payload.message.startsWith('\u001B[31m✗')) {
    // don't send duplicate event
    return null;
  }

  if (
    payload.type === EventType.Programmatic
    && payload.meta.via === 'logger'
  ) {
    // eslint-disable-next-line no-param-reassign
    payload.type = EventType.CustomLogger;
  }

  if (reason != null && typeof reason === 'object') {
    // eslint-disable-next-line no-param-reassign
    payload.meta.status ??= (reason as AppError).status;
    // eslint-disable-next-line no-param-reassign
    payload.meta.code ??= (reason as Record<string, unknown>).code;
    // eslint-disable-next-line no-param-reassign
    payload.meta.details ??= (reason as AppError).details;
  }

  return payload;
};

export function hash(data: Buffer): Buffer {
  hasher.reset();
  hasher.update(data);
  return hasher.digest();
}

export function generateSalt(rounds: number): string {
  return crypto
    .randomBytes(Math.ceil(rounds / 2))
    .toString('base64')
    .slice(0, rounds);
}

export function humanizeTime(ms: number): string {
  const periods = {
    d: Math.floor(ms / (1000 * 60 * 60 * 24)),
    h: Math.floor(ms / (1000 * 60 * 60)) % 24,
    m: Math.floor(ms / (1000 * 60)) % 60,
    s: Math.floor(ms / 1000) % 60,
    ms: Math.floor(ms) % 1000,
  };
  const keep = [];
  let key: keyof typeof periods;

  for (key in periods) {
    if (periods[key] > 0) {
      keep.push(`${periods[key]}${key}`);
    }
  }

  return keep.join(' ');
}

export function humanizeFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  let b = bytes;
  let e = -1;
  do {
    b /= 1024;
    ++e;
  } while (b >= 1024);
  return `${b.toFixed(2)} ${'KMGTP'.charAt(e)}iB`;
}

export function byteSize(data: string | object): number {
  return Buffer.byteLength(
    typeof data === 'string' ? data : JSON.stringify(data),
    // Text strings are stored as UTF8 in SQLite
    'utf8',
  );
}

// Same validation as packages/trackx-cli/src/actions/adduser.ts
// https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address
const RE_EMAIL = /^[\w!#$%&'*+./=?^`{|}~-]+@[\dA-Za-z](?:[\dA-Za-z-]{0,61}[\dA-Za-z])?(?:\.[\dA-Za-z](?:[\dA-Za-z-]{0,61}[\dA-Za-z])?)*$/;

export function isNotValidEmail(email: string): boolean {
  return !RE_EMAIL.test(email);
}

/**
 * Check a string is (not) comprised of only printable (not control) ASCII
 * characters from within the "ASCII" range (the first 128 characters in UTF-8).
 */
export function isNotASCII(str: string): boolean {
  return !/^[\u0020-\u007E]*$/.test(str);
}

/** Check a string is (not) a valid URL origin USVString. */
export function isNotOrigin(uri: string): boolean {
  return new URL(uri).origin !== uri;
}

export function toBoolean(str: string): boolean {
  switch (str.toLowerCase()) {
    case '1':
    case 'true':
    case 'on':
    case 'yes':
    case 'y':
      return true;
    case '0':
    case 'false':
    case 'off':
    case 'no':
    case 'n':
      return false;
    default:
      throw new TypeError('Expected boolean value');
  }
}

export function getIpAddress(req: Request): string | undefined {
  return (
    (req.headers['cf-connecting-ip'] as string)
    || (req.headers['x-real-ip'] as string)
    || (req.headers['x-forwarded-for'] as string)?.split(',')[0]
    || req.socket.remoteAddress
  );
}

// https://blog.dashlane.com/implementing-nodejs-http-graceful-shutdown/

// TODO: Clean up and optimise
// TODO: Consider moving timeout values to config

const FORCED_STOP_TIMEOUT = 30_000;
const TIMEOUT_TO_TRY_END_IDLE = 15_000;

const serverStoppingHelper = (server: Server) => {
  const reqCountPerSocket = new Map<Socket, number>();
  const hasRepliedClosedConnectionForSocket = new WeakMap<Socket, boolean>();
  let terminating = false;

  const trackConnections = (socket: Socket) => {
    reqCountPerSocket.set(socket, 0);
    socket.once('close', () => {
      reqCountPerSocket.delete(socket);
    });
  };

  const checkAndCloseConnection = (req: IncomingMessage) => {
    const socketPendingRequests = reqCountPerSocket.get(req.socket)! - 1;
    const hasSuggestedClosingConnection = hasRepliedClosedConnectionForSocket.get(req.socket);

    reqCountPerSocket.set(req.socket, socketPendingRequests);
    if (
      terminating
      && socketPendingRequests === 0
      && hasSuggestedClosingConnection
    ) {
      req.socket.end();
    }
  };

  const trackRequests = (req: IncomingMessage, res: ServerResponse) => {
    const currentCount = reqCountPerSocket.get(req.socket)!;
    reqCountPerSocket.set(req.socket, currentCount + 1);

    if (terminating && !res.headersSent) {
      res.setHeader('connection', 'close');
      hasRepliedClosedConnectionForSocket.set(req.socket, true);
    }

    res.on('finish', () => checkAndCloseConnection(req));
  };

  const endAllConnections = ({ force }: { force: boolean }) => {
    for (const [socket, reqCount] of reqCountPerSocket) {
      if (force || reqCount === 0) {
        socket.end();
      }
    }
  };

  server.on('connection', trackConnections);
  server.on('request', trackRequests);

  const stoppingFunction = (cb: (err?: Error) => void) => {
    terminating = true;
    server.close(cb);

    if (TIMEOUT_TO_TRY_END_IDLE < FORCED_STOP_TIMEOUT) {
      setTimeout(
        () => endAllConnections({ force: false }),
        TIMEOUT_TO_TRY_END_IDLE,
      );
    }
    setTimeout(() => endAllConnections({ force: true }), FORCED_STOP_TIMEOUT);
  };

  return stoppingFunction;
};

export const getServerStop = (server: Server): (() => Promise<void>) => {
  const serverStopper = serverStoppingHelper(server);

  return () => new Promise<void>((resolve, reject) => {
    serverStopper((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

function fileExists(filepath: string) {
  try {
    return fs.statSync(filepath).isFile();
  } catch {
    return false;
  }
}

// TODO: Decide if we want to keep support for plugins. At the moment it's only
// used for trackx-demo. If we keep then document the interface.
export function loadPlugin(filepath: string, app: Polka, db: Database): void {
  const pluginPath = path.resolve(__dirname, filepath);

  if (fileExists(pluginPath)) {
    logger.debug('Loading plugin...');

    try {
      // eslint-disable-next-line
      require(pluginPath).default({
        app,
        db,
        config,
        logger,
      });
    } catch (error) {
      logger.error(error);
    }
  } else {
    logger.debug('No plugin found');
  }
}
