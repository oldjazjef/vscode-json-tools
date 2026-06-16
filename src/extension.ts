import * as vscode from 'vscode';
import { registerPathSearchCommand } from './features/pathSearch/pathSearchCommand';
import { registerFindReferencesCommands } from './features/referenceFinder/referenceResultsProvider';
import { registerJsonOutlineView } from './features/treeView/jsonOutlineProvider';
import { registerOutlineSearchCommands } from './features/treeView/treeViewSearchController';
import { Logger } from './util/logger';

let logger: Logger | undefined;

export function activate(context: vscode.ExtensionContext): void {
  logger = new Logger('JSON Tools');
  context.subscriptions.push(logger);

  registerPathSearchCommand(context, logger);

  const outlineProvider = registerJsonOutlineView(context);
  registerOutlineSearchCommands(context, outlineProvider);

  registerFindReferencesCommands(context, logger);

  logger.info('JSON Tools extension activated.');
}

export function deactivate(): void {
  logger?.info('JSON Tools extension deactivated.');
}
