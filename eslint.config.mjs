import reactHooks from 'eslint-plugin-react-hooks'
import { fixupPluginRules } from '@eslint/compat'
import * as depend from 'eslint-plugin-depend'
import tsParser from '@typescript-eslint/parser'
import path from 'node:path'
import reactPerfPlugin from 'eslint-plugin-react-perf'
import baseConfig from './eslint.config.base.mjs'
import jsdoc from 'eslint-plugin-jsdoc'

const tsConfigPath = path.resolve('./', 'tsconfig.json')
const eslintBase = baseConfig
/** @type {import('eslint').Linter.Config} */
const config = [
  ...eslintBase,
  depend.configs['flat/recommended'],
  {
    ignores: ['**/*.js', '**/api-definitions.ts', '**/.expo/**/*.ts*', '**/dist/**', '**/.storybook/**', 'lib/**/*'],
    files: ['packages/core/*.{ts,tsx}'],
  },
  jsdoc.configs['flat/recommended-typescript'],
  reactPerfPlugin.configs.flat.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { modules: false },
        ecmaVersion: 'latest',
        project: tsConfigPath,
      },
    },
    plugins: {
      'react-hooks': fixupPluginRules(reactHooks),
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error', // Checks rules of Hooks

      'react-hooks/exhaustive-deps': [
        'error',
        {
          additionalHooks: '(useAnimatedStyle|useDerivedValue|useAnimatedProps|useStyle)',
        },
      ],

      'jsdoc/require-description': 'error',
      'jsdoc/check-tag-names': [
        'error',
        {
          definedTags: [
            'group',
            'category',
            'remarks',
            'example',
            'experimental',
            // add other TypeDoc-specific tags you use
          ],
        },
      ],
    },
    settings: {
      react: {
        version: 'detect', // Can also specify a specific version e.g. "17.0"
      },
    },
  },
]

export default config
