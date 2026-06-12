import js from '@eslint/js';
import globals from 'globals';

export default [
  // 繁體中文註解：套用 ESLint 推薦的 JS 規則
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
        // 繁體中文註解：為測試環境加入 Vitest 全域變數
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },
  {
    ignores: [
      'node_modules/**',
      'dashboard/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**'
    ]
  }
];
