<p align="center">
  <img src="resources/icon.png" alt="" width="96" height="96" />
</p>

<h1 align="center">JSON Assistant</h1>

<p align="center">
  <strong>Get around big JSON files in seconds.</strong><br />
  Jump to any nested path, see the structure at a glance, find where a key is used in your code, and spot duplicates before they bite.
</p>

---

Configuration files, translation bundles and API fixtures grow until nobody can find anything in them. **JSON Assistant** gives your editor the missing navigation for JSON and JSONC.

## Highlights

|     | Feature              | What you get                                                                                      |
| --- | -------------------- | ------------------------------------------------------------------------------------------------- |
| 🔎  | **Search Path**      | Type `settings.editor.fontSize` and land on exactly that property                                 |
| 🌳  | **JSON Outline**     | A live tree of the open file in the sidebar, with instant filtering                               |
| 🧭  | **Find References**  | See every place in your code that reads a JSON path: `config.a.b`, `t('a.b')`, `_.get(obj, 'a.b')` |
| 👯  | **Duplicate Keys**   | Gutter markers and a dedicated view for repeated keys, attributes and key-value pairs             |
| 🤖  | **Merge for AI**     | Turn a group of duplicates into a ready-to-paste refactoring instruction                          |

## Search Path

Press `Ctrl+Alt+J` (`Cmd+Alt+J` on macOS) in a JSON or JSONC file, type a path, and the editor selects and reveals the matching key and value.

| You type                  | It finds                                          |
| ------------------------- | ------------------------------------------------- |
| `path1.path2.path3`       | nested object keys                                |
| `items[0]` or `items.0`   | an array element                                  |
| `a["literal.key"]`        | a key that contains a dot                         |
| `a\.b.c`                  | an escaped dot inside a key (`a.b`, then `c`)     |

## JSON Outline

Open the **JSON Tools** view in the Activity Bar. It mirrors the structure of whichever JSON file is active, like the built-in Outline but JSON-aware. Click a row to jump to it.

Use the search icon to filter as you type. A plain word matches keys, array indexes and value previews. A dotted path such as `engines.vscode` matches that exact nested property. Matches keep their parents visible, everything else gets out of the way.

## Find References

Right-click a node in the outline, or run **JSON Tools: Find References to Path** from the Command Palette, and JSON Assistant scans your workspace for the places that use the path:

- property access: `config.server.port`, `config["server"].port`
- accessor calls: `t('server.port')`, `i18n.t('server.port')`, `_.get(config, 'server.port')`, `get('server.port')`

Results are ranked from full-chain matches down to partial ones. Pick one and the file opens at the match. It works across JavaScript, TypeScript, Python, Go, Ruby, Java, C# and PHP out of the box, and you can widen the file list and the accessor function names in the settings.

## Duplicate Keys

Duplicate keys are legal JSON, and they are almost always a mistake or a refactoring waiting to happen. JSON Assistant marks them in the editor gutter and collects them in the **Duplicate Keys** view:

- **Same key twice under one parent**: the later one silently wins in most parsers
- **Same attribute in different places**: a candidate for a shared definition
- **Same key and same value in different places**: copy and paste you can consolidate

From the view you can jump to each occurrence, ignore a duplicate you know is intentional, and manage your ignore list. **Create Merge Instruction for AI** turns a group into a short, clear refactoring brief you can hand to your assistant. The wording is yours to change in the settings.

## Settings

| Setting                                             | Default                                      | What it does                                           |
| --------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| `jsonTools.languageIds`                             | `["json", "jsonc"]`                          | Which languages the extension treats as JSON           |
| `jsonTools.referenceFinder.include`                 | `**/*.{js,jsx,ts,tsx,py,go,rb,java,cs,php}`  | Files scanned for references                           |
| `jsonTools.referenceFinder.exclude`                 | _empty_                                      | Extra exclude pattern                                  |
| `jsonTools.referenceFinder.maxResults`              | `500`                                        | Upper limit for reference matches                      |
| `jsonTools.referenceFinder.accessorFunctionNames`   | `["get", "t", "i18n.t", "_.get"]`            | Function names treated as path accessors               |
| `jsonTools.outline.debounceMs`                      | `150`                                        | Delay before the outline reacts to typing              |
| `jsonTools.duplicateKeys.mergeInstructionTemplates` | built-in                                     | Wording of the AI merge instructions                   |

## Good to know

- Standard JSON and JSONC (comments and trailing commas) are supported. JSON5 is not.
- Find References scans text, it does not parse each language. It is fast and language-independent, but it can miss unusual access patterns or flag a look-alike chain.
- With duplicate keys in one object, Search Path jumps to the first occurrence. The outline shows all of them.

## Feedback

Found a bug or have an idea? [Open an issue](https://github.com/oldjazjef/vscode-json-tools/issues). If JSON Assistant saves you time, a rating on the Marketplace helps others find it.
