import { DEFAULT_SKIN, type SkinId } from "@/app/game/skins";

export interface TetrisStats {
  score: number;
  lines: number;
  level: number;
}

export interface TetrisCallbacks {
  onStats: (stats: TetrisStats) => void;
  onGameOver: (finalScore: number) => void;
}

export interface TetrisGame {
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
  forceGameOver: () => void;
  // Cambia solo la paleta; no reinicia ni avanza la simulación.
  setSkin: (skin: SkinId) => void;
}

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const NEXT_BLOCK = 30;

// ===== Skins: paletas de render (solo visual) =====

// Colores de un bloque por tipo de pieza (índice 1..8 = I, O, T, S, Z, J, L, N).
interface TetrisBlockColors {
  fill: string; // relleno principal
  edge: string | null; // borde/trazo (neon: trazo con glow; retro: marco duro)
  inner: string | null; // cuadro interior de textura (solo retro)
}

interface TetrisPalette {
  // null = clearRect (deja ver el negro de .crt-screen, look original).
  background: string | null;
  grid: string;
  // "stroke" = líneas de 0.5px antialias (original); "pixel" = líneas de 1px duras.
  gridStyle: "stroke" | "pixel";
  // "flat" = relleno + franja de brillo (original); "neon" = relleno translúcido
  // + trazo con glow; "pixel" = marco duro + relleno + textura interior.
  blockStyle: "flat" | "neon" | "pixel";
  highlight: string | null; // franja superior de brillo (flat)
  pieces: readonly (TetrisBlockColors | null)[];
  // Pieza fantasma: "alpha" = bloque con transparencia; "outline" = solo contorno.
  ghostStyle: "alpha" | "outline";
  ghostAlpha: number;
  ghostColor: string; // contorno de la fantasma (outline)
  glow: number; // shadowBlur (0 = sin glow)
  smoothing: boolean; // imageSmoothingEnabled
}

const flat = (fill: string): TetrisBlockColors => ({
  fill,
  edge: null,
  inner: null,
});

// Paleta Game Boy DMG (4 tonos) para retro.
const GB_DARKEST = "#0f380f";
const GB_DARK = "#306230";
const GB_LIGHT = "#8bac0f";
const GB_LIGHTEST = "#9bbc0f";

const TETRIS_PALETTES: Record<SkinId, TetrisPalette> = {
  // Look original exacto.
  clasico: {
    background: null,
    grid: "rgba(255,255,255,0.08)",
    gridStyle: "stroke",
    blockStyle: "flat",
    highlight: "rgba(255,255,255,0.12)",
    pieces: [
      null,
      flat("#4dd0e1"), // I - cyan
      flat("#ffd54f"), // O - yellow
      flat("#ba68c8"), // T - purple
      flat("#81c784"), // S - green
      flat("#e57373"), // Z - red
      flat("#90caf9"), // J - pale blue
      flat("#ffb74d"), // L - orange
      flat("#9e9e9e"), // N - tuerca (gris metálico)
    ],
    ghostStyle: "alpha",
    ghostAlpha: 0.2,
    ghostColor: "rgba(255,255,255,0.2)",
    glow: 0,
    smoothing: true,
  },
  // Tokens del sitio (--cyan, --yellow, --green, --magenta) + glow.
  neon: {
    background: "#05030d",
    grid: "rgba(0,245,255,0.07)",
    gridStyle: "stroke",
    blockStyle: "neon",
    highlight: null,
    pieces: [
      null,
      { fill: "rgba(0,245,255,0.22)", edge: "#00f5ff", inner: null }, // I
      { fill: "rgba(245,255,0,0.22)", edge: "#f5ff00", inner: null }, // O
      { fill: "rgba(192,38,255,0.26)", edge: "#c026ff", inner: null }, // T
      { fill: "rgba(0,255,136,0.22)", edge: "#00ff88", inner: null }, // S
      { fill: "rgba(255,0,110,0.26)", edge: "#ff006e", inner: null }, // Z
      { fill: "rgba(47,123,255,0.28)", edge: "#2f7bff", inner: null }, // J
      { fill: "rgba(255,138,0,0.24)", edge: "#ff8a00", inner: null }, // L
      { fill: "rgba(214,220,255,0.18)", edge: "#d6dcff", inner: null }, // N
    ],
    ghostStyle: "alpha",
    ghostAlpha: 0.28,
    ghostColor: "rgba(0,245,255,0.3)",
    glow: 12,
    smoothing: true,
  },
  // 4 tonos Game Boy, bordes duros, sin glow; cada pieza se distingue por
  // la combinación relleno/textura interior.
  retro: {
    background: GB_LIGHTEST,
    grid: GB_LIGHT,
    gridStyle: "pixel",
    blockStyle: "pixel",
    highlight: null,
    pieces: [
      null,
      { fill: GB_DARK, edge: GB_DARKEST, inner: null }, // I
      { fill: GB_DARKEST, edge: GB_DARKEST, inner: GB_LIGHT }, // O
      { fill: GB_LIGHT, edge: GB_DARKEST, inner: GB_DARKEST }, // T
      { fill: GB_DARK, edge: GB_DARKEST, inner: GB_LIGHTEST }, // S
      { fill: GB_DARKEST, edge: GB_DARKEST, inner: GB_DARK }, // Z
      { fill: GB_LIGHT, edge: GB_DARKEST, inner: GB_DARK }, // J
      { fill: GB_DARK, edge: GB_DARKEST, inner: GB_DARKEST }, // L
      { fill: GB_LIGHT, edge: GB_DARKEST, inner: null }, // N
    ],
    ghostStyle: "outline",
    ghostAlpha: 1,
    ghostColor: GB_DARK,
    glow: 0,
    smoothing: false,
  },
};

