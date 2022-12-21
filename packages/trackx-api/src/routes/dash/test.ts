import type { Middleware } from 'polka';
import { sendEvent } from 'trackx/node';
import { deniedDash } from '../../db';
import type { ReqQueryData } from '../../types';
import { AppError, logger, Status } from '../../utils';

class TestError extends Error {
  constructor(message: string) {
    super(message);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TestError);
    }

    this.name = 'TestError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const VALID_TYPES = [
  'timeout',
  'reject1',
  'reject2',
  'reject3',
  'reject4',
  'console1',
  'console2',
  'console3',
  'logger1',
  'logger2',
  'logger3',
  'throw',
];

export const get: Middleware = async (req, res, next) => {
  try {
    const { count, type, ...rest } = req.query as ReqQueryData;

    if (Object.keys(rest).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    let countValue;

    if (count === undefined) {
      countValue = 1;
    } else {
      if (typeof count !== 'string') {
        throw new AppError('Invalid count', Status.UNPROCESSABLE_ENTITY);
      }
      countValue = +count;
      if (!Number.isInteger(countValue) || countValue < 1) {
        throw new AppError('Invalid count', Status.UNPROCESSABLE_ENTITY);
      }
    }

    if (type !== undefined) {
      if (typeof type !== 'string' || !VALID_TYPES.includes(type)) {
        throw new AppError('Invalid type', Status.UNPROCESSABLE_ENTITY);
      }
    }

    logger.log('STARTING TEST ERROR');

    switch (type) {
      case 'timeout':
        setTimeout(() => {
          throw new TestError('Internal test exception setTimeout throw');
        }, 100);
        break;
      case 'reject1':
        void Promise.reject(
          new TestError('Internal test exception promise reject Error'),
        );
        break;
      case 'reject2':
        // eslint-disable-next-line prefer-promise-reject-errors
        void Promise.reject('Internal test exception promise reject string');
        break;
      case 'reject3':
        // eslint-disable-next-line prefer-promise-reject-errors
        void Promise.reject({ test: true });
        break;
      case 'reject4':
        // eslint-disable-next-line prefer-promise-reject-errors
        void Promise.reject(null);
        break;
      case 'console1':
        // eslint-disable-next-line no-console
        console.error('Internal console error string');
        break;
      case 'console2':
        // eslint-disable-next-line no-console
        console.error(new Error('Internal console error Error'));
        break;
      case 'console3':
        // eslint-disable-next-line no-console
        console.error(null);
        break;
      case 'logger1':
        logger.error('Internal logger error string');
        break;
      case 'logger2':
        logger.error(new Error('Internal logger error Error'));
        break;
      case 'logger3':
        logger.error(null);
        break;
      case 'throw':
        throw new TestError('Internal test exception throw Error');
      default:
        for (let index = 0; index < countValue; index++) {
          sendEvent(new TestError('Internal test exception sendEvent'));
          if (index % (countValue / 10) === 0) logger.log(`${index}`);
          // eslint-disable-next-line no-await-in-loop
          await sleep(0);
        }
    }

    logger.log(`FINISHED TEST ERROR (${countValue} times)`);

    res.statusCode = Status.I_AM_A_TEAPOT;
    res.end();
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
