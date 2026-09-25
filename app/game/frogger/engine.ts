// ===== engine.ts — motor de Frogger, escrito desde cero =====
// Sin referencia en references/started-games/ ni sprites: todo se dibuja con
// primitivas canvas (ver specs/game-jam/frogger/01-frogger-core.md).

import { DEFAULT_SKIN, withGlow, type SkinId } from "../skins";

export interface FroggerStats {
  score: number;
  lives: number;
  level: number; // ronda actual (sube al llenar las 5 bocas)
}

export interface FroggerCallbacks {
  onStats: (stats: FroggerStats) => void;
  onGameOver: (finalScore: number) => void;
}

export interface FroggerOptions {
  showFps?: boolean; // dibuja el contador de FPS (lo activa ?fps=1)
}

export interface FroggerGame {
  start: () => void;
  // Congela la simulación y detiene el loop (pinta un último frame).
  pause: () => void;
  resume: () => void;
  restart: () => void;
  forceGameOver: () => void;
  // Cambia solo el aspecto; no reinicia ni avanza la simulación.
  setSkin: (skin: SkinId) => void;
  destroy: () => void;
}

const COLS = 16;
const ROWS = 15;
const CELL = 40; // px
const CANVAS_W = COLS * CELL; // 640
const CANVAS_H = ROWS * CELL; // 600
const ROW_HUD = 0;
const ROW_GOALS = 1;
const ROW_RIVER_TOP = 2;
const ROW_RIVER_BOT = 7;
const ROW_SAFE_MID = 8;
const ROW_ROAD_TOP = 9;
const ROW_ROAD_BOT = 13;
const ROW_START = 14;
const GOAL_COLS = [1, 4, 7, 10, 13]; // columna izquierda de cada boca (ocupa col y col+1)
const START_LIVES = 3;
const HOP_MS = 120;
const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGED_MS = 1500;
const LEVEL_SPEED_FACTOR = 1.15; // +15 % de velocidad por nivel
const TIMER_BASE_S = 15;
const TIMER_MIN_S = 8;
const TIMER_STEP_S = 1; // segundos menos por nivel
const POINTS_PER_ROW = 10;
const POINTS_PER_GOAL = 50;
const POINTS_PER_SECOND_LEFT = 10;
const POINTS_PER_ROUND = 200;
const STEP_MS = 1000 / 120; // paso fijo de simulación
const MAX_STEPS_PER_FRAME = 12; // ~100 ms; el tiempo que sobra se descarta
const FPS_SAMPLE_MS = 500; // ventana del promedio del contador de FPS

// ===== Paletas por skin (solo visuales) =====
interface FroggerPalette {
  hudBg: string;
  hudText: string;
  lifeIcon: string;
  timeHigh: string; // barra de tiempo: > 50 %
  timeMid: string; // 25–50 %
  timeLow: string; // < 25 %
  goalRow: string;
  goalSlot: string;
  goalBorder: string;
  river: string;
  safe: string;
  road: string;
  roadLine: string;
  cars: readonly string[]; // un color por carril de coches
  wheel: string;
  truck: string;
  truckCab: string;
  log: string;
  logLine: string;
  turtle: string;
  turtleScale: string;
  turtleSubmerged: string;
  frog: string;
  frogEyeWhite: string;
  frogEyePupil: string;
  glow: number; // shadowBlur de las entidades (0 = sin glow)
  smoothing: boolean; // imageSmoothingEnabled
}

