import { PathSegment } from '../../core/pathQuery';

export interface PartialPathParseResult {
  /** Complete, fully-parsed leading segments — safe to feed to resolvePath. */
  readonly prefixSegments: PathSegment[];
  /** Raw text of the in-progress trailing segment (everything after the last separator). Empty string if path ends exactly on a separator. */
  readonly partialSegmentText: string;
  /** True if the in-progress segment is inside an open, unterminated "[". */
  readonly inBracket: boolean;
}

/**
 * Parses a partial/in-progress path query like those generated while the user
 * is typing `jt:<path>` in real-time. Unlike `parsePathQuery`, this tolerates
 * trailing dots, unterminated brackets, empty input, and mid-segment EOF —
 * all the normal states of a keystroke-in-progress.
 *
 * Returns a result with `prefixSegments` (safe for `resolvePath`) and `partialSegmentText`
 * (the incomplete trailing segment, used only for client-side label filtering).
 * Never throws.
 */
export function parsePartialPathQuery(input: string): PartialPathParseResult {
  if (input.length === 0) {
    return { prefixSegments: [], partialSegmentText: '', inBracket: false };
  }

  const segments: PathSegment[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    // Separator: advance past and continue to next segment (or end of input).
    if (ch === '.') {
      i++;
      if (i >= n) {
        // Trailing dot: commit any prior segments and stop.
        return { prefixSegments: segments, partialSegmentText: '', inBracket: false };
      }
      if (input[i] === '.' || input[i] === '[') {
        // Next char is another separator; loop will handle it. But consecutive dots are not well-formed.
        if (input[i] === '.') {
          // Malformed (empty segment), but since we're tolerant, just skip and continue.
          i++;
          continue;
        }
      }
      continue;
    }

    // Bracket segment: parse as much as we can.
    if (ch === '[') {
      const result = tryParseBracketSegment(input, i);
      if (result.closed) {
        segments.push(result.segment);
        i = result.nextIndex;
        continue;
      } else {
        // Unclosed bracket: capture the rest as partial and stop.
        return {
          prefixSegments: segments,
          partialSegmentText: input.substring(i + 1),
          inBracket: true,
        };
      }
    }

    // Bare key segment: parse until we hit a separator or end.
    const keyResult = tryParseKeySegment(input, i);
    segments.push(keyResult.segment);
    i = keyResult.nextIndex;

    // If we're at end-of-input, we have a partial trailing segment (just parsed).
    if (i >= n) {
      // Backtrack: the segment we just added is actually *partial* — remove it from prefix and return as partial text.
      const lastSegment = segments.pop();
      const partialText =
        lastSegment?.type === 'key' ? lastSegment.value : lastSegment?.type === 'index' ? String(lastSegment.value) : '';
      return {
        prefixSegments: segments,
        partialSegmentText: partialText,
        inBracket: false,
      };
    }

    // If we're not at a separator, something went wrong — shouldn't happen in well-formed input.
    // In malformed input, just treat it as a complete segment and continue.
  }

  return { prefixSegments: segments, partialSegmentText: '', inBracket: false };
}

/**
 * Attempts to parse a bracket-form segment `[...]` starting at `input[start]`.
 * Returns the parsed segment and next index if successful and closed,
 * or `closed: false` with the raw text if unclosed (for partial-text capture).
 */
function tryParseBracketSegment(
  input: string,
  start: number
): { segment: PathSegment; nextIndex: number; closed: true } | { closed: false } {
  // input[start] === '['
  let i = start + 1;
  if (i >= input.length) {
    return { closed: false };
  }

  const quote = input[i];
  if (quote === '"' || quote === "'") {
    // Quoted key in bracket form.
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
      return { closed: false };
    }
    if (i >= input.length || input[i] !== ']') {
      return { closed: false };
    }
    i++;
    return { segment: { type: 'key', value: text }, nextIndex: i, closed: true };
  }

  // Unquoted numeric index.
  let raw = '';
  while (i < input.length && input[i] !== ']') {
    raw += input[i];
    i++;
  }
  if (i >= input.length) {
    return { closed: false };
  }
  i++; // consume ']'

  if (!/^\d+$/.test(raw)) {
    return { closed: false };
  }

  return { segment: { type: 'index', value: Number(raw) }, nextIndex: i, closed: true };
}

/**
 * Parses a bare key segment (no quotes, no brackets) starting at `input[start]`.
 */
function tryParseKeySegment(
  input: string,
  start: number
): { segment: PathSegment; nextIndex: number } {
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

  // Text should not be empty (caller checks), but handle gracefully.
  if (text.length === 0) {
    return { segment: { type: 'key', value: '' }, nextIndex: i };
  }

  const segment: PathSegment =
    /^\d+$/.test(text) ? { type: 'index', value: Number(text) } : { type: 'key', value: text };

  return { segment, nextIndex: i };
}
