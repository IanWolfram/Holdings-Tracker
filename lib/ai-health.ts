export async function isAiHealthy(engine: string, baseUrl: string): Promise<boolean> {
  try {
    if (engine === "mlx") {
      // MLX server on port 8080 (OpenAI compatible)
      const res = await fetch(`${baseUrl}/models`, {
        signal: AbortSignal.timeout(2_000),
      });
      return res.ok;
    } else {
      // Ollama on port 11434
      const res = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(2_000),
      });
      return res.ok;
    }
  } catch {
    return false;
  }
}
