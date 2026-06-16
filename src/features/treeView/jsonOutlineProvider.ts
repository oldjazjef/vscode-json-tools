import * as vscode from 'vscode';
import { parseJsonModel } from '../../core/jsonModel';
import { getJsonLanguageIds, getOutlineDebounceMs } from '../../config/settings';
import { revealRange } from '../../navigation/revealService';
import { debounce } from '../../util/debounce';
import {
  buildRootNode,
  describeOutlineNode,
  getChildOutlineNodes,
  hasChildren,
  JsonOutlineNode,
  outlineNodeKeyRange,
  outlineNodePathString,
  outlineNodeValueRange,
  subtreeMatchesFilter,
} from './jsonOutlineNode';

export const OUTLINE_VIEW_ID = 'jsonTools.outlineView';

/**
 * TreeDataProvider for the active JSON/JSONC document. Mirrors VSCode's
 * built-in Outline view, but for JSON structure: it tracks whichever
 * document is active (not a whole-workspace explorer), and supports an
 * optional text filter that prunes non-matching subtrees.
 */
export class JsonOutlineProvider implements vscode.TreeDataProvider<JsonOutlineNode> {
  private readonly changeEmitter = new vscode.EventEmitter<JsonOutlineNode | undefined | void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  private rootOutlineNode: JsonOutlineNode | undefined;
  private documentUri: vscode.Uri | undefined;
  private filterText = '';

  /** Re-parses `document` and rebuilds the tree from scratch. Pass `undefined` to clear the view (e.g. non-JSON active editor). */
  setDocument(document: vscode.TextDocument | undefined): void {
    if (!document || !getJsonLanguageIds().includes(document.languageId)) {
      this.rootOutlineNode = undefined;
      this.documentUri = undefined;
      this.changeEmitter.fire();
      return;
    }

    this.documentUri = document.uri;
    const model = parseJsonModel(document.getText());
    this.rootOutlineNode = model.root ? buildRootNode(model.root) : undefined;
    this.changeEmitter.fire();
  }

  setFilterText(text: string): void {
    this.filterText = text.trim().toLowerCase();
    this.changeEmitter.fire();
  }

  getFilterText(): string {
    return this.filterText;
  }

  getActiveDocumentUri(): vscode.Uri | undefined {
    return this.documentUri;
  }

  getTreeItem(element: JsonOutlineNode): vscode.TreeItem {
    const { label, description } = describeOutlineNode(element);
    const item = new vscode.TreeItem(
      label,
      hasChildren(element) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );
    item.description = description;
    item.id = `${outlineNodePathString(element) || '$root'}#${element.valueNode.offset}`;
    item.contextValue = 'jsonTools.outlineNode';
    item.tooltip = outlineNodePathString(element) || undefined;
    item.command = {
      command: 'jsonTools.outline.revealNode',
      title: 'Reveal in Editor',
      arguments: [element],
    };
    return item;
  }

  getChildren(element?: JsonOutlineNode): JsonOutlineNode[] {
    const base = element ?? this.rootOutlineNode;
    if (!base) {
      return [];
    }
    const children = getChildOutlineNodes(base);
    if (!this.filterText) {
      return children;
    }
    return children.filter((child) => subtreeMatchesFilter(child, this.filterText));
  }
}

/**
 * Creates the provider, registers the tree view, keeps it in sync with the
 * active editor, and registers its refresh/reveal commands. Returns the
 * provider so other features (search controller, future "find references"
 * context-menu action) can attach to it.
 */
export function registerJsonOutlineView(context: vscode.ExtensionContext): JsonOutlineProvider {
  const provider = new JsonOutlineProvider();
  const treeView = vscode.window.createTreeView(OUTLINE_VIEW_ID, {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  const refreshFromActiveEditor = () => provider.setDocument(vscode.window.activeTextEditor?.document);
  refreshFromActiveEditor();

  const debouncedRefresh = debounce(refreshFromActiveEditor, getOutlineDebounceMs());

  const revealCommand = vscode.commands.registerCommand('jsonTools.outline.revealNode', async (node: JsonOutlineNode) => {
    const uri = provider.getActiveDocumentUri();
    if (!uri || !node) {
      return;
    }
    const editor =
      vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === uri.toString()) ??
      (await vscode.window.showTextDocument(uri));
    revealRange(editor, outlineNodeKeyRange(node) ?? outlineNodeValueRange(node));
  });

  const refreshCommand = vscode.commands.registerCommand('jsonTools.refreshOutline', refreshFromActiveEditor);

  context.subscriptions.push(
    treeView,
    revealCommand,
    refreshCommand,
    vscode.window.onDidChangeActiveTextEditor(refreshFromActiveEditor),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === provider.getActiveDocumentUri()?.toString()) {
        debouncedRefresh();
      }
    })
  );

  return provider;
}
