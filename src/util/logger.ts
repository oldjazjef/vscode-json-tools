import * as vscode from 'vscode';

/**
 * Thin wrapper around a dedicated VSCode output channel so the rest of the
 * extension never talks to `vscode.window` directly just to log something.
 */
export class Logger {
  private readonly channel: vscode.OutputChannel;

  constructor(name: string) {
    this.channel = vscode.window.createOutputChannel(name);
  }

  info(message: string): void {
    this.channel.appendLine(`[info] ${message}`);
  }

  warn(message: string): void {
    this.channel.appendLine(`[warn] ${message}`);
  }

  error(message: string, error?: unknown): void {
    const detail = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error ?? '');
    this.channel.appendLine(`[error] ${message}${detail ? ` — ${detail}` : ''}`);
  }

  dispose(): void {
    this.channel.dispose();
  }
}
