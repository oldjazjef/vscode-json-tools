import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/integration/**/*.test.js',
  workspaceFolder: 'test/integration/fixtures',
  mocha: {
    timeout: 20000,
  },
});
