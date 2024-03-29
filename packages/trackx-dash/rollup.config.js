/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-var-requires */

const { getGlobals } = require('@ekscss/framework/utils');
const purgecss = require('@ekscss/rollup-plugin-purgecss').default;
const css = require('@maxmilton/rollup-plugin-css').default;
const { babel } = require('@rollup/plugin-babel');
const buble = require('@rollup/plugin-buble').default;
const commonjs = require('@rollup/plugin-commonjs').default;
const { default: html, makeHtmlAttributes } = require('@rollup/plugin-html');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const replace = require('@rollup/plugin-replace').default;
const { gitHash, isDirty } = require('git-ref');
const xcss = require('rollup-plugin-ekscss').default;
const esbuild = require('rollup-plugin-esbuild').default;
const { terser } = require('rollup-plugin-terser');
const { visualizer } = require('rollup-plugin-visualizer');
const pkg = require('./package.json');
const xcssConfig = require('./xcss.config.cjs');

const viz = !!process.env.BUNDLE_VIZ;
const mode = process.env.NODE_ENV;
const dev = mode === 'development';
const release = `v${pkg.version}-${gitHash()}${isDirty() ? '-dev' : ''}`;

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

/** @type {string} */
let trackxBundleFilename;

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

  if (!trackxBundleFilename) {
    throw new Error(
      'trackxBundleFilename not set, likely a build race condition!',
    );
  }

  return `
  <!doctype html>
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
    <script src=/${trackxBundleFilename}></script>
    ${scripts}
  </head>
  <body class=dark>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id=app></div>
  </body>
  </html>
  `
    .trim()
    .replace(/\n\s+/g, '\n'); // remove leading whitespace
};

/** @type {()=>Promise< import('rollup').RollupOptions[]>} */
module.exports = async () => [
  // Error tracking
  {
    input: 'src/trackx.ts',
    output: {
      entryFileNames: dev ? '[name].js' : '[name]-[hash].js',
      dir: 'dist',
      format: 'iife',
      sourcemap: true,
      name: 'trackx',
      esModule: false,
    },
    plugins: [
      {
        name: 'extract-bundle-name',
        generateBundle(_options, bundle) {
          [trackxBundleFilename] = Object.keys(bundle);
        },
      },
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
      generatedCode: {
        preset: 'es2015',
        constBindings: true,
      },
      manualChunks: {
        // Ensure app bundle is self-contained
        app: ['./src/index'],
        // Force all non-page content code into a single chunk
        runtime: [
          '@maxmilton/solid-router',
          '@trackx/reltime',
          'solid-js', // includes nested paths like solid-js/web and solid-js/store
          './src/components/ErrorAlert',
          './src/runtime',
        ],
      },
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
        'process.env.ENABLE_DB_TABLE_STATS': JSON.stringify(
          // eslint-disable-next-line unicorn/no-await-expression-member
          (await import('./trackx.config.mjs')).ENABLE_DB_TABLE_STATS,
        ),
        'process.env.NODE_ENV': JSON.stringify(mode),
        'process.env.XCSS_GLOBALS': JSON.stringify(getGlobals(xcssConfig)),
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
      viz && visualizer({ filename: 'dist/viz.html', brotliSize: true }),
    ],
    watch,
  },
];
