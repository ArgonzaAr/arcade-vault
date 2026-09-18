// ===== engine.ts — motor de Snake, escrito desde cero =====
// No hay game.js de referencia (ver specs/09-juego-snake.md, Decisiones tomadas).

import { loadSpritesheet, drawFruit } from "./spritesheet";

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
}

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
  callbacks: SnakeCallbacks
): SnakeGame {
  const ctx = canvas.getContext("2d")!;

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

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (spritesReady) {
      drawFruit(
        ctx,
        fruitSprite,
        fruit.col * CELL,
        fruit.row * CELL,
        CELL,
        CELL
      );
    }

    ctx.fillStyle = "#4caf50";
    for (let i = 0; i < snake.length; i++) {
      const segment = snake[i];
      ctx.fillStyle = i === 0 ? "#81c784" : "#4caf50";
      ctx.fillRect(
        segment.col * CELL + 1,
        segment.row * CELL + 1,
        CELL - 2,
        CELL - 2
      );
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
  };
}
