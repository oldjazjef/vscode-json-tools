import * as vscode from 'vscode';
import { OffsetRange } from '../core/pathResolver';

export interface RevealOptions {
  /** Whether to also set the editor's selection to the range. Default: true. */
  select?: boolean;
  revealType?: vscode.TextEditorRevealType;
}

/** Converts a plain offset/length range into a `vscode.Range` for a given document. */
export function toVscodeRange(document: vscode.TextDocument, range: OffsetRange): vscode.Range {
  const start = document.positionAt(range.offset);
  const end = document.positionAt(range.offset + range.length);
  return new vscode.Range(start, end);
}

/**
 * The single place in the extension that touches `editor.selection`/
 * `editor.revealRange`. Feature 1 (path search), feature 2 (tree view
 * clicks), and feature 3 (reference results) all funnel through this so
 * "select + scroll to a range" is implemented exactly once.
 */
export function revealRange(editor: vscode.TextEditor, range: OffsetRange, options: RevealOptions = {}): void {
  const vsRange = toVscodeRange(editor.document, range);
  if (options.select !== false) {
    editor.selection = new vscode.Selection(vsRange.start, vsRange.end);
  }
  editor.revealRange(vsRange, options.revealType ?? vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

/**
 * Opens `uri` (if not already open) and reveals `range` in it. Used by
 * feature 3, whose results point at arbitrary source files rather than the
 * already-open JSON document that features 1 and 2 operate on.
 */
export async function openAndReveal(
  uri: vscode.Uri,
  range: OffsetRange,
  options: RevealOptions = {}
): Promise<vscode.TextEditor> {
  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document);
  revealRange(editor, range, options);
  return editor;
}
