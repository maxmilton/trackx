/* eslint-disable unicorn/no-nested-ternary */

import * as trackx from 'trackx';
import * as config from '../trackx.config.mjs';
import type { AppError } from './utils';

// Add trackx.sendEvent type to the global scope for use in frontend apps
declare global {
  interface Window {
    trackx?: {
      sendEvent: typeof trackx.sendEvent;
    };
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

// Alternative to capturing an exact screen width; low accuracy but interesting
// data point and privacy-friendly. Idea from plausible:
// - https://github.com/plausible/analytics/blob/086d4de74e7b29ed85d1f88067eff4c8598fa71a/tracker/src/plausible.js#L53
// - https://github.com/plausible/analytics/blob/7a02aae2a562efd39f11fa405c0f084c4d59e8cc/lib/plausible_web/controllers/api/external_controller.ex#L255-L258
const screenWidth = window.screen.width;
trackx.meta.screen_size = screenWidth < 576
  ? 'Mobile'
  : screenWidth < 992
    ? 'Tablet'
    : screenWidth < 1440
      ? 'Laptop'
      : 'Desktop';

if (process.env.NODE_ENV !== 'production') {
  trackx.meta.NODE_ENV = process.env.NODE_ENV || 'NULL';
}

trackx.ping();

export const { sendEvent } = trackx;
