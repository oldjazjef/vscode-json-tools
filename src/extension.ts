import * as vscode from 'vscode';
import { Logger } from './util/logger';

let logger: Logger | undefined;

export function activate(context: vscode.ExtensionContext): void {
  logger = new Logger('JSON Tools');
  logger.info('JSON Tools extension activated.');
  context.subscriptions.push(logger);
}

export function deactivate(): void {
  logger?.info('JSON Tools extension deactivated.');
}
