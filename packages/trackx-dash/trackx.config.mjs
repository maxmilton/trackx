/**
 * TrackX configuration for front end apps (trackx-dash and trackx-login).
 *
 * @fileoverview The configuration values in this file will be compiled into
 * the apps. Because this values will become hardcoded, when you change a value
 * you will need to rebuild and deploy the front end apps.
 */

/* eslint-disable operator-linebreak */

const prod = process.env.NODE_ENV === 'production' || !process.env.NODE_ENV;

/**
 * Get an environment variable and parse it into a JSON value.
 * @param {string} key
 * @returns {unknown}
 */
function env(key) {
  const val = process.env[key];
  return val && JSON.parse(val);
}

export const DOCS_URL = 'https://docs.trackx.app';
export const DASH_API_ENDPOINT = prod
  ? 'https://dash.trackx.app/api/dash'
  : '/api/dash';
export const REPORT_API_BASE_URL = prod
  ? 'https://api.trackx.app/v1'
  : '/api/v1';
export const REPORT_API_KEY = '1dncxc0jjib';

// TODO: Consider moving DB table stats to trackx-cli
/**
 * Enable fetching database stats.
 *
 * Note there is also a `ENABLE_DB_TABLE_STATS` config option in `trackx-api`
 * that should also be set to the same value.
 *
 * @remarks Currently has known performance issues. Enabling this feature may
 * be useful for debugging and observability but should be disabled in
 * production to prevent a potential denial-of-service attack vector. See
 * <https://github.com/maxmilton/trackx/issues/158>.
 */
export const ENABLE_DB_TABLE_STATS =
  /* @__PURE__ */ env('ENABLE_DB_TABLE_STATS') || !prod;
