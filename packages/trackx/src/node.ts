import { globalAgent } from 'http';
import { request, RequestOptions } from 'https';
import os from 'os';
import type {
  ClientType,
  EventMeta,
  EventPayload,
  EventType,
  OnErrorHandler,
} from 'trackx/types';
import { parse } from 'url';

const NODE_VERSION = process.versions.node.split('.').map((v) => +v);

// TODO: Work out how to make esbuild inline an imported const enum
const EventTypeUnhandledError = 1;
const EventTypeUnhandledRejection = 2;
const EventTypeConsoleError = 3;
const EventTypeProgrammatic = 4;

const FALLBACK_LOCK_TTL = 1800; // seconds; 30 minutes
const FAIL_LIMIT = 20;
const RETRY_LIMIT = 4;
const TIMEOUT_MS = 60_000; // 60 seconds

const assign = Object.assign;
const oldConsoleError = console.error;

const baseOpts: RequestOptions = {
  headers: {
    'user-agent': `Node.js/${NODE_VERSION[0]}.${
      NODE_VERSION[1]
    } (${os.type()} ${os.arch()})`,
  },
  timeout: TIMEOUT_MS,
};
let eventOpts: RequestOptions;
/** Global meta data sent with every event. Must be JSON serialisable. */
export const meta: EventMeta = {
  // TODO: Work out how to make esbuild inline an imported const enum
  _c: 'n' as ClientType.Node,
  _v: process.env.TRACKX_VERSION,
};
let onErrorHandler: OnErrorHandler | undefined;
let failCount = 0;
let lock: number;

function sendCapturedEvent(
  payload: EventPayload,
  reason: unknown,
  attempt = 0,
): void {
  // Bail while lock is active to prevent flooding the API
  if (Date.now() < lock) return;

  // @ts-expect-error - cheeky use of payload value to exit
  // eslint-disable-next-line no-cond-assign, no-param-reassign
  if (onErrorHandler && !(payload = onErrorHandler(payload, reason))) return;

  const handleRetry = () => {
    if (failCount++ > FAIL_LIMIT) {
      // Network errors occurred too many times so lock out sending future
      // events as an abuse prevention measure -- because node apps tend to be
      // long-lived only lock temporarily
      lock = Date.now() + FALLBACK_LOCK_TTL * 1000;
    } else if (attempt < RETRY_LIMIT) {
      setTimeout(() => {
        sendCapturedEvent(payload, reason, attempt + 1);
      }, 1000 * 4 ** attempt);
    } else {
      oldConsoleError('Send error');
    }
  };

  const body = JSON.stringify(payload);
  const req = request(
    // eslint-disable-next-line prefer-object-spread
    (eventOpts ??= assign({}, baseOpts, {
      // eslint-disable-next-line prefer-object-spread
      headers: assign({ 'content-type': 'application/json' }, baseOpts.headers),
      method: 'POST',
      path: baseOpts.path! + '/event',
    })),
    (res) => {
      // 429 == "Too Many Requests"
      if (res.statusCode === 429) {
        lock = Date.now()
          + (+req.getHeader('retry-after')! || FALLBACK_LOCK_TTL) * 1000;
      } else if (res.statusCode !== 200) {
        handleRetry();
      }
    },
  );

  req.on('timeout', () => {
    req.abort();
    handleRetry();
  });
  req.on('error', handleRetry);

  req.setHeader('content-length', Buffer.byteLength(body));
  req.write(body);
  req.end();
}

function getCallsiteURI() {
  const oldPrepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, stack) => stack;
  const stack = new Error().stack as unknown as NodeJS.CallSite[];
  Error.prepareStackTrace = oldPrepareStackTrace;

  const callsite = (
    stack[2].getTypeName() === 'process' ? stack[2] : stack[3]
  ).getFileName();

  return callsite ? 'file://' + callsite : undefined;
}

function captureEvent(type: EventType, x: unknown, extraMeta?: EventMeta) {
  const ex = (x != null && typeof x === 'object' ? x : {}) as Error;
  let message = (ex.message || x) as string;

  try {
    message = String(message);
  } catch (error) {
    // Protect against primitive string conversion fail e.g., Object.create(null)
    message = Object.prototype.toString.call(message);
  }

  sendCapturedEvent(
    {
      name: ex.name,
      message,
      stack: ex.stack || new Error().stack,
      type,
      uri: getCallsiteURI(),
      // eslint-disable-next-line prefer-object-spread
      meta: assign({}, meta, extraMeta),
    },
    x,
  );
}

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
 * @param origin - Optional `Origin` header to send with event network requests.
 * Use together with the allowed origins setting in the dash to restrict access
 * to your project endpoint. (Default `"null"`). Note: This option is only
 * available in the trackx/node client.
 */
export function setup(
  endpoint: string,
  onError?: OnErrorHandler,
  origin?: string,
): void;
export function setup(endpoint: string, origin?: string): void;
export function setup(
  endpoint: string,
  onErrorOrOrigin?: OnErrorHandler | string,
  origin = 'null',
): void {
  if (typeof onErrorOrOrigin === 'string') {
    // eslint-disable-next-line no-param-reassign
    origin = onErrorOrOrigin;
  } else {
    onErrorHandler = onErrorOrOrigin;
  }
  assign(baseOpts, parse(endpoint));
  baseOpts.headers!.origin = origin;
  if (baseOpts.protocol === 'http:') baseOpts.agent = globalAgent;

  if (
    NODE_VERSION[0] < 12
    || (NODE_VERSION[0] === 12 && NODE_VERSION[1] < 17)
  ) {
    process.on('uncaughtException', (error) => {
      captureEvent(EventTypeUnhandledError, error);
      // Mandatory; https://nodejs.org/api/process.html#process_warning_using_uncaughtexception_correctly
      throw error;
    });
  } else {
    // https://nodejs.org/api/process.html#process_event_uncaughtexceptionmonitor
    process.on('uncaughtExceptionMonitor', (error, type) => {
      captureEvent(
        type === 'unhandledRejection'
          ? EventTypeUnhandledRejection
          : EventTypeUnhandledError,
        error,
      );
    });
  }

  process.on('unhandledRejection', (reason) => {
    captureEvent(EventTypeUnhandledRejection, reason);
    oldConsoleError('Uncaught', reason);
  });

  console.error = new Proxy(console.error, {
    apply(target, thisArg, args) {
      captureEvent(
        EventTypeConsoleError,
        args[0] instanceof Error ? args[0] : args,
      );
      target.apply(thisArg, args);
    },
  });
}

/** Send ping to register a session. */
export function ping(): void {
  // eslint-disable-next-line prefer-object-spread
  const pingOpts = assign({}, baseOpts, {
    path: baseOpts.path! + '/ping',
  });
  const req = request(pingOpts);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  req.on('timeout', req.abort);
  req.on('error', console.error);
  req.end();
}
