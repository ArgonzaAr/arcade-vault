// ===== engine.ts — motor de Snake, escrito desde cero =====
// No hay game.js de referencia (ver specs/09-juego-snake.md, Decisiones tomadas).

import {
  loadSpritesheet,
  drawFruit,
  getSpritesheet,
  FRUIT_FRAMES,
} from "./spritesheet";
import {
  DEFAULT_SKIN,
  rampMapper,
  recolorSprite,
  withGlow,
  type SkinId,
} from "../skins";

export interface SnakeStats {
  score: number;
  length: number; // segmentos de la víbora, incluida la cabeza
  level: number;
}

export interface SnakeCallbacks {
  onStats: (stats: SnakeStats) => void;
  onGameOver: (finalScore: number) => void;
}

export interface SnakeGame {
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
  forceGameOver: () => void;
  // Cambia solo el aspecto; no reinicia ni avanza la simulación.
  setSkin: (skin: SkinId) => void;
}

// ===== Paletas por skin (solo visuales) =====
interface SnakePalette {
  background: string;
  head: string;
  body: string;
  bodyInner: string | null; // cuadro interior de cada segmento del cuerpo
  glow: number; // shadowBlur de los segmentos; 0 = sin glow
  fruitGlow: string | null; // fruta con su sprite original + glow de este tono
  fruitRamp: readonly string[] | null; // fruta recoloreada a estos tonos (oscuro → claro)
  smoothing: boolean;
}

const SNAKE_PALETTES: Record<SkinId, SnakePalette> = {
  // Look original exacto.
  clasico: {
    background: "#000",
    head: "#81c784",
    body: "#4caf50",
    bodyInner: null,
    glow: 0,
    fruitGlow: null,
    fruitRamp: null,
    smoothing: true,
  },
  neon: {
    background: "#05030d",
    head: "#00f5ff",
    body: "#00ff88",
    bodyInner: null,
    glow: 10,
    fruitGlow: "#ff006e",
    fruitRamp: null,
    smoothing: true,
  },
  // Game Boy DMG de 4 tonos.
  retro: {
    background: "#9bbc0f",
    head: "#0f380f",
    body: "#306230",
    bodyInner: "#8bac0f",
    glow: 0,
    fruitGlow: null,
    fruitRamp: ["#0f380f", "#306230", "#306230", "#8bac0f"],
    smoothing: false,
  },
};

const CELL = 20; // px por celda
const COLS = 40;
const ROWS = 30; // 800x600 / 20
const INITIAL_LENGTH = 3;
const INITIAL_TICK_MS = 150; // ms por paso de movimiento
const MIN_TICK_MS = 60; // velocidad máxima
const TICK_DECREASE_PER_FRUIT = 5; // ms que baja el tick por cada fruta (hasta el mínimo)
const FRUITS_PER_LEVEL = 5; // frutas comidas para subir 1 nivel
const POINTS_PER_FRUIT = 10;
const FRUIT_SPRITE_KEYS = [
  "apple",
  "cherry",
  "grape",
  "strawberry",
  "orange",
  "watermelon",
] as const;

interface Cell {
  col: number;
  row: number;
}

type Direction = "up" | "down" | "left" | "right";

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const DELTA: Record<Direction, Cell> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  w: "up",
  W: "up",
  ArrowDown: "down",
  s: "down",
  S: "down",
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
};

