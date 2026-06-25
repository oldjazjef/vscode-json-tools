# Changelog

All notable changes to the "JSON Tools" extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **`jt:` JSON Key Autocomplete** — Type `jt:` in any file (HTML, TypeScript, JavaScript, etc.) to get cascading autocomplete suggestions from JSON keys across your workspace. Select a key to insert its full path.
- **Manual JSON File Registration** — Right-click any JSON file and choose "Register for jt: AutoComplete" to manually add it as an autocomplete source. Useful for files outside the default glob pattern.
- **Multiple Pinned JSON Files in Sidebar** — Pin JSON files to the outline sidebar to keep their structure visible even when switching editors. Pin multiple files and switch between them without losing your place.
- **JSON File Picker** — Click the folder-open icon in the outline toolbar to browse and open JSON files from the workspace (up to 100 files). Selected files are automatically pinned.
- **Default Scan Excludes** — Automatically exclude `node_modules`, `dist`, `build`, `out` from workspace scans (both reference finder and autocomplete). Users can override via settings.
- **Search Path**: jump to a nested JSON property by typing a dotted path (`path1.path2.path3`, array indices, quoted/escaped literal-dot keys).
- **JSON Outline**: a sidebar tree view of the active JSON/JSONC file's structure, with a live, debounced filter.
- **Find References**: scan the workspace's source files for dot/bracket property access or accessor-call string literals (`get(...)`, `t(...)`, `i18n.t(...)`, `_.get(...)`) matching a given path.

### Fixed

- Pin command now recognizes JSON files by extension as fallback, allowing pinning of files with non-standard language detection.
