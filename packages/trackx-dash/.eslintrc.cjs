const OFF = 0;
const WARN = 1;

// /** @type {import('eslint/lib/shared/types').ConfigData} */
module.exports = {
  extends: ['plugin:jsx-a11y/recommended'],
  rules: {
    // TODO: Work through lint issues and remove these rules (=> errors by default)
    '@typescript-eslint/no-misused-promises': WARN,
    '@typescript-eslint/no-unsafe-assignment': WARN,
    '@typescript-eslint/no-unsafe-call': WARN,
    '@typescript-eslint/no-unsafe-member-access': WARN,
    '@typescript-eslint/restrict-template-expressions': WARN,

    'jsx-a11y/accessible-emoji': OFF,
  },
};
