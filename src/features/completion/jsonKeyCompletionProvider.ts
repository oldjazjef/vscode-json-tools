import * as vscode from 'vscode';
import { stringifyPathQuery } from '../../core/pathQuery';
import { getCandidatesForPrefix } from './jsonKeyCandidates';
import { parsePartialPathQuery } from './partialPathParser';
import { JsonKeyIndexService } from './jsonKeyIndexService';

/**
 * Provides completion items for the `jt:` sigil. Type `jt:` anywhere in any file
 * to get JSON key completions sourced from the workspace's JSON/JSONC files.
 * Continue cascading through nested levels; the final selection removes the `jt:` sigil.
 */
export class JsonKeyCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly indexService: JsonKeyIndexService) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.CompletionItem[] | undefined> {
    // Extract the line up to the cursor and check for `jt:` pattern.
    const linePrefix = document.lineAt(position.line).text.substring(0, position.character);
    const match = /jt:([\w$.[\]'"]*)$/.exec(linePrefix);
    if (!match) {
      return undefined;
    }

    const sigilStartCol = match.index;
    const pathStartCol = sigilStartCol + 3; // length of "jt:"
    const pathText = match[1];

    // Parse the partial path into prefix (complete segments) and partial (in-progress).
    let prefixSegments;
    try {
      const parsed = parsePartialPathQuery(pathText);
      prefixSegments = parsed.prefixSegments;
    } catch {
      return undefined;
    }

    // Ensure the index is built.
    await this.indexService.ensureBuilt();

    // Get candidates at this prefix across all roots.
    const candidates = getCandidatesForPrefix(
      this.indexService.getRoots().values(),
      prefixSegments
    );

    // Build completion items.
    const items: vscode.CompletionItem[] = [];
    for (const candidate of candidates) {
      const fullPath = stringifyPathQuery([...prefixSegments, candidate.segment]);

      // Determine kind based on valueKind.
      let kind: vscode.CompletionItemKind;
      if (candidate.valueKind === 'leaf') {
        kind = candidate.segment.type === 'index' ? vscode.CompletionItemKind.Value : vscode.CompletionItemKind.Property;
      } else {
        // object or array
        kind = vscode.CompletionItemKind.Module;
      }

      const item = new vscode.CompletionItem(candidate.label, kind);
      item.detail =
        candidate.fileCount > 1
          ? `${candidate.description} (${candidate.fileCount} files)`
          : candidate.description;
      item.filterText = fullPath;
      item.sortText = candidate.label;

      if (candidate.valueKind === 'leaf') {
        // Final accept: replace from start of `jt:` through cursor with the full path, removing the sigil.
        item.range = new vscode.Range(
          position.line,
          sigilStartCol,
          position.line,
          position.character
        );
        item.insertText = fullPath;
        // No command or additionalTextEdits needed — single edit handles it.
      } else {
        // Non-leaf (cascading): replace from after `jt:` through cursor with the full path,
        // preserving `jt:` in the document, and append a trailing separator for the next segment.
        item.range = new vscode.Range(
          position.line,
          pathStartCol,
          position.line,
          position.character
        );

        // Append separator: dot for object properties, nothing for array (user types `[` themselves).
        const separator = candidate.valueKind === 'object' ? '.' : '';
        item.insertText = fullPath + separator;

        // Retrigger suggestions immediately so the user can cascade without retyping `jt:`.
        item.command = { command: 'editor.action.triggerSuggest', title: 'Continue path' };
      }

      items.push(item);
    }

    return items;
  }
}

export function registerJsonKeyCompletionProvider(context: vscode.ExtensionContext): void {
  const indexService = new JsonKeyIndexService();
  const provider = new JsonKeyCompletionProvider(indexService);
  context.subscriptions.push(
    indexService,
    vscode.languages.registerCompletionItemProvider({ pattern: '**' }, provider, ':')
  );
}
