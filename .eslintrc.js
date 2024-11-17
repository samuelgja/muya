module.exports = {
  root: true,
  extends: ['plugin:unicorn/all'],
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
    ecmaFeatures: {
      modules: true,
    },
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    //TS
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/prefer-ts-expect-error': ['off'],
    '@typescript-eslint/ban-ts-comment': ['off'],
    '@typescript-eslint/restrict-template-expressions': ['off'],
    '@typescript-eslint/return-await': ['off'],
    '@typescript-eslint/prefer-nullish-coalescing': ['off'],
    '@typescript-eslint/no-dynamic-delete': ['off'],
    '@typescript-eslint/prefer-optional-chain': ['error'],
    '@typescript-eslint/no-var-requires': ['off'],
    '@typescript-eslint/no-invalid-void-type': ['off'],

    // REACT
    'react/jsx-curly-brace-presence': 'error',
    'react/jsx-no-duplicate-props': 'error',
    'react/jsx-no-useless-fragment': 'error',
    'react/jsx-sort-props': 'error',
    'react/display-name': 'error',
    // REACT_HOOKS
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': [
      'warn',
      {
        additionalHooks: '(useStyle|useAnimatedStyle)',
      },
    ],
    'no-useless-escape': 'off',
    'no-undef': 'off',

    // COMMON
    semi: ['off'],
    'no-console': 'error',
    'react/jsx-no-bind': ['error'],

    // UNICORN
    'unicorn/prefer-module': 'off',
    'unicorn/prefer-node-protocol': 'off',
    'unicorn/no-null': 'off',
    'unicorn/no-keyword-prefix': 'off',
    'unicorn/consistent-destructuring': 'off',
    'unicorn/no-nested-ternary': 'off',
    'unicorn/no-for-loop': 'off',
    'prettier/prettier': 'off',
    'unicorn/prevent-abbreviations': [
      'error',
      {
        allowList: {
          ref: true,
          Ref: true,
          Props: true,
          props: true,
          prevProps: true,
          nextProps: true,
          prop: true,
          params: true,
          isDev: true,
          dev: true,
          e: true,
          prev: true,
          next: true,
          cb: true,
          obj: true,
          NoFn: true,
        },
      },
    ],
  },
}
