/* eslint-disable import/no-extraneous-dependencies, no-console */

import esbuild from 'esbuild';
import { gitHash, isDirty } from 'git-ref';
import fs from 'node:fs/promises';
import path from 'node:path';
import { totalist } from 'totalist';
import pkg from './package.json' assert { type: 'json' };

const mode = process.env.NODE_ENV;
const dev = mode === 'development';
const release = `v${pkg.version}-${gitHash()}${isDirty() ? '-dev' : ''}`;

const external = [
  // from @trackx/api
  'better-sqlite3',
  'source-map-support',
  'ua-parser-js', // massive size
  'xxhash-addon',
  // from @trackx/stack-trace-parser
  'source-map',
];

// Generate route manifest
/** @type {Array<{ path: string; module: string; }>} */
const routes = [];
let manifest = '// WARNING: This file is automatically generated; do not edit!\n\n';
let count = 0;

await totalist('src/routes', (relPath) => {
  if (path.basename(relPath)[0] === '_') return;
  // don't include development routes in production builds
  if (!dev && relPath === 'dash/query.ts') return;
  if (!dev && relPath === 'dash/test.ts') return;
  if (process.env.DEMO_MODE && !/^(dash|health)/.test(relPath)) return;

  const mod = `m${++count}`;

  routes.push({
    module: mod,
    // convert file path to trouter pattern -- https://github.com/lukeed/trouter#pattern
    path: relPath
      .replace(/(\/index)?\.ts$/, '')
      .split('/')
      .map((param) => param.replace(/^\[(.+)]$/, ':$1'))
      .join('/'),
  });

  // TODO: Improve sort order so the most hit routes are at the top

  // async totalist may return paths in any order so sort into reverse alphabetical order
  routes.sort((a, b) => b.path.localeCompare(a.path));

  manifest += `import * as ${mod} from './${relPath.replace(/\.ts$/, '')}';\n`;
});

manifest += `
export const routes = [${
  // eslint-disable-next-line unicorn/no-array-reduce
  routes.reduce(
    (out, route) => `${out}\n  { path: '/${route.path}', module: ${route.module} },`,
    '',
  )
}
];
`;

await fs.writeFile(
  path.join(process.cwd(), 'src', 'routes', '__ROUTE_MANIFEST__.ts'),
  manifest,
);

const out = await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/server.js',
  platform: 'node',
  target: ['node18'],
  define: {
    'process.env.APP_RELEASE': JSON.stringify(release),
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
  external,
  bundle: true,
  sourcemap: true,
  minifySyntax: !dev,
  minifyIdentifiers: !dev,
  legalComments: 'none',
  metafile: !dev && process.stdout.isTTY,
  logLevel: 'debug',
});

if (out.metafile) {
  console.log(await esbuild.analyzeMetafile(out.metafile));
}

await esbuild.build({
  entryPoints: ['src/check.ts'],
  outfile: 'dist/check.js',
  platform: 'node',
  target: ['node18'],
  bundle: true,
  minify: !dev,
  logLevel: 'debug',
});

/**
 * @typedef {object} PackageJson
 * @property {string} name
 * @property {string} version
 * @property {Record<string, string>} bin
 * @property {Record<string, string>} dependencies
 */

// Generate production package.json
/** @type {PackageJson} */
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  bin: { trackx: './cli.js' },
  dependencies: {},
};

for (const dep of external) {
  // @ts-expect-error - Unavoidable indexing by string
  prodPkg.dependencies[dep] = pkg.dependencies[dep] || pkg.devDependencies[dep];
}

await fs.writeFile(
  path.join(process.cwd(), 'dist', 'package.json'),
  JSON.stringify(prodPkg, null, 2),
);
