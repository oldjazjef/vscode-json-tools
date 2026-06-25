import * as vscode from 'vscode';
import { registerPathSearchCommand } from './features/pathSearch/pathSearchCommand';
import { registerFindReferencesCommands } from './features/referenceFinder/referenceResultsProvider';
import { registerJsonOutlineView } from './features/treeView/jsonOutlineProvider';
import { registerOutlineSearchCommands } from './features/treeView/treeViewSearchController';
import { registerDuplicateKeyView } from './features/duplicateKeys/duplicateKeyProvider';
import { registerDuplicateKeyDecorator } from './features/duplicateKeys/duplicateKeyDecorator';
import { registerJsonKeyCompletionProvider } from './features/completion/jsonKeyCompletionProvider';
import { addRegisteredCompletionFile } from './config/settings';
import { getJsonLanguageIds } from './config/settings';
import { JsonFileManager } from './features/treeView/jsonFileManager';
import { Logger } from './util/logger';

let logger: Logger | undefined;
let fileManager: JsonFileManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
  logger = new Logger('JSON Tools');
  context.subscriptions.push(logger);

  fileManager = new JsonFileManager(context);

  registerPathSearchCommand(context, logger);

  const outlineProvider = registerJsonOutlineView(context, fileManager!);
  registerOutlineSearchCommands(context, outlineProvider);

  registerFindReferencesCommands(context, logger);
  registerDuplicateKeyView(context, logger, fileManager!);
  registerDuplicateKeyDecorator(context, logger);
  registerJsonKeyCompletionProvider(context);

  // Register command to manually register JSON files for autocomplete.
  context.subscriptions.push(
    vscode.commands.registerCommand('jsonTools.registerForAutoComplete', async (resource?: vscode.Uri) => {
      let fileUri = resource;

      // If no resource is provided, use the active editor's document.
      if (!fileUri && vscode.window.activeTextEditor) {
        fileUri = vscode.window.activeTextEditor.document.uri;
      }

      if (!fileUri) {
        vscode.window.showErrorMessage('No JSON file selected. Please right-click a JSON file to register it.');
        return;
      }

      const document = await vscode.workspace.openTextDocument(fileUri);
      const languageId = document.languageId;

      if (languageId !== 'json' && languageId !== 'jsonc') {
        vscode.window.showErrorMessage(`File is not a JSON file (language: ${languageId}).`);
        return;
      }

      const filePath = fileUri.fsPath;
      addRegisteredCompletionFile(filePath);

      vscode.window.showInformationMessage(`Registered "${fileUri.fsPath}" for jt: autocomplete.`);
    })
  );

  // Pin/unpin current JSON file in the sidebar.
  context.subscriptions.push(
    vscode.commands.registerCommand('jsonTools.outline.pinFile', async (resource?: vscode.Uri) => {
      let fileUri = resource;

      if (!fileUri && vscode.window.activeTextEditor) {
        fileUri = vscode.window.activeTextEditor.document.uri;
      }

      if (!fileUri) {
        return;
      }

      const document = await vscode.workspace.openTextDocument(fileUri);
      const isJsonLanguageId = getJsonLanguageIds().includes(document.languageId);
      const isJsonFile = fileUri.fsPath.endsWith('.json') || fileUri.fsPath.endsWith('.jsonc');

      if (!isJsonLanguageId && !isJsonFile) {
        vscode.window.showErrorMessage('Only JSON/JSONC files can be pinned.');
        return;
      }

      fileManager!.pinUri(fileUri, context);
      vscode.window.showInformationMessage(`Pinned "${fileUri.fsPath}" in JSON outline.`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jsonTools.outline.unpinFile', async (resource?: vscode.Uri) => {
      let fileUri = resource;

      if (!fileUri && vscode.window.activeTextEditor) {
        fileUri = vscode.window.activeTextEditor.document.uri;
      }

      if (!fileUri) {
        return;
      }

      fileManager!.unpinUri(fileUri, context);
      vscode.window.showInformationMessage('Unpinned file from JSON outline.');
    })
  );

  // Open a JSON file picker and pin it.
  context.subscriptions.push(
    vscode.commands.registerCommand('jsonTools.outline.openJsonFile', async () => {
      const files = await vscode.workspace.findFiles('**/*.{json,jsonc}', '**/node_modules/**', 100);

      if (files.length === 0) {
        vscode.window.showInformationMessage('No JSON files found in the workspace.');
        return;
      }

      const items = files.map((uri) => ({
        label: vscode.workspace.asRelativePath(uri),
        description: uri.fsPath,
        uri,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a JSON file to pin in the outline',
        matchOnDetail: true,
      });

      if (selected) {
        fileManager!.pinUri(selected.uri, context);
        vscode.window.showInformationMessage(`Pinned "${selected.label}" in JSON outline.`);
      }
    })
  );

  logger.info('JSON Tools extension activated.');
}

export function deactivate(): void {
  logger?.info('JSON Tools extension deactivated.');
}
