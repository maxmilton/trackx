import type { Middleware } from 'polka';

// Simple endpoint to check if the service is up and running
export const get: Middleware = (_req, res) => {
  res.end('ok');
};
