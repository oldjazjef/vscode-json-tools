import * as assert from 'assert';
import { parsePathQuery, stringifyPathQuery, PathQuerySyntaxError } from '../../src/core/pathQuery';

describe('pathQuery', () => {
  describe('parsePathQuery', () => {
    it('parses a simple dotted path', () => {
      assert.deepStrictEqual(parsePathQuery('path1.path2.path3'), [
        { type: 'key', value: 'path1' },
        { type: 'key', value: 'path2' },
        { type: 'key', value: 'path3' },
      ]);
    });

    it('parses a single key', () => {
      assert.deepStrictEqual(parsePathQuery('path1'), [{ type: 'key', value: 'path1' }]);
    });

    it('parses bracket array index notation', () => {
      assert.deepStrictEqual(parsePathQuery('a[0].b'), [
        { type: 'key', value: 'a' },
        { type: 'index', value: 0 },
        { type: 'key', value: 'b' },
      ]);
    });

    it('parses dot-number array index notation', () => {
      assert.deepStrictEqual(parsePathQuery('a.0.b'), [
        { type: 'key', value: 'a' },
        { type: 'index', value: 0 },
        { type: 'key', value: 'b' },
      ]);
    });

    it('parses a leading bracket index with no preceding key', () => {
      assert.deepStrictEqual(parsePathQuery('[0].b'), [
        { type: 'index', value: 0 },
        { type: 'key', value: 'b' },
      ]);
    });

    it('parses multiple consecutive bracket indices', () => {
      assert.deepStrictEqual(parsePathQuery('a[0][1]'), [
        { type: 'key', value: 'a' },
        { type: 'index', value: 0 },
        { type: 'index', value: 1 },
      ]);
    });

    it('parses a quoted bracket key, treating it literally even if numeric-looking', () => {
      assert.deepStrictEqual(parsePathQuery('a["0"].b'), [
        { type: 'key', value: 'a' },
        { type: 'key', value: '0' },
        { type: 'key', value: 'b' },
      ]);
    });

    it('parses a single-quoted bracket key containing a literal dot', () => {
      assert.deepStrictEqual(parsePathQuery("a['b.c'].d"), [
        { type: 'key', value: 'a' },
        { type: 'key', value: 'b.c' },
        { type: 'key', value: 'd' },
      ]);
    });

    it('parses an escaped dot inside a dotted key as a literal character', () => {
      assert.deepStrictEqual(parsePathQuery('a\\.b.c'), [
        { type: 'key', value: 'a.b' },
        { type: 'key', value: 'c' },
      ]);
    });

    it('parses an escaped backslash as a literal backslash', () => {
      assert.deepStrictEqual(parsePathQuery('a\\\\b.c'), [
        { type: 'key', value: 'a\\b' },
        { type: 'key', value: 'c' },
      ]);
    });

    it('throws PathQuerySyntaxError on empty input', () => {
      assert.throws(() => parsePathQuery(''), PathQuerySyntaxError);
    });

    it('throws PathQuerySyntaxError on whitespace-only input', () => {
      assert.throws(() => parsePathQuery('   '), PathQuerySyntaxError);
    });

    it('throws PathQuerySyntaxError on a leading dot', () => {
      assert.throws(() => parsePathQuery('.a.b'), PathQuerySyntaxError);
    });

    it('throws PathQuerySyntaxError on a trailing dot', () => {
      assert.throws(() => parsePathQuery('a.b.'), PathQuerySyntaxError);
    });

    it('throws PathQuerySyntaxError on consecutive dots', () => {
      assert.throws(() => parsePathQuery('a..b'), PathQuerySyntaxError);
    });

    it('throws PathQuerySyntaxError on an unterminated bracket', () => {
      assert.throws(() => parsePathQuery('a[0'), PathQuerySyntaxError);
    });

    it('throws PathQuerySyntaxError on a non-numeric unquoted bracket index', () => {
      assert.throws(() => parsePathQuery('a[b].c'), PathQuerySyntaxError);
    });

    it('throws PathQuerySyntaxError on a character glued after a closing bracket', () => {
      assert.throws(() => parsePathQuery('a[0]b'), PathQuerySyntaxError);
    });

    it('throws PathQuerySyntaxError on an unterminated quoted bracket key', () => {
      assert.throws(() => parsePathQuery("a['b"), PathQuerySyntaxError);
    });
  });

  describe('stringifyPathQuery', () => {
    it('round-trips a simple dotted path', () => {
      const segments = parsePathQuery('path1.path2.path3');
      assert.strictEqual(stringifyPathQuery(segments), 'path1.path2.path3');
    });

    it('renders array indices in bracket form', () => {
      const segments = parsePathQuery('a.0.b');
      assert.strictEqual(stringifyPathQuery(segments), 'a[0].b');
    });

    it('quotes a key that contains a literal dot', () => {
      const segments = parsePathQuery("a['b.c'].d");
      assert.strictEqual(stringifyPathQuery(segments), 'a["b.c"].d');
    });

    it('quotes a numeric-looking literal key to disambiguate from an index', () => {
      const segments = parsePathQuery('a["0"].b');
      assert.strictEqual(stringifyPathQuery(segments), 'a["0"].b');
    });

    it('throws PathQuerySyntaxError when given an empty segment list', () => {
      assert.throws(() => stringifyPathQuery([]), PathQuerySyntaxError);
    });
  });
});
