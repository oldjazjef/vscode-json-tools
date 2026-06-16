// @ts-check
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // test/integration/fixtures/** are inert sample data for the reference
    // scanner and outline tests, not real source — they're deliberately
    // loose (e.g. `any` casts) and aren't meant to satisfy lint rules.
    ignores: ['dist/**', 'out/**', '.vscode-test/**', 'node_modules/**', 'test/integration/fixtures/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      eqeqeq: ['error', 'always'],
      curly: ['warn', 'multi-line'],
    },
  }
);
