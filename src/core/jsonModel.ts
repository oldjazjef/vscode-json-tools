import { Node, ParseError, parseTree, ParseErrorCode, printParseErrorCode } from 'jsonc-parser';

/**
 * The result of parsing a JSON/JSONC document: the AST root (if any could be
 * recovered) plus any parse errors. `jsonc-parser` is tolerant of comments,
 * trailing commas, and many malformed inputs, so a missing/partial root and
 * a non-empty `errors` list can both occur for the same document — callers
 * should not assume `errors.length === 0` implies `root` exists, nor the
 * reverse.
 */
export interface JsonModel {
  readonly text: string;
  readonly root: Node | undefined;
  readonly errors: ParseError[];
}

/**
 * Parses JSON or JSONC (JSON with `//`/`/* *\/` comments and trailing
 * commas) text into an AST that retains source offsets/lengths for every
 * node — the basis for resolving a path query to a document range. Never
 * throws; parse problems are reported via `errors` instead.
 */
export function parseJsonModel(text: string): JsonModel {
  const errors: ParseError[] = [];
  const root = parseTree(text, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  return { text, root, errors };
}

/** Human-readable label for a `jsonc-parser` `ParseErrorCode`, for diagnostics/logging. */
export function describeParseError(code: ParseErrorCode): string {
  return printParseErrorCode(code);
}
