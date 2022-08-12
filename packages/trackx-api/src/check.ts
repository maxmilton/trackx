/**
 * Make a request to a passed URL and check it returns a 200 status code.
 *
 * @fileoverview Because the docker image does not contain curl or another tool
 * to make HTTP requests, we can instead use this simple script to make a
 * request. The intended use is to make a request to the API health endpoint to
 * check the service is up.
 *
 * @example
 * node check.js http://localhost:8000/health
 */

import { request } from 'node:http';

const url = process.argv[2];
const opts = { timeout: 3000 };
const req = request(url, opts, (res) => {
  const code = res.statusCode;

  if (code !== 200) {
    throw new Error(`Status code ${code}`);
  }
});

req.on('error', (err) => {
  throw err;
});
req.on('timeout', () => {
  req.destroy();
  throw new Error('Timeout');
});

req.end();
