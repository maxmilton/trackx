/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable import/no-extraneous-dependencies, no-console, no-param-reassign */

import * as csso from 'csso';
import esbuild from 'esbuild';
import {
  decodeUTF8,
  encodeUTF8,
  minifyTemplates,
  writeFiles,
} from 'esbuild-minify-templates';
import { xcss } from 'esbuild-plugin-ekscss';
import fs from 'fs/promises';
import { gitHash, isDirty } from 'git-ref';
import path from 'path';
import { PurgeCSS } from 'purgecss';
import * as terser from 'terser';
import { fileURLToPath } from 'url';
import * as config from '../trackx-dash/trackx.config.mjs';

// Workaround for no json import in ESM yet
/** @type {import('./package.json')} */
const pkg = JSON.parse(await fs.readFile('./package.json', 'utf8'));

const mode = process.env.NODE_ENV;
const dev = mode === 'development';
const dir = path.dirname(fileURLToPath(import.meta.url)); // no __dirname in node ESM
const hash = gitHash();
const release = `v${pkg.version}-${hash}${isDirty() ? '-dev' : ''}`;

/**
 * @param {esbuild.OutputFile[]} outputFiles
 * @param {string} ext - File extension to match.
 * @returns {{ file: esbuild.OutputFile; index: number; }}
 */
function findOutputFile(outputFiles, ext) {
  const index = outputFiles.findIndex((outputFile) => outputFile.path.endsWith(ext));
  return { file: outputFiles[index], index };
}

/** @type {esbuild.Plugin} */
const analyzeMeta = {
  name: 'analyze-meta',
  setup(build) {
    if (!build.initialOptions.metafile) return;
    build.onEnd((result) => {
      if (result.metafile) {
        esbuild
          .analyzeMetafile(result.metafile)
          .then(console.log)
          .catch(console.error);
      }
    });
  },
};

/**
 * Construct a HTML page.
 *
 * @param {string} jsPath
 * @param {string} cssPath
 */
function makeHTML(jsPath, cssPath) {
  return `<!doctype html>
<html lang=en>
<head>
  <meta charset=utf-8>
  <meta name=viewport content="width=device-width">
  <meta name=theme-color content=#11181c>
  <link href=/app.webmanifest rel=manifest>
  <link href=/logo.svg rel=icon>
  <link href=/apple-touch-icon.png rel=apple-touch-icon>
  <title>Sign in to TrackX</title>
  <meta name=color-scheme content=dark>
  <meta name=referrer content=origin>
  <link href=https://fonts.gstatic.com rel=preconnect crossorigin>
  <link href=/${cssPath} rel=stylesheet>
  <script src=/trackx.js?${hash} crossorigin></script>
  <script src=/${jsPath} defer></script>
</head>
<body class=dark>
  <noscript>You need to enable JavaScript to run this app.</noscript>
  <form id=login class=card>
    <h1 class=mt0>Sign in to TrackX</h1>
    <div id=feedback></div>
    <div class=mb3>
      <label class=label for=email>Email</label>
      <input id=email class="input w100" type=email required autocomplete=email autofocus>
    </div>
    <div class=mb3>
      <label class=label for=password>Password</label>
      <input id=password class="input w100" type=password required minlength=8 maxlength=64 autocomplete=current-password>
    </div>
    <button id=submit class="button button-primary ph4" type=submit>Sign in</button>
    <div>
      Forgot your password? <a href="${config.DOCS_URL}/#/guides/using-the-dash.md#login" rel=noopener>Get help signing in</a>
    </div>
  </form>
  <footer>© <a href=https://maxmilton.com class="normal muted" rel=noopener>Max Milton</a> ・ ${release} ・ <a href=https://github.com/maxmilton/trackx/issues rel=noopener>report bug</a></footer>
<body>
<html>`.replace(/\n\s+/g, '\n'); // remove leading whitespace
}

