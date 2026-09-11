import { readFile, statfs } from 'node:fs/promises';
export interface ResourceSnapshot { availableMiB: number; totalMiB: number; swapInUseMiB: number; modelBusy: boolean; modelId?: string }
export async function localMemory(): Promise<Omit<ResourceSnapshot, 'modelBusy' | 'modelId'>> {
  const values = Object.fromEntries((await readFile('/proc/meminfo', 'utf8')).split('\n').map(line => line.match(/^(\w+):\s+(\d+)/)).filter(Boolean).map(match => [match![1], Number(match![2]) / 1024]));
  return { availableMiB: values.MemAvailable, totalMiB: values.MemTotal, swapInUseMiB: values.SwapTotal - values.SwapFree };
}
export async function localDisk() {
  const disk = await statfs(process.cwd());
  const totalBytes = Number(disk.blocks) * Number(disk.bsize);
  const availableBytes = Number(disk.bavail) * Number(disk.bsize);
  return { availableGiB: availableBytes / 1024 ** 3, totalGiB: totalBytes / 1024 ** 3, availableFraction: totalBytes ? availableBytes / totalBytes : 0 };
}
export function canAcceptRun(snapshot: ResourceSnapshot, requiredModel: string) {
  return snapshot.availableMiB > 200 && snapshot.availableMiB / snapshot.totalMiB > 0.25 && snapshot.swapInUseMiB === 0 && !snapshot.modelBusy && (!snapshot.modelId || snapshot.modelId === requiredModel);
}
