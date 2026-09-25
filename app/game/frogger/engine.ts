// ===== engine.ts — motor de Frogger, escrito desde cero =====
// Sin referencia en references/started-games/ ni sprites: todo se dibuja con
// primitivas canvas (ver specs/game-jam/frogger/01-frogger-core.md).

import { DEFAULT_SKIN, type SkinId } from "../skins";

export interface FroggerStats {
  score: number;
  lives: number;
  level: number; // ronda actual (sube al llenar las 5 bocas)
}

export interface FroggerCallbacks {
  onStats: (stats: FroggerStats) => void;
  onGameOver: (finalScore: number) => void;
}

export interface FroggerGame {
  start: () => void;
  // Congela la simulación; el dibujo sigue corriendo.
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

function buildLanes(level: number): Lane[] {
  const factor = LEVEL_SPEED_FACTOR ** (level - 1);
  return LANE_CONFIGS.map((cfg) => {
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
    };
  });
}

export function createFroggerGame(
  canvas: HTMLCanvasElement,
  callbacks: FroggerCallbacks,
  skin: SkinId = DEFAULT_SKIN
): FroggerGame {
  const ctx = canvas.getContext("2d")!;
  let activeSkin = skin;
  let palette = paletteFor(skin);

  let lanes: Lane[] = [];
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

  function laneAt(row: number): Lane | undefined {
    return lanes.find((lane) => lane.row === row);
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
    lanes = buildLanes(level);
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
  // Glow de la skin activa (solo neon); con glow 0 no toca el contexto.
  function glowOn(color: string) {
    if (palette.glow <= 0) return;
    ctx.shadowBlur = palette.glow;
    ctx.shadowColor = color;
  }

  function glowOff() {
    if (palette.glow > 0) ctx.shadowBlur = 0;
  }

  function fillRow(row: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(0, row * CELL, CANVAS_W, CELL);
  }

  function drawBackground() {
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
    ctx.strokeStyle = palette.roadLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 12]);
    for (let row = ROW_ROAD_TOP + 1; row <= ROW_ROAD_BOT; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * CELL);
      ctx.lineTo(CANVAS_W, row * CELL);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawFrogShape(cx: number, cy: number, scale: number, legs: boolean) {
    const rx = 14 * scale;
    const ry = 12 * scale;
    ctx.fillStyle = palette.frog;
    glowOn(palette.frog);
    if (legs) {
      // Patas extendidas durante el salto.
      ctx.fillRect(cx - rx - 6 * scale, cy - ry, 6 * scale, 4 * scale);
      ctx.fillRect(cx + rx, cy - ry, 6 * scale, 4 * scale);
      ctx.fillRect(
        cx - rx - 6 * scale,
        cy + ry - 4 * scale,
        6 * scale,
        4 * scale
      );
      ctx.fillRect(cx + rx, cy + ry - 4 * scale, 6 * scale, 4 * scale);
    }
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    glowOff();
    for (const side of [-1, 1]) {
      const ex = cx + side * 6 * scale;
      const ey = cy - 7 * scale;
      ctx.fillStyle = palette.frogEyeWhite;
      ctx.beginPath();
      ctx.arc(ex, ey, 4 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.frogEyePupil;
      ctx.beginPath();
      ctx.arc(ex, ey, 2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGoals() {
    GOAL_COLS.forEach((col, i) => {
      const x = col * CELL;
      const y = ROW_GOALS * CELL;
      ctx.fillStyle = palette.goalSlot;
      ctx.fillRect(x + 2, y + 2, CELL * 2 - 4, CELL - 4);
      ctx.strokeStyle = palette.goalBorder;
      ctx.lineWidth = 2;
      glowOn(palette.goalBorder);
      ctx.strokeRect(x + 2, y + 2, CELL * 2 - 4, CELL - 4);
      glowOff();
      if (goals[i]) drawFrogShape(x + CELL, y + CELL / 2, 0.8, false);
    });
  }

  function drawCar(x: number, y: number, w: number, color: string) {
    ctx.fillStyle = palette.wheel;
    for (const wx of [x + 8, x + w - 8]) {
      for (const wy of [y + 8, y + CELL - 8]) {
        ctx.beginPath();
        ctx.arc(wx, wy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = color;
    glowOn(color);
    ctx.fillRect(x + 3, y + 8, w - 6, CELL - 16);
    glowOff();
  }

  function drawTruck(x: number, y: number, w: number, dir: 1 | -1) {
    ctx.fillStyle = palette.truck;
    glowOn(palette.truck);
    ctx.fillRect(x + 2, y + 6, w - 4, CELL - 12);
    glowOff();
    // Cabina en el frente, según el sentido de marcha.
    ctx.fillStyle = palette.truckCab;
    const cabX = dir === 1 ? x + w - 2 - CELL * 0.6 : x + 2;
    ctx.fillRect(cabX, y + 4, CELL * 0.6, CELL - 8);
  }

  function drawLog(x: number, y: number, w: number) {
    ctx.fillStyle = palette.log;
    glowOn(palette.log);
    ctx.fillRect(x + 1, y + 6, w - 2, CELL - 12);
    glowOff();
    ctx.strokeStyle = palette.logLine;
    ctx.lineWidth = 2;
    for (const ly of [y + 14, y + 26]) {
      ctx.beginPath();
      ctx.moveTo(x + 8, ly);
      ctx.lineTo(x + w - 8, ly);
      ctx.stroke();
    }
  }

  function drawTurtles(x: number, y: number, entity: Entity) {
    for (let i = 0; i < entity.width; i++) {
      const cx = x + i * CELL + CELL / 2;
      const cy = y + CELL / 2;
      if (entity.submerged) {
        ctx.strokeStyle = palette.turtleSubmerged;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 15, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = palette.turtle;
      glowOn(palette.turtle);
      ctx.beginPath();
      ctx.arc(cx, cy, 15, 0, Math.PI * 2);
      ctx.fill();
      glowOff();
      ctx.fillStyle = palette.turtleScale;
      for (const [dx, dy] of [
        [0, 0],
        [-6, -6],
        [6, -6],
        [-6, 6],
        [6, 6],
      ]) {
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawLanes() {
    let carLane = 0;
    for (const lane of lanes) {
      const y = lane.row * CELL;
      const carColor = palette.cars[carLane % palette.cars.length];
      if (lane.entities[0]?.type === "car") carLane++;
      for (const entity of lane.entities) {
        const x = entity.col * CELL;
        const w = entity.width * CELL;
        if (entity.type === "car") drawCar(x, y, w, carColor);
        else if (entity.type === "truck") drawTruck(x, y, w, lane.dir);
        else if (entity.type === "log") drawLog(x, y, w);
        else drawTurtles(x, y, entity);
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
    drawFrogShape(
      col * CELL + CELL / 2,
      row * CELL + CELL / 2,
      1,
      frog.animating
    );
  }

  function drawHud() {
    ctx.fillStyle = palette.hudText;
    glowOn(palette.hudText);
    ctx.font = "bold 16px monospace";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(String(score).padStart(6, "0"), 8, 6);
    ctx.textAlign = "center";
    ctx.fillText("NIVEL " + level, CANVAS_W / 2, 6);

    ctx.fillStyle = palette.lifeIcon;
    glowOn(palette.lifeIcon);
    for (let i = 0; i < lives; i++) {
      ctx.beginPath();
      ctx.arc(CANVAS_W - 14 - i * 22, 14, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Barra de tiempo al pie de la fila del HUD.
    const ratio = Math.max(0, timeLeft / roundTime(level));
    const timeColor =
      ratio > 0.5
        ? palette.timeHigh
        : ratio > 0.25
          ? palette.timeMid
          : palette.timeLow;
    ctx.fillStyle = timeColor;
    glowOn(timeColor);
    ctx.fillRect(0, CELL - 10, CANVAS_W * ratio, 8);
    glowOff();
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.shadowBlur = 0; // por si la skin anterior dejaba glow activo
    ctx.imageSmoothingEnabled = palette.smoothing;
    drawBackground();
    drawGoals();
    drawLanes();
    drawFrog();
    drawHud();
  }

  let animationFrameId: number | null = null;
  let lastTime: number | null = null;

  function loop(ts: number) {
    if (lastTime === null) lastTime = ts;
    // Tope al dt para que volver de otra pestaña no teletransporte las entidades.
    const dt = Math.min(ts - lastTime, 100);
    lastTime = ts;

    if (!paused && !over) update(dt);
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
    lanes = buildLanes(1);
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
      paused = true;
    },
    resume() {
      if (over) return;
      paused = false;
      lastTime = null;
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
      // En pausa el loop sigue dibujando (el cambio se ve al siguiente frame);
      // en game over está detenido: repinta un frame sin simular.
      if (animationFrameId === null) draw();
    },
  };
}
