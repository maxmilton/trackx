/* eslint-disable import/no-extraneous-dependencies */

import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  platform: 'node',
  format: 'esm',
  external: ['data-uri-to-buffer', 'httpie', 'source-map'],
  bundle: true,
  sourcemap: true,
  watch: !!process.env.BUILD_WATCH,
  logLevel: 'debug',
});
