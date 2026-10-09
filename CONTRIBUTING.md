# Contributing to JSON Assistant

Thanks for helping. Bug reports and ideas go to the [issue tracker](https://github.com/oldjazjef/vscode-json-tools/issues); code changes come as pull requests. CI must be green and, for behaviour changes, there should be a test.

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

## Releasing

The Marketplace page is built from [MARKETPLACE.md](MARKETPLACE.md) (marketing text only); [README.md](README.md) is the GitHub front page. Keep developer notes in this file.

1. Add a dated entry to [CHANGELOG.md](CHANGELOG.md) for the new version.
2. Commit, then tag and push: `git tag v0.1.0 && git push origin v0.1.0`.
3. The [Release workflow](.github/workflows/release.yml) automatically:
   - Extracts the version from the tag (e.g., `v0.1.0` → `0.1.0`)
   - Updates `package.json` with the tag version
   - Runs the full test suite
   - Packages a `.vsix` file with the correct version
   - Creates a GitHub Release with the `.vsix` and CycloneDX SBOM attached
   - Optionally publishes to the Visual Studio Marketplace / Open VSX if `VSCE_PAT`/`OVSX_PAT` secrets are configured

Setting up auto-publish (one-time, done outside this repo):

1. **Marketplace publisher** — create one at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) with the id used in `package.json`'s `publisher` field (`oldjazjef`).
2. **Personal Access Token** — in [Azure DevOps](https://dev.azure.com), create a PAT scoped to **Marketplace > Manage**.
3. Add it as a repository secret named `VSCE_PAT` (*Settings → Secrets and variables → Actions*). Optionally do the same for [open-vsx.org](https://open-vsx.org) (`OVSX_PAT`) if you also want to publish there.
4. From then on, pushing a `v*.*.*` tag publishes automatically.

## Publisher verification

**Becoming a "Verified" publisher** on the Marketplace (the blue checkmark) is a separate, manual step done on Microsoft's side: it requires verifying ownership of a domain through the [publisher management portal](https://marketplace.visualstudio.com/manage), not anything in this repository. See [Microsoft's docs on publisher verification](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#verify-a-publisher) for the current process.
