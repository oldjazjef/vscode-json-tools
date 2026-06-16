# Security Policy

## Supported Versions

Only the latest published release of JSON Tools is supported. Please update to the newest version before reporting an issue.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report it privately via [GitHub Security Advisories](https://github.com/oldjazjef/vscode-json-tools/security/advisories/new) for this repository. You should receive an initial response within a few days.

Please include:
- A description of the vulnerability and its potential impact
- Steps to reproduce (a minimal JSON file/workspace if relevant)
- The extension version and VS Code version you tested against

## What this extension does (and doesn't) touch

JSON Tools reads files from your open editor and workspace (to resolve paths and scan for references) and writes nothing back except moving the editor's selection/cursor. It makes no network requests at runtime. If you find behavior that contradicts this, please report it as above.

## Supply-chain practices in this repository

- CI pins third-party GitHub Actions to a commit SHA (not a mutable tag).
- `npm audit --omit=dev --audit-level=high` and `npm audit signatures` run on every CI build and gate merges.
- [Dependency Review](.github/workflows/dependency-review.yml) blocks pull requests that introduce a dependency with a known vulnerability.
- [Dependabot](.github/dependabot.yml) keeps both npm packages and pinned GitHub Actions up to date.
- Releases are built from a clean CI run and include a CycloneDX SBOM attached to the GitHub Release.
- [OpenSSF Scorecard](.github/workflows/scorecard.yml) runs weekly against this repository — see the badge in [README.md](README.md).
