// TODO: Documentation:
// - Extra function calls overhead

// TODO: Features; something like compat + default + aim for maximum browser support

// TODO: Which async methods should be wrapped? `fetch` probably shouldn't for example

// References:
// - https://github.com/csnover/TraceKit/blob/master/tracekit.js
// - https://github.com/getsentry/sentry-javascript/blob/master/packages/browser/src/tracekit.ts
// - https://github.com/getsentry/sentry-javascript/blob/3.x/packages/raven-js/vendor/TraceKit/tracekit.js
// - https://github.com/inf3rno/error-polyfill
// - https://github.com/ampproject/error-tracker/blob/main/utils/stacktrace/standardize-stack-trace.js
// - https://github.com/stacktracejs/stacktrace.js
// - https://cdn.jsdelivr.net/npm/trackjs@3.10.1/index.esm.js
// - https://github.com/bugsnag/bugsnag-js
// - https://github.com/airbrake/airbrake-js/blob/master/packages/browser/src/processor/esp.ts
// - https://github.com/cheeaun/javascript-error-logging
// - https://www.bugsnag.com/blog/js-stacktraces

// TODO: Some xhr considerations need to be made for old browsers:
//  ↳ https://github.com/jquery/jquery/blob/1.12-stable/src/ajax/xhr.js
//  ↳ https://github.com/jquery/jquery/blob/1.12-stable/src/ajax.js

/* eslint-disable @typescript-eslint/no-unused-vars */

// import globalThis from '@ungap/global-this';
import type { ClientType, EventMeta, OnErrorHandler } from 'trackx/types';
// import { assign, noop } from '../utils';

console.warn(
  'trackx/extended is currently a no op, please use a different client',
);

export const meta: EventMeta = {
  // TODO: Work out how to make esbuild inline an imported const enum
  _c: 'e' as ClientType.Extended,
  _v: process.env.TRACKX_VERSION,
};

export function sendEvent(_error: Error, _extraMeta?: EventMeta): void {}

export function setup(_endpoint: string, _onError?: OnErrorHandler): void {}

export function ping(_endpoint: string): void {}
