# JSON Tools

Three small tools for working with JSON/JSONC files in VSCode:

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

Open the **JSON Tools** view in the Activity Bar. It shows the structure of whichever JSON/JSONC file is currently active — like the built-in Outline view, but JSON-aware. Use the search icon in the view's title bar to filter by key, index, or value; matching nodes and their ancestors stay visible, everything else is hidden. Click any row to jump to it in the editor.

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
npm run compile        # bundle the extension with esbuild
npm run test:unit       # fast, pure-logic tests (no VSCode needed)
npm run test:integration  # spins up a real VSCode instance (@vscode/test-cli)
npm run lint
npm run typecheck
```

Press `F5` in VSCode to launch an Extension Development Host with the extension loaded.

## License

[MIT](LICENSE)
