// ===== spritesheet.ts — helper de dibujo por sprites, portado de =====
// references/source-assets/snake-assets/sprites.js

export interface SpriteFrame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export const FRUIT_FRAMES: Record<string, SpriteFrame> = {
  apple: { sx: 2786, sy: 136, sw: 110, sh: 160 },
  cherry: { sx: 1066, sy: 136, sw: 110, sh: 160 },
  grape: { sx: 378, sy: 136, sw: 110, sh: 160 },
  strawberry: { sx: 894, sy: 136, sw: 110, sh: 160 },
  orange: { sx: 186, sy: 136, sw: 150, sh: 160 },
  watermelon: { sx: 1734, sy: 136, sw: 150, sh: 160 },
};

let ssImg: HTMLCanvasElement | null = null;
let ssLoaded = false;
let ssCallbacks: Array<() => void> = [];

export function loadSpritesheet(cb: () => void): void {
  if (ssLoaded) {
    cb();
    return;
  }
  ssCallbacks.push(cb);
  if (ssImg) return;

  const rawImg = new Image();
  rawImg.onload = () => {
    const oc = document.createElement("canvas");
    oc.width = rawImg.width;
    oc.height = rawImg.height;
    const octx = oc.getContext("2d")!;
    octx.drawImage(rawImg, 0, 0);
    ssImg = oc;
    ssLoaded = true;
    ssCallbacks.forEach((f) => f());
    ssCallbacks = [];
  };
  rawImg.onerror = () => console.error("Failed to load spritesheet");
  rawImg.src = "/games/snake/fruits.png";
}

export function drawFruit(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  if (!ssLoaded || !ssImg) return;
  const frame = FRUIT_FRAMES[name];
  if (!frame) return;
  ctx.drawImage(ssImg, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
}
