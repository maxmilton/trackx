/* eslint-disable no-underscore-dangle */

// XXX: This compat client is still not well tested and needs additional work
//  ↳ Known issues:
//    - `console.error` doesn't capture message
//    - Promise rejections not captured (it's assumed you're not using promises
//      if you're using compat)

// TODO: Although the concepts in this current implementation are sound, there
// needs to be a lot more testing to validate everything works or what else may
// be necessary for feature parity with our other clients

import globalThis from '@ungap/global-this';
import type {
  ClientType,
  EventMeta,
  EventPayload,
  EventType,
  OnErrorHandler,
} from 'trackx/types';
import { assign, noop } from './utils';

// TODO: Work out how to make esbuild inline an imported const enum
const EventTypeUnhandledError = 1;
// const EventTypeUnhandledRejection = 2;
const EventTypeConsoleError = 3;
const EventTypeProgrammatic = 4;

const FALLBACK_LOCK_TTL = 1800; // seconds; 30 minutes
const FAIL_LIMIT = 20;
const RETRY_LIMIT = 4;
const TIMEOUT_MS = 60_000; // 60 seconds

let oldConsoleError: Console['error'];

/** Global meta data sent with every event. Must be JSON serialisable. */
export const meta: EventMeta = {
  // TODO: Work out how to make esbuild inline an imported const enum
  _c: 'c' as ClientType.Compat,
  _v: process.env.TRACKX_VERSION,
};
let apiEndpoint: string;
let onErrorHandler: OnErrorHandler | undefined;
let failCount = 0;
let lock: number;

const sendCapturedEvent = (
  payload: EventPayload,
  reason: unknown,
  attempt?: number,
): void => {
  // Bail while lock is active to prevent flooding the API
  if (Date.now() < lock) return;

  // @ts-expect-error - cheeky use of payload value to exit
  // eslint-disable-next-line no-cond-assign, no-param-reassign
  if (onErrorHandler && !(payload = onErrorHandler(payload, reason))) return;

  const req = new XMLHttpRequest();
  req.open('POST', apiEndpoint + '/event');
  req.setRequestHeader('content-type', 'application/json');
  req.timeout = TIMEOUT_MS;

  req.onreadystatechange = () => {
    // 4 == XMLHttpRequest.DONE
    if (req.readyState === 4) {
      // 429 == "Too Many Requests"
      if (req.status === 429) {
        lock = Date.now()
          + (+req.getResponseHeader('retry-after')! || FALLBACK_LOCK_TTL) * 1000;
      } else if (req.status !== 200) {
        // eslint-disable-next-line no-param-reassign
        attempt = attempt || 0;

        if (failCount++ > FAIL_LIMIT) {
          // Network errors occurred too many times so lock out sending future
          // events for a while as an abuse prevention measure
          lock = FALLBACK_LOCK_TTL * 1000;
        } else if (attempt < RETRY_LIMIT) {
          setTimeout(() => {
            sendCapturedEvent(payload, reason, attempt! + 1);
            // eslint-disable-next-line no-restricted-properties, prefer-exponentiation-operator
          }, 1000 * Math.pow(4, attempt));
        } else {
          oldConsoleError.call(console, 'Send error');
        }
      }
    }
  };

  req.send(JSON.stringify(payload));
};

const captureEvent = (type: EventType, x: unknown, extraMeta?: EventMeta) => {
  const ex = (x != null && typeof x === 'object' ? x : {}) as Error;
  let message = (ex.message || x) as string;
  let stack = ex.stack;
  // TODO: In extended client also use the stacktrace property for Opera 10 support
  // let stack = ex.stack || ex.stacktrace;

  try {
    message = String(message);
  } catch (error) {
    // Protect against primitive string conversion fail e.g., Object.create(null)
    message = Object.prototype.toString.call(message);
  }

  // TODO: The stack property might not be available on old JS engines at all
  // and so this definitely need lots of exploratory testing
  if (!stack) {
    // IE 10/11 doesn't initialize the stack until the Error is thrown
    try {
      throw new Error();
    } catch (error) {
      stack = (error as Error).stack;
      // TODO: In extended client also use the stacktrace property for Opera 10 support
      // stack = (error as Error).stack || error.stacktrace;
    }
  }

  sendCapturedEvent(
    {
      name: ex.name,
      message,
      stack,
      type,
      uri: (globalThis.location || {}).href,
      meta: assign(assign({}, meta), extraMeta),
    },
    x,
  );
};

interface WrappedFunction extends Function {
  __xw?: this;
}

// FIXME: Write up examples of use
// FIXME: Write JSDoc comment explaining it's a wrapper for your code and it's
// required for unhandled error capture
export const wrap = <T extends WrappedFunction>(fn: T): T => {
  if (!fn.__xw) {
    // @ts-expect-error - transparent wrapper
    // eslint-disable-next-line no-param-reassign
    fn.__xw = function () {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return fn.apply(this, arguments);
      } catch (error) {
        captureEvent(EventTypeUnhandledError, error);
        throw error;
      }
    };
  }

  return fn.__xw as T;
};

