const OFF = 0;
const WARN = 1;
const ERROR = 2;

// /** @type {import('eslint/lib/shared/types').ConfigData} */
module.exports = {
  rules: {
    // TODO: Work through lint issues and remove these rules (=> errors by default)
    '@typescript-eslint/no-unsafe-argument': WARN,
    '@typescript-eslint/no-unsafe-assignment': WARN,
    '@typescript-eslint/no-unsafe-call': WARN,
    '@typescript-eslint/no-unsafe-member-access': WARN,
    '@typescript-eslint/restrict-template-expressions': WARN,

    // Same as eslint-config-airbnb-typescript default but plus variable>snake_case
    // https://github.com/iamturns/eslint-config-airbnb-typescript/blob/e9910fca83641377656106e17c15bf7735442627/lib/shared.js#L36-L54
    '@typescript-eslint/naming-convention': [
      ERROR,
      {
        selector: 'variable',
        format: [
          'camelCase',
          'PascalCase',
          'UPPER_CASE',
          // Database column names
          'snake_case',
        ],
      },
      {
        selector: 'function',
        format: ['camelCase', 'PascalCase'],
      },
      {
        selector: 'typeLike',
        format: ['PascalCase'],
      },
    ],
    'no-plusplus': OFF,
    'no-restricted-syntax': OFF,
    // Nested `if` are used in input validation for code readability and
    // consistency but get transpiled to a more optimal form in the build
    'unicorn/no-lonely-if': OFF,
  },
};
