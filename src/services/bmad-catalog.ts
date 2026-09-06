import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { repositories, workflowDefinitions } from '../db/schema.js';
import { parse as parseYaml } from 'yaml';

const sharedRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../');

export function csvRows(source: string) {
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted && char === '"' && source[i + 1] === '"') { field += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ',') { row.push(field); field = ''; }
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [headers, ...values] = rows;
  return values.map(value => Object.fromEntries(headers.map((header, index) => [header, value[index] ?? ''])));
}

function tomlValues(source: string) {
  const result: Record<string, string | boolean | number | string[]> = {};
  let section = '';
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '').trim();
    const heading = line.match(/^\[([^\]]+)]$/);
    if (heading) { section = heading[1]; continue; }
    const pair = line.match(/^([\w.-]+)\s*=\s*(.+)$/);
    if (!pair) continue;
    const key = section ? `${section}.${pair[1]}` : pair[1];
    const value = pair[2].trim();
    try { result[key] = JSON.parse(value); }
    catch { result[key] = value.replace(/^['"]|['"]$/g, ''); }
  }
  return result;
}

async function effectiveConfig(configRoot: string, projectRoot = configRoot) {
  const paths = ['_bmad/config.toml', '_bmad/custom/config.toml', '_bmad/custom/config.user.toml', '_bmad/config.user.toml'];
  const layers: { path: string; values: ReturnType<typeof tomlValues> }[] = [];
  for (const path of paths) {
    const absolute = resolve(configRoot, path);
    if (!existsSync(absolute)) continue;
    layers.push({ path, values: tomlValues(await readFile(absolute, 'utf8')) });
  }
  const values = Object.assign({}, ...layers.map(layer => layer.values));
  const expanded = Object.fromEntries(Object.entries(values).map(([key, value]) => [key,
    typeof value === 'string' ? value.replaceAll('{project-root}', projectRoot) : value]));
  expanded['core.project_name'] = projectRoot.split('/').filter(Boolean).at(-1) ?? String(expanded['core.project_name'] ?? 'project');
  return { layers: layers.map(layer => layer.path), values: expanded };
}

export class BmadCatalogService {
  constructor(private readonly db: Database) {}

  async sync(repositoryId: string) {
    const [repository] = await this.db.select().from(repositories).where(eq(repositories.id, repositoryId));
    if (!repository) throw new Error('Repository not found');
    const installedRoot = existsSync(resolve(repository.path, '_bmad/_config/bmad-help.csv')) ? repository.path : sharedRoot;
    const catalogPath = resolve(installedRoot, '_bmad/_config/bmad-help.csv');
    const manifestPath = resolve(installedRoot, '_bmad/_config/manifest.yaml');
    const [catalog, manifest, config] = await Promise.all([readFile(catalogPath, 'utf8'), readFile(manifestPath, 'utf8').catch(() => ''), effectiveConfig(installedRoot, repository.path)]);
    const fingerprint = createHash('sha256').update(catalog).update(manifest).digest('hex');
    const entries = csvRows(catalog).filter(row => row.skill && row.skill !== '_meta');
    await this.db.transaction(async tx => {
      await tx.delete(workflowDefinitions).where(eq(workflowDefinitions.repositoryId, repositoryId));
      if (entries.length) await tx.insert(workflowDefinitions).values(entries.map(entry => ({
        id: `workflow_${randomUUID()}`, repositoryId, fingerprint, module: entry.module, skill: entry.skill, displayName: entry['display-name'] || entry.skill,
        phase: entry.phase || 'anytime', action: entry.action || null, required: entry.required === 'true', metadata: entry,
      })));
    });
    return { repositoryId, installedRoot, fingerprint, count: entries.length, modules: (parseYaml(manifest) as any)?.modules ?? [], config };
  }

  list(repositoryId: string) { return this.db.select().from(workflowDefinitions).where(eq(workflowDefinitions.repositoryId, repositoryId)); }

  async health(repositoryId: string) {
    const [repository] = await this.db.select().from(repositories).where(eq(repositories.id, repositoryId));
    if (!repository) throw new Error('Repository not found');
    const installedRoot = existsSync(resolve(repository.path, '_bmad/_config/bmad-help.csv')) ? repository.path : sharedRoot;
    const definitions = await this.list(repositoryId);
    const manifestSource = await readFile(resolve(installedRoot, '_bmad/_config/manifest.yaml'), 'utf8').catch(() => '');
    return { repositoryId, repositoryPath: repository.path, installedRoot, healthy: definitions.length > 0,
      modules: (parseYaml(manifestSource) as any)?.modules ?? [], config: await effectiveConfig(installedRoot, repository.path), definitions: definitions.length };
  }
}
