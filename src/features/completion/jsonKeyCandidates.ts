import { Node } from 'jsonc-parser';
import { PathSegment } from '../../core/pathQuery';
import { resolvePath } from '../../core/pathResolver';
import {
  describeOutlineNode,
  getChildOutlineNodes,
} from '../treeView/jsonOutlineNode';

export interface CompletionCandidate {
  readonly label: string;
  readonly description: string;
  readonly segment: PathSegment;
  readonly valueKind: 'object' | 'array' | 'leaf';
  readonly fileCount: number;
}

/**
 * Gathers completion candidates at a given resolved prefix across all roots in the index.
 * For each root, resolves the prefix path and collects next-level children,
 * then merges by label (deduplicating identical keys across files, tracking fileCount).
 * Never throws — skips unparseable roots and unresolvable prefixes silently.
 */
export function getCandidatesForPrefix(
  roots: Iterable<Node | undefined>,
  prefixSegments: readonly PathSegment[]
): CompletionCandidate[] {
  const candidates = new Map<string, CompletionCandidate>();

  for (const root of roots) {
    if (!root) {
      continue;
    }

    // Get the node at this prefix.
    let prefixNode: Node;
    if (prefixSegments.length === 0) {
      prefixNode = root;
    } else {
      const resolved = resolvePath(root, prefixSegments);
      if (!resolved) {
        continue;
      }
      prefixNode = resolved.node;
    }

    // Get children at the prefix.
    const outlineNode = { valueNode: prefixNode, pathSegments: prefixSegments };
    const children = getChildOutlineNodes(outlineNode);

    // Process each child.
    for (const child of children) {
      const { label, description } = describeOutlineNode(child);

      // Determine value kind.
      let valueKind: 'object' | 'array' | 'leaf';
      if (child.valueNode.type === 'object') {
        valueKind = 'object';
      } else if (child.valueNode.type === 'array') {
        valueKind = 'array';
      } else {
        valueKind = 'leaf';
      }

      // Merge: increment fileCount if already seen, else create new entry.
      if (candidates.has(label)) {
        const existing = candidates.get(label)!;
        candidates.set(label, { ...existing, fileCount: existing.fileCount + 1 });
      } else {
        candidates.set(label, {
          label,
          description,
          segment: child.index !== undefined ? { type: 'index', value: child.index } : { type: 'key', value: label },
          valueKind,
          fileCount: 1,
        });
      }
    }
  }

  return Array.from(candidates.values());
}
