/**
 * Generate a unique salt and a hash of a password.
 *
 * Passwords must be between 8 and 64 characters long and can include any valid
 * Unicode characters.
 *
 * @see packages/trackx-api/src/routes/dash/login.ts -- logic to verify passwords
 */

// TODO: Consider switching to the Argon2 algorithm for password hashing.

import crypto from 'crypto';
import { bold, yellow } from 'kleur/colors';
import readline from 'readline';
import { promisify } from 'util';
import type { GlobalOptions } from '../types';
import { getConfig, logger } from '../utils';

function generateSalt(rounds: number) {
  return crypto
    .randomBytes(Math.ceil(rounds / 2))
    .toString('base64')
    .slice(0, rounds);
}

function hashPassword(
  password: string,
  salt: string,
): [salt: string, hash: string] {
  const hash = crypto
    .createHmac('sha512', salt)
    .update(password)
    .digest('base64');
  return [salt, hash];
}

interface AdduserOptions extends GlobalOptions {
  user: string | undefined;
  pass: string | undefined;
}

// TODO: Better looking and more useful output

export default async function action(opts: AdduserOptions): Promise<void> {
  const config = getConfig(opts.config);
  let { user, pass } = opts;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  // TODO: Better type or maybe create a custom user input class
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const question = promisify(rl.question).bind(rl) as unknown as (
    q: string,
  ) => Promise<string>;

  if (!user) {
    const answer = await question('Email: ');

    if (!answer) {
      // FIXME: Don't exit; get the user to try again
      throw new Error('Email value required but not provided');
    }

    // FIXME: Validate email

    user = answer;
  }

  if (!pass) {
    // FIXME: Don't print input back to CLI; mask password input
    //  ↳ https://blog.bitsrc.io/build-a-password-field-for-the-terminal-using-nodejs-31cd6cfa235

    const answer = await question('Password: ');

    if (!answer) {
      // FIXME: Don't exit; get the user to try again
      throw new Error('Password value required but not provided');
    }

    if (answer.length < 8 || answer.length > 64) {
      // FIXME: Don't exit; get the user to try again
      throw new Error('Password length must be between 8 and 64 characters');
    }

    // FIXME: Validate is printable chars

    pass = answer;
  }

  rl.close();

  // XXX: The config may be read-only, so we can't write to it directly.

  const result = hashPassword(pass, generateSalt(12));

  logger.log(`Copy the following into USERS in ${yellow(config.CONFIG_PATH)}`);
  logger.log(bold(yellow(`'${user}': ['${result[0]}', '${result[1]}']`)));
}