const FROGGER_PALETTES: Record<SkinId, FroggerPalette> = {
  clasico: {
    hudBg: "#000",
    hudText: "#fff",
    lifeIcon: "#76ff03",
    timeHigh: "#43a047",
    timeMid: "#fdd835",
    timeLow: "#e53935",
    goalRow: "#66bb6a",
    goalSlot: "#1b5e20",
    goalBorder: "#ffd700",
    river: "#0d1b4c",
    safe: "#1b3d1b",
    road: "#000",
    roadLine: "#555",
    cars: ["#e53935", "#fdd835", "#1e88e5"],
    wheel: "#111",
    truck: "#9e9e9e",
    truckCab: "#616161",
    log: "#795548",
    logLine: "#4e342e",
    turtle: "#2e7d32",
    turtleScale: "#81c784",
    turtleSubmerged: "rgba(129, 199, 132, 0.35)",
    frog: "#76ff03",
    frogEyeWhite: "#fff",
    frogEyePupil: "#000",
    glow: 0,
    smoothing: true,
  },
  // Fondo casi negro con franjas teñidas por zona y entidades saturadas con glow.
  neon: {
    hudBg: "#05030d",
    hudText: "#00f5ff",
    lifeIcon: "#39ff14",
    timeHigh: "#00ff88",
    timeMid: "#f5ff00",
    timeLow: "#ff006e",
    goalRow: "#08200f",
    goalSlot: "#05030d",
    goalBorder: "#f5ff00",
    river: "#050b2a",
    safe: "#16062a",
    road: "#05030d",
    roadLine: "#7a1f5c",
    cars: ["#ff006e", "#f5ff00", "#00f5ff"],
    wheel: "#2a2440",
    truck: "#c026ff",
    truckCab: "#ff8a00",
    log: "#ff8a00",
    logLine: "#7a3300",
    turtle: "#00f5ff",
    turtleScale: "#05030d",
    turtleSubmerged: "rgba(0, 245, 255, 0.35)",
    frog: "#39ff14",
    frogEyeWhite: "#ffffff",
    frogEyePupil: "#05030d",
    glow: 12,
    smoothing: true,
  },
  // CGA de 4 tonos (negro, cian, magenta, blanco): sin glow ni transparencias.
  retro: {
    hudBg: "#000000",
    hudText: "#ffffff",
    lifeIcon: "#55ffff",
    timeHigh: "#55ffff",
    timeMid: "#ffffff",
    timeLow: "#ff55ff",
    goalRow: "#ff55ff",
    goalSlot: "#000000",
    goalBorder: "#ffffff",
    river: "#55ffff",
    safe: "#ff55ff",
    road: "#000000",
    roadLine: "#55ffff",
    cars: ["#ff55ff", "#55ffff", "#ffffff"],
    wheel: "#55ffff",
    truck: "#ffffff",
    truckCab: "#ff55ff",
    log: "#ff55ff",
    logLine: "#000000",
    turtle: "#000000",
    turtleScale: "#ffffff",
    turtleSubmerged: "#ffffff",
    frog: "#ffffff",
    frogEyeWhite: "#ff55ff",
    frogEyePupil: "#000000",
    glow: 0,
    smoothing: false,
  },
};

function paletteFor(skin: SkinId): FroggerPalette {
  return FROGGER_PALETTES[skin] ?? FROGGER_PALETTES[DEFAULT_SKIN];
}

const START_COL = Math.floor(COLS / 2) - 1; // 7: columna central
const COLLISION_MARGIN = 0.15; // celdas recortadas a cada lado de la rana en carretera

type Direction = "up" | "down" | "left" | "right";

// Solo e.key / e.code (spec 10): el gamepad táctil despacha KeyboardEvent sintéticos.
const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

interface Entity {
  col: number; // posición en celdas (puede ser fraccionaria)
  width: number; // en celdas
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean; // solo tortugas
  cycleT?: number; // ms dentro del ciclo de inmersión (solo tortugas)
}

interface Lane {
  row: number;
  speed: number; // celdas por segundo (ya escalada por nivel)
  dir: 1 | -1;
  entities: Entity[];
  // Clave del sprite de sus entidades ("car:N", "truck:W:D", "log:W"); se arma
  // una vez en buildLanes. Las tortugas usan "turtle:up" / "turtle:down".
  spriteKey: string;
  carIndex: number; // n.º de carril de coches (color de la paleta); -1 si no es de coches
}

interface SpriteEntry {
  sprite: HTMLCanvasElement;
  pad: number; // margen del glow horneado (0 sin glow)
}

interface Frog {
  col: number; // puede ser fraccionaria al ir sobre un tronco/tortuga
  row: number;
  animating: boolean;
  animT: number; // ms
  targetCol: number;
  targetRow: number;
}

function roundTime(level: number): number {
  return Math.max(TIMER_MIN_S, TIMER_BASE_S - (level - 1) * TIMER_STEP_S);
}

// ===== Carriles =====
// Todas las entidades de un carril tienen el mismo ancho y se reparten con
// período (COLS + width) / count: así el hueco se mantiene igual también al
// reaparecer por el lado opuesto.
interface LaneConfig {
  row: number;
  pxPerFrame: number; // velocidad base a 60 fps en nivel 1
  dir: 1 | -1;
  type: Entity["type"];
  width: number;
  count: number;
}

