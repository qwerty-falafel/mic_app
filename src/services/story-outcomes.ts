import { parse as parseYaml } from 'yaml';

export type StoryOutcome = { id: string; title: string; description: string; beneficiary: string; action: string; motive: string; capabilityIds: string[]; specCheckpoint: boolean; doneCheckpoint: boolean; invokeDevWith: string; warnings: string[] };
const taskTitle = /^(?:add|build|create|implement|refactor|test|write|constraint|fix)\b/i;
const genericBeneficiary = /^(?:user|developer|team|system|application|app)$/i;

export function capabilityIdsFromSpec(spec: string) {
  return [...new Set(spec.match(/\bCAP-\d+\b/gi)?.map(value => value.toUpperCase()) ?? [])];
}

export function analyseStoryInventory(content: string, specContent: string) {
  const issues: string[] = [], warnings: string[] = [], stories: StoryOutcome[] = [];
  let value: any;
  try { value = parseYaml(content); } catch { return { stories, issues: ['stories.yaml is not valid YAML'], warnings }; }
  if (!Array.isArray(value)) return { stories, issues: ['stories.yaml must be a top-level list'], warnings };
  const available = new Set(capabilityIdsFromSpec(specContent)), ids: string[] = [];
  for (const [index, entry] of value.entries()) {
    const label = `Story ${index + 1}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { issues.push(`${label} must be a mapping`); continue; }
    const id = entry.id, title = entry.title, description = entry.description;
    if (typeof id !== 'string' || !/^[A-Za-z0-9-]+$/.test(id)) issues.push(`${label} id must be a quoted string containing only letters, digits, and dashes`); else ids.push(id);
    if (typeof title !== 'string' || !title.trim() || /[\r\n]/.test(title)) issues.push(`${label} requires a one-line title`);
    if (typeof description !== 'string' || !description.trim()) { issues.push(`${label} requires a description`); continue; }
    if ('status' in entry) issues.push(`${label} must not contain status`);
    for (const key of ['spec_checkpoint', 'done_checkpoint']) if (key in entry && typeof entry[key] !== 'boolean') issues.push(`${label} ${key} must be boolean`);
    if ('invoke_dev_with' in entry && typeof entry.invoke_dev_with !== 'string') issues.push(`${label} invoke_dev_with must be a string`);
    const match = description.trim().match(/^As (?:a|an|the) ([^,]+), I want (?:to )?([\s\S]+?), so that ([\s\S]+?)\.\s+Covers ([\s\S]+?)\.?$/i);
    const coverage = match?.[4]?.trim() ?? '';
    const capabilityIds = [...new Set(coverage.match(/CAP-\d+/gi)?.map(value => value.toUpperCase()) ?? [])];
    const coverageRemainder = coverage.replace(/CAP-\d+/gi, '').replace(/\band\b/gi, '').replace(/[\s,.]/g, '');
    if (!match || !capabilityIds.length || coverageRemainder) { issues.push(`${label} description must state beneficiary, observable outcome, motive, and CAP-N coverage`); continue; }
    for (const capability of capabilityIds) if (!available.has(capability)) issues.push(`${label} cites unknown capability ${capability}`);
    const storyWarnings: string[] = [];
    if (genericBeneficiary.test(match[1]!.trim())) storyWarnings.push('Beneficiary may be too generic');
    if (typeof title === 'string' && taskTitle.test(title.trim())) storyWarnings.push('Title appears implementation-task shaped');
    warnings.push(...storyWarnings.map(warning => `${label}: ${warning}`));
    stories.push({ id: String(id ?? ''), title: String(title ?? ''), description, beneficiary: match[1]!.trim(), action: match[2]!.trim(), motive: match[3]!.trim(), capabilityIds, specCheckpoint: entry.spec_checkpoint === true, doneCheckpoint: entry.done_checkpoint === true, invokeDevWith: typeof entry.invoke_dev_with === 'string' ? entry.invoke_dev_with : '', warnings: storyWarnings });
  }
  if (!value.length) issues.push('stories.yaml requires at least one Story');
  if (new Set(ids).size !== ids.length) issues.push('stories.yaml requires unique Story ids');
  for (const id of ids) if (ids.some(other => other !== id && other.startsWith(`${id}-`))) issues.push(`Story ids must be prefix-free: ${id}`);
  const covered = new Set(stories.flatMap(story => story.capabilityIds));
  const missing = [...available].filter(capability => !covered.has(capability));
  if (missing.length) issues.push(`stories.yaml does not account for governing capabilities: ${missing.join(', ')}`);
  return { stories, issues: [...new Set(issues)], warnings };
}
