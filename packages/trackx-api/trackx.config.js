if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
  throw new Error('DO NOT USE DEVELOPMENT CONFIG IN PRODUCTION');
}

// TODO: Document the config can be a JSON or CJS file

/** @type {import('./src/types').TrackXAPIConfig} */
module.exports = {
  USERS: {
    // email = dev@user
    // password = development
    'dev@user':
      'Q9hepNsrx4hKD9IkaAEssw==:pt3AEhfEzXUVSq+a2imNpFEEvERr6uLabxGtUqyiq5krNZ050Bl1fXmsi3UGGOxj6sgwEouO4Agw7L+wyw5fJA==',
  },

  ROOT_DIR: __dirname,
  HOST: '127.0.0.1',
  PORT: 8000,
  DB_PATH: 'trackx.db',
  DB_ZSTD_PATH: 'libsqlite_zstd.so',
  DB_INIT_SQL_PATH: 'migrations/master.sql',
  DB_COMPRESSION: 0,
  REPORT_API_ENDPOINT: 'http://localhost:5000/api/v1/cuyk9nmavqs',
  DASH_ORIGIN: 'http://localhost:5000',
  // REPORT_API_ENDPOINT: 'http://localhost:5001/api/v1/cuyk9nmavqs',
  // DASH_ORIGIN: 'http://localhost:5001',

  MAX_EVENT_BYTES: 1_048_576, // 1 MiB
  MAX_STACK_CHARS: 131_072, // 128 KiB
  MAX_STACK_FRAMES: 40,
  MAX_UA_CHARS: 500,
  MAX_URI_CHARS: 1000,
  NET_MAX_FILE_BYTES: 5_242_880, // 5 MiB
  NET_RETRY: 2,
  NET_TIMEOUT: 30_000, // 30 seconds
  SCHEDULED_JOB_INTERVAL: 21_600_000, // 6 hours; 6h * 60m * 60s * 1000ms
  SESSION_TTL: 2_400_000, // 40 minutes; 40m * 60s * 1000ms
};
