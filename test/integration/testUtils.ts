import * as path from 'path';
import * as vscode from 'vscode';

// Compiled location is out/test/integration/testUtils.js; walk back up to the
// repo root (out/test/integration -> out/test -> out -> repo root) and back
// down into the *source* fixtures folder, since fixtures are static files
// that tsc never copies into out/.
const FIXTURES_ROOT = path.join(__dirname, '..', '..', '..', 'test', 'integration', 'fixtures');

export function fixtureUri(...segments: string[]): vscode.Uri {
  return vscode.Uri.file(path.join(FIXTURES_ROOT, ...segments));
}

export async function openFixture(...segments: string[]): Promise<vscode.TextEditor> {
  const document = await vscode.workspace.openTextDocument(fixtureUri(...segments));
  return vscode.window.showTextDocument(document);
}

const EXTENSION_ID = 'oldjazjef.json-assistant';

/**
 * Ensures the extension is activated (commands registered) before a test
 * calls `vscode.commands.executeCommand`. `onStartupFinished` normally
 * handles this, but explicitly awaiting activation here removes any
 * dependency on that event's timing relative to test start.
 */
export async function activateExtension(): Promise<void> {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  if (!extension) {
    throw new Error(`Extension "${EXTENSION_ID}" was not found among loaded extensions.`);
  }
  if (!extension.isActive) {
    await extension.activate();
  }
}
