// Build script for the extension bundle.
// Usage: node esbuild.js [--watch] [--production]
const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');

/** @type {import('esbuild').Plugin} */
const problemMatcherPlugin = {
  name: 'problem-matcher',
  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd((result) => {
      for (const error of result.errors) {
        console.error(
          `> ${error.location?.file ?? ''}:${error.location?.line ?? 0}:${error.location?.column ?? 0}: error: ${error.text}`
        );
      }
      console.log('[watch] build finished');
    });
  },
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node22',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    // jsonc-parser's default (CJS/"main") build is a UMD wrapper with a
    // runtime `require('./impl/format')` that esbuild can't statically
    // resolve once everything is flattened into one file. Its "module"
    // (ESM) build uses static imports instead, which bundles cleanly.
    mainFields: ['module', 'main'],
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    logLevel: 'silent',
    plugins: [problemMatcherPlugin],
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
