import * as vscode from 'vscode';
import * as path from 'path';
import { parseJsonModel } from '../../core/jsonModel';
import { getJsonLanguageIds, getOutlineDebounceMs } from '../../config/settings';
import { revealRange } from '../../navigation/revealService';
import { debounce } from '../../util/debounce';
import { JsonFileManager } from './jsonFileManager';
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

// Sentinel node type to represent a pinned file in the tree view
interface PinnedFileNode {
  readonly _type: 'pinnedFile';
  readonly uri: vscode.Uri;
  readonly label: string;
  readonly isActive: boolean;
}

function isPinnedFileNode(node: unknown): node is PinnedFileNode {
  return typeof node === 'object' && node !== null && '_type' in node && (node as PinnedFileNode)._type === 'pinnedFile';
}

/**
 * TreeDataProvider for the active JSON/JSONC document. Mirrors VSCode's
 * built-in Outline view, but for JSON structure: it tracks whichever
 * document is active (not a whole-workspace explorer), and supports an
 * optional text filter that prunes non-matching subtrees.
 *
 * When a JsonFileManager is provided, shows pinned files as selectable tabs
 * and displays the active pinned file's structure.
 */
export class JsonOutlineProvider implements vscode.TreeDataProvider<JsonOutlineNode | PinnedFileNode> {
  readonly changeEmitter = new vscode.EventEmitter<JsonOutlineNode | PinnedFileNode | undefined | void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  private rootOutlineNode: JsonOutlineNode | undefined;
  private documentUri: vscode.Uri | undefined;
  private filterText = '';
  private treeView: vscode.TreeView<JsonOutlineNode | PinnedFileNode> | undefined;
  private fileManager: JsonFileManager | undefined;

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

  setTreeView(view: vscode.TreeView<JsonOutlineNode | PinnedFileNode>): void {
    this.treeView = view;
  }

  setFileManager(fileManager: JsonFileManager): void {
    this.fileManager = fileManager;
  }

  getActiveDocumentUri(): vscode.Uri | undefined {
    return this.documentUri;
  }

  switchPinnedFile(uri: vscode.Uri): void {
    if (this.fileManager) {
      this.fileManager.setActiveUri(uri);
      // Update the document to show the new file's structure
      vscode.workspace.openTextDocument(uri).then((doc) => {
        this.setDocument(doc);
      });
    }
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

  getTreeItem(element: JsonOutlineNode | PinnedFileNode): vscode.TreeItem {
    // Handle pinned file nodes
    if (isPinnedFileNode(element)) {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('json');
      item.contextValue = element.isActive ? 'jsonTools.pinnedFileActive' : 'jsonTools.pinnedFile';
      item.description = element.isActive ? '(active)' : '';
      item.command = {
        command: 'jsonTools.outline.switchPinnedFile',
        title: 'Switch to file',
        arguments: [element.uri],
      };
      return item;
    }

    // Handle JSON outline nodes
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

  getChildren(element?: JsonOutlineNode | PinnedFileNode): Array<JsonOutlineNode | PinnedFileNode> {
    // If no element is selected, show pinned files AND the active file's structure
    if (!element) {
      const result: Array<JsonOutlineNode | PinnedFileNode> = [];

      // Add pinned files if file manager exists
      if (this.fileManager) {
        const pinnedFiles = this.fileManager.getPinnedUris();
        if (pinnedFiles.length > 0) {
          result.push(
            ...pinnedFiles.map((uri) => ({
              _type: 'pinnedFile' as const,
              uri,
              label: path.basename(uri.fsPath),
              isActive: this.fileManager!.getActiveUri()?.toString() === uri.toString(),
            }))
          );
        }
      }

      // Add the active file's root structure (if it exists)
      if (this.rootOutlineNode) {
        const children = getChildOutlineNodes(this.rootOutlineNode);
        if (this.filterText) {
          result.push(...children.filter((child) => subtreeMatchesFilter(child, this.filterText)));
        } else {
          result.push(...children);
        }
      }

      return result;
    }

    // If element is a pinned file, don't show children (it's just a selector)
    if (isPinnedFileNode(element)) {
      return [];
    }

    // Otherwise, show the structure of the current outline node
    const children = getChildOutlineNodes(element);
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
export function registerJsonOutlineView(context: vscode.ExtensionContext, fileManager: JsonFileManager): JsonOutlineProvider {
  const provider = new JsonOutlineProvider();
  provider.setFileManager(fileManager);

  const treeView = vscode.window.createTreeView(OUTLINE_VIEW_ID, {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  provider.setTreeView(treeView);

  const refreshFromActiveEditor = () => {
    // If a file is pinned and active, use that; otherwise use the active editor
    const activeUri = fileManager.getActiveUri();
    if (activeUri) {
      vscode.workspace.openTextDocument(activeUri).then((doc) => {
        provider.setDocument(doc);
      });
    } else {
      provider.setDocument(vscode.window.activeTextEditor?.document);
    }
  };
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

  const switchPinnedFileCommand = vscode.commands.registerCommand('jsonTools.outline.switchPinnedFile', async (uri: vscode.Uri) => {
    provider.switchPinnedFile(uri);
    provider.changeEmitter.fire();
  });

  const refreshCommand = vscode.commands.registerCommand('jsonTools.refreshOutline', refreshFromActiveEditor);

  context.subscriptions.push(
    treeView,
    revealCommand,
    switchPinnedFileCommand,
    refreshCommand,
    vscode.window.onDidChangeActiveTextEditor(refreshFromActiveEditor),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === provider.getActiveDocumentUri()?.toString()) {
        debouncedRefresh();
      }
    }),
    fileManager.onDidChange(() => {
      refreshFromActiveEditor();
      provider.changeEmitter.fire();
    })
  );

  return provider;
}
