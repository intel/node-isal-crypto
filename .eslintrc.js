module.exports = {
  env: {
    commonjs: true,
    es6: true,
    node: true,
  },
  extends: 'airbnb-base',
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  settings: {
    'import/core-modules': ['worker_threads']
  },
  rules: {
    'arrow-parens': ['error', 'always'],
    'comma-dangle': ['error', 'only-multiline'],
    'global-require': 'off',
    'import/no-extraneous-dependencies': [
      'error', {
        'devDependencies': [
          'benchmark/**/*.js',
          'test/**/*.js'
        ]
      }
    ],
    'no-console': 'off',
    'no-inner-declarations': 'off',
    'no-param-reassign': 'off',
    'no-underscore-dangle': 'off',
    'prefer-destructuring': [
      'error',
      {
        'array': false,
        'object': true
      }
    ],
    'prefer-template': 'off'
  },
};
