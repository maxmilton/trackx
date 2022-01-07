import * as config from '../trackx.config.mjs';

export { config };

export class AppError extends Error {
  declare code: number | undefined;

  declare details: unknown;

  constructor(message: string, code?: number | undefined, details?: unknown) {
    super(message);

    this.name = 'AppError';
    this.code = code;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export async function logout(): Promise<void> {
  try {
    const res = await fetch(`${config.DASH_API_ENDPOINT}/logout`, {
      credentials: 'same-origin',
      mode: 'same-origin',
      redirect: 'error',
    });

    if (!res.ok) {
      throw new AppError(await res.text(), res.status);
    }
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error(error);
  } finally {
    window.location.replace('/login');
  }
}

export async function checkSession(): Promise<void> {
  const res = await fetch(`${config.DASH_API_ENDPOINT}/sess`, {
    credentials: 'same-origin',
    mode: 'same-origin',
    redirect: 'error',
  });

  if (!res.ok) {
    throw new AppError(await res.text(), res.status);
  }
}

export async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    mode: 'same-origin',
    redirect: 'error',
  });

  if (!res.ok) {
    if (res.status === 401) {
      // @ts-expect-error - force exit early
      return logout();
    }

    throw new AppError(await res.text(), res.status);
  }

  return res.json() as Promise<T>;
}

export async function adHocQuery<T>(
  sql: string,
  opts: {
    exec?: boolean;
    expand?: boolean;
    pluck?: boolean;
    raw?: boolean;
    single?: boolean;
  } = {},
): Promise<T> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('AD HOC QUERIES ARE FOR DEVELOPMENT ONLY!');
  }

  const res = await fetch(
    // @ts-expect-error - opts values will be coerced into strings
    `${config.DASH_API_ENDPOINT}/query?${new URLSearchParams(opts)}`,
    {
      method: 'POST',
      credentials: 'same-origin',
      mode: 'same-origin',
      redirect: 'error',
      body: sql,
    },
  );

  if (!res.ok) {
    if (res.status === 401) {
      // @ts-expect-error - force exit early
      return logout();
    }

    throw new AppError(await res.text(), res.status);
  }

  return res.json() as Promise<T>;
}

export function compactNumber(num: number, hideDecimalK?: boolean): string {
  if (num < 1000) return `${num}`;
  let n = num;
  let e = -1;
  do {
    n /= 1000;
    // eslint-disable-next-line no-plusplus
    ++e;
  } while (n >= 1000);
  return `${
    hideDecimalK && e < 1 ? Math.floor(n) : Math.floor(n * 10) / 10 // 1 decimal without rounding
  }${'kMB'[e]}`;
}

function URLParamAction(
  action: 'set' | 'delete',
  key: string,
  value?: string | number,
) {
  const params = new URLSearchParams(window.location.search);
  params[action](key, value != null ? encodeURIComponent(value) : '');
  window.history.replaceState({}, '', `?${params}`);
}

export const setURLParam = URLParamAction.bind(URLParamAction, 'set');
export const delURLParam = URLParamAction.bind(URLParamAction, 'delete');
