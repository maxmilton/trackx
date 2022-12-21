/**
 * TrackX Error Details Plugin
 *
 * @see https://docs.trackx.app/#/guides/tracking-errors.md#plugins-details
 */

// WARNING: This file is experimental and may be removed in the future!!

import type { OnErrorHandler } from 'trackx/types';

export const handlers = (funcs: OnErrorHandler[]): OnErrorHandler => (payload, reason) => {
  let newPayload: ReturnType<OnErrorHandler> = payload;

  // eslint-disable-next-line unicorn/no-for-loop
  for (let index = 0; index < funcs.length; index++) {
    newPayload = funcs[index](newPayload, reason);
    if (!newPayload) break;
  }

  return newPayload;
};

/**
 * Safely clone an object by replacing any cyclic references with '[Circular]'.
 *
 * @param obj - A JSON-serializable object.
 */
const decycle = <T extends object>(obj: T): T => {
  const seen = new WeakSet();

  return JSON.parse(
    JSON.stringify(obj, (_key: string, value: unknown) => {
      if (value != null && typeof value === 'object') {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    }),
  ) as T;
};

export const auto: OnErrorHandler = (payload, reason) => {
  if (
    !('details' in payload.meta)
    && reason != null
    && typeof reason === 'object'
  ) {
    const details: Record<string, unknown> = {};
    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const key in reason) {
      const value = (reason as Record<string, unknown>)[key];
      details[key] = value === undefined ? '[Undefined]' : value;
    }
    // eslint-disable-next-line no-param-reassign
    payload.meta.details = Object.keys(details).length > 0 ? decycle(details) : {};
  }
  if (!('ctor' in payload.meta)) {
    // eslint-disable-next-line no-param-reassign
    payload.meta.ctor = (() => {
      try {
        // @ts-expect-error - Access unknown in try/catch for safety
        return reason.constructor.name; // eslint-disable-line
      } catch (_error) {
        // No op
        return '';
      }
    })();
  }
  if (!('proto' in payload.meta)) {
    // eslint-disable-next-line no-param-reassign
    payload.meta.proto = Object.prototype.toString.call(reason);
  }
  return payload;
};
