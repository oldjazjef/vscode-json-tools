import * as assert from 'assert';
import { parsePathQuery } from '../../src/core/pathQuery';
import { scanTextForPathReferences } from '../../src/features/referenceFinder/referenceScanner';

const defaultOptions = { accessorFunctionNames: ['get', 't', 'i18n.t', '_.get'] };

function kinds(text: string, path: string) {
  return scanTextForPathReferences(text, parsePathQuery(path), defaultOptions).map((m) => m.kind);
}

describe('referenceScanner', () => {
  it('matches dot-access for the full chain', () => {
    const matches = scanTextForPathReferences('const x = config.path1.path2.path3;', parsePathQuery('path1.path2.path3'), defaultOptions);
    assert.ok(matches.some((m) => m.kind === 'full-chain' && m.matchedText === '.path1.path2.path3'));
  });

  it('matches double-quoted bracket notation', () => {
    const text = 'config["path1"]["path2"].path3';
    const matches = scanTextForPathReferences(text, parsePathQuery('path1.path2.path3'), defaultOptions);
    assert.ok(matches.some((m) => m.kind === 'full-chain'));
  });

  it('matches single-quoted bracket notation', () => {
    const text = "config['path1']['path2']['path3']";
    const matches = scanTextForPathReferences(text, parsePathQuery('path1.path2.path3'), defaultOptions);
    assert.ok(matches.some((m) => m.kind === 'full-chain'));
  });

  it('matches a mix of dot and bracket notation', () => {
    const text = "config['path1'].path2[\"path3\"]";
    const matches = scanTextForPathReferences(text, parsePathQuery('path1.path2.path3'), defaultOptions);
    assert.ok(matches.some((m) => m.kind === 'full-chain'));
  });

  it('matches a numeric array index segment in bracket form', () => {
    const text = 'config.items[0].path2';
    const matches = scanTextForPathReferences(text, parsePathQuery('items[0].path2'), defaultOptions);
    assert.ok(matches.some((m) => m.kind === 'full-chain'));
  });

  it('matches get(...) accessor call', () => {
    const text = "get('path1.path2.path3')";
    const matches = scanTextForPathReferences(text, parsePathQuery('path1.path2.path3'), defaultOptions);
    assert.ok(matches.some((m) => m.kind === 'accessor-call'));
  });

  it('matches t(...) accessor call with double quotes', () => {
    const text = 't("path1.path2.path3")';
    const matches = scanTextForPathReferences(text, parsePathQuery('path1.path2.path3'), defaultOptions);
    assert.ok(matches.some((m) => m.kind === 'accessor-call'));
  });

  it('matches i18n.t(...) accessor call (dotted accessor name)', () => {
    const text = 'i18n.t("path1.path2.path3")';
    const matches = scanTextForPathReferences(text, parsePathQuery('path1.path2.path3'), defaultOptions);
    assert.ok(matches.some((m) => m.kind === 'accessor-call'));
  });

  it('matches _.get(obj, ...) accessor call with a leading argument', () => {
    const text = "_.get(obj, 'path1.path2.path3')";
    const matches = scanTextForPathReferences(text, parsePathQuery('path1.path2.path3'), defaultOptions);
    assert.ok(matches.some((m) => m.kind === 'accessor-call'));
  });

  it('matches a partial-chain suffix for a 3+ segment path', () => {
    const text = 'const y = other.path2.path3;';
    const matches = scanTextForPathReferences(text, parsePathQuery('path1.path2.path3'), defaultOptions);
    assert.ok(matches.some((m) => m.kind === 'partial-chain' && m.matchedText === '.path2.path3'));
  });

  it('does not generate a partial-chain for a 2-segment path', () => {
    assert.deepStrictEqual(kinds('const y = other.path2;', 'path1.path2').includes('partial-chain'), false);
  });

  it('does not match unrelated text', () => {
    const matches = scanTextForPathReferences('const z = totally.unrelated.chain;', parsePathQuery('path1.path2.path3'), defaultOptions);
    assert.strictEqual(matches.length, 0);
  });

  it('does not false-positive on a key that is a prefix of a longer identifier', () => {
    // path "a" must not match ".ab" inside "foo.ab.bar" — \b boundary guard.
    const matches = scanTextForPathReferences('foo.ab.bar', parsePathQuery('a'), defaultOptions);
    assert.strictEqual(matches.length, 0);
  });

  it('reports correct line and column for a match on a later line', () => {
    const text = 'line0\nline1\nconst v = config.path1.path2.path3;';
    const matches = scanTextForPathReferences(text, parsePathQuery('path1.path2.path3'), defaultOptions);
    const fullChain = matches.find((m) => m.kind === 'full-chain')!;
    assert.strictEqual(fullChain.line, 2);
    assert.strictEqual(text.split('\n')[2].slice(fullChain.column, fullChain.column + fullChain.length), '.path1.path2.path3');
  });

  it('returns an empty array for an empty path segment list', () => {
    assert.deepStrictEqual(scanTextForPathReferences('config.path1', [], defaultOptions), []);
  });

  it('does not throw on empty source text', () => {
    assert.doesNotThrow(() => scanTextForPathReferences('', parsePathQuery('path1.path2.path3'), defaultOptions));
  });
});
