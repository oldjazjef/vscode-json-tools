import * as assert from 'assert';
import * as fc from 'fast-check';
import { parseJsonModel } from '../../src/core/jsonModel';
import { PathQuerySyntaxError, parsePathQuery, stringifyPathQuery } from '../../src/core/pathQuery';
import { resolvePath } from '../../src/core/pathResolver';

/**
 * Property-based (fuzz) tests: random input must never crash the parsers, and
 * what is written can be read back. Complements the example-based tests next
 * to this file; fast-check shrinks any failure to a minimal counter-example.
 */
describe('fuzz', () => {
  it('parsePathQuery returns segments or throws a PathQuerySyntaxError for any string', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (input) => {
        try {
          const segments = parsePathQuery(input);
          assert.ok(Array.isArray(segments));
          for (const segment of segments) {
            assert.ok(segment.type === 'key' || segment.type === 'index');
          }
        } catch (error) {
          assert.ok(error instanceof PathQuerySyntaxError, `unexpected ${String(error)}`);
        }
      }),
      { numRuns: 2000 },
    );
  });

  it('a stringified path parses back to the same segments', () => {
    const key = fc.string({ minLength: 1 }).filter((text) => !/^\d+$/.test(text));
    const segment = fc.oneof(
      key.map((value) => ({ type: 'key' as const, value })),
      fc.nat({ max: 10_000 }).map((value) => ({ type: 'index' as const, value })),
    );
    fc.assert(
      fc.property(fc.array(segment, { minLength: 1, maxLength: 8 }), (segments) => {
        assert.deepStrictEqual(parsePathQuery(stringifyPathQuery(segments)), segments);
      }),
      { numRuns: 1000 },
    );
  });

  it('parseJsonModel never throws, whatever the text', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (text) => {
        const model = parseJsonModel(text);
        assert.strictEqual(model.text, text);
      }),
      { numRuns: 2000 },
    );
  });

  it('resolvePath never throws for any document and any path', () => {
    const segment = fc.oneof(
      fc.string().map((value) => ({ type: 'key' as const, value })),
      fc.nat({ max: 50 }).map((value) => ({ type: 'index' as const, value })),
    );
    fc.assert(
      fc.property(fc.jsonValue().map((value) => JSON.stringify(value)), fc.array(segment, { maxLength: 6 }), (text, path) => {
        const model = parseJsonModel(text);
        const resolved = resolvePath(model.root, path);
        if (resolved) {
          assert.ok(resolved.valueRange.offset >= 0);
        }
      }),
      { numRuns: 1000 },
    );
  });
});
