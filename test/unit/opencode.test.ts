import { afterEach, describe, expect, it } from 'vitest';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, resolve } from 'node:path';
import { OpenCodeAdapter } from '../../src/adapters/opencode.js';

describe('OpenCodeAdapter', () => {
  let root = '', originalPath = process.env.PATH, originalConfig = process.env.OPENCODE_CONFIG, originalConfigDir = process.env.OPENCODE_CONFIG_DIR;
  afterEach(async () => {
    process.env.PATH = originalPath;
    if (originalConfig === undefined) delete process.env.OPENCODE_CONFIG;
    else process.env.OPENCODE_CONFIG = originalConfig;
    if (originalConfigDir === undefined) delete process.env.OPENCODE_CONFIG_DIR;
    else process.env.OPENCODE_CONFIG_DIR = originalConfigDir;
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('cancels a child and recovers its persisted terminal observation', async () => {
    root = await mkdtemp(resolve(tmpdir(), 'mic-opencode-'));
    const executable = resolve(root, 'opencode');
    await writeFile(executable, '#!/bin/sh\nprintf "%s\\n%s\\n" "$OPENCODE_CONFIG" "$OPENCODE_CONFIG_DIR"\nexec sleep 30\n');
    await chmod(executable, 0o755);
    process.env.PATH = `${root}${delimiter}${originalPath}`;
    delete process.env.OPENCODE_CONFIG;
    delete process.env.OPENCODE_CONFIG_DIR;
    const adapter = new OpenCodeAdapter();
    adapter.dispatch({ runId: 'cancel-run', cwd: root, model: 'test/model', prompt: 'test' });
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
    expect(adapter.cancel('cancel-run')).toBe(true);
    const observation = await adapter.observe('cancel-run', true);
    expect(observation.status).toBe('cancelled');
    expect(observation.stdout.trim().split('\n')).toEqual([
      resolve(process.cwd(), 'opencode.json'),
      resolve(process.cwd(), '.opencode'),
    ]);
    const recovered = await new OpenCodeAdapter().recover('cancel-run', root);
    expect(recovered).toMatchObject({ runId: 'cancel-run', status: 'cancelled', signal: 'SIGTERM' });
  });

  it('invokes a named OpenCode command with the supplied prompt as arguments', async () => {
    root = await mkdtemp(resolve(tmpdir(), 'mic-opencode-command-'));
    const executable = resolve(root, 'opencode');
    await writeFile(executable, '#!/bin/sh\nprintf "%s\\n" "$@"\n');
    await chmod(executable, 0o755);
    process.env.PATH = `${root}${delimiter}${originalPath}`;
    const adapter = new OpenCodeAdapter();
    adapter.dispatch({ runId: 'command-run', cwd: root, model: 'test/model', command: 'bmad-spec', prompt: 'feature intent' });
    const observation = await adapter.observe('command-run', true);
    expect(observation.status).toBe('done');
    expect(observation.stdout.trim().split('\n')).toEqual(expect.arrayContaining(['--command', 'bmad-spec', 'feature intent']));
  });

  it('continues the provider session without invoking the named command again', async () => {
    root = await mkdtemp(resolve(tmpdir(), 'mic-opencode-session-'));
    const executable = resolve(root, 'opencode');
    await writeFile(executable, '#!/bin/sh\nprintf "%s\\n" "$@"\n');
    await chmod(executable, 0o755); process.env.PATH = `${root}${delimiter}${originalPath}`;
    const adapter = new OpenCodeAdapter();
    adapter.dispatch({ runId: 'continued-run', cwd: root, model: 'test/model', sessionId: 'ses_123', prompt: 'My answer' });
    const args = (await adapter.observe('continued-run', true)).stdout.trim().split('\n');
    expect(args).toEqual(expect.arrayContaining(['--session', 'ses_123', 'My answer']));
    expect(args).not.toContain('--command');
  });
});
