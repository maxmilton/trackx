/* eslint-disable import/no-extraneous-dependencies, no-console */

import esbuild from 'esbuild';
import { gitHash, isDirty } from 'git-ref';
import pkg from './package.json' assert { type: 'json' };

const mode = process.env.NODE_ENV;
const dev = mode === 'development';
const release = `v${pkg.version}-${gitHash()}${isDirty() ? '-dev' : ''}`;

const external = ['better-sqlite3'];

const out = await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/cli.js',
  target: ['node18'],
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
