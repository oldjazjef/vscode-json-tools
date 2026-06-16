import * as assert from 'assert';
import { parseJsonModel } from '../../src/core/jsonModel';
import {
  buildRootNode,
  describeOutlineNode,
  getChildOutlineNodes,
  hasChildren,
  nodeMatchesFilter,
  outlineNodeKeyRange,
  outlineNodePathString,
  outlineNodeValueRange,
  subtreeMatchesFilter,
} from '../../src/features/treeView/jsonOutlineNode';

function rootNodeFor(text: string) {
  const model = parseJsonModel(text);
  return buildRootNode(model.root!);
}

describe('jsonOutlineNode', () => {
  it('lists object properties as children with correct labels and previews', () => {
    const root = rootNodeFor('{"a": 1, "b": "hi", "c": {"d": true}}');
    const children = getChildOutlineNodes(root);

    assert.deepStrictEqual(
      children.map((c) => describeOutlineNode(c)),
      [
        { label: 'a', description: '1' },
        { label: 'b', description: '"hi"' },
        { label: 'c', description: '{1}' },
      ]
    );
  });

  it('lists array elements as children labeled by index', () => {
    const root = rootNodeFor('{"items": ["a", "b"]}');
    const itemsNode = getChildOutlineNodes(root)[0];
    const children = getChildOutlineNodes(itemsNode);

    assert.deepStrictEqual(
      children.map((c) => describeOutlineNode(c)),
      [
        { label: '[0]', description: '"a"' },
        { label: '[1]', description: '"b"' },
      ]
    );
  });

  it('reports hasChildren correctly for object, array, and leaf nodes', () => {
    const root = rootNodeFor('{"obj": {"x": 1}, "arr": [1], "leaf": 1, "emptyObj": {}}');
    const [objNode, arrNode, leafNode, emptyObjNode] = getChildOutlineNodes(root);

    assert.strictEqual(hasChildren(objNode), true);
    assert.strictEqual(hasChildren(arrNode), true);
    assert.strictEqual(hasChildren(leafNode), false);
    assert.strictEqual(hasChildren(emptyObjNode), false);
  });

  it('surfaces every occurrence of a duplicate key, not just one', () => {
    const root = rootNodeFor('{"a": 1, "a": 2}');
    const children = getChildOutlineNodes(root);

    assert.strictEqual(children.length, 2);
    assert.deepStrictEqual(children.map((c) => describeOutlineNode(c).description), ['1', '2']);
  });

  it('builds the correct path string through nested objects and arrays', () => {
    const root = rootNodeFor('{"path1": {"path2": [10, 20]}}');
    const path1 = getChildOutlineNodes(root)[0];
    const path2 = getChildOutlineNodes(path1)[0];
    const item1 = getChildOutlineNodes(path2)[1];

    assert.strictEqual(outlineNodePathString(item1), 'path1.path2[1]');
  });

  it('exposes a key range for object properties and none for array elements', () => {
    const root = rootNodeFor('{"a": [1]}');
    const aNode = getChildOutlineNodes(root)[0];
    const arrItem = getChildOutlineNodes(aNode)[0];

    assert.ok(outlineNodeKeyRange(aNode));
    assert.strictEqual(outlineNodeKeyRange(arrItem), undefined);
    assert.ok(outlineNodeValueRange(arrItem));
  });

  describe('filtering', () => {
    it('matches a node whose label contains the filter text (case-insensitive)', () => {
      const root = rootNodeFor('{"PathThree": 1}');
      const node = getChildOutlineNodes(root)[0];
      assert.strictEqual(nodeMatchesFilter(node, 'paththree'), true);
      assert.strictEqual(nodeMatchesFilter(node, 'nomatch'), false);
    });

    it('matches a node whose value preview contains the filter text', () => {
      const root = rootNodeFor('{"a": "hello world"}');
      const node = getChildOutlineNodes(root)[0];
      assert.strictEqual(nodeMatchesFilter(node, 'world'), true);
    });

    it('matches a node by its full dotted path, even when no single label contains it', () => {
      const root = rootNodeFor('{"engines": {"vscode": "^1.96.0", "node": ">=22"}}');
      const engines = getChildOutlineNodes(root)[0];
      const [vscode, node] = getChildOutlineNodes(engines);

      assert.strictEqual(nodeMatchesFilter(vscode, 'engines.vscode'), true);
      assert.strictEqual(nodeMatchesFilter(node, 'engines.vscode'), false);
      // A bare leaf-name filter still matches via the existing label check.
      assert.strictEqual(nodeMatchesFilter(vscode, 'vscode'), true);
    });

    it('matches a node by a partial substring of its full dotted path', () => {
      const root = rootNodeFor('{"engines": {"vscode": "^1.96.0"}}');
      const engines = getChildOutlineNodes(root)[0];
      const [vscodeNode] = getChildOutlineNodes(engines);

      assert.strictEqual(nodeMatchesFilter(vscodeNode, 'ngines.vsc'), true);
    });

    it('keeps an ancestor visible via subtreeMatchesFilter when a dotted-path filter targets a descendant', () => {
      const root = rootNodeFor('{"engines": {"vscode": "^1.96.0"}, "other": 1}');
      const [engines, other] = getChildOutlineNodes(root);

      assert.strictEqual(subtreeMatchesFilter(engines, 'engines.vscode'), true);
      assert.strictEqual(subtreeMatchesFilter(other, 'engines.vscode'), false);
    });

    it('keeps a non-matching ancestor when a descendant matches', () => {
      const root = rootNodeFor('{"outer": {"inner": "needle"}}');
      const outer = getChildOutlineNodes(root)[0];
      assert.strictEqual(nodeMatchesFilter(outer, 'needle'), false);
      assert.strictEqual(subtreeMatchesFilter(outer, 'needle'), true);
    });

    it('excludes a subtree with no matching node at any depth', () => {
      const root = rootNodeFor('{"outer": {"inner": "hay"}}');
      const outer = getChildOutlineNodes(root)[0];
      assert.strictEqual(subtreeMatchesFilter(outer, 'needle'), false);
    });
  });
});
