const OFF = 0;
const WARN = 1;
const ERROR = 2;

module.exports = {
  root: true,
  reportUnusedDisableDirectives: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.lint.json'],
    tsconfigRootDir: __dirname,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'airbnb-base',
    'airbnb-typescript/base',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:unicorn/recommended',
    'plugin:security/recommended',
  ],
  settings: {
    'import/resolver': {
      node: {
        // add .tsx to airbnb-typescript/base
        extensions: ['.js', '.jsx', '.json', '.ts', '.tsx', '.d.ts'],
      },
    },
  },
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': ERROR,
    'import/no-relative-packages': OFF,
    'import/prefer-default-export': OFF,
    'no-void': OFF,
    'unicorn/filename-case': OFF,
    'unicorn/no-abusive-eslint-disable': WARN,
    'unicorn/no-array-callback-reference': OFF,
    'unicorn/no-null': OFF,
    'unicorn/prefer-add-event-listener': OFF,
    'unicorn/prefer-dom-node-append': OFF,
    'unicorn/prefer-module': OFF,
    'unicorn/prefer-query-selector': OFF,
    'unicorn/prefer-reflect-apply': OFF,
    // not actually faster in v8 - https://jsben.ch/Z5MUv
    'unicorn/prefer-set-has': OFF,
    'unicorn/prefer-top-level-await': WARN,
    'unicorn/prevent-abbreviations': OFF,
    'unicorn/switch-case-braces': [ERROR, 'avoid'],
  },
  overrides: [
    {
      files: ['packages/*/test/**', '*.test.ts', '*.test.tsx'],
      extends: ['plugin:jest/recommended', 'plugin:jest/style'],
      rules: {
        '@typescript-eslint/unbound-method': OFF, // replaced by jest/unbound-method
        'import/no-extraneous-dependencies': OFF,
        'jest/unbound-method': ERROR,
      },
    },
  ],
};
