// ===== skins.ts — skins visuales comunes a todos los motores =====
// Las skins solo cambian el aspecto (paletas, glow, suavizado); nunca la
// mecánica, la puntuación ni los controles de un juego.

export type SkinId = "clasico" | "neon" | "retro";

export const SKIN_IDS: readonly SkinId[] = ["clasico", "neon", "retro"];

export const SKIN_LABELS: Record<SkinId, string> = {
  clasico: "CLÁSICO",
  neon: "NEÓN",
  retro: "RETRO",
};

export const DEFAULT_SKIN: SkinId = "clasico";

export function isSkinId(value: unknown): value is SkinId {
  return (
    typeof value === "string" && (SKIN_IDS as readonly string[]).includes(value)
  );
}

// ===== Utilidades de render compartidas por los motores con spritesheet =====
// Se ejecutan solo en el navegador (crean canvas offscreen) y el resultado se
// cachea por skin: nunca se llaman en cada frame.

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Paleta limitada: cuantiza la luminancia normalizada a `tones` (oscuro → claro). */
export function rampMapper(tones: readonly string[]): (n: number) => Rgb {
  const rgb = tones.map(hexToRgb);
  return (n) => rgb[Math.min(rgb.length - 1, Math.floor(n * rgb.length))]!;
}

/** Tinte saturado: el tono `color` escalado por la luminancia, con brillos hacia blanco. */
export function tintMapper(color: string, floor = 0.35): (n: number) => Rgb {
  const [r, g, b] = hexToRgb(color);
  return (n) => {
    const v = floor + (1 - floor) * n;
    const w = Math.max(0, (n - 0.85) / 0.15) * 0.5;
    return [
      Math.round(r * v + (255 - r * v) * w),
      Math.round(g * v + (255 - g * v) * w),
      Math.round(b * v + (255 - b * v) * w),
    ];
  };
}

/**
 * Dibuja la región (sx, sy, sw, sh) de `source` a w×h en un canvas offscreen y,
 * si hay `map`, reemplaza el color de cada píxel visible según su luminancia
 * normalizada (0 = píxel más oscuro del sprite, 1 = más claro). Con
 * `hardAlpha` el alfa queda binario (bordes duros, estilo 8-bit).
 */
export function recolorSprite(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  w: number,
  h: number,
  map: ((n: number) => Rgb) | null,
  { smoothing = false, hardAlpha = false } = {}
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d", { willReadFrequently: true })!;
  octx.imageSmoothingEnabled = smoothing;
  octx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
  if (!map && !hardAlpha) return out;

  const img = octx.getImageData(0, 0, w, h);
  const d = img.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! < 128) continue;
    const l = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    if (l < min) min = l;
    if (l > max) max = l;
  }
  const span = max - min || 1;
  for (let i = 0; i < d.length; i += 4) {
    if (hardAlpha) d[i + 3] = d[i + 3]! < 128 ? 0 : 255;
    if (!map || d[i + 3] === 0) continue;
    const l = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    const [r, g, b] = map(Math.max(0, Math.min(1, (l - min) / span)));
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  octx.putImageData(img, 0, 0);
  return out;
}

/** Copia `sprite` con un margen `pad = blur * 2` y glow del color dado (se dibuja en x - pad, y - pad). */
export function withGlow(
  sprite: HTMLCanvasElement,
  blur: number,
  color: string
): HTMLCanvasElement {
  const pad = blur * 2;
  const out = document.createElement("canvas");
  out.width = sprite.width + pad * 2;
  out.height = sprite.height + pad * 2;
  const octx = out.getContext("2d")!;
  octx.shadowBlur = blur;
  octx.shadowColor = color;
  octx.drawImage(sprite, pad, pad);
  return out;
}
