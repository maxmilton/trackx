// https://jestjs.io/docs/configuration#resolver-string
/** @type {import('jest-resolve').SyncResolver} */
const resolver = (path, options) => options.defaultResolver(path, {
  ...options,
  packageFilter(pkg) {
    return typeof pkg.name === 'string' && pkg.name.startsWith('solid-js')
      ? {
        ...pkg,
        main:
              pkg.browser != null && typeof pkg.browser === 'object'
                ? Object.values(pkg.browser)[0]
                : (typeof pkg.browser === 'string'
                  ? pkg.browser
                  : pkg.main),
      }
      : pkg;
  },
});

module.exports = resolver;
