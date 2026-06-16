import * as assert from 'assert';
import { parseJsonModel } from '../../src/core/jsonModel';

describe('jsonModel', () => {
  it('parses valid JSON with no errors and a root object node', () => {
    const model = parseJsonModel('{"a": 1, "b": {"c": 2}}');
    assert.strictEqual(model.errors.length, 0);
    assert.ok(model.root);
    assert.strictEqual(model.root!.type, 'object');
  });

  it('parses JSON with // and /* */ comments (JSONC)', () => {
    const text = `{
        // leading comment
        "a": 1, /* inline comment */
        "b": 2
      }`;
    const model = parseJsonModel(text);
    assert.strictEqual(model.errors.length, 0);
    assert.ok(model.root);
  });

  it('parses JSON with a trailing comma tolerated by jsonc-parser', () => {
    const model = parseJsonModel('{"a": 1, "b": 2,}');
    assert.ok(model.root);
  });

  it('records parse errors without throwing on malformed JSON', () => {
    assert.doesNotThrow(() => {
      const model = parseJsonModel('{"a": }');
      assert.ok(model.errors.length > 0);
    });
  });

  it('does not throw on an empty document', () => {
    assert.doesNotThrow(() => {
      const model = parseJsonModel('');
      assert.strictEqual(model.root, undefined);
    });
  });

  it('does not throw on whitespace-only document', () => {
    const model = parseJsonModel('   \n  ');
    assert.strictEqual(model.root, undefined);
  });

  it('exposes the raw text it was parsed from', () => {
    const model = parseJsonModel('{"a": 1}');
    assert.strictEqual(model.text, '{"a": 1}');
  });

  it('parses arrays at the root', () => {
    const model = parseJsonModel('[1, 2, 3]');
    assert.strictEqual(model.root!.type, 'array');
    assert.strictEqual(model.root!.children?.length, 3);
  });
});
