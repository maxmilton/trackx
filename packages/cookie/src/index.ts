interface CookieInit {
  key: string;
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
   * @default undefined
   */
  domain?: string | undefined;
  /**
   * @default undefined
   */
  path?: string | undefined;
  /**
   * @default true
   */
  httpOnly?: boolean | undefined;
  /**
   * @default true
   */
  secure?: boolean | undefined;
  /**
   * @default 'Strict'
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite
   * @see https://web.dev/samesite-cookies-explained/
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

    if (process.env.NODE_ENV === 'development' && parts.length > 1) {
      throw new Error(
        `Cookie header contains unexpected parts: ${parts.slice(1).toString()}`,
      );
    }

    return new Cookie({ key, value });
  }

  declare key: string;

  declare value: string;

  /**
   * The date when the cookie will expire. When undefined, the cookie will
   * expire at the end of the browser session.
   */
  declare expires: Date | undefined;

  declare domain: string | undefined;

  declare path: string | undefined;

  declare secure: boolean | undefined;

  declare httpOnly: boolean | undefined;

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite
   * @see https://web.dev/samesite-cookies-explained/
   */
  declare sameSite: 'Lax' | 'Strict' | 'None';

  constructor(options: CookieInit) {
    this.key = options.key;
    this.value = options.value;
    this.expires = options.expires;
    this.domain = options.domain;
    this.path = options.path;
    this.secure = options.secure ?? true;
    this.httpOnly = options.httpOnly ?? true;
    this.sameSite = options.sameSite || 'Strict';
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
