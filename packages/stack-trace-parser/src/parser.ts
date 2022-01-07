// eslint-disable-next-line max-len
/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-use-before-define, no-cond-assign, no-param-reassign, prefer-destructuring */
// @ts-ignore

// Based on https://github.com/xpl/stacktracey/blob/e886dd2ceb4780923050de4d8a0f901bb079fc7b/stacktracey.js

import path from 'path';
import { inspect } from 'util';
// import { getSourceAsync, resetCache } from './get-source';
import { getSourceAsync } from './get-source';
import type { CodeLocation, RawInput, StackFrame } from './types';

const lastOf = <T>(x: T[]): T => x[x.length - 1];
// TODO: Use the native node method?
const nixSlashes = (x: string) => x.replace(/\\/g, '/');
const pathRoot = `${nixSlashes(process.cwd())}/`;

function shortenPath(relativePath: string) {
  return relativePath
    .replace(/^node_modules\//, '')
    .replace(/^webpack\/bootstrap\//, '')
    .replace(/^__parcel_source_root\//, '');
}

function decomposePath(fullPath: string) {
  let result = fullPath;

  const externalDomainMatch = /^(http|https):\/\/?([^/]+)\/(.*)/.exec(result);
  const externalDomain = externalDomainMatch
    ? externalDomainMatch[2]
    : undefined;
  result = externalDomainMatch ? externalDomainMatch[3] : result;
  result = path.relative(pathRoot, result);

  return [
    nixSlashes(result).replace(/^.*:\/{1,3}/, ''), // cut webpack:/// and webpack:/ things
    externalDomain,
  ];
}

function isThirdParty(relativePath: string, externalDomain?: string) {
  return (
    externalDomain
    || relativePath[0] === '~' // webpack-specific heuristic
    || relativePath[0] === '/' // external source
    || relativePath.indexOf('node_modules') === 0
    || relativePath.indexOf('webpack/bootstrap') === 0
  );
}

function shouldSkipResolving(frame: StackFrame) {
  // skip things like <anonymous> and stuff that was already fetched
  return (
    frame.sourceFile || frame.error || (frame.file && frame.file.includes('<'))
  );
}

function rawParse(str: string, rawInput?: RawInput) {
  const lines = (str || '').split('\n');

  const frames = lines.map((line) => {
    line = line.trim();

    let callee;
    let fileLineColumn = [];
    let native;
    let planA;
    let planB;

    if (
      (planA = /at (.+) \(eval at .+ \((.+)\), .+\)/.exec(line)) // eval calls
      || (planA = /at (.+) \((.+)\)/.exec(line))
      || (line.slice(0, 3) !== 'at ' && (planA = /(.*)@(.*)/.exec(line)))
    ) {
      callee = planA[1];
      native = planA[2] === 'native';
      fileLineColumn = (
        /(.*):(\d+):(\d+)/.exec(planA[2])
        || /(.*):(\d+)/.exec(planA[2])
        || []
      ).slice(1);
    } else if ((planB = /^(at\s+)*(.+):(\d+):(\d+)/.exec(line))) {
      fileLineColumn = planB.slice(2);
    } else {
      return;
    }

    /*  Detect things like Array.reduce
      TODO: detect more built-in types            */

    if (callee && !fileLineColumn[0]) {
      const type = callee.split('.')[0];
      if (type === 'Array') {
        native = true;
      }
    }

    // eslint-disable-next-line consistent-return
    return {
      beforeParse: line,
      callee: callee || '',
      // @ts-expect-error - FIXME: url type
      index: rawInput && fileLineColumn[0] === rawInput.url,
      native: native || false,
      file: nixSlashes(fileLineColumn[0] || ''),
      line: Number.parseInt(fileLineColumn[1] || '', 10) || undefined,
      column: Number.parseInt(fileLineColumn[2] || '', 10) || undefined,
    };
  });

  return frames.filter((x) => x !== undefined);
}

function extractEntryMetadata(frame: StackFrame) {
  const decomposedPath = decomposePath(frame.file || '');
  const fileRelative = decomposedPath[0];
  const externalDomain = decomposedPath[1];

  return Object.assign(frame, {
    calleeShort: frame.calleeShort || lastOf((frame.callee || '').split('.')),
    fileRelative,
    // @ts-expect-error - FIXME:!
    fileShort: shortenPath(fileRelative),
    fileName: lastOf((frame.file || '').split('/')),
    // @ts-expect-error - FIXME:!
    thirdParty: isThirdParty(fileRelative, externalDomain) && !frame.index,
    externalDomain,
  });
}

function withSourceResolved<F extends StackFrame, T extends StackFrame>(
  frame: F,
  resolved: T,
): F & T {
  if (resolved.sourceFile && !resolved.sourceFile.error) {
    resolved.file = nixSlashes(resolved.sourceFile.path);
    // @ts-expect-error - FIXME:!
    resolved = extractEntryMetadata(resolved);
  }

  if (resolved.sourceLine!.includes('// @hide')) {
    resolved.sourceLine = resolved.sourceLine!.replace('// @hide', '');
    resolved.hide = true;
  }

  if (
    resolved.sourceLine!.includes('__webpack_require__') // webpack-specific heuristics
    || resolved.sourceLine!.includes('/******/ ({')
  ) {
    resolved.thirdParty = true;
  }

  return { sourceLine: '', ...frame, ...resolved };
}

// function withSource(frame: StackFrame) {
//   if (shouldSkipResolving(frame)) {
//     return frame;
//   }
//   const resolved = getSource(frame.file || '').resolve(frame);

//   if (!resolved.sourceFile) {
//     return frame;
//   }

//   return withSourceResolved(frame, resolved);
// }

function withSourceAsync(frame: StackFrame) {
  if (shouldSkipResolving(frame)) {
    return Promise.resolve(frame);
  }
  return (
    getSourceAsync(frame.file || '')
      // @ts-expect-error - FIXME:!
      .then((x) => x.resolve(frame))
      // @ts-expect-error - FIXME:!
      .then((resolved) => withSourceResolved(frame, resolved))
      // @ts-expect-error - FIXME:!
      .catch((error) => withSourceResolved(frame, { error, sourceLine: '' }))
  );
}

// function withSourceAt(frames: StackFrame[], index: number) {
//   return frames[index] && withSource(frames[index]);
// }

// function withSourceAsyncAt(frames: StackFrame[], index: number) {
//   return frames[index] && withSourceAsync(frames[index]);
// }

// function withSources(frames: StackFrame[]) {
//   return frames.map((x) => withSource(x));
// }

function withSourcesAsync(frames: StackFrame[]): Promise<StackFrame[]> {
  return Promise.all(frames.map((frame) => withSourceAsync(frame))).then(
    (items) => rawParser(items),
  );
}

// function mergeRepeatedLines() {
//   return rawParser(
//     partition(this.items, (e) => e.file + e.line).map((group) => group.items.slice(1).reduce(
//       (memo, entry) => {
//         memo.callee = `${memo.callee || '<anonymous>'} → ${
//           entry.callee || '<anonymous>'
//         }`;
//         memo.calleeShort = `${memo.calleeShort || '<anonymous>'} → ${
//           entry.calleeShort || '<anonymous>'
//         }`;
//         return memo;
//       },
//       { ...group.items[0] },
//     )),
//   );
// }

// function clean() {
//   const s = withSources().mergeRepeatedLines();
//   return s.filter(s.isClean.bind(s));
// }

// function cleanAsync() {
//   return withSourcesAsync().then((s) => {
//     s = s.mergeRepeatedLines();
//     return s.filter(s.isClean.bind(s));
//   });
// }

// function isClean(entry, index: number) {
//   return index === 0 || !(entry.thirdParty || entry.hide || entry.native);
// }

// function at(frames: StackFrame[], index: number) {
//   return {
//     beforeParse: '',
//     callee: '<???>',
//     index: false,
//     native: false,
//     file: '<???>',
//     line: 0,
//     column: 0,
//     ...frames[index],
//   };
// }

export function rawParser(input?: RawInput, offset?: number): StackFrame[] {
  const originalInput = input;
  const isParseableSyntaxError = input && input instanceof SyntaxError;
  let stack = input;

  /* parser() */

  // TODO: Remove this behaviour?
  // if (!stack) {
  //   stack = new Error();
  //   offset = offset === undefined ? 1 : offset;
  // }

  /* parser(Error) */

  // if (stack instanceof Error) {
  // @ts-expect-error - FIXME:!
  if (stack instanceof Error || stack.stack) {
    // @ts-expect-error - FIXME:!
    stack = stack.stack || '';
  }

  /* parser(string) */

  if (typeof stack === 'string') {
    // @ts-expect-error - FIXME:!
    stack = rawParse(stack, input).slice(offset).map(extractEntryMetadata);
  }

  /* parser(array) */

  if (Array.isArray(stack)) {
    if (isParseableSyntaxError) {
      const rawLines = inspect(originalInput).split('\n');
      const fileLine = rawLines[0].split(':');
      const line = fileLine.pop();
      const file = fileLine.join(':');

      if (file) {
        stack.unshift({
          file: nixSlashes(file),
          // @ts-expect-error - FIXME:!
          line,
          column: (rawLines[2] || '').indexOf('^') + 1,
          sourceLine: rawLines[1],
          callee: '(syntax error)',
          syntaxError: true,
        });
      }
    }
  } else {
    stack = [];
  }

  return stack;
}

// interface ParseOptions {
//   withSource?: boolean;
// }
//
// /**
//  * Parse a stack trace then enrich using its source code and sourcemap.
//  */
// export function parse(
//   input: RawInput,
//   options: ParseOptions = {},
// ): Promise<StackFrame[]> {
//   // console.log('@@@@@@@@@@ INPUT', input);
//
//   // FIXME: Also extract the error name and message (either from the input
//   // and/or fallback to the first line of the stack (which might even be a
//   // better option for first choice?))
//   const rawStack = rawParser(input);
//
//   if (!options.withSource) {
//     return Promise.resolve(rawStack);
//   }
//
//   const resolvedStack = withSourcesAsync(rawStack);
//
//  // FIXME: Should the net cache be reset now? Could the cache be moved to disk
//  // on reset? Store each file as a globally uniqye hash based on it's contents
//  // and name etc. If so it needs to accept configuration options. We would
//  // also need a mechanisum to delete unnecessary disk cache items (e.g., after
//  // project is deleted or if we have an X day cache data retention policy
//  // (maybe that's the best thing since we can always fetch again easily,
//  // what's more expensive network or disk?))
//   // getSourceAsync.resetCache();
//   // getSourceAsync.purgeCacheToDisk();
//
//   return resolvedStack;
// }

export const parse = {
  raw: rawParser,
  withSource: withSourcesAsync,
};

export function locationsEqual(a: CodeLocation, b: CodeLocation): boolean {
  return a.file === b.file && a.line === b.line && a.column === b.column;
}