const LANE_CONFIGS: LaneConfig[] = [
  // Río (filas 2–7): troncos y grupos de tortugas, huecos de al menos 1 celda.
  { row: 2, pxPerFrame: 2, dir: 1, type: "log", width: 3, count: 3 },
  { row: 3, pxPerFrame: 1.5, dir: 1, type: "log", width: 2, count: 4 },
  { row: 4, pxPerFrame: 2, dir: -1, type: "turtle", width: 2, count: 4 },
  { row: 5, pxPerFrame: 3, dir: 1, type: "log", width: 4, count: 3 },
  { row: 6, pxPerFrame: 1, dir: 1, type: "log", width: 3, count: 3 },
  { row: 7, pxPerFrame: 1.5, dir: -1, type: "turtle", width: 3, count: 4 },
  // Carretera (filas 9–13): sentidos alternos.
  { row: 9, pxPerFrame: 1.8, dir: -1, type: "truck", width: 3, count: 2 },
  { row: 10, pxPerFrame: 4, dir: 1, type: "car", width: 1, count: 3 },
  { row: 11, pxPerFrame: 2, dir: -1, type: "truck", width: 2, count: 3 },
  { row: 12, pxPerFrame: 2.5, dir: 1, type: "car", width: 1, count: 3 },
  { row: 13, pxPerFrame: 1.5, dir: -1, type: "car", width: 1, count: 4 },
];

const TURTLE_CYCLE_MS = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;

// Offsets de las escamas del caparazón, relativos al centro de la tortuga.
const TURTLE_SCALE_OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  [-6, -6],
  [6, -6],
  [-6, 6],
  [6, 6],
];

function buildLanes(level: number): Lane[] {
  const factor = LEVEL_SPEED_FACTOR ** (level - 1);
  let carLanes = 0;
  return LANE_CONFIGS.map((cfg) => {
    const carIndex = cfg.type === "car" ? carLanes++ : -1;
    const spriteKey =
      cfg.type === "car"
        ? `car:${carIndex}`
        : cfg.type === "truck"
          ? `truck:${cfg.width}:${cfg.dir}`
          : cfg.type === "log"
            ? `log:${cfg.width}`
            : "turtle";
    const period = (COLS + cfg.width) / cfg.count;
    const entities: Entity[] = [];
    for (let i = 0; i < cfg.count; i++) {
      const entity: Entity = {
        col: i * period,
        width: cfg.width,
        type: cfg.type,
      };
      if (cfg.type === "turtle") {
        // Ciclo desfasado por grupo para que no se hundan todos a la vez.
        entity.cycleT = (i * TURTLE_CYCLE_MS) / cfg.count;
        entity.submerged = entity.cycleT >= TURTLE_VISIBLE_MS;
      }
      entities.push(entity);
    }
    return {
      row: cfg.row,
      speed: ((cfg.pxPerFrame * 60) / CELL) * factor, // px/frame → celdas/s
      dir: cfg.dir,
      entities,
      spriteKey,
      carIndex,
    };
  });
}

