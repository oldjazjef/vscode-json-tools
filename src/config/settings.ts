import * as vscode from 'vscode';

/** Default glob excluded from workspace scans unless the user overrides it — keeps node_modules/build output out of reference scans and the jt: completion index by default. */
export const DEFAULT_SCAN_EXCLUDE_GLOB = '**/{node_modules,dist,build,out}/**';

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
    exclude: cfg.get<string>('referenceFinder.exclude', DEFAULT_SCAN_EXCLUDE_GLOB),
    maxResults: cfg.get<number>('referenceFinder.maxResults', 500),
    accessorFunctionNames: cfg.get<string[]>('referenceFinder.accessorFunctionNames', ['get', 't', 'i18n.t', '_.get']),
  };
}

export interface CompletionSettings {
  include: string;
  exclude: string;
}

export function getCompletionSettings(): CompletionSettings {
  const cfg = config();
  return {
    include: cfg.get<string>('completion.include', '**/*.{json,jsonc}'),
    exclude: cfg.get<string>('completion.exclude', DEFAULT_SCAN_EXCLUDE_GLOB),
  };
}

export function getRegisteredCompletionFiles(): string[] {
  const cfg = config();
  return cfg.get<string[]>('completion.registeredFiles', []);
}

export function addRegisteredCompletionFile(filePath: string): void {
  const cfg = config();
  const current = cfg.get<string[]>('completion.registeredFiles', []);
  if (!current.includes(filePath)) {
    cfg.update('completion.registeredFiles', [...current, filePath], vscode.ConfigurationTarget.Workspace);
  }
}

export function removeRegisteredCompletionFile(filePath: string): void {
  const cfg = config();
  const current = cfg.get<string[]>('completion.registeredFiles', []);
  cfg.update('completion.registeredFiles', current.filter((f) => f !== filePath), vscode.ConfigurationTarget.Workspace);
}
