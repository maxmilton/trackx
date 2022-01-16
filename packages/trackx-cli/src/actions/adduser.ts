/**
 * Generate a unique salt and a hash of a password.
 *
 * Passwords must be between 8 and 64 characters long and can include any valid
 * Unicode characters.
 *
 * @see packages/trackx-api/src/routes/dash/login.ts -- logic to verify passwords
 */

import crypto from 'crypto';
import { bold, yellow } from 'kleur/colors';
import { toASCII } from 'punycode/';
import type { GlobalOptions } from '../types';
import {
  containsControlChar,
  getConfig,
  isValidEmail,
  logger,
  read,
} from '../utils';

function createHash(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('base64');
    // XXX: Reduced "cost" because a project goal is to run on low-end hardware.
    // TODO: Should the cost (and/or other options) be configurable?
    crypto.scrypt(password, salt, 64, { cost: 2048 }, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('base64')}`);
    });
  });
}

async function getEmail(input?: string): Promise<string> {
  let answer = input || (await read('Email: '));

  if (!answer) {
    logger.error('Email value required but not provided');
    return getEmail();
  }

  // Support international domains in email addresses e.g., user@例子.世界
  answer = toASCII(answer);

  if (!isValidEmail(answer)) {
    logger.error('Possibly an invalid email, please double check it');
  }

  return answer;
}

async function getPassword(input?: string): Promise<string> {
  const answer = input || (await read('Password: ', true));

  if (!answer) {
    logger.error('Password value required but not provided');
    return getPassword();
  }

  if (answer.length < 8 || answer.length > 64) {
    logger.error('Password length must be between 8 and 64 characters');
    return getPassword();
  }

  if (containsControlChar(answer)) {
    logger.error('Password must not contain control characters');
    return getPassword();
  }

  return String(answer);
}

interface AdduserOptions extends GlobalOptions {
  user: string | undefined;
  pass: string | undefined;
}

export default async function action(opts: AdduserOptions): Promise<void> {
  if (opts._.length > 0) {
    throw new Error(`Unexpected positional arguments: ${String(opts._)}`);
  }

  const config = getConfig(opts.config);
  const user = await getEmail(opts.user);
  const pass = await getPassword(opts.pass);
  const hash = await createHash(pass);

  // XXX: The API configuration file may be read-only so we can't write to it
  // directly. Instead, explain manual actions to take.

  // eslint-disable-next-line no-console
  console.log(`
Copy the following into USERS in ${yellow(config.CONFIG_PATH)}
${bold(yellow(`'${user}': '${hash}'`))}
`);
}
