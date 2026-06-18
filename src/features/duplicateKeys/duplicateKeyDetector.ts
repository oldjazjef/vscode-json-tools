import { Node } from 'jsonc-parser';
import { PathSegment, stringifyPathQuery } from '../../core/pathQuery';
import { OffsetRange } from '../../core/pathResolver';

export interface DuplicateOccurrence {
  readonly keyNode: Node;
  readonly valueNode: Node;
  readonly valuePreview: string;
  readonly keyRange: OffsetRange;
  readonly valueRange: OffsetRange;
  readonly fullPath: string;
}

export interface DuplicateGroup {
  /** Full dotted path to the key, e.g. "user.name". */
  readonly path: string;
  /** Just the key name, e.g. "name". */
  readonly keyName: string;
  readonly occurrences: readonly DuplicateOccurrence[];
}

export interface AttributeGroup {
  /** The attribute name, e.g. "test". */
  readonly attribute: string;
  /** Paths where this attribute appears, e.g. ["mykey1", "mykey2"]. */
  readonly paths: readonly string[];
  readonly occurrences: readonly DuplicateOccurrence[];
}

export interface PairGroup {
  /** The key name, e.g. "test". */
  readonly key: string;
  /** The value preview, e.g. "value1". */
  readonly value: string;
  readonly occurrences: readonly DuplicateOccurrence[];
}

export interface ValueGroup {
  /** The value preview, e.g. "value1". */
  readonly value: string;
  readonly occurrences: readonly DuplicateOccurrence[];
}

/**
 * Walks the AST and returns every object key that appears more than once
 * under the same parent, at any nesting level. Groups whose path is in
 * `ignoreSet` are excluded.
 */
export function findDuplicateKeys(root: Node, ignoreSet: ReadonlySet<string>): DuplicateGroup[] {
  const results: DuplicateGroup[] = [];
  walk(root, [], results, ignoreSet);
  return results;
}

function walk(node: Node, pathSegments: PathSegment[], results: DuplicateGroup[], ignoreSet: ReadonlySet<string>): void {
  if (node.type === 'object') {
    const byKey = new Map<string, DuplicateOccurrence[]>();

    for (const prop of node.children ?? []) {
      if (prop.type !== 'property' || !prop.children || prop.children.length < 2) {
        continue;
      }
      const keyNode = prop.children[0];
      const valueNode = prop.children[1];
      const keyName = String(keyNode.value);
      if (!byKey.has(keyName)) {
        byKey.set(keyName, []);
      }
      const fullPath = stringifyPathQuery([...pathSegments, { type: 'key', value: keyName }]);
      byKey.get(keyName)!.push({
        keyNode,
        valueNode,
        valuePreview: previewValue(valueNode),
        keyRange: { offset: keyNode.offset, length: keyNode.length },
        valueRange: { offset: valueNode.offset, length: valueNode.length },
        fullPath,
      });
    }

    for (const [keyName, occurrences] of byKey) {
      const childSegments: PathSegment[] = [...pathSegments, { type: 'key', value: keyName }];
      const path = stringifyPathQuery(childSegments);

      if (occurrences.length > 1 && !ignoreSet.has(path)) {
        results.push({ path, keyName, occurrences });
      }

      for (const { valueNode } of occurrences) {
        walk(valueNode, childSegments, results, ignoreSet);
      }
    }
  } else if (node.type === 'array') {
    for (let i = 0; i < (node.children?.length ?? 0); i++) {
      const childSegments: PathSegment[] = [...pathSegments, { type: 'index', value: i }];
      walk(node.children![i], childSegments, results, ignoreSet);
    }
  }
}

/**
 * Find attributes (key names) that appear at multiple different parent paths.
 * Example: "name" appears in both "user.name" and "person.name"
 */
