/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { getGlobals } from '@ekscss/framework/utils';
import css from '@ekscss/rollup-plugin-css';
import purgecss from '@ekscss/rollup-plugin-purgecss';
import { babel } from '@rollup/plugin-babel';
import buble from '@rollup/plugin-buble';
import commonjs from '@rollup/plugin-commonjs';
import html, { makeHtmlAttributes } from '@rollup/plugin-html';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import { gitHash, isDirty } from 'git-ref';
import xcss from 'rollup-plugin-ekscss';
import esbuild from 'rollup-plugin-esbuild';
import { terser } from 'rollup-plugin-terser';
import { visualizer } from 'rollup-plugin-visualizer';
import pkg from './package.json';
import * as config from './trackx.config.mjs';

const mode = process.env.NODE_ENV;
const dev = mode === 'development';
const hash = gitHash();
const release = `v${pkg.version}-${hash}${isDirty() ? '-dev' : ''}`;

const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

/** @type {import('@rollup/plugin-babel').RollupBabelInputPluginOptions} */
const babelOpts = {
  include: [/\.[jt]sx$/],
  exclude: [/@babel(?:\/|\\{1,2})runtime/],
  extensions,
  babelrc: false,
  babelHelpers: 'bundled',
  presets: ['babel-preset-solid'],
  skipPreflightCheck: true, // faster builds
};

/** @type {import('rollup-plugin-terser').Options} */
const terserOpts = {
  ecma: 2018,
  compress: {
    comparisons: false,
    passes: 2,
    inline: 2,
    unsafe: true,
    keep_infinity: true,
    negate_iife: false,
  },
  format: {
    comments: false,
    ascii_only: true,
    wrap_iife: true,
    wrap_func_args: true,
  },
  // mangle: false,
};

/** @type {import('rollup').WatcherOptions} */
const watch = {
  clearScreen: false,
};

/** @param {import('@rollup/plugin-html').RollupHtmlTemplateOptions} opts */
const htmlTemplate = ({
  attributes, files, publicPath, title,
}) => {
  const scripts = (files.js || [])
    // @ts-expect-error - TODO:!
    .filter((chunk) => chunk.isEntry)
    .map(({ fileName }) => {
      const attrs = makeHtmlAttributes(attributes.script);
      return `<script src=/${publicPath}${fileName}${attrs}></script>`;
    })
    .join('\n');

  const links = (files.css || [])
    .map(({ fileName }) => {
      const attrs = makeHtmlAttributes(attributes.link);
      return `<link href=/${publicPath}${fileName} rel=stylesheet${attrs}>`;
    })
    .join('\n');

  return `<!doctype html>
  <html${makeHtmlAttributes(attributes.html)}>
  <head>
    <meta charset=utf-8>
    <meta name=viewport content="width=device-width,initial-scale=1">
    <meta name=theme-color content=#11181c>
    <link href=/app.webmanifest rel=manifest>
    <link href=/logo.svg rel=icon>
    <link href=/apple-touch-icon.png rel=apple-touch-icon>
    <title>${title}</title>
    <meta name=color-scheme content=dark>
    <link href=https://fonts.gstatic.com rel=preconnect crossorigin>
    ${links}
    <script src=/trackx.js?${hash} crossorigin></script>
    ${scripts}
  </head>
  <body class=dark>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id=app></div>
  </body>
  </html>`.replace(/\n\s+/g, '\n'); // remove leading whitespace
};

/** @type {import('rollup').RollupOptions[]} */
// @ts-expect-error - TODO: Remove line once rollup types are fixed
export default [
  // Web app
  {
    input: { app: 'src/index.ts' },
    preserveEntrySignatures: false,
    treeshake: 'smallest', // somewhat dangerous!
    external: [
      'https://cdn.jsdelivr.net/npm/xxhash-wasm/esm/xxhash-wasm.js', // dynamic import on test page
      'https://cdn.jsdelivr.net/npm/stats.js/+esm', // dynamic import in Debug component
    ],
    output: {
      assetFileNames: dev ? '[name][extname]' : '[name]-[hash][extname]',
      entryFileNames: dev ? '[name].js' : '[name]-[hash].js',
      chunkFileNames: dev ? '[name].js' : '[name]-[hash].js',
      dir: 'dist',
      format: 'esm',
      name: 'app',
      freeze: false,
      preferConst: true,
      sourcemap: true,
      plugins: [
        !dev
          && purgecss({
            options: {
              // TODO: Why are these not detected by PurgeCSS?
              // @ts-expect-error - PurgeCSS types are wrong
              safelist: ['table', 'table-wrapper', 'bg-zebra'],
            },
            removeInvalidSourceMaps: true,
          }),
      ],
    },
    plugins: [
      replace({
        'process.env.APP_RELEASE': JSON.stringify(release),
        'process.env.ENABLE_DB_TABLE_STATS':
          process.env.ENABLE_DB_TABLE_STATS
          && JSON.parse(process.env.ENABLE_DB_TABLE_STATS),
        'process.env.NODE_ENV': JSON.stringify(mode),
        'process.env.XCSS_GLOBALS': JSON.stringify(
          // eslint-disable-next-line
          getGlobals(require('./xcss.config.js')),
        ),
        preventAssignment: true,
      }),
      commonjs(),
      xcss(),
      nodeResolve({ extensions }),
      css({
        minify: !dev,
      }),
      esbuild({
        target: ['es2018'],
        jsx: 'preserve',
      }),
      babel(babelOpts),
      !dev && terser(terserOpts),
      html({
        title: 'TrackX Dashboard',
        // @ts-expect-error - bad upstream types
        template: htmlTemplate,
      }),
      process.env.BUNDLE_VIZ
        && visualizer({ filename: 'dist/viz.html', brotliSize: true }),
    ],
    watch,
  },

  // Error tracking
  {
    input: 'src/trackx.ts',
    output: {
      file: 'dist/trackx.js',
      format: 'iife',
      sourcemap: true,
      name: 'trackx',
      esModule: false,
    },
    plugins: [
      replace({
        'process.env.APP_RELEASE': JSON.stringify(release),
        'process.env.NODE_ENV': JSON.stringify(mode),
        preventAssignment: true,
      }),
      nodeResolve(),
      esbuild({
        target: ['es2015'],
        minify: !dev,
      }),
      !dev && buble(),
    ],
    watch,
  },
];
