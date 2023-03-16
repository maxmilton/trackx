export interface CookieInit {
  /**
   * The name of the cookie.
   */
  key: string;
  /**
   * The value of the cookie.
   *
   * This is not encoded or decoded in any way. It is passed through as-is. The
   * caller is responsible for encoding and decoding the value.
   *
   * Do not wrap the value in quotes.
   */
  value: string;
  /**
   * The date when the cookie will expire. When undefined, the cookie will
   * expire at the end of the browser session.
   *
   * @default undefined
   */
  expires?: Date | undefined;
  /** @deprecated Use `expires` instead. */
  maxAge?: never;
  /**
   * The domain for which the cookie is valid.
   *
   * @default undefined
   */
  domain?: string | undefined;
  /**
   * The path for which the cookie is valid.
   *
   * @default undefined
   */
  path?: string | undefined;
  /**
   * Should the cookie only be accessible via HTTP(S)? This prevents the cookie
   * from being accessed via JavaScript.
   *
   * @default true
   */
  httpOnly?: boolean | undefined;
  /**
   * Should the cookie only be sent over HTTPS? Note that this is required for
   * `SameSite=None` cookies.
   *
   * @see https://web.dev/samesite-cookies-explained/#samesitenone-must-be-secure
   *
   * @default true
   */
  secure?: boolean | undefined;
  /**
   * The `SameSite` attribute of the cookie.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite
   * @see https://web.dev/samesite-cookies-explained/
   *
   * @default 'Strict'
   */
  sameSite?: 'Lax' | 'Strict' | 'None' | undefined;
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie
 */
export class Cookie {
  /**
   * Parse a Cookie HTTP header sent from a browser.
   *
   * Only a `key=value` pair is supported. No other attributes are parsed.
   *
   * No validation or decoding is performed on the key or value.
   */
  static parse(header: string): Cookie {
    // There should only be one part, but for safety, we break it up anyway
    const parts = header.split(';');
    const [key, value] = parts[0].split('=');

    if (!key || !value) {
      throw new Error('Invalid cookie header');
    }

    if (process.env.NODE_ENV !== 'production' && parts.length > 1) {
      throw new Error(
        `Cookie header contains unexpected parts: ${parts.slice(1).toString()}`,
      );
    }

    return new Cookie({ key, value });
  }

  /**
   * The name of the cookie.
   */
  declare key: string;

  /**
   * The value of the cookie.
   *
   * This is not encoded or decoded in any way. It is passed through as-is. The
   * caller is responsible for encoding and decoding the value.
   *
   * Do not wrap the value in quotes.
   */
  declare value: string;

  /**
   * The date when the cookie will expire. When undefined, the cookie will
   * expire at the end of the browser session.
   */
  declare expires: Date | undefined;

  /** @deprecated Use `expires` instead. */
  declare maxAge: never;

  /**
   * The domain for which the cookie is valid.
   */
  declare domain: string | undefined;

  /**
   * The path for which the cookie is valid.
   */
  declare path: string | undefined;

  /**
   * Should the cookie only be sent over HTTPS? Note that this is required for
   * `SameSite=None` cookies.
   *
   * @see https://web.dev/samesite-cookies-explained/#samesitenone-must-be-secure
   */
  declare secure: boolean | undefined;

  /**
   * Should the cookie only be accessible via HTTP(S)? This prevents the cookie
   * from being accessed via JavaScript.
   */
  declare httpOnly: boolean | undefined;

  /**
   * The `SameSite` attribute of the cookie.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite
   * @see https://web.dev/samesite-cookies-explained/
   */
  declare sameSite: 'Lax' | 'Strict' | 'None';

  /**
   * Create a new Cookie.
   *
   * Note that validation is only performed when `NODE_ENV` is set to
   * `development`. No validation is performed in production for performance.
   *
   * Neither the `key` nor `value` are encoded or decoded. They are passed
   * through as-is so that the caller can decide how to encode them.
   */
  constructor(options: CookieInit) {
    this.key = options.key;
    this.value = options.value;
    this.expires = options.expires;
    this.domain = options.domain;
    this.path = options.path;
    this.secure = options.secure ?? true;
    this.httpOnly = options.httpOnly ?? true;
    this.sameSite = options.sameSite || 'Strict';

    if (process.env.NODE_ENV !== 'production') {
      // Check key and value contain only ASCII and no invalid characters
      if (
        !/^[\u0020-\u007E]*$/.test(this.key)
        || /[\t "(),/:;<=>?@[\\\]{}]/.test(this.key)
      ) {
        throw new Error(`Cookie key contains invalid characters: ${this.key}`);
      }
      if (
        !/^[\u0020-\u007E]*$/.test(this.value)
        || /[\t "(),/:;<=>?@[\\\]{}]/.test(this.value)
      ) {
        throw new Error(
          `Cookie value contains invalid characters: ${this.value}`,
        );
      }

      if (options.maxAge) {
        throw new Error('maxAge is not supported, use expires instead');
      }

      if (this.sameSite === 'None' && !this.secure) {
        throw new Error('SameSite=None cookies must be Secure');
      }
    }
  }

  setExpires(date: Date): void {
    this.expires = date;
  }

  /**
   * Serialize the cookie into a string for use in a Set-Cookie HTTP header.
   */
  toString(): string {
    const parts = [`${this.key}=${this.value}`];

    if (this.expires) {
      // XXX: Expires is supiror to Max-Age because of wider browser support,
      // is more explicit, and simple to implement.
      parts.push(`Expires=${this.expires.toUTCString()}`);
    }
    if (this.domain) {
      parts.push(`Domain=${this.domain}`);
    }
    if (this.path) {
      parts.push(`Path=${this.path}`);
    }
    if (this.secure) {
      parts.push('Secure');
    }
    if (this.httpOnly) {
      parts.push('HttpOnly');
    }
    if (this.sameSite) {
      parts.push(`SameSite=${this.sameSite}`);
    }

    return parts.join('; ');
  }

  /**
   * Get the remaining time to live in milliseconds.
   */
  TTL(): number {
    if (this.expires) {
      const ttl = this.expires.getTime() - Date.now();
      return ttl > 0 ? ttl : 0;
    }

    // Valid until end of browser session
    return Number.POSITIVE_INFINITY;
  }
}
