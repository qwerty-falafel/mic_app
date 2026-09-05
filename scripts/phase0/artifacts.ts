import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parse } from 'yaml';

export interface Artifact { path: string; sha256: string; bytes: number }
const ignored = new Set(['.git', 'node_modules', '.cache', 'render', 'worktrees']);
export function inventory(root: string): Artifact[] {
  const files: Artifact[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      if (ignored.has(name)) continue;
      const path = join(dir, name), stat = lstatSync(path);
      if (stat.isSymbolicLink()) continue; // Never follow a worker's link outside its checkout.
      if (stat.isDirectory()) walk(path);
      else if (stat.isFile()) {
        files.push({ path: relative(root, path), bytes: stat.size,
          sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
      }
    }
  };
  walk(root); return files;
}

export function changedArtifacts(before: Artifact[], after: Artifact[]): Artifact[] {
  const hashes = new Map(before.map(a => [a.path, a.sha256]));
  return after.filter(a => hashes.get(a.path) !== a.sha256);
}

export function capture(root: string, output: string, artifacts: Artifact[]) {
  for (const artifact of artifacts) {
    const target = join(output, artifact.path);
    mkdirSync(dirname(target), { recursive: true }); copyFileSync(join(root, artifact.path), target);
  }
}

export function markdownContract(content: string): { status: string; blockingCondition?: string; hasResult: boolean } | null {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) return null;
  try {
    const data = parse(frontmatter[1]);
    if (!data || typeof data.status !== 'string') return null;
    const result = content.match(/^## Auto Run Result\s*\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1] ?? '';
    return { status: data.status, hasResult: !!result,
      blockingCondition: result.match(/(?:\*\*)?Blocking condition(?:\*\*)?:\s*(.+)/i)?.[1]?.trim() };
  } catch { return null; }
}

export function events(stdout: string): Record<string, any>[] {
  return stdout.split('\n').flatMap(line => {
    try { const value = JSON.parse(line); return value && typeof value === 'object' && !Array.isArray(value) ? [value] : []; }
    catch { return []; }
  });
}

export function hasCompletedSubagent(stdout: string): boolean {
  return events(stdout).some(e => e.type === 'tool_use' && e.part?.tool === 'task' && e.part?.state?.status === 'completed');
}
