import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { provisionBmadCustomization } from '../../src/services/bmad-customization.js';

async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), 'mic-bmad-'));
  const source = resolve(root, 'source'), workspace = resolve(root, 'workspace');
  await mkdir(resolve(source, 'custom'), { recursive: true });
  await Promise.all([
    writeFile(resolve(source, 'custom/mic-story-contract.md'), '<!-- Managed by MIC. -->\ncontract'),
    writeFile(resolve(source, 'custom/bmad-spec.toml'), '# Managed by MIC.\n[workflow]'),
    writeFile(resolve(source, 'custom/bmad-create-epics-and-stories.toml'), '# Managed by MIC.\n[workflow]'),
  ]);
  return { source, workspace };
}

describe('BMAD project customization provisioning', () => {
  it('installs and refreshes MIC-managed customization in a worktree', async () => {
    const { source, workspace } = await fixture();
    await provisionBmadCustomization(source, workspace);
    await writeFile(resolve(source, 'custom/mic-story-contract.md'), '<!-- Managed by MIC. -->\nrevised');
    await provisionBmadCustomization(source, workspace);
    expect(await readFile(resolve(workspace, '_bmad/custom/mic-story-contract.md'), 'utf8')).toContain('revised');
  });

  it('does not overwrite a repository-owned skill override', async () => {
    const { source, workspace } = await fixture();
    await mkdir(resolve(workspace, '_bmad/custom'), { recursive: true });
    await writeFile(resolve(workspace, '_bmad/custom/bmad-spec.toml'), '[workflow]\npersistent_facts = ["team policy"]');
    await expect(provisionBmadCustomization(source, workspace)).rejects.toThrow('Repository-owned BMAD customization conflicts');
  });
});
