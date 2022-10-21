/**
 * TrackX Node.js require Hook
 *
 * @see https://docs.trackx.app/#/guides/tracking-errors.md#node-require
 */

// WARNING: This file is experimental and may be removed in the future!!!

/* eslint-disable */

var endpoint = process.env.TRACKX_ENDPOINT;
var origin = process.env.TRACKX_ORIGIN;

if (!endpoint) {
  console.warn('TRACKX_ENDPOINT not set in env, not sending events');
} else {
  var trackx = require('trackx/node');
  var details = require('trackx/plugins/details-node');
  global.trackx = trackx;
  trackx.setup(endpoint, details.auto, origin);
}
