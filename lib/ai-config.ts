export type AiProvider = "local" | "deepseek" | "openai";

export interface SavedModel {
  id: string;
  name: string;
  provider: AiProvider;
  model: string;
}

const DEEPSEEK_MODEL: SavedModel = {
  id: "deepseek",
  name: "DeepSeek",
  provider: "deepseek",
  model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
};

export function getActiveModel(): SavedModel {
  return DEEPSEEK_MODEL;
}

export function getModelKey(_modelId: string): string | undefined {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY;
  // Fallback: legacy multi-model config wrote keys as MODEL_KEY_deepseek_<suffix>.
  const legacy = Object.entries(process.env).find(
    ([k, v]) => k.startsWith("MODEL_KEY_deepseek") && typeof v === "string" && v.length > 0,
  );
  return legacy?.[1];
}
