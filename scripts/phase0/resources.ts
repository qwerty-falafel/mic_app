import { readFileSync, readdirSync } from 'node:fs';

export function counters(text: string): Record<string, number> {
  return Object.fromEntries(text.split('\n').flatMap(line => {
    const match = line.match(/^([\w()-]+):?\s+(\d+)/);
    return match ? [[match[1], Number(match[2])]] : [];
  }));
}

export interface ResourceSample {
  at: string;
  totalMiB: number;
  availableMiB: number;
  swapIn: number;
  swapOut: number;
  oomKills: number;
  cpuTotal: number;
  cpuIdle: number;
  models: { pid: number; rssMiB: number; gpuResidentMiB: number | null }[];
}

export function sampleResources(): ResourceSample {
  const memory = counters(readFileSync('/proc/meminfo', 'utf8'));
  const vm = counters(readFileSync('/proc/vmstat', 'utf8'));
  const cpu = readFileSync('/proc/stat', 'utf8').split('\n')[0].trim().split(/\s+/).slice(1, 9).map(Number);
  const models: ResourceSample['models'] = [];
  for (const pid of readdirSync('/proc').filter(x => /^\d+$/.test(x))) {
    try {
      if (readFileSync(`/proc/${pid}/comm`, 'utf8').trim() !== 'llama-server') continue;
      const status = counters(readFileSync(`/proc/${pid}/status`, 'utf8'));
      // AMD unified memory is not fully represented by RSS. Count unique DRM clients.
      const clients = new Set<string>();
      let gpuResidentMiB: number | null = null;
      for (const fd of readdirSync(`/proc/${pid}/fdinfo`)) {
        const info = readFileSync(`/proc/${pid}/fdinfo/${fd}`, 'utf8');
        const client = info.match(/^drm-client-id:\s*(.+)$/m)?.[1];
        if (!client || clients.has(client)) continue;
        clients.add(client);
        const c = counters(info);
        if ('drm-resident-gtt' in c || 'drm-resident-vram' in c)
          gpuResidentMiB = (gpuResidentMiB ?? 0) + ((c['drm-resident-gtt'] ?? 0) + (c['drm-resident-vram'] ?? 0)) / 1024;
      }
      models.push({ pid: Number(pid), rssMiB: (status.VmRSS ?? 0) / 1024, gpuResidentMiB });
    } catch { /* Processes and descriptors can disappear between reads. */ }
  }
  return {
    at: new Date().toISOString(), totalMiB: memory.MemTotal / 1024,
    availableMiB: memory.MemAvailable / 1024, swapIn: vm.pswpin,
    swapOut: vm.pswpout, oomKills: vm.oom_kill,
    cpuTotal: cpu.reduce((sum, n) => sum + n, 0), cpuIdle: cpu[3] + cpu[4], models,
  };
}

export function summarizeResources(samples: ResourceSample[]) {
  if (!samples.length) return null;
  const first = samples[0], last = samples[samples.length - 1];
  const cpu = samples.slice(1).map((s, i) => {
    const total = s.cpuTotal - samples[i].cpuTotal;
    return total > 0 ? 100 * (1 - (s.cpuIdle - samples[i].cpuIdle) / total) : 0;
  });
  return {
    samples: samples.length,
    minAvailableMiB: Math.min(...samples.map(s => s.availableMiB)),
    peakRssMiB: Math.max(...samples.map(s => s.models.reduce((sum, m) => sum + m.rssMiB, 0))),
    peakGpuResidentMiB: Math.max(...samples.map(s => s.models.reduce((sum, m) => sum + (m.gpuResidentMiB ?? 0), 0))),
    // Conservative upper bound: RSS and GTT may overlap; never call RSS alone unified memory.
    peakCombinedFraction: Math.max(...samples.map(s => s.models.reduce((sum, m) => sum + m.rssMiB + (m.gpuResidentMiB ?? 0), 0) / s.totalMiB)),
    gpuMeasured: samples.some(s => s.models.some(m => m.gpuResidentMiB !== null)),
    peakSystemCpuPercent: Math.max(0, ...cpu),
    swapInDelta: last.swapIn - first.swapIn, swapOutDelta: last.swapOut - first.swapOut,
    oomKillDelta: last.oomKills - first.oomKills,
  };
}

export function resourcesPass(summary: ReturnType<typeof summarizeResources>): boolean {
  return !!summary && summary.samples >= 2 && summary.gpuMeasured &&
    summary.minAvailableMiB > 200 && summary.peakCombinedFraction < 0.75 &&
    summary.swapInDelta === 0 && summary.swapOutDelta === 0 && summary.oomKillDelta === 0;
}
