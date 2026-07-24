module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist/', 'node_modules/'],
  rules: {
    // TypeScript performs the authoritative symbol/flow checks for this strict
    // project. Keep ESLint focused on syntax and high-signal correctness rules.
    'no-undef': 'off',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    // Existing code intentionally uses these constructs. Keep the first lint
    // baseline non-invasive; tighten individual rules in dedicated cleanups.
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-this-alias': 'off',
    'no-case-declarations': 'off',
    'no-constant-condition': 'off',
    'no-control-regex': 'off',
    'prefer-const': 'off',
  },
};
