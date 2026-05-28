// CSpell:ignore tsparser
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import pluginImportConfig from 'eslint-plugin-import'
import { configs as pluginPerfectionistConfigs } from 'eslint-plugin-perfectionist'
import pluginPrettierConfig from 'eslint-plugin-prettier/recommended'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    '**/.github/**',
    '**/.husky/**',
    '**/.omo/**',
    '**/.opencode/**',
    '**/.vscode/**',
    '**/dist/**',
    '**/node_modules/**',
  ]),
  {
    name: 'eslint config prettier',
    ...pluginPrettierConfig,
  },
  {
    name: 'perfectionist',
    ...pluginPerfectionistConfigs['recommended-natural'],
    rules: {
      ...pluginPerfectionistConfigs['recommended-natural']['rules'],
      'perfectionist/sort-imports': [
        'error',
        {
          customGroups: [
            {
              elementNamePattern: '^@\/.*',
              groupName: 'internal',
              selector: 'type',
            },
            {
              elementNamePattern: '^@\/.*',
              groupName: 'internal',
            },
          ],
          environment: 'node',
          groups: [
            ['side-effect-style', 'side-effect'],
            ['builtin', 'type-builtin', 'external', 'type-external'],
            ['internal'],
            ['parent', 'type-parent', 'sibling', 'type-sibling', 'index', 'type-index'],
            'style',
            'unknown',
          ],
          ignoreCase: true,
          newlinesBetween: 1,
          order: 'asc',
          type: 'natural',
        },
      ],
      'perfectionist/sort-named-imports': [
        'error',
        {
          fallbackSort: { order: 'asc', type: 'alphabetical' },
          ignoreAlias: false,
          ignoreCase: false,
          order: 'asc',
          type: 'natural',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        projectService: true,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'separate-type-imports',
          prefer: 'type-imports',
        },
      ],
      '@typescript-eslint/no-empty-object-type': [
        'error',
        {
          allowObjectTypes: 'always',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksConditionals: true,
          checksVoidReturn: false,
        },
      ],
      '@typescript-eslint/no-unsafe-function-type': ['error'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'none',
          argsIgnorePattern: '^_',
          vars: 'local',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-wrapper-object-types': ['error'],
      '@typescript-eslint/nt-overload-signatures': 'off',
      '@typescript-eslint/sort-type-constituents': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    name: 'general',
    rules: {
      'arrow-body-style': ['error', 'as-needed'],
      'comma-dangle': ['error', 'always-multiline'],
      'linebreak-style': ['error', 'unix'],
      'max-len': [
        'error',
        {
          code: 120,
          ignoreComments: true,
          ignorePattern: '^import',
          ignoreRegExpLiterals: true,
          ignoreTemplateLiterals: true,
          ignoreTrailingComments: true,
          ignoreUrls: true,
        },
      ],
      'no-alert': 'error',
      'no-debugger': 'error',
      'no-unused-vars': 'off',
      'object-shorthand': 'error',
      quotes: [
        'error',
        'single',
        {
          avoidEscape: true,
        },
      ],
      semi: ['error', 'never'],
      'sort-imports': 'off',
      'sort-keys': 'off',
    },
  },
  {
    name: 'sort and import',
    ...pluginImportConfig.flatConfigs.recommended,
    rules: {
      ...pluginImportConfig.flatConfigs.recommended.rules,
      'import/no-duplicates': 'error',
      'import/no-unresolved': 'error',
      'import/order': 'off',
    },
    settings: {
      ...pluginImportConfig.flatConfigs.recommended.settings,
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: ['tsconfig.json'],
        },
      },
    },
  },
])
