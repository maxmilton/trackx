import fs from 'node:fs';
import type { ProjectInternal } from '../../../trackx-api/src/types';
import { connectDB } from '../db';
import type { GlobalOptions } from '../types';
import { getConfig, logger } from '../utils';

// TODO: Better looking and more useful output

interface InstallOptions extends GlobalOptions {
  force: boolean | undefined;
}

export default function action(opts: InstallOptions): void {
  if (opts._.length > 0) {
    throw new Error(`Unexpected positional arguments: ${String(opts._)}`);
  }

  const config = getConfig(opts.config);

  if (!config.DB_INIT_SQL_PATH) {
    logger.fatal('Config "DB_INIT_SQL_PATH" not set but required for install');
    process.exit(2);
  }
  if (!fs.existsSync(config.DB_INIT_SQL_PATH)) {
    logger.fatal(
      'Config "DB_INIT_SQL_PATH" file does not exist:',
      config.DB_INIT_SQL_PATH,
    );
    process.exit(2);
  }

  const db = connectDB(config);

  const tableCount = db
    .prepare(
      "SELECT COUNT() FROM sqlite_schema WHERE type IN ('table') AND name NOT LIKE 'sqlite_%'",
    )
    .pluck()
    .get() as number;

  if (tableCount) {
    logger.error('Database already contains existing data');

    if (!opts.force) return;

    logger.log('Continuing due to --force');
  }

  logger.info('Database empty, initialising...');
  try {
    db.exec(fs.readFileSync(config.DB_INIT_SQL_PATH, 'utf8'));
    logger.info('Database initialised');
  } catch (error: unknown) {
    logger.error(error);
    // The init SQL begins a transaction and since db.exec doesn't manage
    // transactions for you, we need to end it manually
    db.exec('ROLLBACK;');
    if (!opts.force) return;
  }

  try {
    db.prepare(
      `
INSERT INTO project (id, key, origin, name, scrape, tags) VALUES
  (1, 'cuyk9nmavqs', 'http://127.0.0.1:8000', 'trackx-backend', 0, 'trackx-internal'),
  (2, '1dncxc0jjib', '${config.DASH_ORIGIN}', 'trackx-frontend', 1, 'trackx-internal');
    `,
    ).run();
  } catch (error) {
    logger.error(error);
    if (!opts.force) return;
  }

  // Additional DB changes for development and testing
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Making database changes for development environment...');

    const projects = db
      .prepare('SELECT id, name FROM project')
      .all() as ProjectInternal[];
    const setDevProjectStmt = db.prepare(
      "UPDATE project SET origin = '*', scrape = 1 WHERE id = ?",
    );

    db.transaction(() => {
      for (const project of projects) {
        switch (project.name) {
          case 'trackx-backend':
          case 'trackx-frontend':
            setDevProjectStmt.run(project.id);
            break;
          default:
            break;
        }
      }
    })();

    logger.info('Done');
  }

  if (config.DB_COMPRESSION) {
    // TODO: Move initial compression logic to CLI (done!)
    //  ↳ Then we should always default to no compression (done!)
    //  ↳ Re/creating indexes could be done dynamically then too
    //  ↳ Could also add recompress feature and/or create new compression dict
    //  ↳ Explain in CLI and/or docs why it's worth holding off on compression
    //    until truly required or even keeping it off if disk space and faster
    //    look up of individual events are of no concern
    //    ↳ Mostly faster and less system resources on writes too!

    // TODO: Provide a way to override min dict size

    const compressionInitialised = db
      .prepare("SELECT 1 FROM sqlite_schema WHERE name = '_zstd_configs'")
      .pluck()
      .get() as 1 | undefined;

    if (compressionInitialised) {
      db.exec(
        `UPDATE _zstd_configs SET config = json_patch(config, '{"compression_level":${config.DB_COMPRESSION}}');`,
      );
    } else {
      // db.pragma('auto_vacuum = FULL');
      // db.exec('VACUUM;');
      db.exec(
        // TODO: This kind of dict strategy needs zstd_incremental_maintenance
        // to be run periodically, ideally on a configurable schedule that can
        // also be disabled

        // FIXME: Although the code mention returning NULL is allowed, it
        // doesn't seem to actually work... but we need it for the dict strategy
        //  ↳ https://github.com/phiresky/sqlite-zstd/blob/2c394bf546f43295e6db61cc89023b17496d19ac/src/transparent.rs#L53-L66
        //  ↳ The examples in the code also seem to be incorrect (order of
        //    strftime args), so we should open an issue

        // Monthly rotating dictionary with compression delayed until the month is over
        // eslint-disable-next-line max-len
        // `SELECT zstd_enable_transparent('{"table":"event","column":"data","compression_level":${config.DB_COMPRESSION},"dict_chooser":"nullif(strftime(''%Y-%m'',ts/1000,''unixepoch''),strftime(''%Y-%m'',''now''))","min_dict_size_bytes_for_training":100000}');`,
        `SELECT zstd_enable_transparent('{"table":"event","column":"data","compression_level":${config.DB_COMPRESSION},"dict_chooser":"''a''","min_dict_size_bytes_for_training":100000}');`,
      );
    }

    // TODO: Document that for now, until we have a dedicate compression util in
    // the CLI tools, users may need to run this themselves with a much longer
    // timeout (depending on the amount of data they have)

    // There should be no or very little data so compression will be very fast
    db.exec('SELECT zstd_incremental_maintenance(30, 1);');
  }

  // Mark the install date in a time stamp
  db.prepare(
    "INSERT INTO meta(k, v) VALUES('install_ts', datetime('now')) ON CONFLICT(k) DO NOTHING",
  ).run();

  logger.info('Installation finished!');

  // TODO: Add user account or guide user how to
  // TODO: Kick off flow to add an admin user account here
  logger.log('');
  logger.log('You need to add a new admin user account. You can do so via:');
  logger.log('  ./trackx adduser');
  logger.log('');
}
