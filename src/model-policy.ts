const models = new Map([
  ['coding:standard', 'llama.cpp/Qwen3.8-27b-q8'],
  ['coding:senior', 'llama.cpp/Qwen3.8-27b-q8'],
  ['analysis:standard', 'llama.cpp/Qwen3.8-27b-q8'],
]);
export function selectModel(capability: string, tier: string) {
  const model = models.get(`${capability}:${tier}`);
  if (!model) throw new Error(`No model configured for ${capability}:${tier}`);
  return model;
}
