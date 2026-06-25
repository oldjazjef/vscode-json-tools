# JSON Assistant

Professional tools for working with JSON/JSONC configuration files in Visual Studio Code — from quick navigation to workspace-wide analysis.

## ✨ Features

### 🎯 `jt:` JSON Key Autocomplete ⭐ NEW
Type `jt:` anywhere (HTML, TypeScript, JavaScript, or any file) to get cascading autocomplete suggestions from JSON keys across your workspace. Perfect for generating config paths, i18n keys, or any JSON-based references.

**Features:**
- Cascading navigation through nested JSON structures
- Cross-file autocomplete (works on all workspace JSON files by default)
- Customize sources — manually pin specific JSON files
- Works in any file type, not just JSON
- Deduplication across multiple files

### 🔍 Search Path
Instantly jump to any nested JSON property using dotted path notation. Press **Ctrl+Alt+J** (or **Cmd+Alt+J** on Mac) and type a path like `config.database.host` to navigate directly to that location in your file.

**Supports:**
- Nested object keys: `path1.path2.path3`
- Array indices: `items[0]` or `items.0`
- Literal dots in keys: `a["literal.key"]` or `a['literal.key']`
- Escaped dots: `a\.b.c`

### 📋 JSON Outline with Multiple Files
View your JSON structure in an interactive sidebar tree — like VS Code's built-in Outline, but JSON-aware. **Pin multiple JSON files** to keep them visible even when switching editors.

**Features:**
- Live filtering — type to search for keys, indices, or values
- Pin files with the `$(pin)` button in the toolbar
- Use the file picker to browse and open JSON files
- Persistent pinned files across sessions
- Click any node to jump to it in the editor

### 🔗 Find References
Scan your entire workspace for code that accesses a JSON path. Right-click a path in the editor or in the Outline view and choose **Find References** to see every place it's used.

Works across JavaScript, TypeScript, Python, Go, Ruby, Java, C#, PHP, and more. Detects:
- Direct property access: `config.path1.path2.path3`
- Bracket notation: `config["path1"]["path2"].path3`
- i18n functions: `t('path1.path2.path3')`
- Utility functions: `_.get(obj, 'path1.path2.path3')`

### 🔴 Duplicate Key Detection
Automatically highlights duplicate keys in your JSON files in a dedicated sidebar view. See all occurrences, their values, and exact locations.

- Ignore false positives you want to keep
- Generate merge instructions for AI-assisted refactoring

## 🎯 Use Cases

- **Configuration management** — quickly navigate `package.json`, `.vscode/settings.json`, `tsconfig.json`, `webpack.config.js`, and other configs
- **i18n & localization** — autocomplete translation keys from your locale JSON files with `jt:`
- **API response exploration** — explore deeply nested JSON structures in large API payloads
- **Configuration tracking** — understand how your configuration is used across the codebase with Find References
- **Data validation** — spot duplicate keys and inconsistencies in JSON data
- **Multi-file workflows** — pin multiple JSON files in the sidebar for quick reference while coding

## ⚙️ Customization

### Settings

- `jsonTools.languageIds` — extend support beyond JSON/JSONC
- `jsonTools.referenceFinder.include` — adjust which file types to scan for references
- `jsonTools.referenceFinder.exclude` — exclude folders from reference scanning (defaults to `node_modules`, `dist`, `build`, `out`)
- `jsonTools.referenceFinder.accessorFunctionNames` — add custom function names (e.g., `config`, `settings.get`)
- `jsonTools.completion.include` — customize JSON files used for `jt:` autocomplete
- `jsonTools.completion.exclude` — exclude folders from autocomplete indexing
- `jsonTools.completion.registeredFiles` — manually registered JSON files for autocomplete

See the extension's Settings page for full details.

### Quick Actions

Right-click any JSON file to:
- **Pin File in Outline** — add it to the sidebar outline for easy reference
- **Find References** — scan the workspace for usage of that path
- **Register for jt: AutoComplete** — include it in `jt:` autocomplete suggestions

## Keyboard Shortcuts

- **Ctrl+Alt+J** (Windows/Linux) / **Cmd+Alt+J** (Mac) — Search Path in the active JSON file

## 💡 Tips & Tricks

- **Autocomplete all the things** — Use `jt:` to generate paths from any JSON file, perfect for config loaders, i18n functions, or custom data structures
- **Pin your daily files** — Pin `package.json`, `.env`, and app config files to keep them instantly accessible
- **Search before you pin** — Use Find References to understand configuration impact before making changes
- **Filter large files** — Use the outline filter ($(search) icon) to narrow down large JSON files to the section you need

## ⚠️ Known Limitations

- JSON5 (unquoted keys, trailing commas) isn't supported — use standard JSON or JSONC only
- The reference finder is regex-based, not language-aware — it's fast across any language but may miss unusual access patterns
- Duplicate keys are resolved to the first occurrence; the Outline view shows every occurrence

## 🤝 Support & Contributing

- [GitHub Repository](https://github.com/oldjazjef/vscode-json-tools) — source code and development
- [Report Issues](https://github.com/oldjazjef/vscode-json-tools/issues) — feature requests and bug reports
- [MIT License](https://github.com/oldjazjef/vscode-json-tools/blob/main/LICENSE) — open source and free to use

---

**Made for developers who work with JSON every day.** ⚡
