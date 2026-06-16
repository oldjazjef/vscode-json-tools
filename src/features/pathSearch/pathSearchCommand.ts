import * as vscode from 'vscode';
import { parseJsonModel } from '../../core/jsonModel';
import { parsePathQuery, PathQuerySyntaxError } from '../../core/pathQuery';
import { resolvePath } from '../../core/pathResolver';
import { revealRange } from '../../navigation/revealService';
import { Logger } from '../../util/logger';

export type PathSearchOutcome =
  | { kind: 'resolved' }
  | { kind: 'notFound'; message: string }
  | { kind: 'invalidQuery'; message: string };

/**
 * Resolves `pathInput` against `editor`'s document and reveals it if found.
 * Pure with respect to VSCode UI (no input boxes/message popups) so it can
 * be called directly from tests and from the command handler below.
 */
export function searchPathInEditor(editor: vscode.TextEditor, pathInput: string): PathSearchOutcome {
  let segments;
  try {
    segments = parsePathQuery(pathInput);
  } catch (error) {
    if (error instanceof PathQuerySyntaxError) {
      return { kind: 'invalidQuery', message: error.message };
    }
    throw error;
  }

  const model = parseJsonModel(editor.document.getText());
  const resolved = resolvePath(model.root, segments);
  if (!resolved) {
    return { kind: 'notFound', message: `No property found at path "${pathInput}".` };
  }

  revealRange(editor, resolved.keyRange ?? resolved.valueRange);
  return { kind: 'resolved' };
}

/** Registers the `jsonTools.searchPath` command: prompts for a path, then delegates to `searchPathInEditor`. */
export function registerPathSearchCommand(context: vscode.ExtensionContext, logger: Logger): void {
  const disposable = vscode.commands.registerCommand('jsonTools.searchPath', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showWarningMessage('JSON Tools: open a JSON file first.');
      return;
    }

    const input = await vscode.window.showInputBox({
      title: 'JSON Tools: Search Path',
      prompt: 'Enter a JSON path, e.g. path1.path2.path3 or path1[0].path2',
      placeHolder: 'path1.path2.path3',
    });
    if (input === undefined) {
      return; // user cancelled
    }

    const outcome = searchPathInEditor(editor, input);
    if (outcome.kind !== 'resolved') {
      logger.warn(`searchPath: ${outcome.kind} for input "${input}" — ${outcome.message}`);
      void vscode.window.showWarningMessage(`JSON Tools: ${outcome.message}`);
    }
  });

  context.subscriptions.push(disposable);
}