export function createSnakeGame(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks,
  skin: SkinId = DEFAULT_SKIN
): SnakeGame {
  const ctx = canvas.getContext("2d")!;
  let palette = SNAKE_PALETTES[skin] ?? SNAKE_PALETTES[DEFAULT_SKIN];
  // Sprites precalculados de la skin activa (segmentos con glow, frutas recoloreadas).
  let spriteCache = new Map<string, HTMLCanvasElement>();

  let snake: Cell[] = [];
  let currentDirection: Direction = "right";
  let pendingDirection: Direction = "right";
  let fruit: Cell = { col: 0, row: 0 };
  let fruitSprite: (typeof FRUIT_SPRITE_KEYS)[number] = "apple";
  let score = 0;
  let level = 1;
  let tickMs = INITIAL_TICK_MS;
  let fruitsEaten = 0;
  let over = false;
  let spritesReady = false;

  let lastScore = -1;
  let lastLength = -1;
  let lastLevel = -1;

  function emitStats() {
    const length = snake.length;
    if (score !== lastScore || length !== lastLength || level !== lastLevel) {
      lastScore = score;
      lastLength = length;
      lastLevel = level;
      callbacks.onStats({ score, length, level });
    }
  }

  function isOccupied(cell: Cell): boolean {
    return snake.some((s) => s.col === cell.col && s.row === cell.row);
  }

  function placeFruit() {
    let candidate: Cell;
    let attempts = 0;
    do {
      candidate = {
        col: Math.floor(Math.random() * COLS),
        row: Math.floor(Math.random() * ROWS),
      };
      attempts++;
    } while (isOccupied(candidate) && attempts < COLS * ROWS);
    fruit = candidate;
    fruitSprite =
      FRUIT_SPRITE_KEYS[Math.floor(Math.random() * FRUIT_SPRITE_KEYS.length)];
  }

  function onKeyDown(e: KeyboardEvent) {
    const direction = KEY_TO_DIRECTION[e.key];
    if (!direction) return;
    e.preventDefault();
    if (direction === OPPOSITE[currentDirection]) return;
    pendingDirection = direction;
  }

  function endGame() {
    if (over) return;
    over = true;
    stopLoop();
    emitStats();
    callbacks.onGameOver(score);
  }

  function step() {
    if (over) return;

    currentDirection = pendingDirection;
    const delta = DELTA[currentDirection];
    const head = snake[0];
    const newHead: Cell = {
      col: (head.col + delta.col + COLS) % COLS,
      row: (head.row + delta.row + ROWS) % ROWS,
    };

    if (isOccupied(newHead)) {
      endGame();
      return;
    }

    snake.unshift(newHead);

    if (newHead.col === fruit.col && newHead.row === fruit.row) {
      score += POINTS_PER_FRUIT;
      fruitsEaten++;
      tickMs = Math.max(MIN_TICK_MS, tickMs - TICK_DECREASE_PER_FRUIT);
      if (fruitsEaten % FRUITS_PER_LEVEL === 0) level++;
      placeFruit();
    } else {
      snake.pop();
    }

    emitStats();
  }

  function cached(key: string, build: () => HTMLCanvasElement | null) {
    let sprite = spriteCache.get(key);
    if (!sprite) {
      const built = build();
      if (!built) return null;
      sprite = built;
      spriteCache.set(key, sprite);
    }
    return sprite;
  }

  function glowSegment(color: string) {
    return cached("seg:" + color, () => {
      const base = document.createElement("canvas");
      base.width = CELL - 2;
      base.height = CELL - 2;
      const bctx = base.getContext("2d")!;
      bctx.fillStyle = color;
      bctx.fillRect(0, 0, base.width, base.height);
      return withGlow(base, palette.glow, color);
    });
  }

  function skinnedFruit(name: string) {
    return cached("fruit:" + name, () => {
      const sheet = getSpritesheet();
      const frame = FRUIT_FRAMES[name];
      if (!sheet || !frame) return null;
      const args = [sheet, frame.sx, frame.sy, frame.sw, frame.sh] as const;
      if (palette.fruitRamp) {
        return recolorSprite(
          ...args,
          CELL,
          CELL,
          rampMapper(palette.fruitRamp),
          { smoothing: true, hardAlpha: true }
        );
      }
      const sprite = recolorSprite(...args, CELL, CELL, null, {
        smoothing: true,
      });
      return palette.fruitGlow
        ? withGlow(sprite, palette.glow, palette.fruitGlow)
        : sprite;
    });
  }

  function drawSkinnedFruit() {
    const x = fruit.col * CELL;
    const y = fruit.row * CELL;
    if (!palette.fruitGlow && !palette.fruitRamp) {
      drawFruit(ctx, fruitSprite, x, y, CELL, CELL);
      return;
    }
    const sprite = skinnedFruit(fruitSprite);
    if (!sprite) return;
    const pad = (sprite.width - CELL) / 2;
    ctx.drawImage(sprite, x - pad, y - pad);
  }

  function draw() {
    ctx.imageSmoothingEnabled = palette.smoothing;
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (spritesReady) drawSkinnedFruit();

    for (let i = 0; i < snake.length; i++) {
      const segment = snake[i];
      const color = i === 0 ? palette.head : palette.body;
      const x = segment.col * CELL + 1;
      const y = segment.row * CELL + 1;
      if (palette.glow > 0) {
        const sprite = glowSegment(color);
        if (sprite) {
          const pad = palette.glow * 2;
          ctx.drawImage(sprite, x - pad, y - pad);
        }
        continue;
      }
      ctx.fillStyle = color;
      ctx.fillRect(x, y, CELL - 2, CELL - 2);
      if (i > 0 && palette.bodyInner) {
        ctx.fillStyle = palette.bodyInner;
        ctx.fillRect(x + 6, y + 6, CELL - 14, CELL - 14);
      }
    }
  }

  let animationFrameId: number | null = null;
  let lastTime: number | null = null;
  let accumulator = 0;

  function loop(ts: number) {
    if (lastTime === null) lastTime = ts;
    const dt = ts - lastTime;
    lastTime = ts;

    accumulator += dt;
    while (accumulator >= tickMs) {
      step();
      accumulator -= tickMs;
      if (over) break;
    }
    draw();

    if (over) {
      animationFrameId = null;
      return;
    }
    animationFrameId = requestAnimationFrame(loop);
  }

  function startLoop() {
    lastTime = null;
    accumulator = 0;
    animationFrameId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function initGame() {
    const startCol = Math.floor(COLS / 2);
    const startRow = Math.floor(ROWS / 2);
    snake = [];
    for (let i = 0; i < INITIAL_LENGTH; i++) {
      snake.push({ col: startCol - i, row: startRow });
    }
    currentDirection = "right";
    pendingDirection = "right";
    score = 0;
    level = 1;
    tickMs = INITIAL_TICK_MS;
    fruitsEaten = 0;
    over = false;
    lastScore = -1;
    lastLength = -1;
    lastLevel = -1;
    placeFruit();
    emitStats();
  }

  return {
    start() {
      document.addEventListener("keydown", onKeyDown);
      initGame();
      spritesReady = false;
      loadSpritesheet(() => {
        spritesReady = true;
      });
      startLoop();
    },
    pause() {
      stopLoop();
    },
    resume() {
      if (over) return;
      startLoop();
    },
    restart() {
      stopLoop();
      initGame();
      startLoop();
    },
    forceGameOver() {
      endGame();
    },
    destroy() {
      stopLoop();
      document.removeEventListener("keydown", onKeyDown);
    },
    setSkin(nextSkin: SkinId) {
      const next = SNAKE_PALETTES[nextSkin];
      if (!next || next === palette) return;
      palette = next;
      spriteCache = new Map();
      // En pausa o game over el loop está detenido: repinta un frame sin simular.
      if (animationFrameId === null && snake.length > 0) draw();
    },
  };
}
