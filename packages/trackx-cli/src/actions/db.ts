import { connectDB } from '../db';
import type { GlobalOptions } from '../types';
import { getConfig, logger } from '../utils';

// TODO: Add a separate command for DB compression that will:
//  1. Verify config.DB_COMPRESSION is valid
//  2. Notify user about caveats etc. with link to docs
//  3. Check if we're changing from a previous compression level which is
//    different and notify user that only new data will be compressed at
//    the new level
//  4. Perform similar things to bellow
//  5. Do the initial compression in a loop until done with sleep between
//    to give live APIs a chance to continue to serve requests
//  6. Create new indexes
//  7. Vacuum the DB, but first alert/warn the user it can take a long time
//    on large DBs and get user input before continuing

// TODO: Consider adding another separate command to revert DB compression

// TODO: Add another command to generate a new zstd dictionary

// TODO: Consider adding another command to recompress the entire data
//  ↳ Features like this might be overkill, should probably try to keep the CLI
//    feature/UX as simple and easy to comprehend as the dash itself -- we can
//    always put fancy things like this in the docs

// TODO: Command to "optimise" the DB:
//  - PRAGMA wal_checkpoint(TRUNCATE); -- maybe?
//  - REINDEX;
//  - INSERT INTO issue_fts(issue_fts) VALUES('optimize');
//  - ANALYZE;
//  - VACUUM;

// TODO: Command to purge issues with no event activity for more than X days
// const daysInMs = Date.now() - state.issuePurgeDays * 24 * 60 * 60 * 1000;
// const result = db.prepare(`DELETE FROM issue WHERE ts_last <= ${daysInMs}`).run();
// console.log(result.changes);

// TODO: Command to purge meta table entries that relate to projects, issues,
// events, sessions, etc. which have been deleted
//  ↳ Since there's no explicit relation, each kind of meta entry needs to be
//    handled in a unique way
//  ↳ Might be a good chance to standardise some data in the meta table

export default function action(opts: GlobalOptions): void {
  logger.error('Database features are not implemented yet');

  const config = getConfig(opts.config);
  const db = connectDB(config);

  logger.log(db.pragma('quick_check'));
}
