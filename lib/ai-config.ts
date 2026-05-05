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
  return process.env.DEEPSEEK_API_KEY;
}