const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}

function createBoard(): number[][] {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type]!.map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

function collide(
  board: number[][],
  shape: number[][],
  ox: number,
  oy: number
): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

// Pinta un bloque con origen de celda en (px, py) píxeles, sin alpha global.
function paintBlock(
  ctx: CanvasRenderingContext2D,
  palette: TetrisPalette,
  colors: TetrisBlockColors,
  px: number,
  py: number,
  size: number
) {
  const inner = size - 2;
  if (palette.blockStyle === "flat") {
    ctx.fillStyle = colors.fill;
    ctx.fillRect(px + 1, py + 1, inner, inner);
    if (palette.highlight) {
      ctx.fillStyle = palette.highlight;
      ctx.fillRect(px + 1, py + 1, inner, 4);
    }
    return;
  }
  if (palette.blockStyle === "neon") {
    ctx.fillStyle = colors.fill;
    ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
    const edge = colors.edge ?? colors.fill;
    ctx.save();
    ctx.shadowBlur = palette.glow;
    ctx.shadowColor = edge;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 3, py + 3, size - 6, size - 6);
    ctx.restore();
    return;
  }
  // pixel (retro): marco duro de 2px + relleno + textura interior.
  ctx.fillStyle = colors.edge ?? colors.fill;
  ctx.fillRect(px + 1, py + 1, inner, inner);
  ctx.fillStyle = colors.fill;
  ctx.fillRect(px + 3, py + 3, inner - 4, inner - 4);
  if (colors.inner) {
    const core = Math.round(inner / 3);
    const off = Math.round((size - core) / 2);
    ctx.fillStyle = colors.inner;
    ctx.fillRect(px + off, py + off, core, core);
  }
}

// Contorno duro de la pieza fantasma (retro), sin transparencias.
function paintGhostOutline(
  ctx: CanvasRenderingContext2D,
  color: string,
  px: number,
  py: number,
  size: number
) {
  const inner = size - 2;
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, inner, 2);
  ctx.fillRect(px + 1, py + size - 3, inner, 2);
  ctx.fillRect(px + 1, py + 1, 2, inner);
  ctx.fillRect(px + size - 3, py + 1, 2, inner);
}

