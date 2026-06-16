import * as assert from 'assert';
import * as vscode from 'vscode';
import { JsonOutlineProvider } from '../../src/features/treeView/jsonOutlineProvider';
import { describeOutlineNode } from '../../src/features/treeView/jsonOutlineNode';
import { activateExtension, openFixture } from './testUtils';

suite('JSON outline tree view', () => {
  test('getChildren reflects the active document\'s top-level structure', async () => {
    const editor = await openFixture('simple.json');
    const provider = new JsonOutlineProvider();
    provider.setDocument(editor.document);

    const children = provider.getChildren();

    assert.deepStrictEqual(
      children.map((c) => describeOutlineNode(c).label),
      ['path1', 'items']
    );
  });

  test('getChildren descends into nested objects and arrays', async () => {
    const editor = await openFixture('simple.json');
    const provider = new JsonOutlineProvider();
    provider.setDocument(editor.document);

    const [path1] = provider.getChildren();
    const [path2] = provider.getChildren(path1);
    const path3Children = provider.getChildren(path2);

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
    const filtered = provider.getChildren();

    // "items" has no descendant matching "path3", so only "path1" survives.
    assert.deepStrictEqual(filtered.map((c) => describeOutlineNode(c).label), ['path1']);

    provider.setFilterText('');
    const cleared = provider.getChildren();
    assert.deepStrictEqual(cleared.map((c) => describeOutlineNode(c).label), ['path1', 'items']);
  });

  test('branches leading to a match auto-expand while filtering, and collapse again once cleared', async () => {
    const editor = await openFixture('simple.json');
    const provider = new JsonOutlineProvider();
    provider.setDocument(editor.document);

    provider.setFilterText('path3');
    const [path1] = provider.getChildren();
    assert.strictEqual(provider.getTreeItem(path1).collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
    const [path2] = provider.getChildren(path1);
    assert.strictEqual(provider.getTreeItem(path2).collapsibleState, vscode.TreeItemCollapsibleState.Expanded);

    provider.setFilterText('');
    const [path1Unfiltered] = provider.getChildren();
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
    const path3 = provider.getChildren(provider.getChildren(provider.getChildren()[0])[0])[0];
    assert.strictEqual(provider.getTreeItem(path3).collapsibleState, vscode.TreeItemCollapsibleState.None);
  });

  test('setFilterText accepts a dotted path, filtering down to that nested property', async () => {
    const editor = await openFixture('simple.json');
    const provider = new JsonOutlineProvider();
    provider.setDocument(editor.document);

    provider.setFilterText('path1.path2');
    const topLevel = provider.getChildren();
    assert.deepStrictEqual(topLevel.map((c) => describeOutlineNode(c).label), ['path1']);

    const path1Children = provider.getChildren(topLevel[0]);
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
    assert.notStrictEqual(provider.getChildren().length, 0);

    provider.setDocument(undefined);

    assert.deepStrictEqual(provider.getChildren(), []);
  });

  test('jsonTools.outline.revealNode command moves the editor selection to the node', async () => {
    const editor = await openFixture('simple.json');
    const provider = new JsonOutlineProvider();
    provider.setDocument(editor.document);
    const [path1] = provider.getChildren();
    const [path2] = provider.getChildren(path1);
    const [path3] = provider.getChildren(path2);

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
