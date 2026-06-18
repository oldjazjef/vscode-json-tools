import * as vscode from 'vscode';
import { parseJsonModel } from '../../core/jsonModel';
import { getJsonLanguageIds, getOutlineDebounceMs } from '../../config/settings';
import { revealRange } from '../../navigation/revealService';
import { debounce } from '../../util/debounce';
import { Logger } from '../../util/logger';
import {
  DuplicateGroup,
  DuplicateOccurrence,
  findDuplicateKeys,
  findDuplicatedAttributes,
  findDuplicatedPairs,
  findDuplicatedValues,
  AttributeGroup,
  PairGroup,
  ValueGroup,
} from './duplicateKeyDetector';

export const DUPLICATE_KEYS_VIEW_ID = 'jsonTools.duplicateKeysView';
const IGNORE_LIST_STATE_KEY = 'jsonTools.duplicateKeys.ignoreList';

type DuplicateCategory = 'paths' | 'attributes' | 'pairs' | 'values';

interface CategoryNode {
  readonly kind: 'category';
  readonly category: DuplicateCategory;
  readonly displayName: string;
  readonly count: number;
}

interface PathGroupNode {
  readonly kind: 'path-group';
  readonly group: DuplicateGroup;
}

interface AttributeGroupNode {
  readonly kind: 'attribute-group';
  readonly group: AttributeGroup;
}

interface PairGroupNode {
  readonly kind: 'pair-group';
  readonly group: PairGroup;
}

interface ValueGroupNode {
  readonly kind: 'value-group';
  readonly group: ValueGroup;
}

interface OccurrenceNode {
  readonly kind: 'occurrence';
  readonly occurrence: DuplicateOccurrence;
  readonly index: number;
}

type DuplicateKeyNode = CategoryNode | PathGroupNode | AttributeGroupNode | PairGroupNode | ValueGroupNode | OccurrenceNode;

class DuplicateKeyProvider implements vscode.TreeDataProvider<DuplicateKeyNode> {
  private readonly changeEmitter = new vscode.EventEmitter<DuplicateKeyNode | undefined | void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  private pathGroups: DuplicateGroup[] = [];
  private attributeGroups: AttributeGroup[] = [];
  private pairGroups: PairGroup[] = [];
  private valueGroups: ValueGroup[] = [];
  private documentUri: vscode.Uri | undefined;
  private ignoreSet: Set<string>;

  constructor(private readonly workspaceState: vscode.Memento) {
    const saved = workspaceState.get<string[]>(IGNORE_LIST_STATE_KEY, []);
    this.ignoreSet = new Set(saved);
  }

  setDocument(document: vscode.TextDocument | undefined): void {
    if (!document || !getJsonLanguageIds().includes(document.languageId)) {
      this.documentUri = undefined;
      this.pathGroups = [];
      this.attributeGroups = [];
      this.pairGroups = [];
      this.valueGroups = [];
      this.changeEmitter.fire();
      return;
    }
    this.documentUri = document.uri;
    const model = parseJsonModel(document.getText());
    if (!model.root) {
      this.pathGroups = [];
      this.attributeGroups = [];
      this.pairGroups = [];
      this.valueGroups = [];
    } else {
      this.pathGroups = findDuplicateKeys(model.root, this.ignoreSet);
      this.attributeGroups = findDuplicatedAttributes(model.root);
      this.pairGroups = findDuplicatedPairs(model.root);
      this.valueGroups = findDuplicatedValues(model.root);
    }
    this.changeEmitter.fire();
  }

  getActiveDocumentUri(): vscode.Uri | undefined {
    return this.documentUri;
  }

  ignore(path: string): void {
    this.ignoreSet.add(path);
    void this.workspaceState.update(IGNORE_LIST_STATE_KEY, [...this.ignoreSet]);
    this.recomputeGroups();
  }

  getIgnoreList(): readonly string[] {
    return [...this.ignoreSet].sort();
  }

