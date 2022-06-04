// TODO: Go over all potential stored XSS vectors (anything that's stored in
// the DB and then rendered in the frontend in a way that makes it malicious
// like in a script or in a way where it can break out of the DOM context and
// inject a script etc.)
//  ↳ https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
//  ↳ https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html

// TODO: Go over all potential reflected XSS vectors (anything that's not
// necessarily stored in the DB but is rendered on the frontend as an error
// message, UI feedback, events which take dynamic input, anything in the UI
// which takes URL segments/query params, etc. which can then break out of its
// context)

// TODO: Consistent patterns for input validation; optional inputs, where
// default values are set (especially for pagination; offset, limit), where DB
// data type conversion happens

// TODO: Should the incoming request max body size be increased? Currently 100kb
// set in https://github.com/lukeed/polka/blob/next/packages/parse/index.js

import { json, parse, text } from '@polka/parse';
import http from 'http';
import polka, { type Middleware } from 'polka';
import * as trackx from 'trackx/node';
import { db } from './db';
import { log } from './log';
import { session } from './routes/dash/sess';
import { routes } from './routes/__ROUTE_MANIFEST__';
import {
  config,
  getServerStop,
  handleError,
  loadPlugin,
  logger,
} from './utils';

const origin = `http://${config.HOST}:${config.PORT}`;

trackx.setup(config.REPORT_API_ENDPOINT, handleError, origin);
trackx.meta.release = process.env.APP_RELEASE;

if (process.env.NODE_ENV !== 'production') {
  trackx.meta.NODE_ENV = process.env.NODE_ENV || 'NULL';
  Error.stackTraceLimit = 40;
}

const server = http.createServer();
const stop = getServerStop(server);
const app = polka({ server });

process.on('exit', () => {
  db.close();
  logger.info('Server stopped');
});

const handleExit = (callback: () => void) => {
  logger.info('Stopping...');
  stop().catch(logger.fatal).finally(callback);
};

process.on('SIGHUP', () => handleExit(() => process.exit(128 + 1)));
process.on('SIGINT', () => handleExit(() => process.exit(128 + 2)));
process.on('SIGTERM', () => handleExit(() => process.exit(128 + 15)));

app.use(log);
app.use('/dash/*', session);

const methods = [
  'all',
  'del', // "delete" keyword is reserved in JS
  'get',
  'head',
  'options',
  'post',
  'put',
  // 'connect',
  // 'patch',
  // 'trace',
] as const;

for (const route of routes) {
  for (const method of methods) {
    // @ts-expect-error - Each route only implements certain methods
    const handler = route.module[method] as Middleware | undefined;

    if (handler) {
      switch (method) {
        case 'post':
        case 'put':
          if (
            process.env.NODE_ENV !== 'production'
            && route.path === '/dash/query'
          ) {
            const limit = 300 * 1024 * 1024; // 300MiB
            app[method](route.path, text({ limit }), handler);
          } else if (route.path === '/v1/:key/event') {
            app[method](
              route.path,
              // TODO: Should the incoming event max body size be a separate
              // config option rather than MAX_EVENT_BYTES?
              json({ limit: config.MAX_EVENT_BYTES }),
              handler,
            );
          } else if (route.path === '/v1/:key/report') {
            app[method](route.path, parse({ type: '' }), handler);
          } else {
            app[method](route.path, json(), handler);
          }
          break;
        case 'del':
          app.delete(route.path, handler);
          break;
        default:
          app[method](route.path, handler);
          break;
      }
    }
  }
}

loadPlugin('plugin.js', app, db);

app.listen(config.PORT, config.HOST, () => {
  logger.info(`Running on ${origin}`);

  // Normally ping() can be called after setup() but we need to wait until the
  // actual server is running first to accept the request!
  trackx.ping();
});
