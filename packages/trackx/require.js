/**
 * TrackX Node.js require hook
 *
 * @see https://docs.trackx.app/#/guides/tracking-errors.md#node-require
 */

// NOTE: This file is experimental and may be removed in the future.

// FIXME: Experiment with use cases and different node versions, then decide if
// we should keep this file.

/* eslint-disable */ // @ts-nocheck

const endpoint = process.env.TRACKX_ENDPOINT;
const origin = process.env.TRACKX_ORIGIN;

if (!endpoint) {
  console.warn('TRACKX_ENDPOINT not set in env, not sending events');
} else {
  const trackx = require('trackx/node');
  global.trackx = trackx;

  function onError(payload, reason) {
    if (!payload.meta.details && reason != null && typeof reason === 'object') {
      const details = {};
      for (const key in reason) details[key] = reason[key];
      payload.meta.details = details;
    }
    return payload;
  }

  trackx.setup(endpoint, onError, origin);
}
