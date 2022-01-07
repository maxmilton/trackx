# `@trackx/stack-trace-parser`

- Originally based on source code from [xpl/stacktracey](https://github.com/xpl/stacktracey) ([unlicense license](https://github.com/xpl/stacktracey/blob/master/LICENSE)) and [xpl/get-source](https://github.com/xpl/get-source) ([MIT licence](https://github.com/xpl/get-source/blob/master/LICENSE)).

**TODO:**

- Rewrite the entire package from scratch -- node only, no local require; fetch all source maps, better performance, better caching strategy, fully typed
  - References:
    - https://github.com/thlorenz/convert-source-map/blob/master/index.js
    - https://github.com/ampproject/error-tracker/blob/main/utils/stacktrace/unminify.js
  - Reject source files which are too big to avoid running out of memory or use some kind of alternative disk based store

## Licence

MIT. See [LICENCE](https://github.com/MaxMilton/trackx/blob/master/LICENCE).

---

© 2021 [Max Milton](https://maxmilton.com)
