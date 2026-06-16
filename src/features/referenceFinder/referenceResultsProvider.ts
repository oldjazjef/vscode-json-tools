import * as vscode from 'vscode';
import { parsePathQuery, PathQuerySyntaxError } from '../../core/pathQuery';
import { openAndReveal } from '../../navigation/revealService';
import { Logger } from '../../util/logger';
import { JsonOutlineNode, outlineNodePathString } from '../treeView/jsonOutlineNode';
import { FileReferenceMatch, scanWorkspaceForPathReferences } from './referenceScannerService';

interface ReferenceQuickPickItem extends vscode.QuickPickItem {
  readonly match: FileReferenceMatch;
}

/** Registers the editor/command-palette `jsonTools.findReferences` (prompts for a path) and the tree-view context-menu `jsonTools.findReferencesFromNode` (path already known). */
export function registerFindReferencesCommands(context: vscode.ExtensionContext, logger: Logger): void {
  const findReferences = vscode.commands.registerCommand('jsonTools.findReferences', async () => {
    const input = await vscode.window.showInputBox({
      title: 'JSON Tools: Find References to Path',
      prompt: 'Enter a JSON path to search for across the workspace, e.g. path1.path2.path3',
      placeHolder: 'path1.path2.path3',
    });
    if (input === undefined) {
      return;
    }
    await findReferencesForPathString(input, logger);
  });

  const findReferencesFromNode = vscode.commands.registerCommand(
    'jsonTools.findReferencesFromNode',
    async (node: JsonOutlineNode) => {
      const pathString = node ? outlineNodePathString(node) : '';
      if (!pathString) {
        void vscode.window.showWarningMessage('JSON Tools: select a property (not the document root) to find references.');
        return;
      }
      await findReferencesForPathString(pathString, logger);
    }
  );

  context.subscriptions.push(findReferences, findReferencesFromNode);
}

async function findReferencesForPathString(input: string, logger: Logger): Promise<void> {
  let segments;
  try {
    segments = parsePathQuery(input);
  } catch (error) {
    if (error instanceof PathQuerySyntaxError) {
      void vscode.window.showWarningMessage(`JSON Tools: ${error.message}`);
      return;
    }
    throw error;
  }

  const matches = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `JSON Tools: searching for references to "${input}"`,
      cancellable: true,
    },
    (progress, token) =>
      scanWorkspaceForPathReferences(segments, {
        token,
        onProgress: ({ filesScanned, totalFiles }) => {
          progress.report({ message: `${filesScanned}/${totalFiles} files scanned` });
        },
      })
  );

  logger.info(`findReferences: ${matches.length} match(es) for "${input}"`);

  if (matches.length === 0) {
    void vscode.window.showInformationMessage(`JSON Tools: no references found for "${input}".`);
    return;
  }

  const ranked = [...matches].sort((a, b) => rank(a) - rank(b));
  const picked = await vscode.window.showQuickPick(ranked.map(toQuickPickItem), {
    title: `JSON Tools: ${matches.length} reference(s) to "${input}"`,
    matchOnDescription: true,
  });

  if (picked) {
    await openAndReveal(picked.match.uri, { offset: picked.match.offset, length: picked.match.length });
  }
}

/** Full-chain matches first, then accessor-call (still high confidence), then the noisier partial-chain suffix matches. */
function rank(match: FileReferenceMatch): number {
  switch (match.kind) {
    case 'full-chain':
      return 0;
    case 'accessor-call':
      return 1;
    case 'partial-chain':
      return 2;
  }
}

function toQuickPickItem(match: FileReferenceMatch): ReferenceQuickPickItem {
  const relativePath = vscode.workspace.asRelativePath(match.uri, true);
  return {
    label: `$(file) ${relativePath}:${match.line + 1}`,
    description: kindLabel(match.kind),
    detail: match.matchedText,
    match,
  };
}

function kindLabel(kind: FileReferenceMatch['kind']): string {
  switch (kind) {
    case 'full-chain':
      return 'full match';
    case 'accessor-call':
      return 'accessor call';
    case 'partial-chain':
      return 'partial match';
  }
}
