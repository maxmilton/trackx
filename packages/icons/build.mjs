/* eslint-disable import/no-extraneous-dependencies, no-console */

import esbuild from 'esbuild';

const out = await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.jsx',
  platform: 'browser',
  format: 'esm',
  jsx: 'preserve',
  bundle: true,
  sourcemap: true,
  watch: !!process.env.BUILD_WATCH,
  metafile: !process.env.BUILD_WATCH && process.stdout.isTTY,
  logLevel: 'debug',
});

if (out.metafile) {
  console.log(await esbuild.analyzeMetafile(out.metafile));
}
