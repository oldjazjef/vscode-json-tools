import * as vscode from 'vscode';

/** Typed wrapper over `vscode.workspace.getConfiguration('jsonTools')` so callers never hand-roll keys/defaults. */
function config(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('jsonTools');
}

export function getJsonLanguageIds(): string[] {
  return config().get<string[]>('languageIds', ['json', 'jsonc']);
}

export function getOutlineDebounceMs(): number {
  return config().get<number>('outline.debounceMs', 150);
}

export interface ReferenceFinderSettings {
  include: string;
  exclude: string;
  maxResults: number;
  accessorFunctionNames: string[];
}

export function getReferenceFinderSettings(): ReferenceFinderSettings {
  const cfg = config();
  return {
    include: cfg.get<string>('referenceFinder.include', '**/*.{js,jsx,ts,tsx,py,go,rb,java,cs,php}'),
    exclude: cfg.get<string>('referenceFinder.exclude', ''),
    maxResults: cfg.get<number>('referenceFinder.maxResults', 500),
    accessorFunctionNames: cfg.get<string[]>('referenceFinder.accessorFunctionNames', ['get', 't', 'i18n.t', '_.get']),
  };
}
