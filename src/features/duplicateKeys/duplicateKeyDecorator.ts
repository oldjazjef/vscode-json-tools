import * as vscode from 'vscode';
import { parseJsonModel } from '../../core/jsonModel';
import { getJsonLanguageIds, getOutlineDebounceMs } from '../../config/settings';
import { debounce } from '../../util/debounce';
import { Logger } from '../../util/logger';
import { findDuplicateKeys, findDuplicatedAttributes, findDuplicatedPairs } from './duplicateKeyDetector';

// SVG icons as data URIs
const WARNING_ICON = 'data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22%3E%3Cpath fill=%22%23f48771%22 d=%22M8 1l7 13H1z%22/%3E%3C/svg%3E';
const LAYERS_ICON = 'data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22%3E%3Crect x=%222%22 y=%222%22 width=%2210%22 height=%228%22 fill=%22none%22 stroke=%22%23f48771%22 stroke-width=%221%22/%3E%3Crect x=%224%22 y=%226%22 width=%2210%22 height=%228%22 fill=%22none%22 stroke=%22%23f48771%22 stroke-width=%221%22/%3E%3C/svg%3E';
const CIRCLE_ICON = 'data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22%3E%3Ccircle cx=%228%22 cy=%228%22 r=%226%22 fill=%22none%22 stroke=%22%2385bbf0%22 stroke-width=%221%22/%3E%3C/svg%3E';

export function registerDuplicateKeyDecorator(context: vscode.ExtensionContext, _logger: Logger): void {
  // Decoration type for duplicated paths (same key under same parent)
  const pathDecorator = vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.parse(WARNING_ICON),
    gutterIconSize: 'contain',
  });

  // Decoration type for duplicated pairs (same key AND same value in different places)
  const pairDecorator = vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.parse(LAYERS_ICON),
    gutterIconSize: 'contain',
  });

  // Decoration type for duplicated attributes (same key name in different paths)
  const attributeDecorator = vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.parse(CIRCLE_ICON),
    gutterIconSize: 'contain',
  });

  const ignoreSet: Set<string> = new Set();

  const updateDecorations = (editor: vscode.TextEditor | undefined) => {
    if (!editor || !getJsonLanguageIds().includes(editor.document.languageId)) {
      editor?.setDecorations(pathDecorator, []);
      editor?.setDecorations(pairDecorator, []);
      editor?.setDecorations(attributeDecorator, []);
      return;
    }

    const model = parseJsonModel(editor.document.getText());
    if (!model.root) {
      editor.setDecorations(pathDecorator, []);
      editor.setDecorations(pairDecorator, []);
      editor.setDecorations(attributeDecorator, []);
      return;
    }

    // Get all three types of duplications
    const duplicatePathGroups = findDuplicateKeys(model.root, ignoreSet);
    const duplicateAttributeGroups = findDuplicatedAttributes(model.root);
    const duplicatePairGroups = findDuplicatedPairs(model.root);

    // Build a map of occurrence offsets to their decoration types
    const occurrenceMap = new Map<number, Set<string>>();

    // Add duplicated paths
    for (const group of duplicatePathGroups) {
      for (const occurrence of group.occurrences) {
        const key = occurrence.keyRange.offset;
        if (!occurrenceMap.has(key)) {
          occurrenceMap.set(key, new Set());
        }
        occurrenceMap.get(key)!.add('path');
      }
    }

    // Add duplicated pairs
    for (const group of duplicatePairGroups) {
      for (const occurrence of group.occurrences) {
        const key = occurrence.keyRange.offset;
        if (!occurrenceMap.has(key)) {
          occurrenceMap.set(key, new Set());
        }
        occurrenceMap.get(key)!.add('pair');
      }
    }

    // Add duplicated attributes
    for (const group of duplicateAttributeGroups) {
      for (const occurrence of group.occurrences) {
        const key = occurrence.keyRange.offset;
        if (!occurrenceMap.has(key)) {
          occurrenceMap.set(key, new Set());
        }
        occurrenceMap.get(key)!.add('attribute');
      }
    }

    // Create decorations for each type
    const pathDecorations: vscode.DecorationOptions[] = [];
    const pairDecorations: vscode.DecorationOptions[] = [];
    const attributeDecorations: vscode.DecorationOptions[] = [];

    for (const [offset, types] of occurrenceMap) {
      const line = editor.document.positionAt(offset).line;
      const range = new vscode.Range(line, 0, line, 0);

      // Build hover message based on types
      const messages: string[] = [];
      if (types.has('path')) {
        messages.push('Duplicated path: key appears multiple times at same location');
      }
      if (types.has('pair')) {
        messages.push('Duplicated pair: same key-value appears elsewhere');
      }
      if (types.has('attribute')) {
        messages.push('Duplicated attribute: key appears in multiple different paths');
      }

      const hoverMessage = messages.join('\n');

      if (types.has('path')) {
        pathDecorations.push({ range, hoverMessage });
      }
      if (types.has('pair')) {
        pairDecorations.push({ range, hoverMessage });
      }
      if (types.has('attribute')) {
        attributeDecorations.push({ range, hoverMessage });
      }
    }

    editor.setDecorations(pathDecorator, pathDecorations);
    editor.setDecorations(pairDecorator, pairDecorations);
    editor.setDecorations(attributeDecorator, attributeDecorations);
  };

  const updateActiveEditor = () => updateDecorations(vscode.window.activeTextEditor);
  const debouncedUpdate = debounce(updateActiveEditor, getOutlineDebounceMs());

  updateActiveEditor();

  context.subscriptions.push(
    pathDecorator,
    pairDecorator,
    attributeDecorator,
    vscode.window.onDidChangeActiveTextEditor(updateActiveEditor),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document === vscode.window.activeTextEditor?.document) {
        debouncedUpdate();
      }
    })
  );
}
