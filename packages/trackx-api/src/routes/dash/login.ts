import send from '@polka/send';
import crypto from 'crypto';
import type { Middleware } from 'polka';
import { Cookie } from 'tough-cookie';
import { deniedDash } from '../../db';
import type { ReqBodyData, ReqQueryData } from '../../types';
import {
  AppError, config, logger, sessions, Status, uid,
} from '../../utils';

// https://github.com/angular/angular.js/blob/0633d8f2b0ac6cbad1c637768258b1f72994a614/src/ng/directive/input.js#L27
const RE_EMAIL = /^(?=.{1,254}$)(?=.{1,64}@)[\w!#$%&'*+/=?^`{|}~-]+(\.[\w!#$%&'*+/=?^`{|}~-]+)*@[\dA-Za-z]([\dA-Za-z-]{0,61}[\dA-Za-z])?(\.[\dA-Za-z]([\dA-Za-z-]{0,61}[\dA-Za-z])?)*$/;

export const options: Middleware = (_req, res) => {
  res.writeHead(Status.NO_CONTENT, {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST',
  });
  res.end();
};

function verify(password: string, hash: string) {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':');
    const keyBuffer = Buffer.from(key, 'base64');
    crypto.scrypt(password, salt, 64, { cost: 2048 }, (err, derivedKey) => {
      if (err) reject(err);
      resolve(crypto.timingSafeEqual(keyBuffer, derivedKey));
    });
  });
}

export const post: Middleware = async (req, res, next) => {
  try {
    const query = req.query as ReqQueryData;

    if (Object.keys(query).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    const { email, password, ...rest } = req.body as ReqBodyData;
    let userid: string;

    if (
      Object.keys(rest).length > 0
      || !email
      || !password
      || typeof email !== 'string'
      || typeof password !== 'string'
      || email.length < 3
      || email.length > 254
      || password.length < 8
      // OWASP suggest max length of 64 for passwords -- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#implement-proper-password-strength-controls
      || password.length > 64
      || !RE_EMAIL.test(email)
      // eslint-disable-next-line no-cond-assign
      || !((userid = email.toLowerCase()) in config.USERS)
      || !(await verify(password, config.USERS[userid]))
    ) {
      throw new AppError('Invalid email or password.', Status.FORBIDDEN);
    }

    const sessionId = uid();
    const cookie = new Cookie({
      key: 'id',
      value: sessionId,
      expires: new Date(Date.now() + config.SESSION_TTL),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/api/dash/',
      sameSite: 'strict',
    });
    sessions.set(sessionId, cookie);

    send(res, Status.OK, undefined, {
      'Set-Cookie': cookie.toString(),
    });

    // TODO: Use this? Is session timeout not enough?
    // // Purge existing session if it exists
    // const hCookie = req.headers.cookie;
    //
    // if (hCookie) {
    //   const reqCookie = Cookie.parse(hCookie);
    //
    //   if (reqCookie && reqCookie.key === 'id') {
    //     sessions.delete(reqCookie.value);
    //   }
    // }

    // Garbage collection; purge expired sessions
    // eslint-disable-next-line unicorn/no-array-for-each
    sessions.forEach((session) => {
      if (session.TTL() <= 0) {
        sessions.delete(session.value);
      }
    });
  } catch (error) {
    if (!(error instanceof AppError) || error.status !== Status.FORBIDDEN) {
      logger.error(error);
    }
    void next(error || new Error(error));
    deniedDash();
  }
};
