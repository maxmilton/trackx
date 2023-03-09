/* eslint-disable import/no-extraneous-dependencies, no-console */

import esbuild from 'esbuild';

/** @type {esbuild.BuildOptions} */
const esbuildConfig = {
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.jsx',
  platform: 'browser',
  format: 'esm',
  jsx: 'preserve',
  bundle: true,
  sourcemap: true,
  metafile: !process.env.BUILD_WATCH && process.stdout.isTTY,
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
