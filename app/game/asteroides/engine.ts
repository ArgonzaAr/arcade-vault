import { DEFAULT_SKIN, type SkinId } from "../skins";

export interface AsteroidsStats {
  score: number;
  lives: number;
  level: number;
}

export interface AsteroidsCallbacks {
  onStats: (stats: AsteroidsStats) => void;
  onGameOver: (finalScore: number) => void;
}

export interface AsteroidsGame {
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
interface AsteroidsPalette {
  background: string;
  ship: string;
  thrust: string;
  asteroid: string;
  bullet: string;
  bulletShape: "round" | "square";
  powerUp: string;
  powerUpText: string;
  particleRgb: string; // "r,g,b"; el alfa lo pone la vida de la partícula
  particleAlphaSteps: number; // 0 = alfa continuo; n = alfa cuantizado a n pasos
  glow: number; // shadowBlur; 0 = sin glow
  lineJoin: CanvasLineJoin;
  smoothing: boolean;
}

const ASTEROIDS_PALETTES: Record<SkinId, AsteroidsPalette> = {
  // Look original exacto.
  clasico: {
    background: "#000",
    ship: "#fff",
    thrust: "rgba(255, 130, 0, 0.85)",
    asteroid: "#fff",
    bullet: "#fff",
    bulletShape: "round",
    powerUp: "#0ff",
    powerUpText: "#0ff",
    particleRgb: "255,255,255",
    particleAlphaSteps: 0,
    glow: 0,
    lineJoin: "round",
    smoothing: true,
  },
  neon: {
    background: "#05030d",
    ship: "#00f5ff",
    thrust: "#ff8a00",
    asteroid: "#ff006e",
    bullet: "#f5ff00",
    bulletShape: "round",
    powerUp: "#00ff88",
    powerUpText: "#00ff88",
    particleRgb: "255,0,110",
    particleAlphaSteps: 0,
    glow: 12,
    lineJoin: "round",
    smoothing: true,
  },
  // Monitor vectorial de fósforo verde: un solo tono + variante tenue/brillante.
  retro: {
    background: "#020d04",
    ship: "#33ff66",
    thrust: "#1f9e3f",
    asteroid: "#33ff66",
    bullet: "#b6ffc8",
    bulletShape: "square",
    powerUp: "#b6ffc8",
    powerUpText: "#b6ffc8",
    particleRgb: "51,255,102",
    particleAlphaSteps: 2,
    glow: 0,
    lineJoin: "miter",
    smoothing: false,
  },
};

function applyGlow(
  ctx: CanvasRenderingContext2D,
  p: AsteroidsPalette,
  color: string
) {
  if (p.glow > 0) {
    ctx.shadowBlur = p.glow;
    ctx.shadowColor = color;
  }
}

const W = 800;
const H = 600;

const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5;
const POWERUP_TTL = 12;
const TRIPLE_SPREAD = 0.18;

const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
const POINTS = [0, 100, 50, 20]; // puntos por tamaño

const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl = 1.1;
  radius = 2;
  dead = false;

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, p: AsteroidsPalette) {
    ctx.fillStyle = p.bullet;
    applyGlow(ctx, p, p.bullet);
    if (p.bulletShape === "square") {
      const r = this.radius;
      ctx.fillRect(
        Math.round(this.x - r),
        Math.round(this.y - r),
        r * 2,
        r * 2
      );
      return;
    }
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Asteroid {
  x: number;
  y: number;
  size: number;
  radius: number;
  dead = false;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: [number, number][] = [];

  constructor(x: number, y: number, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw(ctx: CanvasRenderingContext2D, p: AsteroidsPalette) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = p.asteroid;
    applyGlow(ctx, p, p.asteroid);
    ctx.lineWidth = 1.5;
    ctx.lineJoin = p.lineJoin;
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

class PowerUp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius = 12;
  ttl = POWERUP_TTL;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, p: AsteroidsPalette) {
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = p.powerUp;
    applyGlow(ctx, p, p.powerUp);
    ctx.lineWidth = 2;
    const r = this.radius * pulse;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.fillStyle = p.powerUpText;
    applyGlow(ctx, p, p.powerUpText);
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("3x", this.x, this.y);
  }
}

class Ship {
  x = 0;
  y = 0;
  angle = 0;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 0;
  shootCooldown = 0;
  dead = false;
  tripleShot = 0;

  constructor() {
    this.reset();
  }

  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number, keys: Record<string, boolean>) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot > 0) this.tripleShot -= dt;

    const ROT = 3.5;
    const THRUST = 260;
    const DRAG = 0.987;

    if (keys["ArrowLeft"]) this.angle -= ROT * dt;
    if (keys["ArrowRight"]) this.angle += ROT * dt;

    this.thrusting = !!keys["ArrowUp"];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(ctx: CanvasRenderingContext2D, p: AsteroidsPalette) {
    if (this.dead) return;
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
      return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = p.ship;
    applyGlow(ctx, p, p.ship);
    ctx.lineWidth = 1.5;
    ctx.lineJoin = p.lineJoin;

    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, -9);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, 9);
    ctx.closePath();
    ctx.stroke();

    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = p.thrust;
      applyGlow(ctx, p, p.thrust);
      ctx.stroke();
    }

    ctx.restore();
  }
}

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, p: AsteroidsPalette) {
    let alpha = this.ttl / this.life;
    if (p.particleAlphaSteps > 0)
      alpha = Math.ceil(alpha * p.particleAlphaSteps) / p.particleAlphaSteps;
    ctx.strokeStyle = `rgba(${p.particleRgb},${alpha.toFixed(2)})`;
    applyGlow(ctx, p, `rgb(${p.particleRgb})`);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
  skin: SkinId = DEFAULT_SKIN
): AsteroidsGame {
  const ctx = canvas.getContext("2d")!;
  let palette = ASTEROIDS_PALETTES[skin] ?? ASTEROIDS_PALETTES[DEFAULT_SKIN];

  const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "Space"]);

  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};

  function onKeyDown(e: KeyboardEvent) {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  }
  function onKeyUp(e: KeyboardEvent) {
    keys[e.code] = false;
  }

  function pressed(code: string): boolean {
    const val = justPressed[code];
    justPressed[code] = false;
    return !!val;
  }

  let ship: Ship;
  let bullets: Bullet[];
  let asteroids: Asteroid[];
  let particles: Particle[];
  let powerUps: PowerUp[];
  let score: number;
  let lives: number;
  let level: number;
  let state: "playing" | "dead";
  let deadTimer: number;
  let powerUpSpawned: boolean;
  let killsSinceSpawn: number;
  let over = false;

  let lastScore = -1;
  let lastLives = -1;
  let lastLevel = -1;

  function emitStats() {
    if (score !== lastScore || lives !== lastLives || level !== lastLevel) {
      lastScore = score;
      lastLives = lives;
      lastLevel = level;
      callbacks.onStats({ score, lives, level });
    }
  }

  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x, y;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    over = false;
    spawnAsteroids(4);
    lastScore = -1;
    lastLives = -1;
    lastLevel = -1;
    emitStats();
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    spawnAsteroids(3 + level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      state = "dead";
      over = true;
      emitStats();
      callbacks.onGameOver(score);
    } else {
      state = "dead";
      deadTimer = 2;
      emitStats();
    }
  }

  function update(dt: number) {
    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      if (!over && deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    if (pressed("Space")) {
      bullets.push(...ship.tryShoot());
    }

    ship.update(dt, keys);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }

    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn++;
            const guaranteed = killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    if (!over && asteroids.length === 0) nextLevel();

    emitStats();
  }

  function draw() {
    ctx.shadowBlur = 0;
    ctx.imageSmoothingEnabled = palette.smoothing;
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw(ctx, palette));
    asteroids.forEach((a) => a.draw(ctx, palette));
    powerUps.forEach((p) => p.draw(ctx, palette));
    bullets.forEach((b) => b.draw(ctx, palette));
    ship.draw(ctx, palette);
    ctx.shadowBlur = 0;
  }

  let animationFrameId: number | null = null;
  let lastTime: number | null = null;

  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    if (over) {
      animationFrameId = null;
      return;
    }
    animationFrameId = requestAnimationFrame(loop);
  }

  function startLoop() {
    lastTime = null;
    animationFrameId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  return {
    start() {
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      initGame();
      startLoop();
    },
    pause() {
      stopLoop();
    },
    resume() {
      if (over) return;
      lastTime = null;
      startLoop();
    },
    restart() {
      stopLoop();
      initGame();
      startLoop();
    },
    forceGameOver() {
      if (over) return;
      lives = 0;
      ship.dead = true;
      state = "dead";
      over = true;
      stopLoop();
      emitStats();
      callbacks.onGameOver(score);
    },
    destroy() {
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
    setSkin(nextSkin: SkinId) {
      const next = ASTEROIDS_PALETTES[nextSkin];
      if (!next || next === palette) return;
      palette = next;
      // En pausa o game over el loop está detenido: repinta un frame sin simular.
      if (animationFrameId === null && ship) draw();
    },
  };
}
