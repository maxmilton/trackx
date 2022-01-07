// Based on https://github.com/xpl/stacktracey/blob/master/stacktracey.d.ts

export type RawInput = Error | string | StackFrame[];

export interface SourceFile {
  path: string;
  text: string;
  lines: string[];
  error?: Error;
}

export interface CodeLocation {
  file: string;
  line?: number;
  column?: number;
}

export interface StackFrame extends CodeLocation {
  beforeParse: string;
  callee: string;
  index: boolean;
  native: boolean;

  calleeShort: string;
  fileRelative: string;
  fileShort: string;
  fileName: string;
  thirdParty: boolean;

  hide?: boolean;
  sourceLine?: string;
  sourceFile?: SourceFile;
  error?: Error;
}
