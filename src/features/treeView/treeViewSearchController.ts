import * as vscode from 'vscode';
import { getOutlineDebounceMs } from '../../config/settings';
import { debounce } from '../../util/debounce';
import { JsonOutlineProvider } from './jsonOutlineProvider';

/**
 * Registers `jsonTools.outline.search` / `jsonTools.outline.clearSearch`.
 * Uses `createInputBox` (rather than `showInputBox`) so the filter updates
 * live as the user types, debounced to avoid rebuilding the tree on every
 * keystroke — but the value is always applied immediately, un-debounced,
 * on accept/hide so the final keystroke is never lost to a pending timer.
 */
export function registerOutlineSearchCommands(context: vscode.ExtensionContext, provider: JsonOutlineProvider): void {
  const searchCommand = vscode.commands.registerCommand('jsonTools.outline.search', () => {
    const inputBox = vscode.window.createInputBox();
    inputBox.title = 'JSON Tools: Filter Outline';
    inputBox.placeholder = 'Filter by key, index, or value...';
    inputBox.value = provider.getFilterText();

    const applyFilterDebounced = debounce((text: string) => provider.setFilterText(text), getOutlineDebounceMs());

    inputBox.onDidChangeValue((value) => applyFilterDebounced(value));
    inputBox.onDidAccept(() => {
      provider.setFilterText(inputBox.value);
      inputBox.hide();
    });
    inputBox.onDidHide(() => {
      provider.setFilterText(inputBox.value);
      inputBox.dispose();
    });
    inputBox.show();
  });

  const clearCommand = vscode.commands.registerCommand('jsonTools.outline.clearSearch', () => {
    provider.setFilterText('');
  });

  context.subscriptions.push(searchCommand, clearCommand);
}
