import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { parsePathQuery } from '../../src/core/pathQuery';
import { scanWorkspaceForPathReferences } from '../../src/features/referenceFinder/referenceScannerService';
import { fixtureUri } from './testUtils';

suite('Reference finder', () => {
  test('finds full-chain and accessor-call matches across source files', async () => {
    const matches = await scanWorkspaceForPathReferences(parsePathQuery('path1.path2.path3'));

    const relativePaths = matches.map((m) => vscode.workspace.asRelativePath(m.uri, false));
    assert.ok(relativePaths.some((p) => p.endsWith('refs/src/a.ts') || p.endsWith('refs\\src\\a.ts')));
    assert.ok(relativePaths.some((p) => p.endsWith('refs/src/b.js') || p.endsWith('refs\\src\\b.js')));
    assert.ok(matches.some((m) => m.kind === 'full-chain'));
    assert.ok(matches.some((m) => m.kind === 'accessor-call'));
  });

  test('respects files.exclude/search.exclude: a planted match in an excluded folder is not returned', async () => {
    const matches = await scanWorkspaceForPathReferences(parsePathQuery('path1.path2.path3'));

    const excludedUriString = fixtureUri('refs', 'excluded', 'd.ts').toString();
    assert.ok(
      matches.every((m) => m.uri.toString() !== excludedUriString),
      'expected no match from the .gitignore-excluded refs/excluded/d.ts'
    );
  });

  test('does not crash scanning a JSONC fixture file among source files', async () => {
    // simple.json/with-comments.jsonc live alongside refs/ in the same fixtures
    // workspace; the include glob doesn't target *.json, but this asserts the
    // scan as a whole still completes cleanly with mixed content present.
    await assert.doesNotReject(scanWorkspaceForPathReferences(parsePathQuery('path1.path2.path3')));
  });

  test('returns no matches for a path that appears nowhere', async () => {
    const matches = await scanWorkspaceForPathReferences(parsePathQuery('totally.unused.path'));
    assert.deepStrictEqual(matches, []);
  });

  test('perf smoke: scanning ~120 generated non-matching files completes within a generous budget', async function () {
    this.timeout(20000);
    const perfFolder = fixtureUri('refs', 'perf');
    await vscode.workspace.fs.createDirectory(perfFolder);

    const fileCount = 120;
    for (let i = 0; i < fileCount; i++) {
      const content = Buffer.from(`export const value${i} = other.unrelated.chain${i};\n`, 'utf8');
      await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(perfFolder, `file${i}.ts`), content);
    }

    try {
      const start = Date.now();
      const matches = await scanWorkspaceForPathReferences(parsePathQuery('path1.path2.path3'));
      const elapsedMs = Date.now() - start;

      console.log(`perf smoke: scanned workspace (incl. ${fileCount} generated files) in ${elapsedMs}ms`);
      assert.ok(elapsedMs < 10000, `expected scan to complete well under 10s, took ${elapsedMs}ms`);
      assert.ok(matches.every((m) => !m.uri.fsPath.includes(`refs${path.sep}perf`)));
    } finally {
      await vscode.workspace.fs.delete(perfFolder, { recursive: true, useTrash: false });
    }
  });
});
