/* eslint-disable import/no-extraneous-dependencies, no-console */

import esbuild from 'esbuild';
import { gitHash, isDirty } from 'git-ref';
import pkg from './package.json' assert { type: 'json' };

const mode = process.env.NODE_ENV;
const dev = mode === 'development';
const release = `v${pkg.version}-${gitHash()}${isDirty() ? '-dev' : ''}`;

const external = ['better-sqlite3'];

/** @type {esbuild.BuildOptions} */
const esbuildConfig = {
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
  metafile: !dev && process.stdout.isTTY,
  logLevel: 'debug',
};

if (process.env.BUILD_WATCH) {
  const context = await esbuild.context(esbuildConfig);
  await context.watch();
} else {
  const out = await esbuild.build(esbuildConfig);

  if (out.metafile) {
    console.log(await esbuild.analyzeMetafile(out.metafile));
  }
}