const wrapTimer = (name: 'setTimeout' | 'setInterval'): void => {
  const method = globalThis[name];

  if (method) {
    // @ts-expect-error - FIXME:!
    globalThis[name] = function (callback: (args: void) => void, ms?: number) {
      return method.call(this, wrap(callback), ms);
    };
  }
};

const wrapEventListener = (
  name: 'EventTarget' | 'Window' | 'Node' | 'XMLHttpRequest',
): void => {
  const proto = (globalThis as typeof window)[name]?.prototype;

  if (
    proto
    && Object.prototype.hasOwnProperty.call(proto, 'addEventListener')
  ) {
    const oldAddEventListener = proto.addEventListener;
    const oldRemoveEventListener = proto.removeEventListener;

    proto.addEventListener = function (type, callback, opts) {
      // @ts-expect-error - null is valid but not for all interfaces; should work anyway
      oldAddEventListener.call(
        this,
        type,
        callback == null
          ? callback
          : wrap(
            // TODO: Do EventListenerObject ever need `this` to be correct?
            // eslint-disable-next-line @typescript-eslint/unbound-method
            typeof callback === 'object' ? callback.handleEvent : callback,
          ),
        opts,
      );
    };
    proto.removeEventListener = function (type, callback, opts) {
      oldRemoveEventListener.call(
        this,
        type,
        // @ts-expect-error - null is valid but not for all interfaces; should work anyway
        callback == null
          ? callback
          : (
            (typeof callback === 'object'
              ? callback.handleEvent // eslint-disable-line @typescript-eslint/unbound-method
              : callback) as WrappedFunction
          ).__xw || callback,
        opts,
      );
    };
  }
};

/**
 * Programmatically send an error event.
 *
 * @param error - The error to report.
 * @param extraMeta - Additional meta data to send with this event.
 */
export function sendEvent(error: Error, extraMeta?: EventMeta): void {
  captureEvent(EventTypeProgrammatic, error, extraMeta);
}

/**
 * Set up error tracking.
 *
 * @param endpoint - API endpoint; a URL including server origin, API version,
 * and your project ID e.g., `"https://api.trackx.app/v1/uvxpkibb17b"`.
 * @param onError - Optional function that will be called before every event is
 * sent allowing you to mutate its payload data or prevent sending the event.
 */
export function setup(endpoint: string, onError?: OnErrorHandler): void {
  apiEndpoint = endpoint;
  onErrorHandler = onError;
  oldConsoleError = console?.error || noop;

  // TODO: Should compat include onerror and onunhandledrejection handling?
  //  ↳ Probably not, it should be one or the other
  //  ↳ if you're using compat then you're probably writing/transpiling code
  //    specifically for old JS engines which wouldn't support these kinds of
  //    features anyway -- it's assumed these developers known what they're
  //    doing so mainly we need good documentation

  // const oldOnerror = globalThis.onerror;
  // const oldOnunhandledrejection = globalThis.onunhandledrejection;

  // if (oldOnerror !== undefined) {
  //   globalThis.onerror = (message, source, lineno, colno, error) => {
  //     captureEvent(EventTypeUnhandledError, error || { message });

  //     if (oldOnerror) {
  //       oldOnerror(message, source, lineno, colno, error);
  //     }
  //   };
  // }

  // if (oldOnunhandledrejection !== undefined) {
  //   globalThis.onunhandledrejection = (event) => {
  //     captureEvent(EventTypeUnhandledRejection, event.reason);

  //     if (oldOnunhandledrejection) {
  //       oldOnunhandledrejection.call(globalThis as typeof window, event);
  //     }
  //   };
  // }

  (console || {}).error = function () {
    const args: unknown[] = Array.prototype.slice.call(arguments);
    const error = args[0];
    captureEvent(EventTypeConsoleError, error instanceof Error ? error : args);
    oldConsoleError.apply(console, args);
  };

  // TODO: Document the reasoning behind the wrapped methods
  //  ↳ Old browsers or JS engines don't have window.onerror and
  //    window.onunhandledrejection etc. so unhandled errors may be silently
  //    swallowed if they're not wrapped in a try/catch. Even if you wrap your
  //    outer code in a try/catch by the time a timer/event handler runs
  //    it's in a new call stack -- to catch the error you need to add a
  //    try/catch within the handler, which is what the wrappers do to attempt
  //    to automatically capture all errors.

  // TODO: What should be wrapped by default?
  // - `EventTarget.attachEvent` and `EventTarget.detachEvent`?
  // - https://github.com/bugsnag/bugsnag-js/blob/02730ba4683cfbff8babf6741acd00c7bdc12424/packages/plugin-inline-script-content/inline-script-content.js#L107
  // - https://github.com/bugsnag/bugsnag-js/blob/v3.3.3/src/bugsnag.js#L1313

  wrapTimer('setTimeout');
  wrapTimer('setInterval');

  wrapEventListener('EventTarget');
  wrapEventListener('Window');
  wrapEventListener('Node');
  wrapEventListener('XMLHttpRequest');
}
