// ===== engine.ts — motor de Snake, escrito desde cero =====
// No hay game.js de referencia (ver specs/09-juego-snake.md, Decisiones tomadas).

import { loadSpritesheet, getSpritesheet, FRUIT_FRAMES } from "./spritesheet";
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

export interface SnakeOptions {
  showFps?: boolean; // dibuja el contador de FPS (lo activa ?fps=1)
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
type FruitName = (typeof FRUIT_SPRITE_KEYS)[number];
// Claves del caché de sprites por fruta, precalculadas: sin strings por frame.
const FRUIT_CACHE_KEYS: Record<FruitName, string> = {
  apple: "fruit:apple",
  cherry: "fruit:cherry",
  grape: "fruit:grape",
  strawberry: "fruit:strawberry",
  orange: "fruit:orange",
  watermelon: "fruit:watermelon",
};

// El movimiento de la víbora sigue siendo un paso discreto cada `tickMs`
// (60-150 ms); el reloj que lo dispara avanza en pasos fijos de STEP_MS.
const STEP_MS = 1000 / 120; // paso fijo de simulación
const MAX_STEPS_PER_FRAME = 12; // ~100 ms; el tiempo que sobra se descarta
const FPS_SAMPLE_MS = 500; // ventana del promedio del contador de FPS

interface SpriteEntry {
  sprite: HTMLCanvasElement;
  pad: number; // margen del glow a cada lado; se dibuja en (x - pad, y - pad)
}

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
  skin: SkinId = DEFAULT_SKIN,
  options: SnakeOptions = {}
): SnakeGame {
  // Tablero opaco en las tres skins: el navegador omite la composición alfa.
  const ctx = canvas.getContext("2d", { alpha: false })!;
  let palette = SNAKE_PALETTES[skin] ?? SNAKE_PALETTES[DEFAULT_SKIN];
  // Caché de sprites offscreen de la skin activa; se vacía en setSkin.
  // Claves "<tipo>:<variante>": "seg:head", "seg:body", "fruit:apple"…
  const spriteCache = new Map<string, SpriteEntry>();
  // La escena solo cambia en cada paso de la víbora, al cargar la hoja de
  // frutas, al cambiar de skin o al rearmar la etiqueta de FPS: el resto de
  // frames no se redibuja.
  let needsDraw = true;

  let snake: Cell[] = [];
  let currentDirection: Direction = "right";
  let pendingDirection: Direction = "right";
  let fruit: Cell = { col: 0, row: 0 };
  let fruitSprite: FruitName = "apple";
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
    needsDraw = true;

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

  // Sprite de w × h pintado una sola vez con `paint` (coordenadas locales desde
  // 0,0). Con glow en la skin, se hornea con withGlow y el sprite gana un margen
  // `pad` a cada lado: se dibuja en (x - pad, y - pad). `glowColor` null: sin
  // glow en ninguna skin.
  function getSprite(
    key: string,
    w: number,
    h: number,
    glowColor: string | null,
    paint: (sctx: CanvasRenderingContext2D) => void
  ): SpriteEntry {
    let entry = spriteCache.get(key);
    if (!entry) {
      let sprite = document.createElement("canvas");
      sprite.width = w;
      sprite.height = h;
      paint(sprite.getContext("2d")!);
      let pad = 0;
      if (palette.glow > 0 && glowColor !== null) {
        sprite = withGlow(sprite, palette.glow, glowColor);
        pad = palette.glow * 2;
      }
      entry = { sprite, pad };
      spriteCache.set(key, entry);
    }
    return entry;
  }

  // Pintores de sprites definidos una vez (leen la paleta activa al construir):
  // getSprite no recibe closures nuevas en cada frame.
  function paintHead(sctx: CanvasRenderingContext2D) {
    sctx.fillStyle = palette.head;
    sctx.fillRect(0, 0, CELL - 2, CELL - 2);
  }

  function paintBody(sctx: CanvasRenderingContext2D) {
    sctx.fillStyle = palette.body;
    sctx.fillRect(0, 0, CELL - 2, CELL - 2);
    // Cuadro interior (retro); con glow nunca se dibujaba.
    if (palette.bodyInner && palette.glow === 0) {
      sctx.fillStyle = palette.bodyInner;
      sctx.fillRect(6, 6, CELL - 14, CELL - 14);
    }
  }

  // Fruta activa escalada a la celda (y recoloreada en retro); solo se llama
  // con la hoja ya cargada.
  function paintFruit(sctx: CanvasRenderingContext2D) {
    const frame = FRUIT_FRAMES[fruitSprite];
    const scaled = recolorSprite(
      getSpritesheet()!,
      frame.sx,
      frame.sy,
      frame.sw,
      frame.sh,
      CELL,
      CELL,
      palette.fruitRamp ? rampMapper(palette.fruitRamp) : null,
      palette.fruitRamp
        ? { smoothing: true, hardAlpha: true }
        : { smoothing: true }
    );
    sctx.drawImage(scaled, 0, 0);
  }

  function drawSkinnedFruit() {
    const entry = getSprite(
      FRUIT_CACHE_KEYS[fruitSprite],
      CELL,
      CELL,
      palette.fruitGlow,
      paintFruit
    );
    ctx.drawImage(
      entry.sprite,
      fruit.col * CELL - entry.pad,
      fruit.row * CELL - entry.pad
    );
  }

  // Por frame solo hay drawImage: el glow (shadowBlur) está horneado en los
  // sprites y el contexto principal nunca lo activa. Coordenadas enteras
  // (celdas × 20 y pad entero): sin temblor en retro.
  function draw() {
    needsDraw = false;
    ctx.imageSmoothingEnabled = palette.smoothing;
    // Fondo de color sólido: un fillRect es más barato que una capa cacheada.
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (spritesReady) drawSkinnedFruit();

    const head = getSprite(
      "seg:head",
      CELL - 2,
      CELL - 2,
      palette.head,
      paintHead
    );
    const body = getSprite(
      "seg:body",
      CELL - 2,
      CELL - 2,
      palette.body,
      paintBody
    );
    for (let i = 0; i < snake.length; i++) {
      const segment = snake[i];
      const entry = i === 0 ? head : body;
      ctx.drawImage(
        entry.sprite,
        segment.col * CELL + 1 - entry.pad,
        segment.row * CELL + 1 - entry.pad
      );
    }

    if (options.showFps) drawFps();
  }

  // Contador de FPS (?fps=1): promedio de frames en ventanas de FPS_SAMPLE_MS.
  // Se dibuja fuera de la caché; la etiqueta solo se rearma al cambiar.
  let fpsFrames = 0;
  let fpsWindow = 0; // ms acumulados en la ventana actual
  let fpsLabel = "FPS --";

  function sampleFps(elapsed: number) {
    if (elapsed <= 0) return; // primer frame tras (re)arrancar el loop
    fpsFrames++;
    fpsWindow += elapsed;
    if (fpsWindow >= FPS_SAMPLE_MS) {
      fpsLabel = "FPS " + Math.round((fpsFrames * 1000) / fpsWindow);
      fpsFrames = 0;
      fpsWindow = 0;
      needsDraw = true;
    }
  }

  // Esquina inferior izquierda del tablero.
  function drawFps() {
    ctx.fillStyle = palette.head;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(fpsLabel, 6, canvas.height - 4);
  }

  let animationFrameId: number | null = null;
  let lastTime: number | null = null;
  let accumulator = 0; // ms pendientes de simular
  let tickElapsed = 0; // ms simulados desde el último paso de la víbora

  // Un paso fijo de simulación: avanza el reloj del tick y mueve la víbora
  // cada `tickMs` (el sobrante pasa al siguiente tick, como antes).
  function update(dt: number) {
    tickElapsed += dt;
    while (tickElapsed >= tickMs) {
      step();
      tickElapsed -= tickMs;
      if (over) break;
    }
  }

  function loop(ts: number) {
    if (lastTime === null) lastTime = ts;
    const elapsed = ts - lastTime;
    lastTime = ts;
    if (options.showFps) sampleFps(elapsed);

    // Paso fijo: la simulación es la misma a cualquier tasa de refresco.
    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME && !over) {
      update(STEP_MS);
      accumulator -= STEP_MS;
      steps++;
    }
    // Tope de pasos: el tiempo sobrante se descarta (evita la espiral en
    // equipos lentos y los saltos de varias celdas tras un frame largo).
    if (accumulator >= STEP_MS) accumulator = 0;
    if (needsDraw) draw();

    if (over) {
      animationFrameId = null;
      return;
    }
    animationFrameId = requestAnimationFrame(loop);
  }

  function startLoop() {
    // Una sola cadena de rAF: si resume() llega repetido, una segunda cadena
    // sobreviviría a stopLoop() y el juego seguiría corriendo en pausa.
    if (animationFrameId !== null) return;
    lastTime = null;
    accumulator = 0;
    tickElapsed = 0; // como antes: el progreso hacia el siguiente paso se reinicia
    fpsFrames = 0; // la pausa no cuenta en el promedio
    fpsWindow = 0;
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
    needsDraw = true;
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
        needsDraw = true;
      });
      startLoop();
    },
    pause() {
      if (over) return;
      // Loop detenido en pausa: se pinta un frame y no se vuelve a dibujar
      // hasta resume().
      stopLoop();
      draw();
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
      spriteCache.clear(); // los sprites se rehacen con la skin nueva al usarse
      // En pausa o game over el loop está detenido: repinta un frame sin simular.
      // En partida el cambio se ve en el siguiente frame.
      if (animationFrameId === null && snake.length > 0) draw();
      else needsDraw = true;
    },
  };
}
