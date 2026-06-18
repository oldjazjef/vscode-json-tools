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
  nodeMatchesFilter,
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
  private treeView: vscode.TreeView<JsonOutlineNode> | undefined;

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

  setTreeView(view: vscode.TreeView<JsonOutlineNode>): void {
    this.treeView = view;
  }

  getActiveDocumentUri(): vscode.Uri | undefined {
    return this.documentUri;
  }

  /**
   * Finds the first node in the tree that directly matches the current filter text.
   * Used for auto-revealing matched nodes when filtering.
   */
  findFirstMatchingNode(): JsonOutlineNode | undefined {
    if (!this.rootOutlineNode || !this.filterText) {
      return undefined;
    }
    return this.findFirstMatchingNodeRecursive(this.rootOutlineNode);
  }

  /**
   * Reveals and expands the first matching node in the tree view.
   */
  revealFirstMatch(): void {
    if (!this.treeView) {
      return;
    }
    const firstMatch = this.findFirstMatchingNode();
    if (firstMatch) {
      this.treeView.reveal(firstMatch, { focus: false, select: false, expand: true });
    }
  }

  private findFirstMatchingNodeRecursive(node: JsonOutlineNode): JsonOutlineNode | undefined {
    if (nodeMatchesFilter(node, this.filterText)) {
      return node;
    }
    for (const child of getChildOutlineNodes(node)) {
      if (subtreeMatchesFilter(child, this.filterText)) {
        const result = this.findFirstMatchingNodeRecursive(child);
        if (result) {
          return result;
        }
      }
    }
    return undefined;
  }

  getTreeItem(element: JsonOutlineNode): vscode.TreeItem {
    const { label, description } = describeOutlineNode(element);
    const item = new vscode.TreeItem(label, this.collapsibleStateFor(element));
    item.description = description;
    // Append ':f' when filtering so VS Code treats filtered items as fresh tree
    // nodes and respects the Expanded collapsibleState, rather than reusing the
    // cached Collapsed state from the unfiltered render.
    item.id = `${outlineNodePathString(element) || '$root'}#${element.valueNode.offset}${this.filterText ? ':f' : ''}`;
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

  /**
   * Leaves use `None`. Branches normally start `Collapsed` so browsing an
   * unfiltered document doesn't dump everything open at once — but while a
   * filter is active, every branch reaching this point is, by construction,
   * an ancestor of a match (see `getChildren`'s `subtreeMatchesFilter`
   * filtering), so it's expanded automatically to walk the user straight
   * down to the match instead of requiring a manual click at every level.
   */
  private collapsibleStateFor(element: JsonOutlineNode): vscode.TreeItemCollapsibleState {
    if (!hasChildren(element)) {
      return vscode.TreeItemCollapsibleState.None;
    }
    return this.filterText ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
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
  provider.setTreeView(treeView);

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
