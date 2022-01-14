/**
 * @fileoverview Simple health endpoint to check if the service is up and
 * running. This endpoint should not be exposed publicly.
 */

import type { Middleware } from 'polka';

export const get: Middleware = (_req, res) => {
  res.end('ok');
};
