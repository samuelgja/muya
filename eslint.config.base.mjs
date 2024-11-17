import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import stylisticJsx from '@stylistic/eslint-plugin-jsx'
import stylisticTs from '@stylistic/eslint-plugin-ts'
import unicorn from 'eslint-plugin-unicorn'
// import prettier from 'eslint-plugin-prettier'
// import prettierRecommended from 'eslint-plugin-prettier/recommended'
import jest from 'eslint-plugin-jest'
import stylistic from '@stylistic/eslint-plugin'
import sonarjs from 'eslint-plugin-sonarjs'
import * as depend from 'eslint-plugin-depend'

import path from 'node:path'

const tsConfigPath = path.resolve("./", 'tsconfig.json')

 /** @type {import('eslint').Linter.Config} */
 const config =  [
  depend.configs['flat/recommended'],
  {
    ignores: ['**/*.js', '**/api-definitions.ts', '**/.expo/**/*.ts*', "**/dist/**", "**/.storybook/**", "lib/**/*"],
    files: ['src/**/*.{ts,tsx}'],
  },
  js.configs.recommended,
  // prettierRecommended,
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  unicorn.configs['flat/recommended'],
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { modules: false },
        ecmaVersion: 'latest',
        project: tsConfigPath,
      },
    },
    plugins: {
      // prettier,
      jest,
      ts: tseslint,
      '@stylistic': stylistic,
      '@stylistic/ts': stylisticTs,
      '@stylistic/jsx': stylisticJsx,
    },
    rules: {
      'sonarjs/new-cap': 'off',
      'sonarjs/deprecation': 'warn',
      'sonarjs/function-return-type': 'off',
      'sonarjs/no-empty-test-file': 'off',
      'sonarjs/cognitive-complexity': 'error',
      'sonarjs/prefer-immediate-return': 0,
      'sonarjs/no-duplicate-string': 0,
      'sonarjs/no-nested-template-literals': 0,
      'sonarjs/no-redundant-jump': 0,
      'sonarjs/no-small-switch': 0,
      'sonarjs/todo-tag': 0,
      'sonarjs/no-misused-promises': 0,

      'prefer-destructuring': 2,
      camelcase: 2,
      'object-shorthand': 2,
      'no-nested-ternary': 1,
      'no-shadow': 'error',
      '@typescript-eslint/no-shadow': 2,
      'no-unused-vars': 0,

      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/indent': 'off',

      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/method-signature-style': ['error'],
      '@typescript-eslint/prefer-ts-expect-error': ['off'],
      '@typescript-eslint/ban-ts-comment': ['error'],
      '@typescript-eslint/restrict-template-expressions': ['off'],
      '@typescript-eslint/return-await': ['off'],
      '@typescript-eslint/prefer-nullish-coalescing': ['off'],
      '@typescript-eslint/no-dynamic-delete': ['off'],
      // '@typescript-eslint/prefer-optional-chain': ['error'], slow
      '@typescript-eslint/ban-types': ['error'],
      '@typescript-eslint/no-var-requires': ['warn'],
      '@typescript-eslint/no-invalid-void-type': ['off'],
      '@typescript-eslint/explicit-function-return-type': ['off'],
      '@typescript-eslint/no-unused-vars': [
        'error', // or "error"
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      'no-console': 'error',
      'no-unneeded-ternary': 'error',

      'unicorn/prefer-module': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-unreadable-iife': 'error',
      'unicorn/no-keyword-prefix': 'off',
      'unicorn/prefer-ternary': ['error', 'only-single-line'],
      'unicorn/prevent-abbreviations': [
        'error',
        {
          replacements: {
            props: false,
            param: false,
            ref: false,
            params: false,
            args: false,
            vars: false,
            env: false,
            class: false,
            ctx: false,
            db: false,
            cb: false,
          },
        },
      ],
    },
  },
];

export default config