/** @type {esbuild.Plugin} */
const buildHTML = {
  name: 'build-html',
  setup(build) {
    const distPath = path.join(dir, '../trackx-dash/dist');

    build.onEnd(async (result) => {
      if (result.outputFiles) {
        const outJS = findOutputFile(result.outputFiles, '.js');
        const outCSS = findOutputFile(result.outputFiles, '.css');

        const html = makeHTML(
          path.relative(distPath, outJS.file.path),
          path.relative(distPath, outCSS.file.path),
        );

        result.outputFiles[result.outputFiles.length] = {
          path: path.join(distPath, 'login.html'),
          contents: encodeUTF8(html),
          get text() {
            return decodeUTF8(this.contents);
          },
        };
      } else {
        await fs.writeFile(
          path.join(distPath, 'login.html'),
          makeHTML('login.js', 'login.css'),
          'utf8',
        );
      }
    });
  },
};

/** @type {esbuild.Plugin} */
const minifyCSS = {
  name: 'minify-css',
  setup(build) {
    if (build.initialOptions.write !== false) return;

    build.onEnd(async (result) => {
      if (result.outputFiles) {
        const outHTML = findOutputFile(result.outputFiles, '.html');
        const outJS = findOutputFile(result.outputFiles, '.js');
        const outCSS = findOutputFile(result.outputFiles, '.css');

        const purged = await new PurgeCSS().purge({
          content: [
            { extension: '.html', raw: decodeUTF8(outHTML.file.contents) },
            { extension: '.js', raw: decodeUTF8(outJS.file.contents) },
          ],
          css: [{ raw: decodeUTF8(outCSS.file.contents) }],
          safelist: ['html', 'body'],
        });
        const { css } = csso.minify(purged[0].css);

        result.outputFiles[outCSS.index].contents = encodeUTF8(css);
      }
    });
  },
};

/** @type {esbuild.Plugin} */
const minifyJS = {
  name: 'minify-js',
  setup(build) {
    if (build.initialOptions.write !== false) return;

    build.onEnd(async (result) => {
      if (result.outputFiles) {
        const distPath = path.join(dir, 'dist');
        const outJS = findOutputFile(result.outputFiles, '.js');
        const outMap = findOutputFile(result.outputFiles, '.js.map');

        const { code = '', map = '' } = await terser.minify(
          decodeUTF8(outJS.file.contents),
          {
            parse: {
              ecma: 2020,
            },
            compress: {
              ecma: 2018,
              comparisons: false,
              passes: 2,
              inline: 2,
              negate_iife: false,
            },
            format: {
              ecma: 2018,
              comments: false,
              ascii_only: true,
              wrap_iife: true,
              wrap_func_args: true,
            },
            sourceMap: {
              content: decodeUTF8(outMap.file.contents),
              filename: path.relative(distPath, outJS.file.path),
              url: path.relative(distPath, outMap.file.path),
            },
          },
        );

        result.outputFiles[outJS.index].contents = encodeUTF8(code);
        result.outputFiles[outMap.index].contents = encodeUTF8(map.toString());
      }
    });
  },
};

await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: '../trackx-dash/dist/login.js',
  entryNames: dev ? '[name]' : '[name]-[hash]',
  assetNames: dev ? '[name]' : '[name]-[hash]',
  chunkNames: dev ? '[name]' : '[name]-[hash]',
  platform: 'browser',
  target: ['chrome60', 'edge79', 'firefox55', 'safari11.1'],
  define: {
    'process.env.APP_RELEASE': JSON.stringify(release),
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
  plugins: [
    xcss(),
    minifyTemplates(),
    buildHTML,
    minifyCSS,
    minifyJS,
    writeFiles(),
    analyzeMeta,
  ],
  banner: { js: '"use strict";' },
  bundle: true,
  minify: !dev,
  sourcemap: true,
  watch: !!process.env.BUILD_WATCH,
  write: dev,
  metafile: !dev && process.stdout.isTTY,
  logLevel: 'debug',
});
