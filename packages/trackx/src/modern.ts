// TODO: For deno support, how can we make it send an origin header?
//  ↳ Possibly we'll need to override fetch with fetch + custom client
//  ↳ Actually it looks like deno supports a --location flag which might
//    eventually pass the origin in fetch requests

import type {
  ClientType,
  EventMeta,
  EventPayload,
  EventType,
  OnErrorHandler,
} from 'trackx/types';

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

const storage: LocalStorage = localStorage;
const listen = globalThis.addEventListener;
const oldConsoleError = console.error;

/** Global meta data sent with every event. Must be JSON serialisable. */
export const meta: EventMeta = {
  // TODO: Work out how to make esbuild inline an imported const enum
  _c: 'm' as ClientType.Modern,
  _v: process.env.TRACKX_VERSION,
};
let apiEndpoint: string;
let onErrorHandler: OnErrorHandler | undefined;
let failCount = 0;

const sendCapturedEvent = async (
  payload: EventPayload,
  reason: unknown,
  attempt = 0,
): Promise<void> => {
  // Bail while lock is active to prevent flooding the API
  // When t__x is undefined the comparision is safe; it will be coerced to 0
  if (Date.now() < storage.t__x!) return;

  // @ts-expect-error - cheeky use of payload value to exit
  // eslint-disable-next-line no-cond-assign, no-param-reassign
  if (onErrorHandler && !(payload = onErrorHandler(payload, reason))) return;

  const retry = () => {
    if (navigator.onLine === false) {
      // Retry when an offline user comes back online -- note that online does
      // not imply the user is connected to the internet so it's inherently
      // unreliable but better than nothing
      const handleOnline = () => {
        globalThis.removeEventListener('online', handleOnline);
        void sendCapturedEvent(payload, reason, attempt + 1);
      };
      listen('online', handleOnline);
    } else if (failCount++ > FAIL_LIMIT) {
      // Network errors occurred too many times so lock out sending future
      // events for a while as an abuse prevention measure
      storage.t__x = Date.now() + FALLBACK_LOCK_TTL * 1000;
    } else if (attempt < RETRY_LIMIT) {
      setTimeout(() => {
        void sendCapturedEvent(payload, reason, attempt + 1);
      }, 1000 * 4 ** attempt);
    } else {
      oldConsoleError('Send error');
    }
  };

  const abort = new AbortController();
  setTimeout(() => abort.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(apiEndpoint + '/event', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: abort.signal,
    });

    if (res.status === 429) {
      storage.t__x = Date.now()
        + (+res.headers.get('retry-after')! || FALLBACK_LOCK_TTL) * 1000;
    } else if (res.status !== 200) {
      retry();
    }
  } catch {
    retry();
  }
};

const captureEvent = (type: EventType, x: unknown, extraMeta?: EventMeta) => {
  const ex = (x != null && typeof x === 'object' ? x : {}) as Error;
  let message = (ex.message || x) as string;

  try {
    message = String(message);
  } catch (error) {
    // Protect against primitive string conversion fail e.g., Object.create(null)
    message = Object.prototype.toString.call(message);
  }

  void sendCapturedEvent(
    {
      name: ex.name,
      message,
      stack: ex.stack || new Error().stack,
      type,
      uri: globalThis.location.href,
      meta: { ...meta, ...extraMeta },
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
 * @param endpoint - The full API endpoint URL e.g., `"https://api.trackx.app/v1/uvxpkibb17b/event"`.
 *
 * @param onError - Optional function that will be called before every event is
 * sent allowing you to mutate its payload data or prevent sending the event.
 */
export function setup(endpoint: string, onError?: OnErrorHandler): void {
  apiEndpoint = endpoint;
  onErrorHandler = onError;

  listen('error', (event) => captureEvent(EventTypeUnhandledError, event.error));
  listen('unhandledrejection', (event) => captureEvent(EventTypeUnhandledRejection, event.reason));

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
  void fetch(apiEndpoint + '/ping', {
    method: 'POST',
    keepalive: true,
    mode: 'no-cors',
  });
}
