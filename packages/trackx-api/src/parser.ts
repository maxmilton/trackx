/* eslint-disable consistent-return, no-underscore-dangle */

import type { Middleware, Request } from 'polka';

export type RawBodyRequest = Request & {
  _rawbody?: true;
  rawbody?: string;
};

// similar logic as `@polka/parse` but works with any content type
// based on https://github.com/lukeed/polka/blob/230645cd6993b07ca467b05acfd11dcb36f91c00/packages/parse/index.js
export const raw: Middleware = (req: RawBodyRequest, _res, next) => {
  if (req._rawbody) return next();
  req.rawbody ||= '';

  const head = req.headers;
  const clength = Number.parseInt(head['content-length']!, 10);

  if (Number.isNaN(clength) && head['transfer-encoding'] == null) return next(); // no body

  let bits = '';
  req
    .on('data', (chunk) => {
      bits += chunk;
    })
    .on('end', () => {
      req.rawbody = bits;
      req._rawbody = true;
      void next();
    })
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    .on('error', next);
};
