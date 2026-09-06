import { afterEach, describe, expect, it } from 'vitest';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, resolve } from 'node:path';
import { OpenCodeAdapter } from '../../src/adapters/opencode.js';

describe('OpenCodeAdapter', () => {
  let root = '', originalPath = process.env.PATH, originalConfig = process.env.OPENCODE_CONFIG;
  afterEach(async () => {
    process.env.PATH = originalPath;
    if (originalConfig === undefined) delete process.env.OPENCODE_CONFIG;
    else process.env.OPENCODE_CONFIG = originalConfig;
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('cancels a child and recovers its persisted terminal observation', async () => {
    root = await mkdtemp(resolve(tmpdir(), 'mic-opencode-'));
    const executable = resolve(root, 'opencode');
    await writeFile(executable, '#!/bin/sh\necho "$OPENCODE_CONFIG"\nexec sleep 30\n');
    await chmod(executable, 0o755);
    process.env.PATH = `${root}${delimiter}${originalPath}`;
    delete process.env.OPENCODE_CONFIG;
    const adapter = new OpenCodeAdapter();
    adapter.dispatch({ runId: 'cancel-run', cwd: root, model: 'test/model', prompt: 'test' });
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
    expect(adapter.cancel('cancel-run')).toBe(true);
    const observation = await adapter.observe('cancel-run', true);
    expect(observation.status).toBe('cancelled');
    expect(observation.stdout.trim()).toBe(resolve(process.cwd(), 'opencode.json'));
    const recovered = await new OpenCodeAdapter().recover('cancel-run', root);
    expect(recovered).toMatchObject({ runId: 'cancel-run', status: 'cancelled', signal: 'SIGTERM' });
  });
});
