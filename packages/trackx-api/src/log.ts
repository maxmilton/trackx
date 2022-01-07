/**
 * @fileoverview Simple http request logger. Intended for visibility into API
 * requests and not as a full-blown trace for security/accountability purposes,
 * hence the lack of key information like time stamp and IP address. For more
 * in-depth logging use Nginx logs etc.
 */

import { green, red, yellow } from 'kleur/colors';
import { performance } from 'perf_hooks';
import type { Middleware } from 'polka';

export const log: Middleware = (req, res, next) => {
  const start = performance.now();
  void next();

  const writeLog = () => {
    const duration = (performance.now() - start).toFixed(2);
    const statusCode = process.env.NODE_ENV === 'development'
      ? (res.statusCode >= 400
        ? red
        : (res.statusCode >= 300
          ? yellow
          : green))(res.statusCode)
      : res.statusCode;

    process.stdout.write(
      `[http] ${duration}ms ${statusCode} ${req.method} ${
        req.originalUrl || req.url
      } < ${req.headers.referer || req.headers.origin}\n`,
    );
  };

  res.once('finish', writeLog);
  res.once('error', writeLog);
};
