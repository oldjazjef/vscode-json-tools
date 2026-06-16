import * as assert from 'assert';
import { searchPathInEditor } from '../../src/features/pathSearch/pathSearchCommand';
import { openFixture } from './testUtils';

suite('Path search command', () => {
  test('reveals the resolved key for a nested path', async () => {
    const editor = await openFixture('simple.json');

    const outcome = searchPathInEditor(editor, 'path1.path2.path3');

    assert.strictEqual(outcome.kind, 'resolved');
    assert.strictEqual(editor.document.getText(editor.selection), '"path3"');
  });

  test('reveals an array element by bracket index', async () => {
    const editor = await openFixture('simple.json');

    const outcome = searchPathInEditor(editor, 'items[1]');

    assert.strictEqual(outcome.kind, 'resolved');
    assert.strictEqual(editor.document.getText(editor.selection), '"b"');
  });

  test('reports notFound for a missing path without throwing', async () => {
    const editor = await openFixture('simple.json');

    const outcome = searchPathInEditor(editor, 'path1.missing');

    assert.strictEqual(outcome.kind, 'notFound');
  });

  test('reports invalidQuery for malformed input', async () => {
    const editor = await openFixture('simple.json');

    const outcome = searchPathInEditor(editor, 'a..b');

    assert.strictEqual(outcome.kind, 'invalidQuery');
  });

  test('does not throw and reports notFound for an empty document', async () => {
    const editor = await openFixture('empty.json');

    const outcome = searchPathInEditor(editor, 'a.b');

    assert.strictEqual(outcome.kind, 'notFound');
  });
});