export function createFroggerGame(
  canvas: HTMLCanvasElement,
  callbacks: FroggerCallbacks,
  skin: SkinId = DEFAULT_SKIN,
  options: FroggerOptions = {}
): FroggerGame {
  // Tablero opaco: el navegador puede saltarse la composición con transparencia.
  const ctx = canvas.getContext("2d", { alpha: false })!;
  let activeSkin = skin;
  let palette = paletteFor(skin);

  let lanes: Lane[] = [];
  const laneByRow: (Lane | undefined)[] = []; // índice por fila, se rehace con setLanes
  let frog: Frog = newFrog();
  let pendingDir: Direction | null = null;
  let goals: boolean[] = GOAL_COLS.map(() => false);
  let bestRow = ROW_START; // fila más alta alcanzada en el trayecto actual
  let timeLeft = roundTime(1); // segundos
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let paused = false;
  let over = false;

  let lastScore = -1;
  let lastLives = -1;
  let lastLevel = -1;

  function newFrog(): Frog {
    return {
      col: START_COL,
      row: ROW_START,
      animating: false,
      animT: 0,
      targetCol: START_COL,
      targetRow: ROW_START,
    };
  }

  function emitStats() {
    if (score !== lastScore || lives !== lastLives || level !== lastLevel) {
      lastScore = score;
      lastLives = lives;
      lastLevel = level;
      callbacks.onStats({ score, lives, level });
    }
  }

  function endGame() {
    if (over) return;
    over = true;
    emitStats();
    callbacks.onGameOver(score);
  }

  function isRiverRow(row: number) {
    return row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
  }

  function isRoadRow(row: number) {
    return row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT;
  }

  // Rana nueva en la fila de inicio: trayecto y temporizador desde cero.
  function respawnFrog() {
    frog = newFrog();
    pendingDir = null;
    bestRow = ROW_START;
    timeLeft = roundTime(level);
  }

  // Reemplaza los carriles y rehace el índice por fila.
  function setLanes(next: Lane[]) {
    lanes = next;
    laneByRow.length = 0;
    for (const lane of lanes) laneByRow[lane.row] = lane;
  }

  function laneAt(row: number): Lane | undefined {
    return laneByRow[row];
  }

  // Vehículo que se solapa con la rana en su carril. El margen evita muertes
  // por un roce de píxeles entre celdas vecinas.
  function checkRoadCollision(): boolean {
    const lane = laneAt(frog.row);
    if (!lane) return false;
    const left = frog.col + COLLISION_MARGIN;
    const right = frog.col + 1 - COLLISION_MARGIN;
    return lane.entities.some(
      (entity) => left < entity.col + entity.width && right > entity.col
    );
  }

  // Tronco o tortuga visible bajo el centro de la rana, o null (agua).
  function getSupport(): { lane: Lane; entity: Entity } | null {
    const lane = laneAt(frog.row);
    if (!lane) return null;
    const center = frog.col + 0.5;
    const entity = lane.entities.find(
      (e) => center >= e.col && center < e.col + e.width
    );
    if (!entity || entity.submerged) return null;
    return { lane, entity };
  }

  // Rana en la fila de metas: ocupa una boca libre o muere.
  function checkGoal() {
    const col = Math.round(frog.col);
    const index = GOAL_COLS.findIndex((g) => col === g || col === g + 1);
    if (index === -1 || goals[index]) {
      killFrog(); // fuera de una boca o boca ya ocupada
      return;
    }
    goals[index] = true;
    score += POINTS_PER_GOAL + Math.floor(timeLeft) * POINTS_PER_SECOND_LEFT;
    if (goals.every(Boolean)) {
      completeRound();
      return;
    }
    respawnFrog();
  }

  // Las 5 bocas llenas: siguiente ronda, más rápida y con menos tiempo.
  function completeRound() {
    score += POINTS_PER_ROUND;
    goals = GOAL_COLS.map(() => false);
    level++;
    setLanes(buildLanes(level));
    respawnFrog(); // rana al inicio y temporizador con roundTime(level)
  }

  // Resta una vida; con 0 termina la partida (endGame emite lives 0 antes de onGameOver).
  function killFrog() {
    if (over) return;
    lives--;
    if (lives <= 0) {
      lives = 0;
      endGame();
      return;
    }
    respawnFrog();
  }

  function moveEntities(dt: number) {
    for (const lane of lanes) {
      const delta = (lane.speed * lane.dir * dt) / 1000;
      for (const entity of lane.entities) {
        entity.col += delta;
        // Restar/sumar el recorrido completo conserva el espaciado del carril.
        const span = COLS + entity.width;
        if (lane.dir === 1 && entity.col >= COLS) entity.col -= span;
        if (lane.dir === -1 && entity.col + entity.width <= 0)
          entity.col += span;
        if (entity.type === "turtle") {
          entity.cycleT = ((entity.cycleT ?? 0) + dt) % TURTLE_CYCLE_MS;
          entity.submerged = entity.cycleT >= TURTLE_VISIBLE_MS;
        }
      }
    }
  }

  function startHop(dir: Direction) {
    const col = Math.round(frog.col);
    let targetCol = col;
    let targetRow = frog.row;
    if (dir === "up") targetRow = Math.max(ROW_GOALS, frog.row - 1);
    if (dir === "down") targetRow = Math.min(ROW_START, frog.row + 1);
    if (dir === "left") targetCol = Math.max(0, col - 1);
    if (dir === "right") targetCol = Math.min(COLS - 1, col + 1);
    if (targetCol === col && targetRow === frog.row) return; // contra un borde
    frog.col = col;
    frog.targetCol = targetCol;
    frog.targetRow = targetRow;
    frog.animating = true;
    frog.animT = 0;
  }

  // Lógica de la celda destino al terminar el salto.
  function landHop() {
    frog.col = frog.targetCol;
    frog.row = frog.targetRow;
    frog.animating = false;
    if (frog.row < bestRow) {
      score += POINTS_PER_ROW * (bestRow - frog.row);
      bestRow = frog.row;
    }
    if (frog.row === ROW_GOALS) checkGoal();
  }

  function updateFrog(dt: number) {
    if (!frog.animating && pendingDir) {
      startHop(pendingDir);
      pendingDir = null;
    }
    if (frog.animating) {
      frog.animT += dt;
      if (frog.animT >= HOP_MS) landHop();
      return;
    }
    if (isRiverRow(frog.row)) {
      const support = getSupport();
      if (!support) {
        killFrog(); // agua o tortuga sumergida
        return;
      }
      frog.col += (support.lane.speed * support.lane.dir * dt) / 1000;
      const center = frog.col + 0.5;
      if (center < 0 || center > COLS) killFrog(); // arrastrada fuera del borde
    }
  }

  function update(dt: number) {
    moveEntities(dt);
    updateFrog(dt);
    if (over) return;
    if (isRoadRow(frog.row) && checkRoadCollision()) killFrog();

    timeLeft -= dt / 1000;
    if (timeLeft <= 0) killFrog();

    emitStats();
  }

  // ===== Dibujo =====
  // Caché de sprites offscreen de la skin activa; se vacía en setSkin.
  // Claves "<tipo>:<variante>", p. ej. "car:0", "truck:3:1", "turtle:up".
  // Guarda la entrada completa para que getSprite no asigne memoria por frame.
  const spriteCache = new Map<string, SpriteEntry>();

  // Sprite de w × h pintado una sola vez con `paint` (coordenadas locales desde
  // 0,0). Con glow en la skin, se hornea con withGlow y el sprite gana un margen
  // `pad` a cada lado: se dibuja en (x - pad, y - pad). `glowColor` null: sin
  // glow en ninguna skin (p. ej. el contorno de la tortuga sumergida).
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

  // Capa de fondo estático de la skin activa (zonas, líneas discontinuas y
  // bocas vacías con su borde); se construye una vez y se invalida en setSkin.
  let backgroundLayer: HTMLCanvasElement | null = null;

  function buildBackgroundLayer(): HTMLCanvasElement {
    const layer = document.createElement("canvas");
    layer.width = CANVAS_W;
    layer.height = CANVAS_H;
    const b = layer.getContext("2d")!;

    const fillRow = (row: number, color: string) => {
      b.fillStyle = color;
      b.fillRect(0, row * CELL, CANVAS_W, CELL);
    };
    fillRow(ROW_HUD, palette.hudBg);
    fillRow(ROW_GOALS, palette.goalRow);
    for (let row = ROW_RIVER_TOP; row <= ROW_RIVER_BOT; row++) {
      fillRow(row, palette.river);
    }
    fillRow(ROW_SAFE_MID, palette.safe);
    for (let row = ROW_ROAD_TOP; row <= ROW_ROAD_BOT; row++) {
      fillRow(row, palette.road);
    }
    fillRow(ROW_START, palette.safe);

    // Líneas discontinuas entre carriles de carretera.
    b.strokeStyle = palette.roadLine;
    b.lineWidth = 2;
    b.setLineDash([16, 12]);
    for (let row = ROW_ROAD_TOP + 1; row <= ROW_ROAD_BOT; row++) {
      b.beginPath();
      b.moveTo(0, row * CELL);
      b.lineTo(CANVAS_W, row * CELL);
      b.stroke();
    }
    b.setLineDash([]);

    // Bocas vacías; el borde lleva glow en neon (horneado una sola vez).
    const y = ROW_GOALS * CELL;
    for (const col of GOAL_COLS) {
      const x = col * CELL;
      b.fillStyle = palette.goalSlot;
      b.fillRect(x + 2, y + 2, CELL * 2 - 4, CELL - 4);
      b.strokeStyle = palette.goalBorder;
      b.lineWidth = 2;
      if (palette.glow > 0) {
        b.shadowBlur = palette.glow;
        b.shadowColor = palette.goalBorder;
      }
      b.strokeRect(x + 2, y + 2, CELL * 2 - 4, CELL - 4);
      b.shadowBlur = 0;
    }
    return layer;
  }

  // Rana centrada en un sprite de CELL × CELL; con patas extendidas ocupa
  // exactamente el ancho de la celda. El glow lo añade getSprite.
  function paintFrog(
    s: CanvasRenderingContext2D,
    scale: number,
    legs: boolean
  ) {
    const cx = CELL / 2;
    const cy = CELL / 2;
    const rx = 14 * scale;
    const ry = 12 * scale;
    s.fillStyle = palette.frog;
    if (legs) {
      // Patas extendidas durante el salto.
      s.fillRect(cx - rx - 6 * scale, cy - ry, 6 * scale, 4 * scale);
      s.fillRect(cx + rx, cy - ry, 6 * scale, 4 * scale);
      s.fillRect(
        cx - rx - 6 * scale,
        cy + ry - 4 * scale,
        6 * scale,
        4 * scale
      );
      s.fillRect(cx + rx, cy + ry - 4 * scale, 6 * scale, 4 * scale);
    }
    s.beginPath();
    s.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    s.fill();
    for (const side of [-1, 1]) {
      const ex = cx + side * 6 * scale;
      const ey = cy - 7 * scale;
      s.fillStyle = palette.frogEyeWhite;
      s.beginPath();
      s.arc(ex, ey, 4 * scale, 0, Math.PI * 2);
      s.fill();
      s.fillStyle = palette.frogEyePupil;
      s.beginPath();
      s.arc(ex, ey, 2 * scale, 0, Math.PI * 2);
      s.fill();
    }
  }

  // "frog:idle" (en reposo), "frog:hop" (patas extendidas) y "frog:goal"
  // (escala 0.8, rana en boca ocupada).
  function frogSprite(
    key: "frog:idle" | "frog:hop" | "frog:goal"
  ): SpriteEntry {
    return (
      spriteCache.get(key) ??
      getSprite(key, CELL, CELL, palette.frog, (s) =>
        paintFrog(s, key === "frog:goal" ? 0.8 : 1, key === "frog:hop")
      )
    );
  }

  // Solo las ranas de las bocas ocupadas; las bocas vacías están en el fondo.
  function drawGoals() {
    const y = ROW_GOALS * CELL;
    for (let i = 0; i < GOAL_COLS.length; i++) {
      if (!goals[i]) continue;
      // Rana centrada en la boca (x + CELL, y + CELL / 2).
      const { sprite, pad } = frogSprite("frog:goal");
      ctx.drawImage(sprite, GOAL_COLS[i] * CELL + CELL / 2 - pad, y - pad);
    }
  }

  // Pintores de sprites: dibujan una sola vez, en coordenadas locales del
  // sprite (0,0 = esquina superior izquierda de la entidad). El glow lo añade
  // getSprite con withGlow, no el pintor.
  function paintCar(s: CanvasRenderingContext2D, w: number, color: string) {
    s.fillStyle = palette.wheel;
    for (const wx of [8, w - 8]) {
      for (const wy of [8, CELL - 8]) {
        s.beginPath();
        s.arc(wx, wy, 5, 0, Math.PI * 2);
        s.fill();
      }
    }
    s.fillStyle = color;
    s.fillRect(3, 8, w - 6, CELL - 16);
  }

  function paintTruck(s: CanvasRenderingContext2D, w: number, dir: 1 | -1) {
    s.fillStyle = palette.truck;
    s.fillRect(2, 6, w - 4, CELL - 12);
    // Cabina en el frente, según el sentido de marcha.
    s.fillStyle = palette.truckCab;
    const cabX = dir === 1 ? w - 2 - CELL * 0.6 : 2;
    s.fillRect(cabX, 4, CELL * 0.6, CELL - 8);
  }

  function paintLog(s: CanvasRenderingContext2D, w: number) {
    s.fillStyle = palette.log;
    s.fillRect(1, 6, w - 2, CELL - 12);
    s.strokeStyle = palette.logLine;
    s.lineWidth = 2;
    for (const ly of [14, 26]) {
      s.beginPath();
      s.moveTo(8, ly);
      s.lineTo(w - 8, ly);
      s.stroke();
    }
  }

  // Una tortuga (una celda); los grupos repiten el sprite `width` veces.
  function paintTurtle(s: CanvasRenderingContext2D, submerged: boolean) {
    const c = CELL / 2;
    if (submerged) {
      s.strokeStyle = palette.turtleSubmerged;
      s.lineWidth = 2;
      s.beginPath();
      s.arc(c, c, 15, 0, Math.PI * 2);
      s.stroke();
      return;
    }
    s.fillStyle = palette.turtle;
    s.beginPath();
    s.arc(c, c, 15, 0, Math.PI * 2);
    s.fill();
    s.fillStyle = palette.turtleScale;
    for (const [dx, dy] of TURTLE_SCALE_OFFSETS) {
      s.beginPath();
      s.arc(c + dx, c + dy, 3, 0, Math.PI * 2);
      s.fill();
    }
  }

  // El pintor (closure) solo se crea si el sprite no está en caché.
  function laneSprite(lane: Lane): SpriteEntry {
    const cached = spriteCache.get(lane.spriteKey);
    if (cached) return cached;
    const w = lane.entities[0].width * CELL;
    if (lane.entities[0].type === "car") {
      const color = palette.cars[lane.carIndex % palette.cars.length];
      return getSprite(lane.spriteKey, w, CELL, color, (s) =>
        paintCar(s, w, color)
      );
    }
    if (lane.entities[0].type === "truck") {
      return getSprite(lane.spriteKey, w, CELL, palette.truck, (s) =>
        paintTruck(s, w, lane.dir)
      );
    }
    return getSprite(lane.spriteKey, w, CELL, palette.log, (s) =>
      paintLog(s, w)
    );
  }

  function turtleSprite(submerged: boolean): SpriteEntry {
    const key = submerged ? "turtle:down" : "turtle:up";
    return (
      spriteCache.get(key) ??
      // La tortuga sumergida es solo un contorno sin glow.
      getSprite(key, CELL, CELL, submerged ? null : palette.turtle, (s) =>
        paintTurtle(s, submerged)
      )
    );
  }

  // Por frame solo hay drawImage en (x - pad, y - pad), con x entero.
  function drawLanes() {
    for (const lane of lanes) {
      const y = lane.row * CELL;
      for (const entity of lane.entities) {
        const x = Math.round(entity.col * CELL); // píxel entero (retro sin suavizado)
        if (entity.type === "turtle") {
          const { sprite, pad } = turtleSprite(entity.submerged === true);
          for (let i = 0; i < entity.width; i++) {
            ctx.drawImage(sprite, x + i * CELL - pad, y - pad);
          }
        } else {
          const { sprite, pad } = laneSprite(lane);
          ctx.drawImage(sprite, x - pad, y - pad);
        }
      }
    }
  }

  function drawFrog() {
    let col = frog.col;
    let row = frog.row;
    if (frog.animating) {
      const t = Math.min(1, frog.animT / HOP_MS);
      col += (frog.targetCol - frog.col) * t;
      row += (frog.targetRow - frog.row) * t;
    }
    const { sprite, pad } = frogSprite(
      frog.animating ? "frog:hop" : "frog:idle"
    );
    ctx.drawImage(
      sprite,
      Math.round(col * CELL) - pad, // píxel entero (retro sin suavizado)
      Math.round(row * CELL) - pad
    );
  }

  // Capa del HUD (fila 0): puntuación, nivel e iconos de vida. Se redibuja solo
  // cuando cambian score, level o lives, o la skin (hudLayer = null).
  let hudLayer: HTMLCanvasElement | null = null;
  let hudScore = -1;
  let hudLevel = -1;
  let hudLives = -1;

  function buildHudLayer(): HTMLCanvasElement {
    const layer = document.createElement("canvas");
    layer.width = CANVAS_W;
    layer.height = CELL;
    const h = layer.getContext("2d")!;
    const glow = (color: string) => {
      if (palette.glow <= 0) return;
      h.shadowBlur = palette.glow;
      h.shadowColor = color;
    };

    h.fillStyle = palette.hudText;
    glow(palette.hudText);
    h.font = "bold 16px monospace";
    h.textBaseline = "top";
    h.textAlign = "left";
    h.fillText(String(score).padStart(6, "0"), 8, 6);
    h.textAlign = "center";
    h.fillText("NIVEL " + level, CANVAS_W / 2, 6);

    h.fillStyle = palette.lifeIcon;
    glow(palette.lifeIcon);
    for (let i = 0; i < lives; i++) {
      h.beginPath();
      h.arc(CANVAS_W - 14 - i * 22, 14, 8, 0, Math.PI * 2);
      h.fill();
    }
    return layer;
  }

  const TIMEBAR_Y = CELL - 10;
  const TIMEBAR_H = 8;

  // Barra completa (640 × 8) de un color, con glow horneado en neon.
  function timebarSprite(
    key: "timebar:high" | "timebar:mid" | "timebar:low",
    color: string
  ): SpriteEntry {
    return (
      spriteCache.get(key) ??
      getSprite(key, CANVAS_W, TIMEBAR_H, color, (s) => {
        s.fillStyle = color;
        s.fillRect(0, 0, CANVAS_W, TIMEBAR_H);
      })
    );
  }

  function drawHud() {
    if (
      hudLayer === null ||
      score !== hudScore ||
      level !== hudLevel ||
      lives !== hudLives
    ) {
      hudLayer = buildHudLayer();
      hudScore = score;
      hudLevel = level;
      hudLives = lives;
    }
    ctx.drawImage(hudLayer, 0, 0);

    // Barra de tiempo al pie de la fila del HUD: sprite prehorneado recortado
    // al ancho proporcional.
    const ratio = Math.max(0, timeLeft / roundTime(level));
    const barW = Math.round(CANVAS_W * ratio);
    if (barW <= 0) return;
    const { sprite, pad } =
      ratio > 0.5
        ? timebarSprite("timebar:high", palette.timeHigh)
        : ratio > 0.25
          ? timebarSprite("timebar:mid", palette.timeMid)
          : timebarSprite("timebar:low", palette.timeLow);
    const srcW = pad + barW; // glow izquierdo + tramo visible de la barra
    const srcH = TIMEBAR_H + pad * 2;
    ctx.drawImage(sprite, 0, 0, srcW, srcH, -pad, TIMEBAR_Y - pad, srcW, srcH);
    // Con glow, el recorte deja la barra sin halo en su extremo derecho: se
    // añade el remate del sprite completo para que se vea como antes.
    if (pad > 0) {
      const capX = pad + CANVAS_W;
      ctx.drawImage(
        sprite,
        capX,
        0,
        pad,
        srcH,
        barW,
        TIMEBAR_Y - pad,
        pad,
        srcH
      );
    }
  }

  // Por frame solo hay drawImage: el glow (shadowBlur) está horneado en los
  // sprites y las capas, y el contexto principal nunca lo activa.
  function draw() {
    ctx.imageSmoothingEnabled = palette.smoothing;
    // Fondo opaco de 640 × 600: cubre todo el canvas, no hace falta clearRect.
    backgroundLayer ??= buildBackgroundLayer();
    ctx.drawImage(backgroundLayer, 0, 0);
    drawGoals();
    drawLanes();
    drawFrog();
    drawHud();
    if (options.showFps) drawFps();
  }

  // Contador de FPS (?fps=1): promedio de frames en ventanas de FPS_SAMPLE_MS.
  // Se dibuja fuera de las cachés; la etiqueta solo se rearma al cambiar.
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
    }
  }

  // Esquina inferior izquierda de la fila de inicio.
  function drawFps() {
    ctx.fillStyle = palette.hudText;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(fpsLabel, 6, CANVAS_H - 4);
  }

  let animationFrameId: number | null = null;
  let lastTime: number | null = null;
  let accumulator = 0; // ms pendientes de simular

  function loop(ts: number) {
    if (lastTime === null) lastTime = ts;
    const elapsed = ts - lastTime;
    lastTime = ts;
    if (options.showFps) sampleFps(elapsed);

    if (!paused && !over) {
      // Paso fijo: la simulación es la misma a cualquier tasa de refresco.
      accumulator += elapsed;
      let steps = 0;
      while (accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME && !over) {
        update(STEP_MS);
        accumulator -= STEP_MS;
        steps++;
      }
      // Tope de pasos: el tiempo sobrante se descarta (evita la espiral en
      // equipos lentos y el teletransporte al volver de otra pestaña).
      if (accumulator >= STEP_MS) accumulator = 0;
    }
    draw();

    if (over) {
      animationFrameId = null;
      return;
    }
    animationFrameId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (animationFrameId !== null) return;
    lastTime = null;
    accumulator = 0;
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

  // P / Esc no se escuchan aquí: la pausa la maneja la play-page.
  function onKeyDown(e: KeyboardEvent) {
    const dir = KEY_TO_DIRECTION[e.key] ?? KEY_TO_DIRECTION[e.code];
    if (!dir) return;
    e.preventDefault();
    if (paused || over || e.repeat) return;
    pendingDir = dir;
  }

  function initGame() {
    setLanes(buildLanes(1));
    goals = GOAL_COLS.map(() => false);
    score = 0;
    lives = START_LIVES;
    level = 1;
    respawnFrog();
    paused = false;
    over = false;
    lastScore = -1;
    lastLives = -1;
    lastLevel = -1;
    emitStats();
  }

  return {
    start() {
      document.addEventListener("keydown", onKeyDown);
      initGame();
      startLoop();
    },
    pause() {
      if (over) return;
      paused = true;
      // Loop detenido en pausa: se pinta un frame y no se vuelve a dibujar
      // hasta resume().
      stopLoop();
      draw();
    },
    resume() {
      if (over) return;
      paused = false;
      startLoop(); // reinicia lastTime y accumulator: sin salto al reanudar
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
      if (nextSkin === activeSkin) return;
      activeSkin = nextSkin;
      palette = paletteFor(nextSkin);
      spriteCache.clear(); // los sprites se rehacen con la skin nueva al usarse
      backgroundLayer = null; // se reconstruye en el siguiente draw()
      hudLayer = null; // idem para el HUD
      // En pausa y en game over el loop está detenido: repinta un frame sin
      // simular. En partida el cambio se ve en el siguiente frame.
      if (animationFrameId === null) draw();
    },
  };
}
