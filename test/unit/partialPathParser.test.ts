import * as assert from 'assert';
import { parsePartialPathQuery } from '../../src/features/completion/partialPathParser';

describe('partialPathParser', () => {
  it('empty string returns empty prefix and empty partial', () => {
    const result = parsePartialPathQuery('');
    assert.deepEqual(result.prefixSegments, []);
    assert.equal(result.partialSegmentText, '');
    assert.equal(result.inBracket, false);
  });

  it('single bare key returns as partial', () => {
    const result = parsePartialPathQuery('a');
    assert.deepEqual(result.prefixSegments, []);
    assert.equal(result.partialSegmentText, 'a');
    assert.equal(result.inBracket, false);
  });

  it('key with trailing dot returns key as prefix, empty partial', () => {
    const result = parsePartialPathQuery('a.');
    assert.deepEqual(result.prefixSegments, [{ type: 'key', value: 'a' }]);
    assert.equal(result.partialSegmentText, '');
    assert.equal(result.inBracket, false);
  });

  it('two keys returns first as prefix, second as partial', () => {
    const result = parsePartialPathQuery('a.b');
    assert.deepEqual(result.prefixSegments, [{ type: 'key', value: 'a' }]);
    assert.equal(result.partialSegmentText, 'b');
    assert.equal(result.inBracket, false);
  });

  it('three keys returns two as prefix, third as partial', () => {
    const result = parsePartialPathQuery('a.b.c');
    assert.deepEqual(result.prefixSegments, [
      { type: 'key', value: 'a' },
      { type: 'key', value: 'b' },
    ]);
    assert.equal(result.partialSegmentText, 'c');
    assert.equal(result.inBracket, false);
  });

  it('unterminated bracket returns bracket state and partial text', () => {
    const result = parsePartialPathQuery('a[');
    assert.deepEqual(result.prefixSegments, [{ type: 'key', value: 'a' }]);
    assert.equal(result.partialSegmentText, '');
    assert.equal(result.inBracket, true);
  });

  it('unterminated bracket with numeric content', () => {
    const result = parsePartialPathQuery('a[0');
    assert.deepEqual(result.prefixSegments, [{ type: 'key', value: 'a' }]);
    assert.equal(result.partialSegmentText, '0');
    assert.equal(result.inBracket, true);
  });

  it('unterminated bracket with quoted content', () => {
    const result = parsePartialPathQuery('a["fo');
    assert.deepEqual(result.prefixSegments, [{ type: 'key', value: 'a' }]);
    assert.equal(result.partialSegmentText, '"fo');
    assert.equal(result.inBracket, true);
  });

  it('closed bracket followed by dot returns bracket as prefix, empty partial', () => {
    const result = parsePartialPathQuery('a[0].');
    assert.deepEqual(result.prefixSegments, [
      { type: 'key', value: 'a' },
      { type: 'index', value: 0 },
    ]);
    assert.equal(result.partialSegmentText, '');
    assert.equal(result.inBracket, false);
  });

  it('numeric-only key in partial form (recognized as numeric but not yet complete)', () => {
    const result = parsePartialPathQuery('0');
    // A bare "0" is parsed as potentially numeric. When returned as partial text,
    // it remains as the index was already parsed into prefixSegments (empty since
    // there's only one segment, which is partial), so partialSegmentText captures the input.
    assert.deepEqual(result.prefixSegments, []);
    assert.equal(result.partialSegmentText, '0');
    assert.equal(result.inBracket, false);
  });

  it('closed bracket index without trailing separator', () => {
    const result = parsePartialPathQuery('a[0]');
    // [0] is complete, so it becomes a prefix; next segment is partial and empty.
    assert.deepEqual(result.prefixSegments, [
      { type: 'key', value: 'a' },
      { type: 'index', value: 0 },
    ]);
    assert.equal(result.partialSegmentText, '');
    assert.equal(result.inBracket, false);
  });

  it('key with underscore and dollar characters', () => {
    const result = parsePartialPathQuery('_foo$bar');
    assert.deepEqual(result.prefixSegments, []);
    assert.equal(result.partialSegmentText, '_foo$bar');
    assert.equal(result.inBracket, false);
  });

  it('key with escaped dot is captured as single partial segment', () => {
    const result = parsePartialPathQuery('foo\\.bar');
    // The escape sequence \. is processed into a literal dot, so the segment value is "foo.bar".
    // This entire text becomes the partial segment text (since it's the only segment and it's incomplete).
    assert.deepEqual(result.prefixSegments, []);
    assert.equal(result.partialSegmentText, 'foo.bar');
    assert.equal(result.inBracket, false);
  });

  it('never throws on any partial input', () => {
    const partials = [
      '',
      'a',
      'a.',
      'a..',
      'a.b.',
      'a[',
      'a[]',
      'a[0',
      'a["',
      "a['",
      'a["foo',
      "a['foo",
      'a["foo"',
      'a["foo"]',
      '[',
      '[[',
      '.',
      '..',
      '[.]',
    ];

    for (const partial of partials) {
      assert.doesNotThrow(() => parsePartialPathQuery(partial), `Failed for input: ${partial}`);
    }
  });
});
