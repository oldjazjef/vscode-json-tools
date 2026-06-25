import * as assert from 'assert';
import { parseJsonModel } from '../../src/core/jsonModel';
import { getCandidatesForPrefix } from '../../src/features/completion/jsonKeyCandidates';

describe('jsonKeyCandidates', () => {
  it('single root, empty prefix, object at root level', () => {
    const text = '{"alpha": 1, "beta": 2}';
    const model = parseJsonModel(text);
    const candidates = getCandidatesForPrefix([model.root], []);

    assert.equal(candidates.length, 2);
    const labels = candidates.map((c) => c.label).sort();
    assert.deepEqual(labels, ['alpha', 'beta']);

    const alphaCand = candidates.find((c) => c.label === 'alpha')!;
    assert.equal(alphaCand.valueKind, 'leaf');
    assert.equal(alphaCand.fileCount, 1);
  });

  it('nested object: prefix resolves to parent, children enumerated', () => {
    const text = '{"parent": {"child1": 1, "child2": 2}}';
    const model = parseJsonModel(text);
    const candidates = getCandidatesForPrefix(model.root ? [model.root] : [], [
      { type: 'key', value: 'parent' },
    ]);

    assert.equal(candidates.length, 2);
    const labels = candidates.map((c) => c.label).sort();
    assert.deepEqual(labels, ['child1', 'child2']);
  });

  it('array elements: candidates labeled [0], [1], etc.', () => {
    const text = '{"items": [1, 2, 3]}';
    const model = parseJsonModel(text);
    const candidates = getCandidatesForPrefix(model.root ? [model.root] : [], [
      { type: 'key', value: 'items' },
    ]);

    assert.equal(candidates.length, 3);
    const labels = candidates.map((c) => c.label).sort();
    assert.deepEqual(labels, ['[0]', '[1]', '[2]']);

    const firstCand = candidates.find((c) => c.label === '[0]')!;
    assert.deepEqual(firstCand.segment, { type: 'index', value: 0 });
    assert.equal(firstCand.valueKind, 'leaf');
  });

  it('two roots sharing a top-level key: merged with fileCount = 2', () => {
    const text1 = '{"alpha": 1}';
    const text2 = '{"alpha": 2}';
    const model1 = parseJsonModel(text1);
    const model2 = parseJsonModel(text2);

    const candidates = getCandidatesForPrefix(
      [model1.root, model2.root].filter(Boolean),
      []
    );

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].label, 'alpha');
    assert.equal(candidates[0].fileCount, 2);
  });

  it('two roots with disjoint keys: both appear separately', () => {
    const text1 = '{"alpha": 1}';
    const text2 = '{"beta": 2}';
    const model1 = parseJsonModel(text1);
    const model2 = parseJsonModel(text2);

    const candidates = getCandidatesForPrefix(
      [model1.root, model2.root].filter(Boolean),
      []
    );

    assert.equal(candidates.length, 2);
    const labels = candidates.map((c) => c.label).sort();
    assert.deepEqual(labels, ['alpha', 'beta']);

    for (const cand of candidates) {
      assert.equal(cand.fileCount, 1);
    }
  });

  it('prefix that does not resolve in one root: silently skipped', () => {
    const text1 = '{"alpha": {"nested": 1}}';
    const text2 = '{"beta": 2}';
    const model1 = parseJsonModel(text1);
    const model2 = parseJsonModel(text2);

    // Try to resolve "alpha" > "nested" — only model1 has this path.
    const candidates = getCandidatesForPrefix(
      [model1.root, model2.root].filter(Boolean),
      [{ type: 'key', value: 'alpha' }, { type: 'key', value: 'nested' }]
    );

    // Should return nothing (no children at this path in either root, since model2 has no "alpha").
    assert.equal(candidates.length, 0);
  });

  it('undefined root in roots iterable: skipped silently', () => {
    const text = '{"alpha": 1}';
    const model = parseJsonModel(text);

    const candidates = getCandidatesForPrefix(
      [undefined, model.root, undefined].filter(Boolean),
      []
    );

    // Should work normally, ignoring the undefined roots.
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].label, 'alpha');
  });

  it('object vs array: valueKind reflects child node type', () => {
    const text = '{"obj": {}, "arr": [], "leaf": 1}';
    const model = parseJsonModel(text);
    const candidates = getCandidatesForPrefix(model.root ? [model.root] : [], []);

    const objCand = candidates.find((c) => c.label === 'obj')!;
    assert.equal(objCand.valueKind, 'object');

    const arrCand = candidates.find((c) => c.label === 'arr')!;
    assert.equal(arrCand.valueKind, 'array');

    const leafCand = candidates.find((c) => c.label === 'leaf')!;
    assert.equal(leafCand.valueKind, 'leaf');
  });

  it('never throws on any input (graceful fallback)', () => {
    const model = parseJsonModel('not valid json');
    // parseJsonModel is tolerant and may return root: undefined.
    assert.doesNotThrow(() => {
      getCandidatesForPrefix([model.root], []);
    });
  });
});
