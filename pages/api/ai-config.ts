import { NextApiRequest, NextApiResponse } from "next";
import {
  getAiConfig,
  getModelKey,
  addModel,
  removeModel,
  setActiveModel,
  LOCAL_MODEL,
  type SavedModel,
} from "@/lib/ai-config";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const config = getAiConfig();
    const supportsLocalMlx = process.platform === "darwin" && process.arch === "arm64";
    const allModels = [
      ...(supportsLocalMlx ? [LOCAL_MODEL] : []),
      ...config.models,
    ].map((m) => ({
      ...m,
      hasKey: m.provider === "local" ? true : Boolean(getModelKey(m.id)),
    }));
    return res.status(200).json({
      activeModelId: config.activeModelId,
      models: allModels,
      supportsLocalMlx,
    });
  }

  if (req.method === "POST") {
    const { action } = req.body as { action: string };

    if (action === "add") {
      const { name, provider, model, apiKey } = req.body as {
        name?: string;
        provider?: string;
        model?: string;
        apiKey?: string;
      };
      if (!name || !provider || !model) {
        return res.status(400).json({ error: "name, provider, and model are required" });
      }
      const id = `${provider}_${Date.now()}`;
      const saved: SavedModel = { id, name, provider: provider as SavedModel["provider"], model };
      addModel(saved, apiKey);
      setActiveModel(id);
      return res.status(200).json({ ok: true, id });
    }

    if (action === "select") {
      const { id } = req.body as { id?: string };
      if (!id) return res.status(400).json({ error: "id is required" });
      setActiveModel(id);
      return res.status(200).json({ ok: true });
    }

    if (action === "remove") {
      const { id } = req.body as { id?: string };
      if (!id || id === "local") return res.status(400).json({ error: "invalid id" });
      removeModel(id);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "unknown action" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
