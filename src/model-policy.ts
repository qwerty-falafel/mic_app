const models = new Map([
  ['coding:standard', 'llama.cpp/gpt-oss-120b-F16'],
  ['coding:senior', 'llama.cpp/gpt-oss-120b-F16'],
  ['analysis:standard', 'llama.cpp/gpt-oss-120b-F16'],
]);
export function selectModel(capability: string, tier: string) {
  const model = models.get(`${capability}:${tier}`);
  if (!model) throw new Error(`No model configured for ${capability}:${tier}`);
  return model;
}
