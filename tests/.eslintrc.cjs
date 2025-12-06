module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    // Tests are often full of placeholders, mocks and unused helpers
    'no-unused-vars': 'off',
    'import/no-named-as-default-member': 'off',
    'import/no-named-as-default': 'off'
  }
};
