/* eslint-disable consistent-return, no-underscore-dangle */

import type { Middleware, Request } from 'polka';

// Similar to `@polka/parse` but works with any content type
// https://github.com/lukeed/polka/blob/230645cd6993b07ca467b05acfd11dcb36f91c00/packages/parse/index.js
export const raw: Middleware = (
  req: Request & { _body?: true },
  _res,
  next,
) => {
  if (req._body) return next();
  req.body ||= '';

  const head = req.headers;
  const clength = Number.parseInt(head['content-length']!, 10);

  if (Number.isNaN(clength) && head['transfer-encoding'] == null) return next(); // no body
  if (clength === 0) return next(); // is empty

  let bits = '';
  req
    .on('data', (chunk) => {
      bits += chunk;
    })
    .on('end', () => {
      req.body = bits;
      req._body = true;
      void next();
    })
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    .on('error', next);
};
