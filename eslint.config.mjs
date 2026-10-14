import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

/**
 * Syntax that release Rhino (KubeJS 7's JavaScript engine, 2101.2.7-build.85) cannot run, and
 * that esbuild cannot lower for it. scripts/lib/rhino-syntax.ts checks the built bundle for the
 * same list; this rule catches it in the editor, at the line you wrote.
 */
const RHINO_UNSUPPORTED = [
  { selector: 'SpreadElement', message: 'Spread (`...x`) does not run on release Rhino.' },
  { selector: 'RestElement', message: 'Rest (`...x`) does not run on release Rhino.' },
  {
    selector: 'AssignmentPattern',
    message: 'Default values in parameters or destructuring do not run on release Rhino.',
  },
  { selector: 'ClassDeclaration, ClassExpression', message: '`class` is reserved in Rhino.' },
  { selector: ':function[async=true]', message: '`async` does not run in Rhino.' },
  { selector: 'Property[computed=true]', message: 'Computed keys do not run on release Rhino.' },
  { selector: 'TSEnumDeclaration', message: 'Use a union of string literals instead of an enum.' },
  {
    selector:
      ':not(:function) > BlockStatement > VariableDeclaration[kind="const"], SwitchCase > VariableDeclaration[kind="const"]',
    message:
      'A `const` inside a block (a loop, an if, a try) breaks on every Rhino build: in a loop it keeps its first value, next to a closure it throws a redeclaration error. Use `let`, or declare it at the top of the function.',
  },
];

export default defineConfig(
  globalIgnores(['build/', 'dist/', '.cache/', 'coverage/']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      eqeqeq: 'error',
    },
  },
  {
    // The game scripts: KubeJS's Rhino, not Node.
    files: ['src/**/*.ts', 'test/rhino/*.ts'],
    ignores: ['src/**/*.d.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...RHINO_UNSUPPORTED],
      // `{ a }` does not run on release Rhino; `--fix` writes `{ a: a }`.
      'object-shorthand': ['error', 'never'],
      // Rhino makes `var` block-scoped and gives every loop closure the last value.
      'no-var': 'error',
      // A `const` inside a block breaks on Rhino, so blocks use `let` even for values that are
      // never reassigned (RHINO_UNSUPPORTED enforces it).
      'prefer-const': 'off',
      'no-loop-func': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'Proxy', message: 'Rhino has no Proxy.' },
        { name: 'Reflect', message: 'Rhino has no Reflect.' },
        { name: 'Promise', message: 'Release Rhino has no Promise.' },
        { name: 'globalThis', message: 'Release Rhino has no globalThis.' },
      ],
    },
  },
  {
    files: ['eslint.config.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // Plain JavaScript that runs on Rhino in the Rhino check: the stub and the scenario.
    files: ['test/rhino/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { sourceType: 'script' },
    rules: {
      'no-var': 'off',
      'no-redeclare': 'off',
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'prefer-rest-params': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/prefer-for-of': 'off',
      'no-restricted-syntax': ['error', ...RHINO_UNSUPPORTED],
      'object-shorthand': ['error', 'never'],
    },
  },
);