export function findDuplicatedAttributes(root: Node): AttributeGroup[] {
  const allOccurrences = collectAllKeyOccurrences(root, []);
  const results: AttributeGroup[] = [];
  const byAttribute = new Map<string, { paths: Set<string>; occurrences: DuplicateOccurrence[] }>();

  for (const occ of allOccurrences) {
    const attribute = occ.keyNode.value as string;
    if (!byAttribute.has(attribute)) {
      byAttribute.set(attribute, { paths: new Set(), occurrences: [] });
    }
    const entry = byAttribute.get(attribute)!;
    entry.paths.add(occ.fullPath.substring(0, occ.fullPath.lastIndexOf('.')));
    entry.occurrences.push(occ);
  }

  for (const [attribute, { paths, occurrences }] of byAttribute) {
    if (paths.size > 1 && occurrences.length > 1) {
      results.push({
        attribute,
        paths: Array.from(paths).sort(),
        occurrences,
      });
    }
  }

  return results.sort((a, b) => a.attribute.localeCompare(b.attribute));
}

/**
 * Find key-value pairs (same key AND same value) appearing at multiple paths.
 * Only compares leaf values (primitives), never objects or arrays.
 * Example: "test: value1" appears in both "mykey1" and "mykey2"
 */
export function findDuplicatedPairs(root: Node): PairGroup[] {
  const allOccurrences = collectAllKeyOccurrences(root, []);
  const results: PairGroup[] = [];
  const byPair = new Map<string, DuplicateOccurrence[]>();

  for (const occ of allOccurrences) {
    // Only include leaf values (not objects or arrays)
    if (occ.valueNode.type === 'object' || occ.valueNode.type === 'array') {
      continue;
    }
    const pairKey = `${occ.keyNode.value}:${occ.valuePreview}`;
    if (!byPair.has(pairKey)) {
      byPair.set(pairKey, []);
    }
    byPair.get(pairKey)!.push(occ);
  }

  for (const [pairKey, occurrences] of byPair) {
    if (occurrences.length > 1) {
      const [key, value] = pairKey.split(':');
      results.push({ key, value, occurrences });
    }
  }

  return results.sort((a, b) => a.key.localeCompare(b.key) || a.value.localeCompare(b.value));
}

/**
 * Find values that appear at multiple different key paths.
 * Example: "value1" appears in both "mykey1.test1" and "mykey4.test15"
 */
export function findDuplicatedValues(root: Node): ValueGroup[] {
  const allOccurrences = collectAllKeyOccurrences(root, []);
  const results: ValueGroup[] = [];
  const byValue = new Map<string, DuplicateOccurrence[]>();

  for (const occ of allOccurrences) {
    if (!byValue.has(occ.valuePreview)) {
      byValue.set(occ.valuePreview, []);
    }
    byValue.get(occ.valuePreview)!.push(occ);
  }

  for (const [value, occurrences] of byValue) {
    if (occurrences.length > 1) {
      results.push({ value, occurrences });
    }
  }

  return results.sort((a, b) => a.value.localeCompare(b.value));
}

/**
 * Collect all key occurrences in the tree with their full paths.
 */
function collectAllKeyOccurrences(node: Node, pathSegments: PathSegment[]): DuplicateOccurrence[] {
  const results: DuplicateOccurrence[] = [];

  if (node.type === 'object') {
    for (const prop of node.children ?? []) {
      if (prop.type !== 'property' || !prop.children || prop.children.length < 2) {
        continue;
      }
      const keyNode = prop.children[0];
      const valueNode = prop.children[1];
      const keyName = String(keyNode.value);
      const childSegments: PathSegment[] = [...pathSegments, { type: 'key' as const, value: keyName }];
      const fullPath = stringifyPathQuery(childSegments);

      results.push({
        keyNode,
        valueNode,
        valuePreview: previewValue(valueNode),
        keyRange: { offset: keyNode.offset, length: keyNode.length },
        valueRange: { offset: valueNode.offset, length: valueNode.length },
        fullPath,
      });

      results.push(...collectAllKeyOccurrences(valueNode, childSegments));
    }
  } else if (node.type === 'array') {
    for (let i = 0; i < (node.children?.length ?? 0); i++) {
      const childSegments: PathSegment[] = [...pathSegments, { type: 'index' as const, value: i }];
      results.push(...collectAllKeyOccurrences(node.children![i], childSegments));
    }
  }

  return results;
}

function previewValue(node: Node): string {
  switch (node.type) {
    case 'object':
      return `{${node.children?.length ?? 0}}`;
    case 'array':
      return `[${node.children?.length ?? 0}]`;
    case 'string':
      return JSON.stringify(node.value);
    case 'null':
      return 'null';
    default:
      return String(node.value);
  }
}
