import { Node } from 'jsonc-parser';
import { PathSegment } from './pathQuery';

/** A document range expressed as a plain offset/length, independent of `vscode.Range`. */
export interface OffsetRange {
  readonly offset: number;
  readonly length: number;
}

export interface ResolvedPath {
  /** The AST node the path resolved to (a property's value node, or an array element). */
  readonly node: Node;
  /** Range of the resolved value. */
  readonly valueRange: OffsetRange;
  /** Range of the property's key, when the last segment was an object key (undefined for array indices and the root). */
  readonly keyRange?: OffsetRange;
}

/**
 * Walks `root` following `segments` and returns the resolved node's
 * key/value ranges, or `undefined` if the path does not exist in this
 * document (missing key, out-of-bounds index, or a segment kind that
 * doesn't match the node it's applied to — e.g. an index against an
 * object). Never throws.
 *
 * When an object has duplicate keys (legal at the JSON-syntax level, even
 * though most parsers disagree on its semantics), the **first** matching
 * property is resolved — this is a navigation tool, so "find the first
 * occurrence reading top to bottom" is more useful than replicating
 * whatever last-wins/first-wins behavior a particular JSON.parse engine
 * uses for *value* semantics. The JSON outline tree view still surfaces
 * every occurrence, so the duplication itself is never hidden.
 */
export function resolvePath(root: Node | undefined, segments: readonly PathSegment[]): ResolvedPath | undefined {
  if (!root) {
    return undefined;
  }

  if (segments.length === 0) {
    return { node: root, valueRange: toRange(root) };
  }

  let current = root;
  let keyNode: Node | undefined;

  for (const segment of segments) {
    if (segment.type === 'key') {
      if (current.type !== 'object' || !current.children) {
        return undefined;
      }
      const property = current.children.find(
        (propertyNode) => propertyNode.type === 'property' && propertyNode.children?.[0]?.value === segment.value
      );
      if (!property?.children || property.children.length < 2) {
        return undefined;
      }
      keyNode = property.children[0];
      current = property.children[1];
    } else {
      if (current.type !== 'array' || !current.children) {
        return undefined;
      }
      const element = current.children[segment.value];
      if (!element) {
        return undefined;
      }
      keyNode = undefined;
      current = element;
    }
  }

  return {
    node: current,
    valueRange: toRange(current),
    keyRange: keyNode ? toRange(keyNode) : undefined,
  };
}

function toRange(node: Node): OffsetRange {
  return { offset: node.offset, length: node.length };
}
