import * as vscode from 'vscode';
import { Node } from 'jsonc-parser';
import { getCompletionSettings, getRegisteredCompletionFiles } from '../../config/settings';
import { parseJsonModel } from '../../core/jsonModel';
import { debounce } from '../../util/debounce';

const CONCURRENCY = 8;
const NUL_CHARACTER = String.fromCharCode(0);

/**
 * Manages a persistent, workspace-wide index of JSON roots parsed from files
 * matching the completion settings' include/exclude globs. Built on first use
 * and kept up-to-date via file-system watcher. Cancellable but not cancellation-aware
 * since completion builds are tied to user keystrokes and should run to completion
 * without interruption (unlike reference scans which may span many files).
 */
export class JsonKeyIndexService implements vscode.Disposable {
  private readonly rootsByUri = new Map<string, Node | undefined>();
  private built = false;
  private watcher: vscode.FileSystemWatcher | undefined;
  private disposables: vscode.Disposable[] = [];

  /** Lazily builds the full index on first call; no-op on subsequent calls unless invalidated. */
  async ensureBuilt(): Promise<void> {
    if (this.built) {
      return;
    }

    const settings = getCompletionSettings();
    const globFiles = await vscode.workspace.findFiles(settings.include, settings.exclude || undefined);

    // Also include manually registered files.
    const registeredPaths = getRegisteredCompletionFiles();
    const registeredFiles = registeredPaths.map((path) => vscode.Uri.file(path));
    const allFiles = [...globFiles, ...registeredFiles];

    this.rootsByUri.clear();

    let nextFileIndex = 0;

    const worker = async (): Promise<void> => {
      while (nextFileIndex < allFiles.length) {
        const uri = allFiles[nextFileIndex++];
        try {
          const bytes = await vscode.workspace.fs.readFile(uri);
          const text = Buffer.from(bytes).toString('utf8');
          if (!looksLikeBinary(text)) {
            const model = parseJsonModel(text);
            this.rootsByUri.set(uri.toString(), model.root);
          }
        } catch {
          // Unreadable file — skip silently.
        }
      }
    };

    const workerCount = Math.min(CONCURRENCY, allFiles.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    this.setupWatcher(settings.include);
    this.built = true;
  }

  /** All cached roots (parsed AST), keyed by uri.toString(). */
  getRoots(): Map<string, Node | undefined> {
    return this.rootsByUri;
  }

  private setupWatcher(includeGlob: string): void {
    if (this.watcher) {
      this.watcher.dispose();
    }

    this.watcher = vscode.workspace.createFileSystemWatcher(includeGlob);

    const debouncedRebuild = debounce((uri: vscode.Uri) => this.rebuildUri(uri), 300);

    this.watcher.onDidCreate((uri) => {
      debouncedRebuild(uri);
    });

    this.watcher.onDidChange((uri) => {
      debouncedRebuild(uri);
    });

    this.watcher.onDidDelete((uri) => {
      this.rootsByUri.delete(uri.toString());
    });

    this.disposables.push(this.watcher);

    // Reload the index if completion settings change.
    const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('jsonTools.completion')) {
        this.built = false;
        this.rootsByUri.clear();
        if (this.watcher) {
          this.watcher.dispose();
        }
        this.watcher = undefined;
      }
    });

    this.disposables.push(configListener);
  }

  private async rebuildUri(uri: vscode.Uri): Promise<void> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(bytes).toString('utf8');
      if (!looksLikeBinary(text)) {
        const model = parseJsonModel(text);
        this.rootsByUri.set(uri.toString(), model.root);
      }
    } catch {
      // Unreadable file — remove from index.
      this.rootsByUri.delete(uri.toString());
    }
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
    if (this.watcher) {
      this.watcher.dispose();
    }
  }
}

function looksLikeBinary(text: string): boolean {
  return text.includes(NUL_CHARACTER);
}

export function createJsonKeyIndexService(): JsonKeyIndexService {
  return new JsonKeyIndexService();
}
