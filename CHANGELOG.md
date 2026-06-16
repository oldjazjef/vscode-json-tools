# Changelog

All notable changes to the "JSON Tools" extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Search Path**: jump to a nested JSON property by typing a dotted path (`path1.path2.path3`, array indices, quoted/escaped literal-dot keys).
- **JSON Outline**: a sidebar tree view of the active JSON/JSONC file's structure, with a live, debounced filter.
- **Find References**: scan the workspace's source files for dot/bracket property access or accessor-call string literals (`get(...)`, `t(...)`, `i18n.t(...)`, `_.get(...)`) matching a given path.
