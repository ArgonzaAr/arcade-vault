// ===== engine.ts — motor real de Arkanoid, portado de =====
// references/started-games/04-arkanoid/game.js

import { LEVELS } from "./levels";
import {
  loadSpritesheet,
  drawSprite,
  drawFrame,
  EXPLOSION_FRAMES,
  EXPLOSION_DURATION,
} from "./spritesheet";

export interface ArkanoidStats {
  score: number;
  lives: number;
  level: number;
}

export interface ArkanoidCallbacks {
  onStats: (stats: ArkanoidStats) => void;
  onGameOver: (finalScore: number) => void;
}

export interface ArkanoidGame {
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
  forceGameOver: () => void;
}

const W = 800;
const H = 600;

const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;

interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Ball {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alive: boolean;
}

interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  elapsed: number;
}

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  callbacks: ArkanoidCallbacks
): ArkanoidGame {
  const ctx = canvas.getContext("2d")!;

  const bounceSound = new Audio("/games/arkanoid/ball-bounce.mp3");
  const breakSound = new Audio("/games/arkanoid/break-sound.mp3");

  const paddle: Paddle = { x: 0, y: 560, w: 81, h: 14 };
  const ball: Ball = { x: 0, y: 0, w: 16, h: 16, vx: 200, vy: -300 };

  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = 3;
  let score = 0;
  let currentLevel = 1;
  let over = false;
  let spritesReady = false;

  const keys: Record<string, boolean> = { ArrowLeft: false, ArrowRight: false };

  let lastScore = -1;
  let lastLives = -1;
  let lastLevel = -1;

  function emitStats() {
    if (
      score !== lastScore ||
      lives !== lastLives ||
      currentLevel !== lastLevel
    ) {
      lastScore = score;
      lastLives = lives;
      lastLevel = currentLevel;
      callbacks.onStats({ score, lives, level: currentLevel });
    }
  }

  function initPaddle() {
    paddle.x = (canvas.width - paddle.w) / 2;
  }

  function initBall() {
    const speed = LEVELS[currentLevel - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    currentLevel = n;
    const level = LEVELS[n - 1];
    blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * level.speed;
    ball.vy = BASE_BALL_VY * level.speed;
  }

  function collideAABB(block: Block): boolean {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }

  function playSound(sound: HTMLAudioElement) {
    (sound.cloneNode() as HTMLAudioElement).play().catch(() => {});
  }

  function onMouseMove(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    paddle.x = Math.max(
      0,
      Math.min(canvas.width - paddle.w, mouseX - paddle.w / 2)
    );
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key in keys) keys[e.key] = true;
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.key in keys) keys[e.key] = false;
  }

  function endGame() {
    if (over) return;
    over = true;
    stopLoop();
    emitStats();
    callbacks.onGameOver(score);
  }

  function update(dt: number) {
    if (over) return;

    if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys.ArrowRight)
      paddle.x = Math.min(
        canvas.width - paddle.w,
        paddle.x + PADDLE_SPEED * dt
      );

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      playSound(bounceSound);
    }
    if (ball.x + ball.w >= canvas.width) {
      ball.x = canvas.width - ball.w;
      ball.vx = -Math.abs(ball.vx);
      playSound(bounceSound);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      playSound(bounceSound);
    }

    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      playSound(bounceSound);
    }

    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        score += 10;
        ball.vy = -ball.vy;
        playSound(breakSound);
        if (blocks.every((b) => !b.alive)) {
          if (currentLevel < 5) {
            loadLevel(currentLevel + 1);
          } else {
            emitStats();
            endGame();
            return;
          }
        }
        break;
      }
    }

    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    if (ball.y > canvas.height) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        emitStats();
        endGame();
        return;
      } else {
        initBall();
      }
    }

    emitStats();
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!spritesReady) return;

    for (const block of blocks) {
      if (block.alive)
        drawSprite(
          ctx,
          "block_" + block.color,
          block.x,
          block.y,
          block.w,
          block.h
        );
    }

    for (const exp of explosions) {
      const frameIndex = Math.min(
        Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
        3
      );
      drawFrame(
        ctx,
        EXPLOSION_FRAMES[exp.color][frameIndex],
        exp.x,
        exp.y,
        exp.w,
        exp.h
      );
    }

    drawSprite(ctx, "paddle", paddle.x, paddle.y, paddle.w, paddle.h);
    drawSprite(ctx, "ball", ball.x, ball.y, ball.w, ball.h);
  }

  let animationFrameId: number | null = null;
  let lastTime: number | null = null;

  function loop(ts: number) {
    if (lastTime === null) lastTime = ts;
    const dt = (ts - lastTime) / 1000;
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

  function initGame() {
    lives = 3;
    score = 0;
    over = false;
    lastScore = -1;
    lastLives = -1;
    lastLevel = -1;
    initPaddle();
    loadLevel(1);
    emitStats();
  }

  return {
    start() {
      document.addEventListener("keydown", onKeyDown);
      document.addEventListener("keyup", onKeyUp);
      canvas.addEventListener("mousemove", onMouseMove);
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
      document.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouseMove);
    },
  };
}
