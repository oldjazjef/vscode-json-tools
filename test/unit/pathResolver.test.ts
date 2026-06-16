import * as assert from 'assert';
import { parseJsonModel } from '../../src/core/jsonModel';
import { parsePathQuery } from '../../src/core/pathQuery';
import { resolvePath } from '../../src/core/pathResolver';

function rangeText(model: ReturnType<typeof parseJsonModel>, range: { offset: number; length: number }): string {
  return model.text.slice(range.offset, range.offset + range.length);
}

describe('pathResolver', () => {
  it('resolves a nested object property', () => {
    const model = parseJsonModel('{"path1": {"path2": {"path3": 42}}}');
    const result = resolvePath(model.root, parsePathQuery('path1.path2.path3'));
    assert.ok(result);
    assert.strictEqual(rangeText(model, result!.valueRange), '42');
    assert.strictEqual(rangeText(model, result!.keyRange!), '"path3"');
  });

  it('resolves an array element by index', () => {
    const model = parseJsonModel('{"items": ["a", "b", "c"]}');
    const result = resolvePath(model.root, parsePathQuery('items[1]'));
    assert.ok(result);
    assert.strictEqual(rangeText(model, result!.valueRange), '"b"');
    assert.strictEqual(result!.keyRange, undefined);
  });

  it('resolves a dot-number index the same as bracket index', () => {
    const model = parseJsonModel('{"items": ["a", "b", "c"]}');
    const result = resolvePath(model.root, parsePathQuery('items.1'));
    assert.ok(result);
    assert.strictEqual(rangeText(model, result!.valueRange), '"b"');
  });

  it('returns undefined for a key that does not exist', () => {
    const model = parseJsonModel('{"path1": {"path2": 1}}');
    const result = resolvePath(model.root, parsePathQuery('path1.missing'));
    assert.strictEqual(result, undefined);
  });

  it('returns undefined for an out-of-bounds array index', () => {
    const model = parseJsonModel('{"items": ["a"]}');
    const result = resolvePath(model.root, parsePathQuery('items[5]'));
    assert.strictEqual(result, undefined);
  });

  it('returns undefined when a key segment is used against an array node', () => {
    const model = parseJsonModel('{"items": ["a"]}');
    const result = resolvePath(model.root, parsePathQuery('items.foo'));
    assert.strictEqual(result, undefined);
  });

  it('returns undefined when an index segment is used against an object node', () => {
    const model = parseJsonModel('{"items": {"a": 1}}');
    const result = resolvePath(model.root, parsePathQuery('items[0]'));
    assert.strictEqual(result, undefined);
  });

  it('returns undefined when the document failed to parse (no root)', () => {
    const model = parseJsonModel('');
    const result = resolvePath(model.root, parsePathQuery('a.b'));
    assert.strictEqual(result, undefined);
  });

  it('resolves a literal key containing an escaped dot', () => {
    const model = parseJsonModel('{"a.b": {"c": 1}}');
    const result = resolvePath(model.root, parsePathQuery('a\\.b.c'));
    assert.ok(result);
    assert.strictEqual(rangeText(model, result!.valueRange), '1');
  });

  it('resolves the first occurrence when duplicate keys exist', () => {
    const model = parseJsonModel('{"a": 1, "a": 2}');
    const result = resolvePath(model.root, parsePathQuery('a'));
    assert.ok(result);
    assert.strictEqual(rangeText(model, result!.valueRange), '1');
  });

  it('returns the root itself for an empty segment list', () => {
    const model = parseJsonModel('{"a": 1}');
    const result = resolvePath(model.root, []);
    assert.ok(result);
    assert.strictEqual(rangeText(model, result!.valueRange), '{"a": 1}');
    assert.strictEqual(result!.keyRange, undefined);
  });

  it('resolves correctly through JSONC comments without offset drift', () => {
    const model = parseJsonModel('{\n  // comment\n  "a": {\n    "b": 7\n  }\n}');
    const result = resolvePath(model.root, parsePathQuery('a.b'));
    assert.ok(result);
    assert.strictEqual(rangeText(model, result!.valueRange), '7');
  });
});
