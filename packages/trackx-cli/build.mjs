/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable import/no-extraneous-dependencies */

import esbuild from 'esbuild';
import fs from 'fs/promises';
import { gitHash, isDirty } from 'git-ref';

// workaround for no json import in esm yet
/** @type {import('./package.json')} */
const pkg = JSON.parse(await fs.readFile('./package.json', 'utf8'));

const mode = process.env.NODE_ENV;
const dev = mode === 'development';
const release = `v${pkg.version}-${gitHash()}${isDirty() ? '-dev' : ''}`;

const external = ['better-sqlite3'];

const out = await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/cli.js',
  target: ['node16'],
  platform: 'node',
  define: {
    'process.env.APP_RELEASE': JSON.stringify(release),
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
  external,
  banner: { js: '#!/usr/bin/env node\n"use strict";' },
  bundle: true,
  sourcemap: true,
  minify: !dev,
  watch: !!process.env.BUILD_WATCH,
  metafile: !dev && process.stdout.isTTY,
  logLevel: 'debug',
});

if (out.metafile) {
  console.log(await esbuild.analyzeMetafile(out.metafile));
}
