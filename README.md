# JSON Tools

[![CI](https://github.com/oldjazjef/vscode-json-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/oldjazjef/vscode-json-tools/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/oldjazjef/vscode-json-tools/badge)](https://scorecard.dev/viewer/?uri=github.com/oldjazjef/vscode-json-tools)
[![License: MIT](https://img.shields.io/github/license/oldjazjef/vscode-json-tools)](LICENSE)

Three small tools for working with JSON/JSONC files in VS Code:

1. **Search Path** — type a dotted path like `path1.path2.path3` and jump straight to that nested property in the active file.
2. **JSON Outline** — a sidebar tree view that mirrors the active JSON file's structure, with a live filter.
3. **Find References** — given a path, scan your workspace's source code for places that access it (`config.path1.path2.path3`, `config["path1"]["path2"].path3`, `t('path1.path2.path3')`, `_.get(obj, 'path1.path2.path3')`, ...).

## Features

### Search Path

Run **JSON Tools: Search Path...** (default keybinding `Ctrl+Alt+J` / `Cmd+Alt+J` on a JSON/JSONC file), type a path, and the editor selects and reveals the matching key/value.

Supported path syntax:

| Example | Meaning |
| --- | --- |
| `path1.path2.path3` | nested object keys |
| `items[0]` or `items.0` | array index |
| `a["literal.key"]` or `a['literal.key']` | a key containing a literal dot |
| `a\.b.c` | an escaped literal dot inside a dotted key (`a.b` then `c`) |

### JSON Outline

Open the **JSON Tools** view in the Activity Bar. It shows the structure of whichever JSON file is currently active — like the built-in Outline view, but JSON-aware. Click any row to jump to it in the editor.

Use the search icon in the view's title bar to filter live as you type:
- A plain term (`vscode`) matches any key, array index, or value preview containing it.
- A dotted path (`engines.vscode`) matches that specific nested property, even though no single node's own label contains the full string.

Matching nodes and their ancestors stay visible; everything else is hidden. Clear the filter with the broom icon next to the search icon.

### Find References

Run **JSON Tools: Find References to Path...** from the Command Palette or the editor context menu, or right-click a node in the JSON Outline view and choose **Find References** (no typing needed — the path is taken from the node you clicked). Results are ranked full-chain match → accessor-call match → partial-chain match, and picking one opens the file and reveals the match.

This is a text/regex scan, not a per-language AST analysis — it's fast and works across any language, but it can both miss unusual access patterns and occasionally flag an unrelated chain that happens to share segment names.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `jsonTools.languageIds` | `["json", "jsonc"]` | Language IDs treated as JSON by this extension. |
| `jsonTools.outline.debounceMs` | `150` | Debounce delay for the outline filter and live-document refresh. |
| `jsonTools.referenceFinder.include` | `**/*.{js,jsx,ts,tsx,py,go,rb,java,cs,php}` | Glob of files scanned when finding references. |
| `jsonTools.referenceFinder.exclude` | `""` | Additional exclude glob, on top of `files.exclude`/`search.exclude`. |
| `jsonTools.referenceFinder.maxResults` | `500` | Maximum number of reference matches returned. |
| `jsonTools.referenceFinder.accessorFunctionNames` | `["get", "t", "i18n.t", "_.get"]` | Function names treated as path-accessor calls, e.g. `get('a.b.c')`. |

## Known limitations

- JSON5 (unquoted keys, single-quoted strings, etc.) isn't supported — only standard JSON and JSONC (comments + trailing commas).
- The reference finder is a regex scanner, not a language-aware analyzer; see above.
- Duplicate keys in an object are legal JSON syntax. Search Path resolves to the **first** occurrence (top to bottom); the Outline view shows every occurrence.

## Development

```bash
npm install
npm run compile           # bundle the extension with esbuild
npm run test:unit         # fast, pure-logic tests (no VS Code needed)
npm run test:integration  # spins up a real VS Code instance (@vscode/test-cli)
npm run lint
npm run typecheck
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded.

## Trust & Security

- [SECURITY.md](SECURITY.md) — vulnerability reporting policy and a summary of the supply-chain practices below.
- Every CI run audits production dependencies (`npm audit --omit=dev --audit-level=high`) and verifies npm registry package signatures (`npm audit signatures`).
- [Dependency Review](.github/workflows/dependency-review.yml) blocks any pull request that introduces a dependency with a known vulnerability.
- [Dependabot](.github/dependabot.yml) keeps npm packages and GitHub Actions up to date; CI workflows pin actions to a commit SHA rather than a mutable tag.
- [OpenSSF Scorecard](.github/workflows/scorecard.yml) runs weekly (badge above) — an automated, third-party-verifiable score of this repo's security posture.
- Each GitHub Release includes a CycloneDX SBOM alongside the `.vsix`.

**Becoming a "Verified" publisher** on the Marketplace (the blue checkmark) is a separate, manual step done on Microsoft's side: it requires verifying ownership of a domain through the [publisher management portal](https://marketplace.visualstudio.com/manage), not anything in this repository. See [Microsoft's docs on publisher verification](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#verify-a-publisher) for the current process.

## License

[MIT](LICENSE)
