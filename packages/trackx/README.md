[![NPM version](https://img.shields.io/npm/v/trackx.svg)](https://www.npmjs.com/package/trackx)
[![NPM bundle size (minified + gzip)](https://img.shields.io/bundlephobia/minzip/trackx.svg)](https://bundlephobia.com/result?p=trackx)
[![Licence](https://img.shields.io/github/license/MaxMilton/trackx.svg)](https://github.com/MaxMilton/trackx/blob/master/LICENSE)

# TrackX Client

> ![Status](https://img.shields.io/badge/status-alpha-red) Warning: This is alpha software. Test thoroughly before using in production! Please report any bugs you find! Before version `1.0.0` there may be backwards incompatible changes.

Simple JavaScript exception tracking.

TODO: Explain why build output is to the package root instead of a `dist/` dir -- cleaner CDN URLs and possibly less confusing for non-developer users

TODO: Write docs:

- Go over the 5 client variants; `default`, `lite`, `extended`, `compat`, and `node`
  - Write up a whole page/section of documentation about the `compat` client and support for extreme/edge scenarios
    - Would be fun to experiment with obscure browsers and non-browser JS environments
    - We still need data around what info will be sent in headers etc. to make sure we support ingesting those events e.g., user-agent, origin
  - Show a table with the features of each client and maybe event other project/services features
    - Include client file size -- e.g., `extended` client aims to have the same base requirements as `default` but is larger in size due to generating better stack traces in certain scenarios
- CDN or local self-hosted
  - Include `crossorigin` on `<script>` -- ref: https://developer.mozilla.org/en-US/docs/Web/API/GlobalEventHandlers/onerror#notes
  - `setup` function
    - OnErrorHandler must not generate an error or use console.error otherwise you'll get into an infinite loop
- For local:
  - best to put in a separate script and load it as the first script in the document so it can track load errors
  - for best browser coverage use es3 or transpile down to es3
    - suggest `buble` (since that's what we use)
    - only minify whitespace
  - recommend exposing `sendEvent` for use in your app if error tracking is a separate script
  - Node client will use `source-map-support` if it's available so recommend installing it on node apps which are built with generated source maps
- Adding extra data to events with `meta` object
- Custom tracking with `sendEvent` + add notes for
  - Always pass in an instance of `Error` for its stack trace data
  - Use of `extraMeta` arg when you need more contextual information
- Tips on how to get the best results:
  - Always throw an instance of Error (it can be a custom error that extends from Error; so long as Error is in the prototype chain)
  - Always reject promises with an instance of Error
    - In most cases the client can handle anything being thrown or rejected but you'll get extra contextual info by using Error
  - Calls to `console.error` get picked up by the client and if the _first argument_ is an instance of Error it gets "special treatment"
- How to implement a client-side event sample rate, what the pros and cons are, and when it might actually be of benefit:
  ```js
  trackx.setup(
    'https://api.trackx.app/v1/xxxxxxxxxxx/event',
    // where 0.1 represents a 10% chance the event will be sent
    (payload) => (Math.random() < 0.1 ? payload : null),
  );
  ```
  - This is a good example to explain that the clients are small but have all the critical features + the hooks you need to add extra features as required for specific projects
- Integration with common JS frameworks: React, Vue, Express
- App integration tips:
  - Use a custom Error class + populate event meta data using `trackx.setup()` `onError` handler
  - Automatic global error capture vs `trackx.sendEvent()`
  - Custom loggers
- Support for deno, cloudflare workers, and other "exotic" but increasingly common tools/platforms
- Users should opt to use the modern client if they don't need old browser support. Other than the small size reduction, the killer feature is fetch keepalive; event requests will still be sent even if the page is closed (otherwise errors on page unload are not captured because their requests are cancelled!).

## Features

TODO: Note which feature applies to which client variant

<!-- prettier-ignore -->
| | |
| --- | --- |
| Tracks JS exceptions | Unhandled errors, unhandled promise rejections, calls to `console.error`. Also supports programmatic use via `trackx.sendEvent` method. |
| High compatibility   | Emphasis on browser and Node.js compatibility. See [browser requirements](#Browser%20requirements). |
| High performance | Low impact, virtually no overhead; no wrapped built-in functions other than `console.error` or trying to extract more data than what an error provides. |
| Lightweight | Around 1 KB compressed. |
| Automatic retry | Retries failed send event. Multiple retries with increasingly larger time between retry (exponential backoff). |
| Offline support | Waits for the browser to come back online before send reports. |
| Privacy conscious | No cookies or persistent local data. Only sends the captured error, the time and place it occurred, and the client version. A lock timestamp may be saved in `localStorage` for flood protection. Sessions are tracked on the server in a privacy friendly way. Read more about [privacy and data security](https://docs.trackx.app/#/privacy-and-user-data.md). |

### Browser requirements

The browser `trackx` client is specifically designed to be as small as possible while still maintaining wide browser engine compatibility. The client script should not crash the browser process so long as you meet the minimum requirements.

> Note: In archaic or obscure environments which don't support `Error.prototype.stack`, or have buggy support, the amount of information in event reports may be limited.

> Note: In an effort to keep the the script small, the default client makes little attempt to workaround known cross-browser issues when attempting to get a stack trace. For better stack traces in old or non-mainstream browsers use the experimental "extended" client; `import * as trackx from 'trackx/extended'`.

> Note: If you only need to support up-to-date modern browsers, you can use the lite client which provides essential features with the smallest possible output code size; `import * as trackx from 'trackx/lite'`.

With the default client, the absolute minimum your browser environment needs to support is:

- ES3 compliant JavaScript engine
- XHR (`XMLHttpRequest`)
- `JSON.stringify` (only need first argument)
- Global `console` object with a `console.error` method
- Global `localStorage` object
- Global `Image` object (only when using the ping feature)

<!-- TODO: Add link to docs or rewrite -->

> Note: To run the client in _very_ old browsers, non-browser and non-node.js environments, etc., for the best possible compatibility try the `trackx/compat` client.

### Node.js requirements

Node.js version 8 or above.

Import or require `'trackx/node'`:

```js
import * as trackx from 'trackx/node';
```

or

```js
const trackx = require('trackx/node');
```

## Installation & usage

### CDN

Your TrackX project page will contain an easy to copy code snippet that looks similar to the following code. It should be placed in your document head before any other scripts (so we can capture their errors).

<!-- prettier-ignore -->
```html
<script src="https://cdn.jsdelivr.net/npm/trackx@0/default.js" crossorigin></script>
<script>
  window.trackx && trackx.setup('https://api.trackx.app/v1/xxxxxxxxxxx/event');
</script>
```

### NPM or Yarn

```sh
npm i trackx
```

or

```sh
yarn add trackx
```

TODO: Explain why keep this minimal and include as separate script in head

```ts
import * as trackx from 'trackx';

trackx.setup('https://api.trackx.app/v1/xxxxxxxxxxx/event');
trackx.meta.version = process.env.npm_package_version;

export const { sendEvent } = trackx;
```

## Additional considerations

### Content Security Policy

If you're using the [Content-Security-Policy header](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP), you'll also need to add `https://api.trackx.app` to the `connect-src` directive.

Example:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; connect-src 'self' https://api.trackx.app"
/>
```

## Licence

`TrackX` is an MIT licensed open source project. See [LICENCE](https://github.com/MaxMilton/trackx/blob/master/LICENCE).

---

© 2022 [Max Milton](https://maxmilton.com)
