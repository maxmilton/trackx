// TrackX configuration for frontends

const prod = process.env.NODE_ENV === 'production' || !process.env.NODE_ENV;

export const DOCS_URL = 'https://docs.trackx.app';
export const DASH_API_ENDPOINT = prod
  ? 'https://dash.trackx.app/api/dash'
  : '/api/dash';
export const REPORT_API_BASE_URL = prod
  ? 'https://api.trackx.app/v1'
  : '/api/v1';
export const REPORT_API_KEY = '1dncxc0jjib';
