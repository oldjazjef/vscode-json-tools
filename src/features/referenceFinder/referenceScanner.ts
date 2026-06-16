import { PathSegment } from '../../core/pathQuery';

export type ReferenceMatchKind = 'full-chain' | 'partial-chain' | 'accessor-call';

export interface ReferenceMatch {
  readonly offset: number;
  readonly length: number;
  readonly line: number;
  readonly column: number;
  readonly matchedText: string;
  readonly kind: ReferenceMatchKind;
}

export interface ReferenceScannerOptions {
  readonly accessorFunctionNames: readonly string[];
}

/**
 * Scans arbitrary source text for places that look like they access
 * `pathSegments` — dot/bracket property access (`config.path1.path2.path3`,
 * `config["path1"]["path2"].path3`), or the dotted path as a string literal
 * passed to a configured accessor-style function (`get('path1.path2.path3')`,
 * `i18n.t("path1.path2.path3")`, `_.get(obj, 'path1.path2.path3')`).
 *
 * This is intentionally a text/regex scanner, not a per-language AST
 * analyzer — it has no notion of what file type it's looking at, so it
 * will produce both false positives (an unrelated chain that happens to
 * share segment names) and false negatives (any access pattern not covered
 * by the regexes below). `kind` lets callers rank `full-chain` matches
 * above the noisier `partial-chain`/`accessor-call` ones rather than
 * trying to eliminate the noise outright.
 */
export function scanTextForPathReferences(
  text: string,
  pathSegments: readonly PathSegment[],
  options: ReferenceScannerOptions
): ReferenceMatch[] {
  if (pathSegments.length === 0) {
    return [];
  }

  const lineStarts = buildLineStarts(text);
  const matches: ReferenceMatch[] = [];

  collect(matches, text, buildAccessRegex(pathSegments), 'full-chain', lineStarts);

  // Partial-chain suffixes (e.g. for a.b.c, also match a bare b.c). Only
  // generated for suffixes of length >= 2 — a single bare segment name is
  // too generic to be a useful signal on its own.
  for (let start = 1; start <= pathSegments.length - 2; start++) {
    collect(matches, text, buildAccessRegex(pathSegments.slice(start)), 'partial-chain', lineStarts);
  }

  if (pathSegments.every(isKeySegment)) {
    const dotJoined = pathSegments.map((segment) => segment.value).join('.');
    for (const name of options.accessorFunctionNames) {
      collect(matches, text, buildAccessorCallRegex(name, dotJoined), 'accessor-call', lineStarts);
    }
  }

  return matches;
}

function isKeySegment(segment: PathSegment): segment is { type: 'key'; value: string } {
  return segment.type === 'key';
}

function buildAccessRegex(segments: readonly PathSegment[]): RegExp {
  const parts = segments.map((segment) => {
    if (segment.type === 'index') {
      return `\\[\\s*${segment.value}\\s*\\]`;
    }
    const escaped = escapeRegExp(segment.value);
    return `(?:\\.${escaped}\\b|\\[\\s*['"]${escaped}['"]\\s*\\])`;
  });
  return new RegExp(parts.join(''), 'g');
}

function buildAccessorCallRegex(accessorName: string, dotJoinedPath: string): RegExp {
  const escapedName = escapeRegExp(accessorName);
  const escapedPath = escapeRegExp(dotJoinedPath);
  // Optional leading argument covers two-arg forms like `_.get(obj, 'a.b.c')`.
  return new RegExp(`${escapedName}\\s*\\(\\s*(?:[\\w.$]+\\s*,\\s*)?['"]${escapedPath}['"]`, 'g');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collect(
  out: ReferenceMatch[],
  text: string,
  regex: RegExp,
  kind: ReferenceMatchKind,
  lineStarts: readonly number[]
): void {
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const offset = match.index;
    const { line, column } = positionAt(lineStarts, offset);
    out.push({ offset, length: match[0].length, line, column, matchedText: match[0], kind });
    if (match[0].length === 0) {
      regex.lastIndex++;
    }
  }
}

/** `lineStarts[i]` is the offset where line `i` begins (0-based). */
function buildLineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      starts.push(i + 1);
    }
  }
  return starts;
}

function positionAt(lineStarts: readonly number[], offset: number): { line: number; column: number } {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (lineStarts[mid] <= offset) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return { line: lo, column: offset - lineStarts[lo] };
}
