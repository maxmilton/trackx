/* eslint-disable no-restricted-globals */

// TODO: Document minimum supported browser versions + newer browser APIs used:
// - Try/catch; optional catch binding
// - Fetch
// - Proxy
// - Arrow function
// - Error().stack

// TODO: Document what's missing/different in the lite client (to save bytes):
// - No sendEvent method (use console.error instead + best practice to still
//   use an Error instance for correct stack context)
// - No fetch timeout; request timeout handled by browser
// - No retry when sending an event fails (silently swallows the send error)
// - No offline support
// - No `onError` argument in `setup` function
//   - No way to cancel sending events or modify their data before sending
// - Doesn't protect against certain edge cases
//   - No protection against primitive string conversion fail on message e.g., Object.create(null)
// - Calls globals directly (no globalThis or window) e.g., addEventListener, location

import type { ClientType, EventMeta, EventPayload } from 'trackx/types';

const listen = addEventListener;

// TODO: Work out how to make esbuild inline an imported const enum
const EventTypeUnhandledError = 1;
const EventTypeUnhandledRejection = 2;
const EventTypeConsoleError = 3;

/** Global meta data sent with every event. Must be JSON serialisable. */
export const meta: EventMeta = {
  // TODO: Work out how to make esbuild inline an imported const enum
  _c: 'l' as ClientType.Lite,
  _v: process.env.TRACKX_VERSION,
};

/**
 * Set up error tracking.
 *
 * @param endpoint - API endpoint; a URL including server origin, API version,
 * and your project ID e.g., `"https://api.trackx.app/v1/uvxpkibb17b"`.
 */
export const setup = (endpoint: string): void => {
  const sendCapturedEvent = (type: number, x: unknown) => {
    const ex = (x != null && typeof x === 'object' ? x : {}) as Error;

    try {
      void fetch(endpoint + '/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: ex.name,
          message: String(ex.message || x),
          stack: ex.stack || new Error().stack,
          type,
          uri: location.href,
          meta,
          // TODO: Correctly type as EventPayload for type safety (but without extra bytes!)
        } as EventPayload),
      });
    } catch {
      /* No op; no retry, no offline handling, no flood lock, etc. */
    }
  };

  listen('error', (event) => sendCapturedEvent(EventTypeUnhandledError, event.error));
  listen('unhandledrejection', (event) => sendCapturedEvent(EventTypeUnhandledRejection, event.reason));

  console.error = new Proxy(console.error, {
    apply(target, thisArg, args) {
      sendCapturedEvent(
        EventTypeConsoleError,
        args[0] instanceof Error ? args[0] : args,
      );
      target.apply(thisArg, args);
    },
  });
};
