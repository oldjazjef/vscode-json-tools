import * as assert from 'assert';
import * as vscode from 'vscode';
import { JsonOutlineProvider } from '../../src/features/treeView/jsonOutlineProvider';
import { describeOutlineNode, JsonOutlineNode } from '../../src/features/treeView/jsonOutlineNode';
import { activateExtension, openFixture } from './testUtils';

// Helper to filter out non-JsonOutlineNode items (pinned files, etc.)
function isJsonOutlineNode(item: unknown): item is JsonOutlineNode {
  return typeof item === 'object' && item !== null && 'valueNode' in item && (item as JsonOutlineNode).valueNode !== undefined;
}

suite('JSON outline tree view', () => {
  test('getChildren reflects the active document\'s top-level structure', async () => {
    const editor = await openFixture('simple.json');
    const provider = new JsonOutlineProvider();
    provider.setDocument(editor.document);

    const children = provider.getChildren().filter(isJsonOutlineNode);

    assert.deepStrictEqual(
      children.map((c) => describeOutlineNode(c).label),
      ['path1', 'items']
    );
  });

  test('getChildren descends into nested objects and arrays', async () => {
    const editor = await openFixture('simple.json');
    const provider = new JsonOutlineProvider();
    provider.setDocument(editor.document);

    const [path1] = provider.getChildren().filter(isJsonOutlineNode);
    const [path2] = provider.getChildren(path1 as JsonOutlineNode).filter(isJsonOutlineNode);
    const path3Children = provider.getChildren(path2 as JsonOutlineNode).filter(isJsonOutlineNode);

    assert.deepStrictEqual(
      path3Children.map((c) => describeOutlineNode(c)),
      [{ label: 'path3', description: '42' }]
    );
  });

  test('setFilterText narrows results to matching subtrees', async () => {
    const editor = await openFixture('simple.json');
    const provider = new JsonOutlineProvider();
    provider.setDocument(editor.document);

    provider.setFilterText('path3');
    const filtered = provider.getChildren().filter(isJsonOutlineNode);

    // "items" has no descendant matching "path3", so only "path1" survives.
    assert.deepStrictEqual(filtered.map((c) => describeOutlineNode(c).label), ['path1']);

    provider.setFilterText('');
    const cleared = provider.getChildren().filter(isJsonOutlineNode);
    assert.deepStrictEqual(cleared.map((c) => describeOutlineNode(c).label), ['path1', 'items']);
  });

  test('branches leading to a match auto-expand while filtering, and collapse again once cleared', async () => {
    const editor = await openFixture('simple.json');
    const provider = new JsonOutlineProvider();
    provider.setDocument(editor.document);

    provider.setFilterText('path3');
    const [path1] = provider.getChildren().filter(isJsonOutlineNode);
    assert.strictEqual(provider.getTreeItem(path1).collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
    const [path2] = provider.getChildren(path1 as JsonOutlineNode).filter(isJsonOutlineNode);
    assert.strictEqual(provider.getTreeItem(path2).collapsibleState, vscode.TreeItemCollapsibleState.Expanded);

    provider.setFilterText('');
    const [path1Unfiltered] = provider.getChildren().filter(isJsonOutlineNode);
    assert.strictEqual(
      provider.getTreeItem(path1Unfiltered).collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed
    );
  });

  test('a leaf node always has collapsibleState None, filtered or not', async () => {
    const editor = await openFixture('simple.json');
    const provider = new JsonOutlineProvider();
    provider.setDocument(editor.document);

    provider.setFilterText('path3');
    const level1 = provider.getChildren().filter(isJsonOutlineNode);
    const level2 = provider.getChildren(level1[0] as JsonOutlineNode).filter(isJsonOutlineNode);
    const path3 = provider.getChildren(level2[0] as JsonOutlineNode).filter(isJsonOutlineNode)[0];
    assert.strictEqual(provider.getTreeItem(path3).collapsibleState, vscode.TreeItemCollapsibleState.None);
  });

  test('setFilterText accepts a dotted path, filtering down to that nested property', async () => {
    const editor = await openFixture('simple.json');
    const provider = new JsonOutlineProvider();
    provider.setDocument(editor.document);

    provider.setFilterText('path1.path2');
    const topLevel = provider.getChildren().filter(isJsonOutlineNode);
    assert.deepStrictEqual(topLevel.map((c) => describeOutlineNode(c).label), ['path1']);

    const path1Children = provider.getChildren(topLevel[0] as JsonOutlineNode).filter(isJsonOutlineNode);
    assert.deepStrictEqual(path1Children.map((c) => describeOutlineNode(c).label), ['path2']);
  });

  test('setDocument with a non-JSON document empties the tree', async () => {
    const provider = new JsonOutlineProvider();
    const plainTextDoc = await vscode.workspace.openTextDocument({ content: 'not json', language: 'plaintext' });

    provider.setDocument(plainTextDoc);

    assert.deepStrictEqual(provider.getChildren(), []);
    assert.strictEqual(provider.getActiveDocumentUri(), undefined);
  });

  test('setDocument with undefined empties the tree', async () => {
    const editor = await openFixture('simple.json');
    const provider = new JsonOutlineProvider();
    provider.setDocument(editor.document);
    assert.notStrictEqual(provider.getChildren().filter(isJsonOutlineNode).length, 0);

    provider.setDocument(undefined);

    assert.deepStrictEqual(provider.getChildren(), []);
  });

  test('jsonTools.outline.revealNode command moves the editor selection to the node', async () => {
    const editor = await openFixture('simple.json');
    const provider = new JsonOutlineProvider();
    provider.setDocument(editor.document);
    const [path1] = provider.getChildren().filter(isJsonOutlineNode);
    const [path2] = provider.getChildren(path1 as JsonOutlineNode).filter(isJsonOutlineNode);
    const [path3] = provider.getChildren(path2 as JsonOutlineNode).filter(isJsonOutlineNode);

    // jsonTools.outline.revealNode is registered against the *extension's own*
    // provider instance (wired in activate()), not this locally-constructed one,
    // so point it at the same active document by ensuring this editor is the
    // visible one; the command looks up the editor by the active provider's URI.
    await activateExtension();
    await vscode.commands.executeCommand('jsonTools.refreshOutline');
    await vscode.commands.executeCommand('jsonTools.outline.revealNode', path3);

    assert.strictEqual(editor.document.getText(editor.selection), '"path3"');
  });
});