  removeFromIgnoreList(paths: readonly string[]): void {
    for (const p of paths) {
      this.ignoreSet.delete(p);
    }
    void this.workspaceState.update(IGNORE_LIST_STATE_KEY, [...this.ignoreSet]);
    this.recomputeGroups();
  }

  private recomputeGroups(): void {
    if (!this.documentUri) {
      this.pathGroups = [];
      this.attributeGroups = [];
      this.pairGroups = [];
      this.valueGroups = [];
      this.changeEmitter.fire();
      return;
    }
    const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === this.documentUri!.toString());
    if (!doc) {
      this.pathGroups = [];
      this.attributeGroups = [];
      this.pairGroups = [];
      this.valueGroups = [];
      this.changeEmitter.fire();
      return;
    }
    const model = parseJsonModel(doc.getText());
    if (!model.root) {
      this.pathGroups = [];
      this.attributeGroups = [];
      this.pairGroups = [];
      this.valueGroups = [];
    } else {
      this.pathGroups = findDuplicateKeys(model.root, this.ignoreSet);
      this.attributeGroups = findDuplicatedAttributes(model.root);
      this.pairGroups = findDuplicatedPairs(model.root);
      this.valueGroups = findDuplicatedValues(model.root);
    }
    this.changeEmitter.fire();
  }

  getTreeItem(element: DuplicateKeyNode): vscode.TreeItem {
    if (element.kind === 'category') {
      const item = new vscode.TreeItem(element.displayName, vscode.TreeItemCollapsibleState.Collapsed);
      item.id = `dup-category:${element.category}`;
      item.description = `${element.count} items`;
      item.iconPath = new vscode.ThemeIcon('list-unordered');
      return item;
    }

    if (element.kind === 'path-group') {
      const item = new vscode.TreeItem(element.group.keyName, vscode.TreeItemCollapsibleState.Expanded);
      item.id = `dup-path-group:${element.group.path}`;
      item.description = `${element.group.path} — ${element.group.occurrences.length} occurrences`;
      item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
      item.contextValue = 'jsonTools.duplicateGroup';
      item.tooltip = `Duplicate key "${element.group.keyName}" at path: ${element.group.path}`;
      return item;
    }

    if (element.kind === 'attribute-group') {
      const item = new vscode.TreeItem(element.group.attribute, vscode.TreeItemCollapsibleState.Expanded);
      item.id = `dup-attr-group:${element.group.attribute}`;
      item.description = `${element.group.paths.length} paths — ${element.group.occurrences.length} occurrences`;
      item.iconPath = new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('list.warningForeground'));
      item.tooltip = `Attribute "${element.group.attribute}" found in: ${element.group.paths.join(', ')}`;
      item.contextValue = 'jsonTools.duplicateGroup';
      return item;
    }

    if (element.kind === 'pair-group') {
      const label = `${element.group.key}: ${element.group.value}`;
      const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
      item.id = `dup-pair-group:${element.group.key}:${element.group.value}`;
      item.description = `${element.group.occurrences.length} occurrences`;
      item.iconPath = new vscode.ThemeIcon('layers', new vscode.ThemeColor('list.warningForeground'));
      item.contextValue = 'jsonTools.duplicateGroup';
      return item;
    }

    if (element.kind === 'value-group') {
      const item = new vscode.TreeItem(element.group.value, vscode.TreeItemCollapsibleState.Expanded);
      item.id = `dup-value-group:${element.group.value}`;
      item.description = `${element.group.occurrences.length} occurrences`;
      item.iconPath = new vscode.ThemeIcon('symbol-value', new vscode.ThemeColor('list.warningForeground'));
      item.contextValue = 'jsonTools.duplicateGroup';
      return item;
    }

    const item = new vscode.TreeItem(element.occurrence.valuePreview, vscode.TreeItemCollapsibleState.None);
    item.id = `dup-occ:${element.occurrence.fullPath}:${element.occurrence.keyNode.offset}`;
    item.description = `#${element.index + 1} — ${element.occurrence.fullPath}`;
    item.iconPath = new vscode.ThemeIcon('circle-small-filled');
    item.contextValue = 'jsonTools.duplicateOccurrence';
    item.command = {
      command: 'jsonTools.duplicateKeys.revealOccurrence',
      title: 'Reveal in Editor',
      arguments: [element],
    };
    return item;
  }

  getChildren(element?: DuplicateKeyNode): DuplicateKeyNode[] {
    if (!element) {
      const categories: DuplicateKeyNode[] = [];
      if (this.pathGroups.length > 0) {
        categories.push({ kind: 'category', category: 'paths', displayName: 'Duplicated Paths', count: this.pathGroups.length });
      }
      if (this.attributeGroups.length > 0) {
        categories.push({ kind: 'category', category: 'attributes', displayName: 'Duplicated Attributes', count: this.attributeGroups.length });
      }
      if (this.pairGroups.length > 0) {
        categories.push({ kind: 'category', category: 'pairs', displayName: 'Duplicated Pairs', count: this.pairGroups.length });
      }
      if (this.valueGroups.length > 0) {
        categories.push({ kind: 'category', category: 'values', displayName: 'Duplicated Values', count: this.valueGroups.length });
      }
      return categories;
    }

    if (element.kind === 'category') {
      switch (element.category) {
        case 'paths':
          return this.pathGroups.map((group) => ({ kind: 'path-group' as const, group }));
        case 'attributes':
          return this.attributeGroups.map((group) => ({ kind: 'attribute-group' as const, group }));
        case 'pairs':
          return this.pairGroups.map((group) => ({ kind: 'pair-group' as const, group }));
        case 'values':
          return this.valueGroups.map((group) => ({ kind: 'value-group' as const, group }));
      }
    }

    if (element.kind === 'path-group' || element.kind === 'attribute-group' || element.kind === 'pair-group' || element.kind === 'value-group') {
      const group = element.group;
      return group.occurrences.map((occurrence, index) => ({
        kind: 'occurrence' as const,
        occurrence,
        index,
      }));
    }

    return [];
  }
}

