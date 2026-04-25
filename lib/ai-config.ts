import fs from "fs";
import path from "path";

export type AiProvider = "local" | "deepseek" | "openai";

export interface SavedModel {
  id: string;
  name: string;
  provider: AiProvider;
  model: string;
}

export interface AiConfig {
  activeModelId: string;
  models: SavedModel[];
}

function getUserDataPath(): string {
  return process.env.PULSE_USER_DATA_PATH ?? process.cwd();
}

function getConfigPath(): string {
  return path.join(getUserDataPath(), ".ai-config.json");
}

function getEnvPath(): string {
  return path.join(getUserDataPath(), ".env.local");
}

export const LOCAL_MODEL: SavedModel = {
  id: "local",
  name: "Local MLX",
  provider: "local",
  model: process.env.MLX_MODEL ?? "mlx-community/DeepSeek-R1-Distill-Qwen-14B-4bit",
};

let cached: AiConfig | null = null;

export function getAiConfig(): AiConfig {
  if (cached) return cached;
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Migrate from old format { engine, deepseekModel }
    if (!Array.isArray(parsed.models)) {
      const models: SavedModel[] = [];
      if (parsed.engine === "deepseek" && process.env.DEEPSEEK_API_KEY) {
        const id = "deepseek_migrated";
        models.push({ id, name: "DeepSeek V3", provider: "deepseek", model: String(parsed.deepseekModel ?? "deepseek-chat") });
        // Migrate the key to the new env var name
        if (!process.env[`MODEL_KEY_${id}`]) {
          process.env[`MODEL_KEY_${id}`] = process.env.DEEPSEEK_API_KEY;
        }
      }
      cached = { activeModelId: models.length > 0 ? models[0].id : "local", models };
      saveConfig(cached);
    } else {
      cached = parsed as unknown as AiConfig;
    }
  } catch {
    cached = { activeModelId: "local", models: [] };
  }
  return cached;
}

export function getActiveModel(): SavedModel {
  const config = getAiConfig();
  if (config.activeModelId === "local") return LOCAL_MODEL;
  return config.models.find((m) => m.id === config.activeModelId) ?? LOCAL_MODEL;
}

export function getModelKey(modelId: string): string | undefined {
  return process.env[`MODEL_KEY_${modelId}`];
}

function saveConfig(config: AiConfig): void {
  cached = config;
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error("[ai-config] Failed to persist config:", err);
  }
}

export function addModel(model: SavedModel, apiKey?: string): void {
  const config = getAiConfig();
  const existing = config.models.findIndex((m) => m.id === model.id);
  if (existing >= 0) {
    config.models[existing] = model;
  } else {
    config.models.push(model);
  }
  saveConfig(config);
  if (apiKey) setModelKey(model.id, apiKey);
}

export function removeModel(id: string): void {
  if (id === "local") return;
  const config = getAiConfig();
  config.models = config.models.filter((m) => m.id !== id);
  if (config.activeModelId === id) config.activeModelId = "local";
  saveConfig(config);
}

export function setActiveModel(id: string): void {
  const config = getAiConfig();
  config.activeModelId = id;
  saveConfig(config);
}

export function setModelKey(modelId: string, apiKey: string): void {
  const envKey = `MODEL_KEY_${modelId}`;
  process.env[envKey] = apiKey;
  const envPath = getEnvPath();

  try {
    let content = "";
    try { content = fs.readFileSync(envPath, "utf-8"); } catch { /* new file */ }

    const keyLine = `${envKey}=${apiKey}`;
    const pattern = new RegExp(`^${envKey}=.*`, "m");
    if (pattern.test(content)) {
      content = content.replace(pattern, keyLine);
    } else {
      content = content.trimEnd() + (content ? "\n" : "") + keyLine + "\n";
    }
    fs.writeFileSync(envPath, content, "utf-8");
  } catch (err) {
    console.error("[ai-config] Failed to write .env.local in userData:", err);
  }
}
