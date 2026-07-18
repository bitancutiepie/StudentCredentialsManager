export default [
  {
    ignores: ['node_modules/', 'dist/'],
  },
  {
    files: ['js/**/*.js'],
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'warn',
      'no-console': 'off',
      'prefer-const': 'warn',
      'no-var': 'warn',
      'eqeqeq': ['warn', 'always'],
      'curly': 'warn',
    },
  },
];
