[![Build status](https://img.shields.io/github/workflow/status/maxmilton/trackx/ci)](https://github.com/maxmilton/trackx/actions)
[![Coverage status](https://img.shields.io/codeclimate/coverage/maxmilton/trackx)](https://codeclimate.com/github/maxmilton/trackx)
[![Licence](https://img.shields.io/github/license/maxmilton/trackx.svg)](https://github.com/maxmilton/trackx/blob/master/LICENSE)

# TrackX ![](./packages/trackx-dash/static/favicon-32x32.png)

WIP

<!--
> ![Status](https://img.shields.io/badge/status-alpha-red) Warning: This is alpha software. Test thoroughly before using in production! Please report any bugs you find! Before version `1.0.0` there may be backwards incompatible changes.

Simple JavaScript exception tracking with a real-time monitoring dashboard.

**Features:**

- Lightweight but feature rich clients; [![NPM version](https://img.shields.io/npm/v/trackx.svg)](https://www.npmjs.com/package/trackx) default: [![NPM bundle size (minified + gzip)](https://img.shields.io/bundlephobia/minzip/trackx.svg)](https://bundlephobia.com/result?p=trackx)
- Web browser, Node.js, Deno, and non-browser JS environment support
- Error stack trace analysis
- Smart grouping of similar events into issues
- Simple SQLite database backend

## Considerations

- Because of the SQLite backing store, this solution may not be ideal for situations where you expect to be receiving a massive volume of events (e.g. over 1M per day). For massive websites/apps you're likely better off going with a proven solution like Sentry, however, for the other 98% of sites TrackX is a viable choice.
  - XXX: Explain SQLite write concurrency/performance.
- If you need in-depth reporting and broad data capture, use Sentry instead.
- TODO: Write up a comparison between error tracking solutions and when it's most beneficial to use each e.g., Firebase Crashalytics for mobile apps since it's free and actually a great product

## Getting started

<https://docs.trackx.app/#/introduction.md>

<https://docs.trackx.app/#/getting-started/installation.md>

TODO: Write me:

- client CDN script
- client in build
- node client
- running a private instance
  - how auth works and how to create users

## Browser and Node.js support

<https://docs.trackx.app/#/guides/tracking-errors.md#browser-supoprt>

- TODO: Write me after doing browser testing!
- TODO: Test and note Web Worker support (should work as expected already but probably does need to be initialised in each worker or other isolated context)
- Node.js Support
  - `v8.9.0` and above tested, but the node client may work in older versions too
  - Deno support is in the works (use modern client)
-->

## Bugs

Report any bugs you encounter on the [GitHub issue tracker](https://github.com/maxmilton/trackx/issues).

If you have questions or need help, [ask in our community](https://github.com/maxmilton/trackx/discussions).

## Changelog

See [releases on GitHub](https://github.com/maxmilton/trackx/releases).

## License

MIT license. See [LICENSE](https://github.com/maxmilton/trackx/blob/master/LICENSE).

The [alert light icon](https://github.com/twitter/twemoji/blob/master/assets/svg/1f6a8.svg) is from [twitter/twemoji](https://github.com/twitter/twemoji) which is licensed CC-BY 4.0.

---

© 2022 [Max Milton](https://maxmilton.com)
