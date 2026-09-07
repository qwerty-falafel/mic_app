import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { and, desc, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { artifactLinks, artifactRevisions, auditEvents, reviewDecisions, workflowSessions, workstreams } from '../db/schema.js';
import { analyseStoryInventory } from './story-outcomes.js';

const exec = promisify(execFile);
const statuses = new Set(['draft', 'ready-for-dev', 'in-progress', 'review', 'done', 'complete', 'completed', 'blocked', 'backlog', 'optional', 'deferred']);

async function walk(root: string, dir: string): Promise<string[]> {
  try {
    const result: string[] = [];
    for (const entry of await readdir(dir)) {
      const path = resolve(dir, entry), info = await stat(path);
      if (info.isDirectory()) result.push(...await walk(root, path));
      else if (/\.(md|ya?ml|json)$/i.test(entry)) result.push(relative(root, path));
    }
    return result;
  } catch { return []; }
}

export function parseArtifact(path: string, content: string) {
  let frontmatter: Record<string, unknown> = {}, body = content;
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (match) { try { frontmatter = parseYaml(match[1]) ?? {}; } catch { frontmatter = { parseError: 'Invalid YAML frontmatter' }; } body = content.slice(match[0].length); }
  const name = basename(path).toLowerCase();
  const type = name === 'spec.md' ? 'spec' : name === '.memlog.md' ? 'memlog' : name === 'stories.yaml' || name === 'stories.yml' ? 'story-inventory'
    : name === 'sprint-status.yaml' || name === 'sprint-status.yml' ? 'sprint-status' : /architecture/.test(name) ? 'architecture' : /prd/.test(name) ? 'prd' : /story/.test(name) && name.endsWith('.md') ? 'story' : name.endsWith('.md') ? 'markdown' : 'structured';
  const status = typeof frontmatter.status === 'string' ? frontmatter.status.toLowerCase() : undefined;
  const assumptions = [...body.matchAll(/^\s*[-*]\s+(?:assumption|assumes?):\s*(.+)$/gim)].map(value => value[1]);
  const questions = [...body.matchAll(/^\s*[-*]\s+(?:open question|question):\s*(.+)$/gim)].map(value => value[1]);
  const conflicts = [...body.matchAll(/^\s*[-*]\s+(?:conflict|contradiction):\s*(.+)$/gim)].map(value => value[1]);
  return { type, status, frontmatter, assumptions, questions, conflicts };
}

export class ArtifactService {
  constructor(private readonly db: Database) {}

  async index(workstreamId: string, sessionId?: string) {
    const [stream] = await this.db.select().from(workstreams).where(eq(workstreams.id, workstreamId));
    if (!stream?.workspacePath) throw new Error('Workstream workspace is unavailable');
    const root = resolve(stream.workspacePath), paths = (await walk(root, resolve(root, '_bmad-output'))).sort((left, right) => {
      const leftMemlog = basename(left).toLowerCase() === '.memlog.md';
      const rightMemlog = basename(right).toLowerCase() === '.memlog.md';
      return Number(rightMemlog) - Number(leftMemlog) || left.localeCompare(right);
    });
    const revision = (await exec('git', ['-C', root, 'rev-parse', 'HEAD'])).stdout.trim();
    const pathSet = new Set(paths);
    const created: (typeof artifactRevisions.$inferSelect)[] = [];
    for (const path of paths) {
      const content = await readFile(resolve(root, path), 'utf8');
      const hash = createHash('sha256').update(content).digest('hex');
      const existing = await this.db.select().from(artifactRevisions).where(and(eq(artifactRevisions.workstreamId, workstreamId), eq(artifactRevisions.path, path), eq(artifactRevisions.contentHash, hash))).limit(1);
      if (existing.length) { created.push(existing[0]!); continue; }
      const parsed = parseArtifact(path, content), issues: string[] = [];
      if (parsed.status && !statuses.has(parsed.status)) issues.push(`Unrecognized status: ${parsed.status}`);
      if (parsed.type === 'spec') {
        const memlogPath = `${dirname(path)}/.memlog.md`;
        if (!pathSet.has(memlogPath)) issues.push('SPEC.md requires an adjacent .memlog.md');
        else {
          const companion = created.find(row => row.path === memlogPath);
          if ((companion?.metadata as any)?.valid === false) issues.push('Adjacent .memlog.md revision is quarantined');
        }
      }
      if (parsed.type === 'memlog') {
        const [prior] = await this.db.select().from(artifactRevisions).where(and(eq(artifactRevisions.workstreamId, workstreamId), eq(artifactRevisions.path, path), or(isNull(artifactRevisions.status), ne(artifactRevisions.status, 'quarantined')))).orderBy(desc(artifactRevisions.createdAt)).limit(1);
        if (prior && !content.startsWith(prior.content)) issues.push('Historical memlog content was modified; revisions must append');
      }
      let storyAnalysis: ReturnType<typeof analyseStoryInventory> | undefined;
      if (parsed.type === 'story-inventory') {
        const spec = created.find(row => row.path === `${dirname(path)}/SPEC.md`);
        if (!spec) issues.push('stories.yaml requires its governing sibling SPEC.md');
        storyAnalysis = analyseStoryInventory(content, spec?.content ?? '');
        issues.push(...storyAnalysis.issues);
      }
      const [row] = await this.db.insert(artifactRevisions).values({ id: `artifact_${randomUUID()}`, workstreamId, sessionId, path, type: parsed.type, status: issues.length ? 'quarantined' : parsed.status, contentHash: hash, content, repositoryRevision: revision, metadata: { ...parsed, valid: issues.length === 0, issues, ...(storyAnalysis ? { storyOutcomes: storyAnalysis.stories, warnings: storyAnalysis.warnings } : {}) } }).returning();
      created.push(row!);
    }
    await this.rebuildLinks(workstreamId, created);
    return { workstreamId, revision, indexed: created.length, invalid: created.filter(row => (row.metadata as any)?.valid === false).length };
  }

  private async rebuildLinks(workstreamId: string, current: (typeof artifactRevisions.$inferSelect)[]) {
    const ids = current.map(row => row.id);
    if (ids.length) await this.db.delete(artifactLinks).where(inArray(artifactLinks.fromArtifactId, ids));
    for (const consumer of current) for (const source of current) {
      if (consumer.id === source.id) continue;
      const cited = consumer.content.includes(source.path) || consumer.content.includes(`](${basename(source.path)})`);
      if (cited) await this.db.insert(artifactLinks).values({ id: `link_${randomUUID()}`, fromArtifactId: source.id, toArtifactId: consumer.id, relationship: 'source-for' }).onConflictDoNothing();
    }
  }

  list(workstreamId: string) { return this.db.select().from(artifactRevisions).where(eq(artifactRevisions.workstreamId, workstreamId)).orderBy(desc(artifactRevisions.createdAt)); }

  async graph(workstreamId: string) {
    const nodes = await this.list(workstreamId), ids = nodes.map(node => node.id);
    const links = ids.length ? await this.db.select().from(artifactLinks).where(inArray(artifactLinks.fromArtifactId, ids)) : [];
    const byId = new Map(nodes.map(node => [node.id, node]));
    return { nodes: nodes.map(node => ({ ...node, stale: links.some(link => link.toArtifactId === node.id && byId.get(link.fromArtifactId)!.createdAt > node.createdAt) })), links };
  }

  async review(artifactRevisionId: string, input: { kind: 'accepted' | 'rejected' | 'feedback' | 'override'; feedback?: string; actor: string }) {
    const [artifact] = await this.db.select().from(artifactRevisions).where(eq(artifactRevisions.id, artifactRevisionId));
    if (!artifact) throw new Error('Artifact revision not found');
    if (input.kind === 'accepted' && ((artifact.metadata as any)?.valid === false || artifact.status === 'quarantined')) throw new Error('A quarantined artifact revision cannot be accepted');
    const [latest] = await this.db.select().from(artifactRevisions).where(and(eq(artifactRevisions.workstreamId, artifact.workstreamId), eq(artifactRevisions.path, artifact.path))).orderBy(desc(artifactRevisions.createdAt)).limit(1);
    if (input.kind === 'accepted' && latest?.id !== artifact.id) throw new Error('Only the latest artifact revision can be accepted');
    if (input.kind === 'accepted' && artifact.type === 'spec') {
      const memlogPath = `${dirname(artifact.path)}/.memlog.md`;
      const [companion] = await this.db.select().from(artifactRevisions).where(and(eq(artifactRevisions.workstreamId, artifact.workstreamId), eq(artifactRevisions.path, memlogPath))).orderBy(desc(artifactRevisions.createdAt)).limit(1);
      if (!companion || companion.status === 'quarantined' || (companion.metadata as any)?.valid === false) throw new Error('SPEC.md cannot be accepted while its companion .memlog.md is missing or quarantined');
    }
    const [decision] = await this.db.transaction(async tx => {
      const [row] = await tx.insert(reviewDecisions).values({ id: `review_${randomUUID()}`, artifactRevisionId, ...input }).returning();
      await tx.insert(auditEvents).values({ aggregateType: 'artifact_revision', aggregateId: artifactRevisionId, action: `review.${input.kind}`, actor: input.actor, detail: { feedback: input.feedback }, idempotencyKey: `${row!.id}:audit` });
      return [row];
    });
    return decision;
  }

  async diff(fromId: string, toId: string) {
    const rows = await this.db.select().from(artifactRevisions).where(inArray(artifactRevisions.id, [fromId, toId]));
    const from = rows.find(row => row.id === fromId), to = rows.find(row => row.id === toId);
    if (!from || !to || from.path !== to.path) throw new Error('Comparable artifact revisions not found');
    const left = from.content.split('\n'), right = to.content.split('\n'), changes: string[] = [];
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index++) if (left[index] !== right[index]) { if (left[index] !== undefined) changes.push(`- ${left[index]}`); if (right[index] !== undefined) changes.push(`+ ${right[index]}`); }
    return { path: from.path, from: from.id, to: to.id, changes };
  }

  async attention() {
    const candidates = await this.db.select().from(workflowSessions).where(inArray(workflowSessions.status, ['WAITING_FOR_INPUT', 'BLOCKED', 'INTERRUPTED', 'NEEDS_CLASSIFICATION']));
    const sessions = candidates.filter(session => {
      const raw = session.rawState as any;
      return !(session.status === 'INTERRUPTED' && raw?.status === 'done' && raw?.rawAdapterState?.exitCode === 0);
    });
    const revisions = await this.db.select().from(artifactRevisions).orderBy(desc(artifactRevisions.createdAt));
    const latest = new Map<string, typeof artifactRevisions.$inferSelect>();
    for (const revision of revisions) {
      const key = `${revision.workstreamId}:${revision.path}`;
      if (!latest.has(key)) latest.set(key, revision);
    }
    const invalid = [...latest.values()].filter(revision => revision.status === 'quarantined');
    return { sessions, invalidArtifacts: invalid, reviewFeedback: [] };
  }
}
