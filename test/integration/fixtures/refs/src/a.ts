export function readPath(config: Record<string, unknown>): unknown {
  return (config as any).path1.path2.path3;
}
