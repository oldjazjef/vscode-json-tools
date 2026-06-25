import * as vscode from 'vscode';

/**
 * Manages the list of JSON files currently open in the outline sidebar.
 * Tracks "active" file (currently displayed) and "pinned" files (persistent list).
 */
export class JsonFileManager {
  private activeUri: vscode.Uri | undefined;
  private pinnedUris: vscode.Uri[] = [];
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changeEmitter.event;

  private storageKey = 'jsonTools.pinnedFiles';

  constructor(context: vscode.ExtensionContext) {
    this.loadPinnedFiles(context);
  }

  /**
   * Get the currently active file URI (the one being displayed in the outline).
   */
  getActiveUri(): vscode.Uri | undefined {
    return this.activeUri;
  }

  /**
   * Set the active file URI.
   */
  setActiveUri(uri: vscode.Uri | undefined): void {
    this.activeUri = uri;
    this.changeEmitter.fire();
  }

  /**
   * Get all currently open files (active + pinned).
   */
  getOpenUris(): vscode.Uri[] {
    const uris = [...this.pinnedUris];
    if (this.activeUri && !uris.some((u) => u.toString() === this.activeUri!.toString())) {
      uris.unshift(this.activeUri);
    }
    return uris;
  }

  /**
   * Get pinned files.
   */
  getPinnedUris(): vscode.Uri[] {
    return [...this.pinnedUris];
  }

  /**
   * Pin a file (add to persistent list).
   */
  pinUri(uri: vscode.Uri, context: vscode.ExtensionContext): void {
    const uriStr = uri.toString();
    if (!this.pinnedUris.some((u) => u.toString() === uriStr)) {
      this.pinnedUris.push(uri);
      this.savePinnedFiles(context);
      this.changeEmitter.fire();
    }
  }

  /**
   * Unpin a file (remove from persistent list).
   */
  unpinUri(uri: vscode.Uri, context: vscode.ExtensionContext): void {
    const uriStr = uri.toString();
    this.pinnedUris = this.pinnedUris.filter((u) => u.toString() !== uriStr);
    // If unpinning the active file, switch to another one.
    if (this.activeUri?.toString() === uriStr) {
      this.activeUri = this.pinnedUris[0] || undefined;
    }
    this.savePinnedFiles(context);
    this.changeEmitter.fire();
  }

  /**
   * Check if a file is pinned.
   */
  isPinned(uri: vscode.Uri): boolean {
    return this.pinnedUris.some((u) => u.toString() === uri.toString());
  }

  /**
   * Clear all open files.
   */
  clear(): void {
    this.activeUri = undefined;
    this.changeEmitter.fire();
  }

  private savePinnedFiles(context: vscode.ExtensionContext): void {
    const uris = this.pinnedUris.map((u) => u.toString());
    context.workspaceState.update(this.storageKey, uris);
  }

  private loadPinnedFiles(context: vscode.ExtensionContext): void {
    const uris = context.workspaceState.get<string[]>(this.storageKey, []);
    this.pinnedUris = uris.map((u) => vscode.Uri.parse(u));
    // Set first pinned file as active if available.
    if (this.pinnedUris.length > 0) {
      this.activeUri = this.pinnedUris[0];
    }
  }
}
