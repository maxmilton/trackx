import {
  blue, bold, dim, red, yellow,
} from 'kleur/colors';
import path from 'path';
import { createInterface } from 'readline';
import type { TrackXAPIConfig } from '../../trackx-api/src/types';

export const logger = {
  /* eslint-disable no-console */
  fatal(this: void, ...args: unknown[]): void {
    console.error(bold(red('✗ fatal ')), ...args);
    process.exitCode = 2;
  },
  error(this: void, ...args: unknown[]): void {
    console.error(red('✗ error '), ...args);
    process.exitCode = 1;
  },
  warn(this: void, ...args: unknown[]): void {
    console.warn(yellow('‼ warn  '), ...args);
  },
  log(this: void, ...args: unknown[]): void {
    console.log('◆ log   ', ...args);
  },
  info(this: void, ...args: unknown[]): void {
    console.info(blue('ℹ info  '), ...args);
  },
  debug(this: void, ...args: unknown[]): void {
    console.debug(dim('● debug '), ...args);
  },
  /* eslint-enable no-console */
};

const CONFIG_SCHEMA = [
  ['USERS', ['Object']],

  ['ROOT_DIR', ['String', 'Undefined']],
  ['HOST', ['String']],
  ['PORT', ['Number']],
  ['DB_PATH', ['String']],
  ['DB_ZSTD_PATH', ['String', 'Undefined']],
  ['DB_INIT_SQL_PATH', ['String', 'Undefined']],
  ['DB_COMPRESSION', ['Number', 'Undefined']],
  ['REPORT_API_ENDPOINT', ['String']],
  ['DASH_ORIGIN', ['String']],

  ['MAX_EVENT_BYTES', ['Number']],
  ['MAX_STACK_CHARS', ['Number']],
  ['MAX_STACK_FRAMES', ['Number']],
  ['MAX_UA_CHARS', ['Number']],
  ['MAX_URI_CHARS', ['Number']],
  ['NET_MAX_FILE_BYTES', ['Number']],
  ['NET_RETRY', ['Number']],
  ['NET_TIMEOUT', ['Number']],
  ['SCHEDULED_JOB_INTERVAL', ['Number']],
  ['SESSION_TTL', ['Number']],
] as const;
const configExpectedKeys: string[] = CONFIG_SCHEMA.map((item) => item[0]);

// eslint-disable-next-line @typescript-eslint/unbound-method
const toStr = Object.prototype.toString;

// TODO: Don't throw immediately, try to validate as much as possible so we can
// report all the issues at once
function validateConfig(
  rawConfig: unknown,
  onError: (errors: Error[]) => void,
): rawConfig is TrackXAPIConfig {
  const errors: Error[] = [];

  if (rawConfig == null || typeof rawConfig !== 'object') {
    errors.push(
      new ReferenceError(
        `Config must be an object but got ${toStr.call(rawConfig)}`,
      ),
    );
    onError(errors);
    return false;
  }

  for (const key in rawConfig) {
    if (!configExpectedKeys.includes(key)) {
      errors.push(new ReferenceError(`Unexpected config key "${key}"`));
    }
  }

  for (const [key, types] of CONFIG_SCHEMA) {
    if (!(key in rawConfig)) {
      errors.push(new ReferenceError(`Config missing "${key}" key`));
    }

    const valueType = toStr
      .call((rawConfig as Record<string, unknown>)[key])
      .slice(8, -1);

    // @ts-expect-error - FIXME: "types" type
    if (!types.includes(valueType)) {
      errors.push(
        new TypeError(
          `Bad config "${key}" value. Expected ${String(
            types,
          )} but got ${valueType}.`,
        ),
      );
    }
  }

  if ((rawConfig as TrackXAPIConfig).DB_COMPRESSION) {
    if (
      !Number.isInteger((rawConfig as TrackXAPIConfig).DB_COMPRESSION)
      || (rawConfig as TrackXAPIConfig).DB_COMPRESSION! < -5
      || (rawConfig as TrackXAPIConfig).DB_COMPRESSION! > 22
    ) {
      errors.push(
        new Error(
          'Config "DB_COMPRESSION" must be a whole number between -5 and 22',
        ),
      );
    }

    if (!(rawConfig as TrackXAPIConfig).DB_ZSTD_PATH) {
      errors.push(
        new Error(
          'Config "DB_ZSTD_PATH" is required when "DB_COMPRESSION" is not 0',
        ),
      );
    }
  }

  if (errors.length > 0) {
    onError(errors);
    return false;
  }
  return true;
}

export function getConfig(
  filepath: string,
): TrackXAPIConfig & { CONFIG_PATH: string } {
  const CONFIG_PATH = path.resolve(process.cwd(), filepath);
  // eslint-disable-next-line max-len
  // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-dynamic-require, global-require
  const rawConfig = require(CONFIG_PATH) as unknown;
  // Override config values with env vars
  for (const key of Object.keys(rawConfig as object)) {
    if (typeof process.env[key] !== 'undefined') {
      // @ts-expect-error - unavoidable string indexing
      rawConfig[key] = process.env[key];
    }
  }
  const validConfig = validateConfig(rawConfig, (errors) => {
    for (const error of errors) logger.error(`${error.name}: ${error.message}`);
  });

  if (!validConfig) {
    logger.fatal('Invalid TrackX API configuration:', CONFIG_PATH);
    process.exit(2);
  }

  const rootDir = path.resolve(process.cwd(), rawConfig.ROOT_DIR || '.');

  return {
    ...rawConfig,
    CONFIG_PATH,
    DB_PATH: path.resolve(rootDir, rawConfig.DB_PATH),
    DB_ZSTD_PATH:
      rawConfig.DB_ZSTD_PATH && path.resolve(rootDir, rawConfig.DB_ZSTD_PATH),
    DB_INIT_SQL_PATH:
      rawConfig.DB_INIT_SQL_PATH
      && path.resolve(rootDir, rawConfig.DB_INIT_SQL_PATH),
  };
}

/** Read user input from stdin */
export function read(prompt: string, mask?: boolean): Promise<string> {
  return new Promise((resolve) => {
    const output = process.stdout;
    const rl = createInterface({
      input: process.stdin,
      output,
      historySize: 0,
    });

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });

    if (mask) {
      // @ts-expect-error - Private internal API (undocumented)
      // eslint-disable-next-line no-underscore-dangle
      rl._writeToOutput = (char: string) => {
        output.write(['\n', '\r\n', '\r'].includes(char) ? char : '*');
      };
    }
  });
}

export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function containsControlChar(str: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u001F\u007F]/.test(str);
}
