# Changelog

All notable changes to the "JSON Tools" extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.2.1] - 2026-10-09

### Changed

- The Marketplace page (`MARKETPLACE.md`) now contains only what the extension offers; development and release notes moved to `CONTRIBUTING.md`, and the repository README links to the Marketplace.
- Dependency updates (build and test tooling). TypeScript stays on 6.x until `typescript-eslint` supports 7, and `@types/vscode` stays at 1.125 to match `engines.vscode`.

## [1.2.0] - 2026-06-23

### Added

- **Duplicate Keys**: gutter markers for repeated keys, attributes and key-value pairs.

## [1.1.1] - 2026-06-18

### Added

- **Create Merge Instruction for AI** for duplicate keys (templates configurable in the settings).

### Added

- **Search Path**: jump to a nested JSON property by typing a dotted path (`path1.path2.path3`, array indices, quoted/escaped literal-dot keys).
- **JSON Outline**: a sidebar tree view of the active JSON/JSONC file's structure, with a live, debounced filter.
- **Find References**: scan the workspace's source files for dot/bracket property access or accessor-call string literals (`get(...)`, `t(...)`, `i18n.t(...)`, `_.get(...)`) matching a given path.