export function registerDuplicateKeyView(context: vscode.ExtensionContext, _logger: Logger): void {
  const provider = new DuplicateKeyProvider(context.workspaceState);

  vscode.window.createTreeView(DUPLICATE_KEYS_VIEW_ID, {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  const refreshFromActiveEditor = () => provider.setDocument(vscode.window.activeTextEditor?.document);
  refreshFromActiveEditor();

  const debouncedRefresh = debounce(refreshFromActiveEditor, getOutlineDebounceMs());

  const ignoreCommand = vscode.commands.registerCommand(
    'jsonTools.duplicateKeys.ignore',
    (node: DuplicateKeyNode) => {
      if (node?.kind !== 'path-group') {
        return;
      }
      provider.ignore(node.group.path);
    }
  );

  const revealCommand = vscode.commands.registerCommand(
    'jsonTools.duplicateKeys.revealOccurrence',
    async (node: DuplicateKeyNode) => {
      if (node?.kind !== 'occurrence') {
        return;
      }
      const uri = provider.getActiveDocumentUri();
      if (!uri) {
        return;
      }
      const editor =
        vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === uri.toString()) ??
        (await vscode.window.showTextDocument(uri));
      revealRange(editor, node.occurrence.keyRange);
    }
  );

  const manageIgnoreListCommand = vscode.commands.registerCommand(
    'jsonTools.duplicateKeys.manageIgnoreList',
    async () => {
      const ignoreList = provider.getIgnoreList();
      if (ignoreList.length === 0) {
        vscode.window.showInformationMessage('JSON Tools: Ignore list is empty.');
        return;
      }

      const picks = ignoreList.map((path) => ({ label: path }));
      const selected = await vscode.window.showQuickPick(picks, {
        canPickMany: true,
        title: 'JSON Tools: Ignored Duplicates — select entries to remove',
        placeHolder: 'Select entries to remove from the ignore list',
      });

      if (selected && selected.length > 0) {
        provider.removeFromIgnoreList(selected.map((s) => s.label));
      }
    }
  );

  const mergeInstructionCommand = vscode.commands.registerCommand(
    'jsonTools.duplicateKeys.createMergeInstruction',
    async (node: DuplicateKeyNode) => {
      const uri = provider.getActiveDocumentUri();
      if (!uri) {
        return;
      }
      const instruction = generateMergeInstruction(node, uri);
      if (!instruction) {
        return;
      }
      await vscode.env.clipboard.writeText(instruction);
      vscode.window.showInformationMessage('Merge instruction copied to clipboard');
    }
  );

  context.subscriptions.push(
    ignoreCommand,
    revealCommand,
    manageIgnoreListCommand,
    mergeInstructionCommand,
    vscode.window.onDidChangeActiveTextEditor(refreshFromActiveEditor),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === provider.getActiveDocumentUri()?.toString()) {
        debouncedRefresh();
      }
    })
  );
}

