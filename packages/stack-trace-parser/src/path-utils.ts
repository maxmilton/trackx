/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-shadow, no-plusplus */

// Based on https://github.com/xpl/get-source/blob/master/impl/path.js

// TODO: Remove browser specific code
const isBrowser = typeof window !== 'undefined' && window.window === window && window.navigator;
const cwd = isBrowser ? window.location.href : process.cwd();

const isData = (x: string) => x.indexOf('data:') === 0;

const isAbsolute = (x: string) => x[0] === '/' || /^[^/]*:/.test(x);

function normalize(x: string) {
  const output: string[] = [];
  let skip = 0;

  x.split('/')
    .reverse()
    .filter((x) => x !== '.')
    // eslint-disable-next-line unicorn/no-array-for-each
    .forEach((x) => {
      if (x === '..') {
        skip++;
      } else if (skip === 0) {
        output.push(x);
      } else {
        skip--;
      }
    });

  const result = output.reverse().join('/');

  return (
    (isBrowser && result[0] === '/'
      ? (result[1] === '/'
        ? window.location.protocol
        : window.location.origin)
      : '') + result
  );
}

function concat(a: string, b: string): string {
  const a_endsWithSlash = a[a.length - 1] === '/';
  const b_startsWithSlash = b[0] === '/';

  return (
    a
    + (a_endsWithSlash || b_startsWithSlash ? '' : '/')
    + (a_endsWithSlash && b_startsWithSlash ? b.slice(1) : b)
  );
}

export function resolve(x: string): string {
  if (isAbsolute(x)) {
    return normalize(x);
  }

  return normalize(concat(cwd, x));
}

export function relativeToFile(a: string, b: string): string {
  return isData(a) || isAbsolute(b)
    ? normalize(b)
    : normalize(concat(a.split('/').slice(0, -1).join('/'), b));
}
