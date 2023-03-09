/* eslint-disable import/no-extraneous-dependencies */

import esbuild from 'esbuild';

/** @type {esbuild.BuildOptions} */
const esbuildConfig = {
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  platform: 'node',
  format: 'esm',
  external: ['data-uri-to-buffer', 'httpie', 'source-map'],
  bundle: true,
  sourcemap: true,
  logLevel: 'debug',
};

if (process.env.BUILD_WATCH) {
  const context = await esbuild.context(esbuildConfig);
  await context.watch();
} else {
  await esbuild.build(esbuildConfig);
}
