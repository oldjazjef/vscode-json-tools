// This file lives under a folder excluded via the fixture workspace's
// files.exclude/search.exclude settings (test/integration/fixtures/.vscode/settings.json)
// on purpose: the reference finder must NOT report this match, since
// vscode.workspace.findFiles applies those as its default exclude when
// no explicit exclude glob is passed.
export const planted = (config: any) => config.path1.path2.path3;
