/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-use-before-define, max-len, no-constant-condition, no-return-assign, no-underscore-dangle */
// @ts-ignore

// Based on:
// - https://github.com/xpl/get-source/blob/master/get-source.js
// - https://github.com/xpl/get-source/blob/master/get-source.d.ts

import dataURIToBuffer from 'data-uri-to-buffer';
import { get as httpGet } from 'httpie';
import { SourceMapConsumer } from 'source-map';
import { relativeToFile, resolve as resolvePath } from './path-utils';

interface Location {
  line: number;
  column: number;
  // name: string;
}

interface ResolvedLocation<FileType> extends Location {
  sourceFile: FileType;
  sourceLine: string;
  error?: Error;
}

interface File {
  path: string;
  text: string;
  lines: string[];
  error?: Error;
}

interface FileAsync extends File {
  resolve(location: Location): Promise<ResolvedLocation<FileAsync>>;
  _resolve(location: Location): Promise<ResolvedLocation<FileAsync>>;
}

type MemoizerCache = Record<string, Promise<FileAsync>>;
interface Memoizer {
  (path: string): Promise<FileAsync>;
  cache: MemoizerCache;
  forgetEverything(): void;
}

// TODO: Keep this in-memory cache or implement something more fancy like a disk cache?
function memoize(fn: (x: string) => Promise<FileAsync>): Memoizer {
  const m = (x: string) => (x in m.cache ? m.cache[x] : (m.cache[x] = fn(x)));
  m.forgetEverything = () => {
    m.cache = Object.create(null) as MemoizerCache;
  };
  m.cache = Object.create(null) as MemoizerCache;

  return m;
}

function fetchFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // TODO: Implement fs fetching for enhancing errors coming directly from a
    // local app (e.g., @trackx/server) at runtime?
    //  ↳ TBH that's probably more trouble than it's worth, however, uploading
    //    source maps would definately be a worthwhile feature

    // require('fs').readFile(path, { encoding: 'utf8' }, (e, x) => {
    //   e ? reject(e) : resolve(x);
    // });

    // FIXME: Exactly what kind of potential security issues does this present
    // and what are some strategies we could use to mitigate them?
    httpGet(path, {
      timeout: 20_000,
    })
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      .then((res) => resolve(res.data))
      .catch((error) => reject(error));
  });
}

const SourceFileMemoized = memoize((path) => SourceFile(path, fetchFile(path)));

function SourceMapResolver(
  originalFilePath: string,
  sourceMapPath: string,
  fallbackResolve: (loc: Location) => ResolvedLocation<FileAsync>,
) {
  const srcFile = sourceMapPath.startsWith('data:')
    ? SourceFile(originalFilePath, dataURIToBuffer(sourceMapPath).toString())
    : SourceFile(relativeToFile(originalFilePath, sourceMapPath));

  const parsedMap = srcFile.then((file) => new SourceMapConsumer(file.text));

  const sourceFor = memoize((filePath) => srcFile.then((file) => {
    const fullPath = relativeToFile(file.path, filePath);
    return parsedMap.then((consumer) => SourceFile(
      fullPath,
      consumer.sourceContentFor(filePath, true) || undefined,
    ));
  }));

  return (loc: Location) => parsedMap
    .then((consumer) => {
      const originalLoc = consumer.originalPositionFor(loc);
      return originalLoc.source
        ? sourceFor(originalLoc.source).then((x) => x._resolve({
          ...loc,
          line: originalLoc.line!,
          column: originalLoc.column! + 1,
          // @ts-expect-error - FIXME:!
          name: originalLoc.name!,
        }))
        : fallbackResolve(loc);
    })
    .catch((error) => Object.assign(fallbackResolve(loc), { sourceMapError: error }));
}

function SourceMapResolverFromFetchedFile(file: FileAsync) {
  /*  Extract the last sourceMap occurrence (TODO: support multiple sourcemaps) */

  const re = /# sourceMappingURL=(.+)\n?/g;
  let lastMatch;

  while (true) {
    const match = re.exec(file.text);
    if (match) lastMatch = match;
    else break;
  }

  const url = lastMatch && lastMatch[1];

  const defaultResolver = (loc: Location) => ({
    ...loc,
    sourceFile: file,
    sourceLine: file.lines[loc.line - 1] || '',
  });

  return url
    ? SourceMapResolver(file.path, url, defaultResolver)
    : defaultResolver;
}

function SourceFile(
  srcPath: string,
  text?: string | Promise<string>,
): Promise<FileAsync> {
  if (text === undefined) {
    return SourceFileMemoized(resolvePath(srcPath));
  }

  return Promise.resolve(text).then((_text) => {
    let file: FileAsync;
    let lines: string[];
    let resolver: (loc: Location) => Promise<ResolvedLocation<FileAsync>>;
    // @ts-expect-error - FIXME:!
    // const _resolve = (loc: Location) => (resolver = resolver || SourceMapResolverFromFetchedFile(file))(loc);
    const _resolve = (loc: Location) => (resolver ||= SourceMapResolverFromFetchedFile(file))(loc);

    return (file = {
      path: srcPath,
      text: _text,
      get lines() {
        return (lines = lines || _text.split('\n'));
      },
      resolve(loc: Location) {
        const result = _resolve(loc);
        return Promise.resolve(result);
      },
      _resolve,
    });
  });
}

// FIXME: Pointless alias
export const getSourceAsync = SourceFile;

export const resetCache = (): void => SourceFileMemoized.forgetEverything();
export const getCache = (): MemoizerCache => SourceFileMemoized.cache;
