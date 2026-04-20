import { spawn } from "child_process";
import { isAiHealthy } from "./ai-health";
import path from "path";

/**
 * Ensures the MLX server is running.
 * If not responding, it spawns the ./scripts/mlx-server.sh script in the background.
 */
export async function ensureMlxServer(): Promise<void> {
  const engine = process.env.AI_ENGINE ?? "ollama";
  if (engine !== "mlx") return;

  const baseUrl = process.env.MLX_BASE_URL ?? "http://localhost:8080/v1";
  
  const healthy = await isAiHealthy("mlx", baseUrl);
  if (healthy) {
    console.log("[mlx] Server is already healthy.");
    return;
  }

  console.log("[mlx] Server not responding. Attempting to start via scripts/mlx-server.sh...");

  // We spawn the script and detach it so it doesn't die when this request finishes
  // However, we want to at least wait a bit or just fire and forget if we're in a background task
  const scriptPath = path.join(process.cwd(), "scripts", "mlx-server.sh");
  
  const child = spawn("bash", [scriptPath], {
    detached: true,
    stdio: "ignore", // We don't want to pipe logs to the main process to avoid blocking
    cwd: process.cwd(),
  });

  child.unref();

  // Poll for health until it's up or we timeout (e.g., 60s for large models)
  console.log("[mlx] Waiting for server to become healthy...");
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const isUp = await isAiHealthy("mlx", baseUrl);
    if (isUp) {
      console.log("[mlx] Server is now healthy and ready.");
      return;
    }
    if (i % 5 === 0 && i > 0) {
      console.log(`[mlx] Still waiting... (attempt ${i}/${maxAttempts})`);
    }
  }

  console.warn("[mlx] Server failed to become healthy within the timeout period.");
}