function generateMergeInstruction(node: DuplicateKeyNode, fileUri: vscode.Uri): string | null {
  const filePath = fileUri.fsPath;
  const config = vscode.workspace.getConfiguration('jsonTools.duplicateKeys');

  if (node.kind === 'path-group') {
    const group = node.group;
    const locations = group.occurrences
      .map((occ) => `  - ${filePath}:${occ.fullPath}`)
      .join('\n');
    const template = config.get<string>('mergeInstructionTemplates.pathGroup') ||
      'File: {filePath}\n\nMerge duplicate key "{keyName}" found at multiple locations:\n{locations}\n\nConsider refactoring to eliminate duplication by:\n- Creating a shared reference\n- Extracting to a common parent object\n- Using a data structure that deduplicates this key';

    return template
      .replace('{filePath}', filePath)
      .replace('{keyName}', group.keyName)
      .replace('{locations}', locations);
  }

  if (node.kind === 'attribute-group') {
    const group = node.group;
    const locations = group.occurrences
      .map((occ) => `  - ${filePath}:${occ.fullPath}`)
      .join('\n');
    const template = config.get<string>('mergeInstructionTemplates.attributeGroup') ||
      'File: {filePath}\n\nMerge duplicated attribute "{attribute}" found in {pathCount} different locations:\n{locations}\n\nConsider refactoring to:\n- Extract the attribute to a shared parent\n- Create a template or base object\n- Use composition to avoid repetition';

    return template
      .replace('{filePath}', filePath)
      .replace('{attribute}', group.attribute)
      .replace('{pathCount}', String(group.paths.length))
      .replace('{locations}', locations);
  }

  if (node.kind === 'pair-group') {
    const group = node.group;
    const locations = group.occurrences
      .map((occ) => `  - ${filePath}:${occ.fullPath}`)
      .join('\n');
    const template = config.get<string>('mergeInstructionTemplates.pairGroup') ||
      'File: {filePath}\n\nMerge duplicated pair "{key}: {value}" found at {occurrenceCount} locations:\n{locations}\n\nConsider refactoring to:\n- Extract to a shared constant or reference\n- Use a single definition referenced multiple times\n- Consolidate into a lookup table';

    return template
      .replace('{filePath}', filePath)
      .replace('{key}', group.key)
      .replace('{value}', group.value)
      .replace('{occurrenceCount}', String(group.occurrences.length))
      .replace('{locations}', locations);
  }

  if (node.kind === 'value-group') {
    const group = node.group;
    const locations = group.occurrences
      .map((occ) => `  - ${filePath}:${occ.fullPath}`)
      .join('\n');
    const template = config.get<string>('mergeInstructionTemplates.valueGroup') ||
      'File: {filePath}\n\nMerge duplicated value "{value}" found at {occurrenceCount} locations:\n{locations}\n\nConsider refactoring to:\n- Replace with a reference to a shared value\n- Create a constants object\n- Use variable substitution';

    return template
      .replace('{filePath}', filePath)
      .replace('{value}', group.value)
      .replace('{occurrenceCount}', String(group.occurrences.length))
      .replace('{locations}', locations);
  }

  return null;
}
