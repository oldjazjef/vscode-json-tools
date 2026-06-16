/**
 * A single step in a JSON path query, e.g. `path1.path2[0]` becomes
 * `[{type:'key', value:'path1'}, {type:'key', value:'path2'}, {type:'index', value:0}]`.
 */
export type PathSegment = { type: 'key'; value: string } | { type: 'index'; value: number };

/** Thrown when a path query string cannot be parsed. */
export class PathQuerySyntaxError extends Error {
  constructor(message: string, readonly input: string, readonly position: number) {
    super(`${message} (at position ${position} in "${input}")`);
    this.name = 'PathQuerySyntaxError';
  }
}

/**
 * Parses a user-typed path query such as `path1.path2.path3`, `a[0].b`,
 * `a.0.b`, `a["literal.key"]`, or `a\.b.c` (escaped literal dot) into a
 * structured list of segments suitable for `pathResolver.resolve`.
 *
 * Supported syntax:
 * - Dotted keys: `a.b.c`
 * - Bracket index: `a[0]`, `a[0][1]`
 * - Dot-number index (sugar for bracket index): `a.0.b` === `a[0].b`
 * - Quoted bracket key (always literal, even if it looks numeric): `a["0"]`, `a['b.c']`
 * - Escaped characters in a dotted key: `\.` for a literal dot, `\\` for a literal backslash
 */
export function parsePathQuery(input: string): PathSegment[] {
  if (input.trim().length === 0) {
    throw new PathQuerySyntaxError('Path query must not be empty', input, 0);
  }

  const segments: PathSegment[] = [];
  let i = 0;
  const n = input.length;
  let expectSeparatorOrEnd = false;

  while (i < n) {
    const ch = input[i];

    if (ch === '.') {
      if (!expectSeparatorOrEnd) {
        throw new PathQuerySyntaxError('Unexpected "."', input, i);
      }
      i++;
      if (i >= n) {
        throw new PathQuerySyntaxError('Path must not end with "."', input, i);
      }
      if (input[i] === '.' || input[i] === '[') {
        // Let the next loop iteration handle "[", but "." immediately after "." is empty segment.
        if (input[i] === '.') {
          throw new PathQuerySyntaxError('Empty path segment between "."', input, i);
        }
      }
      expectSeparatorOrEnd = false;
      continue;
    }

    if (ch === '[') {
      const { segment, nextIndex } = parseBracketSegment(input, i);
      segments.push(segment);
      i = nextIndex;
      expectSeparatorOrEnd = true;
      continue;
    }

    if (expectSeparatorOrEnd) {
      throw new PathQuerySyntaxError(`Expected "." or "[" but found "${ch}"`, input, i);
    }

    const { segment, nextIndex } = parseKeySegment(input, i);
    segments.push(segment);
    i = nextIndex;
    expectSeparatorOrEnd = true;
  }

  return segments;
}

function parseKeySegment(input: string, start: number): { segment: PathSegment; nextIndex: number } {
  let i = start;
  let text = '';

  while (i < input.length && input[i] !== '.' && input[i] !== '[') {
    if (input[i] === '\\' && i + 1 < input.length) {
      text += input[i + 1];
      i += 2;
      continue;
    }
    text += input[i];
    i++;
  }

  if (text.length === 0) {
    throw new PathQuerySyntaxError('Empty path segment', input, start);
  }

  return { segment: toKeyOrIndexSegment(text), nextIndex: i };
}

function toKeyOrIndexSegment(text: string): PathSegment {
  return /^\d+$/.test(text) ? { type: 'index', value: Number(text) } : { type: 'key', value: text };
}

function parseBracketSegment(input: string, start: number): { segment: PathSegment; nextIndex: number } {
  // input[start] === '['
  let i = start + 1;
  if (i >= input.length) {
    throw new PathQuerySyntaxError('Unterminated "["', input, start);
  }

  const quote = input[i];
  if (quote === '"' || quote === "'") {
    i++;
    let text = '';
    let closed = false;
    while (i < input.length) {
      if (input[i] === '\\' && i + 1 < input.length) {
        text += input[i + 1];
        i += 2;
        continue;
      }
      if (input[i] === quote) {
        closed = true;
        i++;
        break;
      }
      text += input[i];
      i++;
    }
    if (!closed) {
      throw new PathQuerySyntaxError('Unterminated quoted key in "[...]"', input, start);
    }
    if (i >= input.length || input[i] !== ']') {
      throw new PathQuerySyntaxError('Expected "]" after quoted key', input, i);
    }
    i++;
    assertSegmentTerminator(input, i, start);
    return { segment: { type: 'key', value: text }, nextIndex: i };
  }

  let raw = '';
  while (i < input.length && input[i] !== ']') {
    raw += input[i];
    i++;
  }
  if (i >= input.length) {
    throw new PathQuerySyntaxError('Unterminated "["', input, start);
  }
  i++; // consume ']'

  if (!/^\d+$/.test(raw)) {
    throw new PathQuerySyntaxError(`Array index in "[...]" must be numeric or quoted, got "${raw}"`, input, start);
  }

  assertSegmentTerminator(input, i, start);
  return { segment: { type: 'index', value: Number(raw) }, nextIndex: i };
}

/** After a "[...]" segment, the next character must be ".", "[", or end of input. */
function assertSegmentTerminator(input: string, index: number, segmentStart: number): void {
  if (index < input.length && input[index] !== '.' && input[index] !== '[') {
    throw new PathQuerySyntaxError(`Unexpected "${input[index]}" after "[...]"`, input, index);
  }
  void segmentStart;
}

/**
 * Renders a parsed path back into its canonical string form, e.g.
 * `[{key:'a'}, {index:0}, {key:'b'}]` -> `a[0].b`. Keys that contain a
 * literal dot/bracket, or that look numeric (and would otherwise be
 * ambiguous with an index), are rendered in quoted bracket form.
 */
export function stringifyPathQuery(segments: PathSegment[]): string {
  if (segments.length === 0) {
    throw new PathQuerySyntaxError('Cannot stringify an empty path', '', 0);
  }

  let result = '';
  for (let idx = 0; idx < segments.length; idx++) {
    const segment = segments[idx];
    if (segment.type === 'index') {
      result += `[${segment.value}]`;
      continue;
    }

    const needsBracket = /[.[\]]/.test(segment.value) || /^\d+$/.test(segment.value);
    if (needsBracket) {
      result += `[${JSON.stringify(segment.value)}]`;
    } else if (idx === 0) {
      result += segment.value;
    } else {
      result += `.${segment.value}`;
    }
  }
  return result;
}
