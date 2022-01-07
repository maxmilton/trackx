/**
 * TrackX CLI
 *
 * Provides a way to interact with a TrackX API server to perform administrative
 * tasks.
 *
 * This tool should be built and then copied to the same location as the api
 * dist/server.js output; it's not intended to be installable via NPM etc. The
 * ClI code is in a separate package as a logical boundary from the API but when
 * deployed there are some shared NPM dependencies.
 */

import sade from 'sade';
import adduser from './actions/adduser';
import check from './actions/check';
import db from './actions/db';
import install from './actions/install';
import update from './actions/update';

// Exit node on any unhandled error
function onFatalError(error: unknown) {
  throw error;
}

process.on('uncaughtExceptionMonitor', onFatalError);
process.on('unhandledRejection', onFatalError);

const prog = sade('trackx');

// TODO: Write documentation explaining each "app" has its own version
prog.version(process.env.APP_RELEASE!).option(
  '-c, --config',
  'Use specified configuration file',
  // TODO: Paths in general could be confusing for users because of the use
  // of docker, the monorepo, and differences between development, testing,
  // and production... simplify or at the very least write decent documentation
  process.env.CONFIG_PATH || 'trackx.config.js',
);

prog
  .command('install')
  .describe('Install a new TrackX API server.')
  .option('-f, --force', 'Force install even if initial checks fail')
  .example('install')
  .action(install);

prog
  .command('update')
  .describe('Update an existing TrackX API server (not implemented yet).')
  .example('update')
  .action(update);

prog
  .command('adduser')
  .describe('Create a new admin user account.')
  .option(
    '-u, --user',
    'User email address (optional; can input interactively)',
  )
  .option('-p, --pass', 'User password (optional; can input interactively)')
  .example('adduser --user user@example.com --pass insecure')
  .example('adduser -u user@example.com')
  .example('adduser')
  .action(adduser);

prog
  .command('check')
  .describe('Check configuration and server health.')
  .option(
    '-a, --all',
    'Run all tests, otherwise just check valid config and database connection',
  )
  .example('check --all')
  .example('check')
  .action(check);

prog
  .command('db')
  .describe('Database maintenance utilities (NOT IMPLEMENTED YET!).')
  .example('db')
  .action(db);

prog.parse(process.argv);
