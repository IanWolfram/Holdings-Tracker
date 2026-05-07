import * as THREE from "three";

const TEX_SIZE = 256;
const FALLBACK_BG = "#0a0a0a";
const FALLBACK_FG = "#00FF88";

export function createFallbackTexture(ticker: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = FALLBACK_BG;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  const initials = ticker.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase();
  ctx.fillStyle = FALLBACK_FG;
  ctx.font = `bold ${TEX_SIZE * 0.38}px "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials, TEX_SIZE / 2, TEX_SIZE / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export async function loadLogoTexture(ticker: string): Promise<THREE.CanvasTexture | null> {
  try {
    const url = `https://assets.parqet.com/logos/symbol/${encodeURIComponent(ticker)}?format=svg`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = objectUrl;
    });

    URL.revokeObjectURL(objectUrl);

    const canvas = document.createElement("canvas");
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = FALLBACK_BG;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    const padding = TEX_SIZE * 0.12;
    const innerSize = TEX_SIZE - padding * 2;
    ctx.drawImage(img, padding, padding, innerSize, innerSize);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  } catch {
    return null;
  }
}