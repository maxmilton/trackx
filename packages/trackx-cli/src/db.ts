import SqliteDB, { Database } from 'better-sqlite3';
import type { TrackXAPIConfig } from '../../trackx-api/src/types';
import { logger } from './utils';

export function connectDB(config: TrackXAPIConfig): Database {
  const db = new SqliteDB(config.DB_PATH, {
    verbose: process.env.NODE_ENV === 'development' ? logger.debug : undefined,
  });

  process.on('exit', () => db.close());
  process.on('SIGHUP', () => process.exit(128 + 1));
  process.on('SIGINT', () => process.exit(128 + 2));
  process.on('SIGTERM', () => process.exit(128 + 15));

  // TODO: Fix DB crashing with sqlite-zstd + trusted_schema off
  if (!config.DB_COMPRESSION) {
    db.pragma('trusted_schema = OFF');
  }
  db.pragma('journal_mode = WAL');

  if (config.DB_COMPRESSION) {
    db.loadExtension(config.DB_ZSTD_PATH!);
  }

  return db;
}
