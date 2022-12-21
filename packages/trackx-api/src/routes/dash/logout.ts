import send from '@polka/send';
import { Cookie } from '@trackx/cookie';
import type { Middleware } from 'polka';
import { deniedDash } from '../../db';
import { logger, sessions, Status } from '../../utils';

const unixEpoch = new Date(0);

// XXX: Validation is purposely limited (e.g., no query params check) in this
// route as we want to allow logout as liberally as possible
export const get: Middleware = (req, res, next) => {
  try {
    const cookieHeader = req.headers.cookie;

    if (cookieHeader) {
      const cookie = Cookie.parse(cookieHeader);

      if (cookie) {
        sessions.delete(cookie.value);

        // Deleting cookies works by expiring them; we use a date far in the
        // past so even user machines with the time set incorrectly will likely
        // expire the cookie. This is a fallback for browsers which don't
        // support the Clear-Site-Data header.
        cookie.setExpires(unixEpoch);

        send(res, Status.OK, undefined, {
          'Set-Cookie': cookie.toString(),
          'Clear-Site-Data': '"cookies"',
        });
        return;
      }
    }

    // TODO: Is it enough to have the frontend logic or should we force
    // redirect to login page? Also add to send() if we use this.
    // res.writeHead(302, {
    //   Location: '/login',
    //   'Content-Length': 0
    // });
    res.end();
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
