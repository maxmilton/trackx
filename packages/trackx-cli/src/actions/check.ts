import { green, red, yellow } from 'kleur/colors';
import fs from 'node:fs';
import { connectDB } from '../db';
import type { GlobalOptions } from '../types';
import { getConfig, logger } from '../utils';

// TODO: Give suggestions to the user about how to fix + links to docs

// TODO: Better looking and more useful output

interface CheckOptions extends GlobalOptions {
  all: boolean | undefined;
}

export default function action(opts: CheckOptions): void {
  if (opts._.length > 0) {
    throw new Error(`Unexpected positional arguments: ${String(opts._)}`);
  }

  const config = getConfig(opts.config);
  const db = connectDB(config);

  logger.info('Configuration OK');
  logger.info('Database connection OK');

  if (!opts.all) return;

  let errors = 0;
  let warnings = 0;
  let ok = 2;

  // https://www.sqlite.org/pragma.html#pragma_integrity_check
  const integrity = db.pragma('integrity_check(3)') as [
    { integrity_check: string },
  ];

  if (integrity.length > 1 || integrity[0].integrity_check !== 'ok') {
    logger.error('Database integrity failed, your database may be corrupt');
    process.exitCode = 1;
    errors += 1;
  } else {
    logger.info('Database integrity OK');
    ok += 1;
  }

  // https://www.sqlite.org/pragma.html#pragma_foreign_key_check
  const foreignKeys = db.pragma('foreign_key_check') as any[];

  if (foreignKeys.length > 0) {
    logger.error('Database foreign key check failed');
    process.exitCode = 1;
    errors += 1;
  } else {
    logger.info('Database foreign keys OK');
    ok += 1;
  }

  try {
    db.prepare(
      "INSERT INTO issue_fts(issue_fts, rank) VALUES ('integrity-check', 1)",
    ).run();

    logger.info('Database issue full-text search OK');
    ok += 1;
  } catch {
    logger.error(
      'Database issue full-text search integrity failed or is out of sync',
    );
    process.exitCode = 1;
    errors += 1;
  }

  // FIXME: Check DB schema here, including all tables exist + all indexes
  // exists (but only warn on missing indexes)
  //  ↳ Keep in mind the schema difference when DB_COMPRESSION is enabled!

  const dbWrite = db
    .prepare("INSERT INTO meta(k, v) VALUES('trackx-cli-check', 1)")
    .run();

  if (dbWrite.changes === 1) {
    logger.info('Database write OK');
    ok += 1;
  } else {
    logger.error('Database write failed');
    process.exitCode = 1;
    errors += 1;
  }

  const dbReadStmt = db
    .prepare("SELECT v FROM meta WHERE k = 'trackx-cli-check'")
    .pluck();
  const dbRead1 = dbReadStmt.get() as number;

  if (dbRead1 === 1) {
    logger.info('Database read OK');
    ok += 1;
  } else {
    logger.error('Database read failed');
    process.exitCode = 1;
    errors += 1;
  }

  const dbDelete = db
    .prepare("DELETE FROM meta WHERE k = 'trackx-cli-check'")
    .run();
  const dbRead2 = dbReadStmt.get() as number;

  if (dbDelete.changes !== 1 || dbRead2 !== undefined) {
    logger.error('Database delete failed');
    process.exitCode = 1;
    errors += 1;
  } else {
    logger.info('Database delete OK');
    ok += 1;
  }

  if (config.DB_COMPRESSION !== 0) {
    const shadowTable = db
      .prepare(
        "SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = '_event_zstd'",
      )
      .pluck()
      .get() as 1 | undefined;

    if (shadowTable) {
      logger.info(
        'Config DB_COMPRESSION is enabled and event shadow table exists OK',
      );
      ok += 1;
    } else {
      logger.error(
        'Config DB_COMPRESSION is enabled but the event shadow table does not exist',
      );
      process.exitCode = 1;
      errors += 1;
    }

    // TODO: Check the indexes on _event_zstd exist or else warn
  }

  // Check the 2 internal projects trackx-backend and trackx-frontend are in
  // the DB. Since users can change the project name (but not remove the
  // "trackx-internal" tag) we only check the tag.
  const internalProjects = db
    .prepare("SELECT tags FROM project WHERE instr(tags, 'trackx-internal')")
    .pluck()
    .all() as string[] | undefined;

  if (
    !internalProjects
    || internalProjects.length !== 2
    || internalProjects.some(
      (tags) => !tags.split(',').includes('trackx-internal'),
    )
  ) {
    logger.error('Missing trackx-internal projects');
    process.exitCode = 1;
    errors += 1;
  } else {
    logger.info('Found trackx-internal projects OK');
    ok += 1;
  }

  if (Object.keys(config.USERS).length === 0) {
    logger.error('No admin user accounts');
    process.exitCode = 1;
    errors += 1;
  } else {
    logger.info('At least one admin user account OK');
    ok += 1;
  }

  try {
    fs.accessSync(config.CONFIG_PATH, fs.constants.W_OK);
    logger.warn('Configuration file has write permissions');
    process.exitCode = 1;
    warnings += 1;
  } catch {
    logger.info('Configuration file does not have write permissions OK');
    ok += 1;
  }

  logger.log(
    `\nSummary: ${red(errors)} errors, ${yellow(warnings)} warnings, ${green(
      ok,
    )} ok`,
  );
}
