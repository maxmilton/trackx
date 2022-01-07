const OFF = 0;
const WARN = 1;

// /** @type {import('eslint/lib/shared/types').ConfigData} */
module.exports = {
  rules: {
    '@typescript-eslint/restrict-plus-operands': WARN,
    'func-names': OFF,
    'no-console': OFF,
    'no-plusplus': OFF,
    'prefer-destructuring': OFF,
    'prefer-rest-params': OFF,
    'prefer-template': OFF,
    'unicorn/error-message': OFF,
    'unicorn/prefer-number-properties': OFF,
    'unicorn/prefer-optional-catch-binding': OFF,
  },
};
