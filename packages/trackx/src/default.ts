import globalThis from '@ungap/global-this';
import type {
  ClientType,
  EventMeta,
  EventPayload,
  EventType,
  OnErrorHandler,
} from 'trackx/types';
import { assign } from './utils';

interface LocalStorage extends Storage {
  /**
   * Send lock.
   *
   * A timestamp (in milliseconds past the Unix epoch) to prevent sending
   * events until. Actually a string or undefined but coerced to/from number.
   */
  t__x?: string | number;
}

// TODO: Work out how to make esbuild inline an imported const enum
const EventTypeUnhandledError = 1;
const EventTypeUnhandledRejection = 2;
const EventTypeConsoleError = 3;
const EventTypeProgrammatic = 4;

const FALLBACK_LOCK_TTL = 1800; // seconds; 30 minutes
const FAIL_LIMIT = 20;
const RETRY_LIMIT = 4;
const TIMEOUT_MS = 60_000; // 60 seconds

const storage: LocalStorage = globalThis.localStorage;
const listen = globalThis.addEventListener;
let oldConsoleError: Console['error'];

/** Global meta data sent with every event. Must be JSON serialisable. */
export const meta: EventMeta = {
  // TODO: Work out how to make esbuild inline an imported const enum
  _c: 'd' as ClientType.Default,
  _v: process.env.TRACKX_VERSION,
};
let apiEndpoint: string;
let onErrorHandler: OnErrorHandler | undefined;
let failCount = 0;

const sendCapturedEvent = (
  payload: EventPayload,
  reason: unknown,
  attempt?: number,
): void => {
  // Bail while lock is active to prevent flooding the API
  // When t__x is undefined the comparision is safe; it will be coerced to 0
  if (Date.now() < storage.t__x!) return;

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
        storage.t__x = Date.now()
          + (+req.getResponseHeader('retry-after')! || FALLBACK_LOCK_TTL) * 1000;
      } else if (req.status !== 200) {
        // eslint-disable-next-line no-param-reassign
        attempt = attempt || 0;

        if (navigator.onLine === false) {
          // Retry when an offline user comes back online -- note that online does
          // not imply the user is connected to the internet so it's inherently
          // unreliable but better than nothing
          const handleOnline = () => {
            globalThis.removeEventListener('online', handleOnline);
            sendCapturedEvent(payload, reason, attempt! + 1);
          };
          listen('online', handleOnline);
        } else if (failCount++ > FAIL_LIMIT) {
          // Network errors occurred too many times so lock out sending future
          // events for a while as an abuse prevention measure
          storage.t__x = Date.now() + FALLBACK_LOCK_TTL * 1000;
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

  try {
    message = String(message);
  } catch (error) {
    // Protect against primitive string conversion fail e.g., Object.create(null)
    message = Object.prototype.toString.call(message);
  }

  if (!stack) {
    // IE 10/11 doesn't initialize the stack until the Error is thrown
    try {
      throw new Error();
    } catch (error) {
      stack = (error as Error).stack;
    }
  }

  sendCapturedEvent(
    {
      name: ex.name,
      message,
      stack,
      type,
      uri: globalThis.location.href,
      meta: assign(assign({}, meta), extraMeta),
    },
    x,
  );
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
  oldConsoleError = console.error;
  const oldOnerror = globalThis.onerror;

  // TODO: Do our own testing for browser compatibility of key browser features
  //  ↳ Ref: https://blog.sentry.io/2016/01/04/client-javascript-reporting-window-onerror/#browser-compatibility
  //  ↳ https://github.com/maxmilton/trackx-lab

  // Use `onerror` to capture unhandled errors instead of addEventListener
  // because of better browser support e.g., IE9; in ErrorEvent the `error`
  // property isn't available in many old browsers
  globalThis.onerror = (message, source, lineno, colno, error) => {
    captureEvent(EventTypeUnhandledError, error || { message });

    if (oldOnerror) oldOnerror(message, source, lineno, colno, error);
  };

  listen('unhandledrejection', (event) => captureEvent(EventTypeUnhandledRejection, event.reason));

  console.error = function () {
    const args: unknown[] = Array.prototype.slice.call(arguments);
    const error = args[0];
    captureEvent(EventTypeConsoleError, error instanceof Error ? error : args);
    oldConsoleError.apply(console, args);
  };
}

/** Send ping to register a session. */
export function ping(): void {
  const img = new Image();
  img.crossOrigin = '';
  img.src = apiEndpoint + '/ping';
}
