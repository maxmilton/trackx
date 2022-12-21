/* eslint-disable import/no-extraneous-dependencies */

import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  platform: 'node',
  format: 'esm',
  bundle: true,
  sourcemap: true,
  watch: !!process.env.BUILD_WATCH,
  logLevel: 'debug',
});
