import buble from '@rollup/plugin-buble';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';

const dev = !!process.env.ROLLUP_WATCH;

/** @type {import('rollup').RollupOptions[]} */
// @ts-expect-error - TODO: Remove once rollup fixes types
export default [
  {
    input: 'src/default.ts',
    output: [
      {
        file: 'default.js',
        format: 'iife',
        sourcemap: true,
        name: 'trackx',
        esModule: false,
      },
      {
        file: 'default.mjs',
        format: 'es',
        sourcemap: true,
      },
    ],
    external: ['trackx/types'],
    plugins: [
      replace({
        'process.env.TRACKX_VERSION': JSON.stringify(pkg.version),
        preventAssignment: true,
      }),
      commonjs(),
      resolve(),
      esbuild({
        target: 'es2015', // esbuild errors if choosing a target lower than es6
      }),
      !dev
        && terser({
          compress: {
            comparisons: false,
          },
        }),
      buble(),
    ],
  },

  {
    input: 'src/compat.ts',
    output: [
      {
        file: 'compat.js',
        format: 'iife',
        sourcemap: true,
        name: 'trackx',
        esModule: false,
      },
      {
        file: 'compat.mjs',
        format: 'es',
        sourcemap: true,
      },
    ],
    external: ['trackx/types'],
    plugins: [
      replace({
        'process.env.TRACKX_VERSION': JSON.stringify(pkg.version),
        preventAssignment: true,
      }),
      commonjs(),
      resolve(),
      esbuild({
        target: 'es2015',
      }),
      !dev
        && terser({
          compress: {
            comparisons: false,
            // passes: 2,
            inline: 2,
          },
          ie8: true,
          safari10: true,
        }),
      buble(),
    ],
  },

  {
    input: 'src/extended/index.ts',
    output: [
      {
        file: 'extended.js',
        format: 'iife',
        sourcemap: true,
        name: 'trackx',
        esModule: false,
      },
      {
        file: 'extended.mjs',
        format: 'es',
        sourcemap: true,
      },
    ],
    external: ['trackx/types'],
    plugins: [
      replace({
        'process.env.TRACKX_VERSION': JSON.stringify(pkg.version),
        preventAssignment: true,
      }),
      commonjs(),
      resolve(),
      esbuild({
        target: 'es2015',
      }),
      !dev
        && terser({
          compress: {
            comparisons: false,
            // passes: 2,
            inline: 2,
          },
          ie8: true,
          safari10: true,
        }),
      buble({
        // transforms: {
        //   dangerousForOf: true,
        // },
      }),
    ],
  },

  {
    input: 'src/lite.ts',
    output: [
      {
        file: 'lite.js',
        format: 'iife',
        sourcemap: true,
        name: 'trackx',
        esModule: false,
      },
      {
        file: 'lite.mjs',
        format: 'es',
        sourcemap: true,
      },
    ],
    external: ['trackx/types'],
    plugins: [
      replace({
        'process.env.TRACKX_VERSION': JSON.stringify(pkg.version),
        preventAssignment: true,
      }),
      esbuild({
        target: 'es2020',
      }),
      !dev
        && terser({
          ecma: 2020,
          compress: {
            comparisons: false,
            // passes: 2,
            // inline: 2,
          },
        }),
    ],
  },

  {
    input: 'src/modern.ts',
    output: [
      {
        file: 'modern.js',
        format: 'iife',
        sourcemap: true,
        name: 'trackx',
        esModule: false,
      },
      {
        file: 'modern.mjs',
        format: 'es',
        sourcemap: true,
      },
    ],
    external: ['trackx/types'],
    plugins: [
      replace({
        'process.env.TRACKX_VERSION': JSON.stringify(pkg.version),
        preventAssignment: true,
      }),
      esbuild({
        target: 'es2020',
      }),
      !dev
        && terser({
          ecma: 2020,
          compress: {
            comparisons: false,
          },
        }),
    ],
  },

  {
    input: 'src/node.ts',
    output: [
      {
        file: 'node.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'node.mjs',
        format: 'es',
        sourcemap: true,
      },
    ],
    external: ['trackx/types'],
    plugins: [
      replace({
        'process.env.TRACKX_VERSION': JSON.stringify(pkg.version),
        preventAssignment: true,
      }),
      commonjs(),
      resolve(),
      esbuild({
        minify: !dev,
        target: 'node8',
      }),
    ],
  },

  !dev && {
    input: './src/default.ts',
    output: [{ file: 'default.d.ts', format: 'es' }],
    external: ['trackx/types'],
    plugins: [dts()],
  },
  !dev && {
    input: './src/compat.ts',
    output: [{ file: 'compat.d.ts', format: 'es' }],
    external: ['trackx/types'],
    plugins: [dts()],
  },
  !dev && {
    input: './src/extended/index.ts',
    output: [{ file: 'extended.d.ts', format: 'es' }],
    external: ['trackx/types'],
    plugins: [dts()],
  },
  !dev && {
    input: './src/lite.ts',
    output: [{ file: 'lite.d.ts', format: 'es' }],
    external: ['trackx/types'],
    plugins: [dts()],
  },
  !dev && {
    input: './src/modern.ts',
    output: [{ file: 'modern.d.ts', format: 'es' }],
    external: ['trackx/types'],
    plugins: [dts()],
  },
  !dev && {
    input: './src/node.ts',
    output: [{ file: 'node.d.ts', format: 'es' }],
    external: ['trackx/types'],
    plugins: [dts()],
  },
].filter(Boolean);
