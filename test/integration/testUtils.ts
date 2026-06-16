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
