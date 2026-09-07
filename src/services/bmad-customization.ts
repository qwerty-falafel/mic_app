import { access, copyFile, mkdir, readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const managedFiles = ['mic-story-contract.md', 'bmad-spec.toml', 'bmad-create-epics-and-stories.toml'] as const;
const markers: Record<(typeof managedFiles)[number], string> = {
  'mic-story-contract.md': '<!-- Managed by MIC.',
  'bmad-spec.toml': '# Managed by MIC.',
  'bmad-create-epics-and-stories.toml': '# Managed by MIC.',
};

export async function provisionBmadCustomization(sourceBmadRoot: string, workspace: string) {
  const source = resolve(sourceBmadRoot, 'custom');
  const target = resolve(workspace, '_bmad/custom');
  await mkdir(target, { recursive: true });
  const provisioned: string[] = [];
  for (const name of managedFiles) {
    const from = resolve(source, name), to = resolve(target, name);
    try {
      await access(to);
      const current = await readFile(to, 'utf8');
      if (!current.startsWith(markers[name])) throw new Error(`Repository-owned BMAD customization conflicts with MIC's required ${basename(to)}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await copyFile(from, to);
    provisioned.push(to);
  }
  return provisioned;
}
