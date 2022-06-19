/* eslint-disable unicorn/no-nested-ternary */

import * as trackx from 'trackx';
import * as config from '../trackx.config.mjs';
import type { AppError } from './utils';

declare global {
  interface Window {
    // Added by /trackx.js script in index.html
    trackx?: typeof trackx;
  }
}

// TODO: Document this can be useful for debugging but is not supported by all
// browsers (e.g., Firefox, old Opera) + mention browser defaults
//  ↳ Suggest to use the same value as API config.MAX_STACK_FRAMES (or keep defaults!)
//  ↳ Higher values may have a negative performance/mem impact
//  ↳ https://v8.dev/docs/stack-trace-api
// Error.stackTraceLimit = 40;

trackx.setup(
  `${config.REPORT_API_BASE_URL}/${config.REPORT_API_KEY}`,
  // TODO: Document this is a good technique for adding extra meta data without
  // needing to explicitly call `trackx.sendEvent()`
  (payload, reason) => {
    if (reason != null && typeof reason === 'object') {
      // eslint-disable-next-line no-param-reassign
      payload.meta.code = (reason as AppError).code;
      // eslint-disable-next-line no-param-reassign
      payload.meta.details = (reason as AppError).details;
    }

    return payload;
  },
);
trackx.meta.release = process.env.APP_RELEASE;

// TODO: Document these data points can be useful for debugging web apps, they
// would be a good example for "how to add meta data", but keep in mind they
// are varying degrees of PII
trackx.meta.referrer = document.referrer;
// trackx.meta.touch = 'ontouchstart' in document.documentElement;
// trackx.meta.viewport_width = window.innerWidth;
// trackx.meta.viewport_height = window.innerHeight;
// trackx.meta.orientation = window.screen.orientation.type;

// Privacy-friendly alternative to exact screen width
// Note this width is not multiplied by devicePixelRatio (which would give the
// true pixel width, however we want the "virtual"/scaled width)
const screenWidth = window.screen.width;
trackx.meta.screen_size = screenWidth < 576
  ? 'XS'
  : screenWidth < 992
    ? 'S'
    : screenWidth < 1440
      ? 'M'
      : screenWidth < 3840
        ? 'L'
        : 'XL';

if (process.env.NODE_ENV !== 'production') {
  trackx.meta.NODE_ENV = process.env.NODE_ENV || 'NULL';
}

trackx.ping();

export const { sendEvent } = trackx;