function drawGrid(ctx: CanvasRenderingContext2D, palette: TetrisPalette) {
  if (palette.gridStyle === "pixel") {
    ctx.fillStyle = palette.grid;
    for (let c = 1; c < COLS; c++) ctx.fillRect(c * BLOCK, 0, 1, ROWS * BLOCK);
    for (let r = 1; r < ROWS; r++) ctx.fillRect(0, r * BLOCK, COLS * BLOCK, 1);
    return;
  }
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function clearCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  palette: TetrisPalette
) {
  if (palette.background === null) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export function createTetrisGame(
  boardCanvas: HTMLCanvasElement,
  nextCanvas: HTMLCanvasElement,
  callbacks: TetrisCallbacks,
  skin: SkinId = DEFAULT_SKIN
): TetrisGame {
  const ctx = boardCanvas.getContext("2d")!;
  const nextCtx = nextCanvas.getContext("2d")!;

  let palette = TETRIS_PALETTES[skin];
  // Sprites precalculados por tipo/tamaño cuando la skin usa glow
  // (shadowBlur por bloque en cada frame es costoso). Se vacía al cambiar skin.
  let spriteCache = new Map<string, HTMLCanvasElement>();

  function applySmoothing() {
    ctx.imageSmoothingEnabled = palette.smoothing;
    nextCtx.imageSmoothingEnabled = palette.smoothing;
  }
  applySmoothing();

  function blockSprite(colorIndex: number, size: number): HTMLCanvasElement {
    const key = `${colorIndex}:${size}`;
    let sprite = spriteCache.get(key);
    if (!sprite) {
      const pad = palette.glow * 2;
      sprite = document.createElement("canvas");
      sprite.width = size + pad * 2;
      sprite.height = size + pad * 2;
      const sctx = sprite.getContext("2d")!;
      paintBlock(sctx, palette, palette.pieces[colorIndex]!, pad, pad, size);
      spriteCache.set(key, sprite);
    }
    return sprite;
  }

  function drawBlock(
    target: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    ghost = false
  ) {
    if (!colorIndex) return;
    const px = x * size;
    const py = y * size;
    if (ghost && palette.ghostStyle === "outline") {
      paintGhostOutline(target, palette.ghostColor, px, py, size);
      return;
    }
    target.globalAlpha = ghost ? palette.ghostAlpha : 1;
    if (palette.glow > 0) {
      const pad = palette.glow * 2;
      target.drawImage(blockSprite(colorIndex, size), px - pad, py - pad);
    } else {
      paintBlock(target, palette, palette.pieces[colorIndex]!, px, py, size);
    }
    target.globalAlpha = 1;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (
      e.code === "ArrowLeft" ||
      e.code === "ArrowRight" ||
      e.code === "ArrowDown" ||
      e.code === "ArrowUp" ||
      e.code === "Space"
    ) {
      e.preventDefault();
    }
    if (paused || over) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(board, current.shape, current.x - 1, current.y))
          current.x--;
        break;
      case "ArrowRight":
        if (!collide(board, current.shape, current.x + 1, current.y))
          current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
      default:
        return;
    }
    emitStats();
  }

  let board: number[][];
  let current: Piece;
  let next: Piece;
  let score: number;
  let lines: number;
  let level: number;
  let paused: boolean;
  let over: boolean;
  let dropInterval: number;
  let dropAccum: number;

  let lastScore = -1;
  let lastLines = -1;
  let lastLevel = -1;

  function emitStats() {
    if (score !== lastScore || lines !== lastLines || level !== lastLevel) {
      lastScore = score;
      lastLines = lines;
      lastLevel = level;
      callbacks.onStats({ score, lines, level });
    }
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(board, rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(board, current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(board, current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(board, current.shape, current.x, current.y)) {
      endGame();
    }
    drawNext();
  }

  function endGame() {
    over = true;
    stopLoop();
    emitStats();
    callbacks.onGameOver(score);
  }

  function draw() {
    clearCanvas(ctx, boardCanvas, palette);
    drawGrid(ctx, palette);

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c], BLOCK);

    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(
            ctx,
            current.x + c,
            gy + r,
            current.shape[r][c],
            BLOCK,
            true
          );

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(
            ctx,
            current.x + c,
            current.y + r,
            current.shape[r][c],
            BLOCK
          );
  }

  function drawNext() {
    clearCanvas(nextCtx, nextCanvas, palette);
    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NEXT_BLOCK);
  }

  let animationFrameId: number | null = null;
  let lastTime: number | null = null;

  function loop(ts: number) {
    if (lastTime === null) lastTime = ts;
    const dt = ts - lastTime;
    lastTime = ts;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(board, current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
    emitStats();
    if (over) {
      animationFrameId = null;
      return;
    }
    draw();
    animationFrameId = requestAnimationFrame(loop);
  }

  function startLoop() {
    // Una sola cadena de rAF: si resume() llega repetido, una segunda cadena
    // sobreviviría a stopLoop() y el juego seguiría corriendo en pausa.
    if (animationFrameId !== null) return;
    lastTime = null;
    animationFrameId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function initGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    paused = false;
    over = false;
    dropInterval = 1000;
    dropAccum = 0;
    next = randomPiece();
    spawn();
    lastScore = -1;
    lastLines = -1;
    lastLevel = -1;
    emitStats();
  }

  return {
    start() {
      window.addEventListener("keydown", onKeyDown);
      initGame();
      startLoop();
    },
    pause() {
      paused = true;
      stopLoop();
    },
    resume() {
      if (over) return;
      paused = false;
      startLoop();
    },
    restart() {
      stopLoop();
      initGame();
      startLoop();
    },
    forceGameOver() {
      if (over) return;
      endGame();
    },
    destroy() {
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
    },
    setSkin(nextSkin: SkinId) {
      const nextPalette = TETRIS_PALETTES[nextSkin];
      if (!nextPalette || nextPalette === palette) return;
      palette = nextPalette;
      spriteCache = new Map();
      applySmoothing();
      // Redibujo síncrono sin avanzar la simulación: la vista previa solo se
      // repinta al aparecer pieza, y el tablero queda congelado en pausa o
      // game over (el loop está detenido).
      if (!current || !next) return;
      drawNext();
      if (animationFrameId === null) draw();
    },
  };
}
