import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nounsanitized from 'eslint-plugin-no-unsanitized';
import globals from 'globals';

const bannedSyntax = [
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: 'Never render HTML from data. Build elements with JSX instead.',
  },
  {
    selector: 'MemberExpression[property.name=/^(innerHTML|outerHTML|srcdoc)$/]',
    message: 'HTML-string sinks are banned (XSS). Use JSX or textContent.',
  },
  {
    selector:
      'CallExpression[callee.property.name=/^(insertAdjacentHTML|write|writeln|createContextualFragment)$/]',
    message: 'HTML-string sinks are banned (XSS).',
  },
  {
    selector: "JSXAttribute[name.name='style']",
    message: 'Use a CSS class instead of inline styles.',
  },
  {
    selector: "JSXAttribute[name.name='target']",
    message:
      'Use <ExternalLink> for links that open a new tab (it adds rel=noopener noreferrer and checks the URL).',
  },
];

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/', 'test-results/', 'playwright-report/', 'public/dict/'] },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.test.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Chinese text is deliberately split into code points with [...str].
      '@typescript-eslint/no-misused-spread': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'no-unsanitized': nounsanitized },
    rules: {
      'no-unsanitized/method': 'error',
      'no-unsanitized/property': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-restricted-syntax': ['error', ...bannedSyntax],
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Use core/safe/prefs.ts (wrapped in try/catch).' },
      ],
    },
  },
  {
    files: ['src/core/ui/ExternalLink.tsx'],
    rules: {
      'no-restricted-syntax': ['error', ...bannedSyntax.filter((r) => !r.selector.includes("'target'"))],
    },
  },
  {
    files: ['src/core/safe/prefs.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    files: ['**/*.{js,mjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['tools/**/*.{js,mjs,ts}', '*.config.{js,ts}', 'tests/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['public/**/*.js', 'tools/sw-template.js', 'tools/sw-kill-switch.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        __VERSION__: 'readonly',
        __PRECACHE__: 'readonly',
      },
      sourceType: 'script',
    },
  },
);
