const OFF = 0;
const ERROR = 2;

// /** @type {import('eslint/lib/shared/types').ConfigData} */
module.exports = {
  rules: {
    // TODO: Rename database columns or keep this
    // same as eslint-config-airbnb-typescript default but with var snake_case
    // https://github.com/iamturns/eslint-config-airbnb-typescript/blob/e9910fca83641377656106e17c15bf7735442627/lib/shared.js#L36-L54
    '@typescript-eslint/naming-convention': [
      ERROR,
      {
        selector: 'variable',
        format: [
          'camelCase',
          'PascalCase',
          'UPPER_CASE',
          // database column names
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
    'no-restricted-syntax': OFF,
    'unicorn/no-process-exit': OFF,
  },
};
