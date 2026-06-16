import { Node } from 'jsonc-parser';
import { PathSegment, stringifyPathQuery } from '../../core/pathQuery';
import { OffsetRange } from '../../core/pathResolver';

/**
 * A lazily-materialized wrapper around a `jsonc-parser` `Node`. Each
 * instance describes exactly one tree-view row; children are computed
 * on demand via `getChildOutlineNodes` rather than eagerly for the whole
 * document, so a large JSON file only pays the wrapping cost for rows the
 * user actually expands.
 */
export interface JsonOutlineNode {
  readonly valueNode: Node;
  /** Present when this node is an object property (absent for array elements and the root). */
  readonly keyNode?: Node;
  /** Present when this node is an array element (absent for object properties and the root). */
  readonly index?: number;
  /** Full path from the document root to this node. */
  readonly pathSegments: readonly PathSegment[];
}

export function buildRootNode(root: Node): JsonOutlineNode {
  return { valueNode: root, pathSegments: [] };
}

/** One level of children for `node`, built directly from the underlying AST — no caching, no recursion. */
export function getChildOutlineNodes(node: JsonOutlineNode): JsonOutlineNode[] {
  const { valueNode, pathSegments } = node;

  if (valueNode.type === 'object') {
    const children: JsonOutlineNode[] = [];
    for (const property of valueNode.children ?? []) {
      if (property.type !== 'property' || !property.children || property.children.length < 2) {
        continue;
      }
      const keyNode = property.children[0];
      const propertyValueNode = property.children[1];
      children.push({
        valueNode: propertyValueNode,
        keyNode,
        pathSegments: [...pathSegments, { type: 'key', value: String(keyNode.value) }],
      });
    }
    return children;
  }

  if (valueNode.type === 'array') {
    return (valueNode.children ?? []).map((child, index) => ({
      valueNode: child,
      index,
      pathSegments: [...pathSegments, { type: 'index', value: index }] as PathSegment[],
    }));
  }

  return [];
}

export function hasChildren(node: JsonOutlineNode): boolean {
  return (
    (node.valueNode.type === 'object' || node.valueNode.type === 'array') && (node.valueNode.children?.length ?? 0) > 0
  );
}

export interface OutlineNodeDescription {
  readonly label: string;
  readonly description: string;
}

/** Display label (key/index) + a short value preview, e.g. `{ label: "path3", description: "42" }`. */
export function describeOutlineNode(node: JsonOutlineNode): OutlineNodeDescription {
  const label = node.keyNode ? String(node.keyNode.value) : node.index !== undefined ? `[${node.index}]` : '(root)';
  return { label, description: valuePreview(node.valueNode) };
}

function valuePreview(valueNode: Node): string {
  switch (valueNode.type) {
    case 'object':
      return `{${valueNode.children?.length ?? 0}}`;
    case 'array':
      return `[${valueNode.children?.length ?? 0}]`;
    case 'string':
      return JSON.stringify(valueNode.value);
    case 'null':
      return 'null';
    default:
      return String(valueNode.value);
  }
}

export function outlineNodeValueRange(node: JsonOutlineNode): OffsetRange {
  return { offset: node.valueNode.offset, length: node.valueNode.length };
}

export function outlineNodeKeyRange(node: JsonOutlineNode): OffsetRange | undefined {
  return node.keyNode ? { offset: node.keyNode.offset, length: node.keyNode.length } : undefined;
}

/** Canonical dotted-path string for this node, e.g. `path1.path2[0]`. Empty string for the root. */
export function outlineNodePathString(node: JsonOutlineNode): string {
  return node.pathSegments.length > 0 ? stringifyPathQuery(node.pathSegments as PathSegment[]) : '';
}

export function nodeMatchesFilter(node: JsonOutlineNode, filterTextLower: string): boolean {
  if (!filterTextLower) {
    return true;
  }
  const { label, description } = describeOutlineNode(node);
  return label.toLowerCase().includes(filterTextLower) || description.toLowerCase().includes(filterTextLower);
}

/**
 * True if `node` itself matches the filter, or any descendant does — used
 * to decide whether a non-matching ancestor should still be shown because
 * it leads to a match further down (mirrors the built-in Outline view's
 * filter behavior).
 */
export function subtreeMatchesFilter(node: JsonOutlineNode, filterTextLower: string): boolean {
  if (!filterTextLower || nodeMatchesFilter(node, filterTextLower)) {
    return true;
  }
  return getChildOutlineNodes(node).some((child) => subtreeMatchesFilter(child, filterTextLower));
}
