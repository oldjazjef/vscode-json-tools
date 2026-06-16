import * as vscode from 'vscode';
import { PathSegment } from '../../core/pathQuery';
import { getReferenceFinderSettings } from '../../config/settings';
import { ReferenceMatch, scanTextForPathReferences } from './referenceScanner';

export interface FileReferenceMatch extends ReferenceMatch {
  readonly uri: vscode.Uri;
}

export interface ScanProgress {
  readonly filesScanned: number;
  readonly totalFiles: number;
}

export interface ScanOptions {
  readonly token?: vscode.CancellationToken;
  readonly onProgress?: (progress: ScanProgress) => void;
}

const CONCURRENCY = 8;
/** A NUL character strongly suggests binary content slipped through the include glob; `String.fromCharCode` avoids embedding a literal NUL byte in this source file. */
const NUL_CHARACTER = String.fromCharCode(0);

/**
 * Finds candidate files via `vscode.workspace.findFiles` (which already
 * honors `files.exclude`/`search.exclude`/`.gitignore` when no explicit
 * exclude glob is given), reads each with `workspace.fs.readFile` (so
 * matches aren't forced into the open-document tracking machinery), and
 * runs the pure regex scanner over its contents. Concurrency-limited and
 * cancellable so a large workspace can't stall the UI indefinitely.
 */
export async function scanWorkspaceForPathReferences(
  pathSegments: readonly PathSegment[],
  options: ScanOptions = {}
): Promise<FileReferenceMatch[]> {
  const settings = getReferenceFinderSettings();
  const files = await vscode.workspace.findFiles(settings.include, settings.exclude || undefined, undefined, options.token);

  const results: FileReferenceMatch[] = [];
  let nextFileIndex = 0;
  let filesScanned = 0;

  async function worker(): Promise<void> {
    while (nextFileIndex < files.length) {
      if (options.token?.isCancellationRequested || results.length >= settings.maxResults) {
        return;
      }
      const uri = files[nextFileIndex++];
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(bytes).toString('utf8');
        if (!looksLikeBinary(text)) {
          const matches = scanTextForPathReferences(text, pathSegments, {
            accessorFunctionNames: settings.accessorFunctionNames,
          });
          for (const match of matches) {
            results.push({ ...match, uri });
          }
        }
      } catch {
        // Unreadable file (permissions, deleted between findFiles and readFile, etc.) — skip silently.
      } finally {
        filesScanned++;
        options.onProgress?.({ filesScanned, totalFiles: files.length });
      }
    }
  }

  const workerCount = Math.min(CONCURRENCY, files.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results.slice(0, settings.maxResults);
}

function looksLikeBinary(text: string): boolean {
  return text.includes(NUL_CHARACTER);
}
