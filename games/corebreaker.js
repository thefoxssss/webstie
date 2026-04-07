import {
  registerGameStop,
  setText,
  showGameOver,
  showToast,
  unlockAchievement,
  updateHighScore,
  loadHighScores,
  state,
  EngineKernel,
  DrawSystem,
  isInputFocused,
} from "../core.js";

const WIDTH = 800;
const HEIGHT = 450;
const FIXED_DT = 1 / 60;

const BLOCK_ARMORED = 1 << 0;
const BLOCK_EXPLOSIVE = 1 << 1;
const BLOCK_GHOST = 1 << 2;

const MAX_BLOCKS = 160;
const MAX_POWERUPS = 48;
const MAX_PARTICLES = 256;

const paddle = { x: 350, y: 412, w: 100, h: 14, speed: 500 };
const ball = { x: 400, y: 300, px: 400, py: 300, vx: 220, vy: -250, r: 7 };

const blockX = new Float32Array(MAX_BLOCKS);
const blockY = new Float32Array(MAX_BLOCKS);
const blockW = new Float32Array(MAX_BLOCKS);
const blockH = new Float32Array(MAX_BLOCKS);
const blockMask = new Uint8Array(MAX_BLOCKS);
const blockHP = new Uint8Array(MAX_BLOCKS);
const blockActive = new Uint8Array(MAX_BLOCKS);

const puX = new Float32Array(MAX_POWERUPS);
const puY = new Float32Array(MAX_POWERUPS);
const puVY = new Float32Array(MAX_POWERUPS);
const puType = new Uint8Array(MAX_POWERUPS);
const puActive = new Uint8Array(MAX_POWERUPS);
const puFree = new Uint16Array(MAX_POWERUPS);
let puFreeTop = 0;

const pX = new Float32Array(MAX_PARTICLES);
const pY = new Float32Array(MAX_PARTICLES);
const pVX = new Float32Array(MAX_PARTICLES);
const pVY = new Float32Array(MAX_PARTICLES);
const pTTL = new Float32Array(MAX_PARTICLES);
const pActive = new Uint8Array(MAX_PARTICLES);
const pFree = new Uint16Array(MAX_PARTICLES);
let pFreeTop = 0;

let ctx;
let draw;
let kernel;
let score = 0;
let lives = 3;
let shakeTime = 0;
let shakeMag = 0;
let moveDir = 0;

function resetPools() {
  puFreeTop = MAX_POWERUPS;
  pFreeTop = MAX_PARTICLES;
  for (let i = 0; i < MAX_POWERUPS; i++) {
    puActive[i] = 0;
    puFree[i] = MAX_POWERUPS - i - 1;
  }
  for (let i = 0; i < MAX_PARTICLES; i++) {
    pActive[i] = 0;
    pFree[i] = MAX_PARTICLES - i - 1;
  }
}

function allocPowerup() {
  if (puFreeTop <= 0) return -1;
  const idx = puFree[--puFreeTop];
  puActive[idx] = 1;
  return idx;
}

function freePowerup(i) {
  puActive[i] = 0;
  puFree[puFreeTop++] = i;
}

function allocParticle() {
  if (pFreeTop <= 0) return -1;
  const idx = pFree[--pFreeTop];
  pActive[idx] = 1;
  return idx;
}

function freeParticle(i) {
  pActive[i] = 0;
  pFree[pFreeTop++] = i;
}

function spawnImpactParticles(x, y, count = 8) {
  for (let i = 0; i < count; i++) {
    const idx = allocParticle();
    if (idx === -1) break;
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 180;
    pX[idx] = x;
    pY[idx] = y;
    pVX[idx] = Math.cos(a) * s;
    pVY[idx] = Math.sin(a) * s;
    pTTL[idx] = 0.2 + Math.random() * 0.3;
  }
}

function screenShake(intensity, duration) {
  shakeMag = Math.max(shakeMag, intensity);
  shakeTime = Math.max(shakeTime, duration);
}

function spawnPowerup(x, y) {
  const idx = allocPowerup();
  if (idx === -1) return;
  puX[idx] = x;
  puY[idx] = y;
  puVY[idx] = 120;
  puType[idx] = Math.random() < 0.5 ? 1 : 2;
}

function initBricks() {
  for (let i = 0; i < MAX_BLOCKS; i++) blockActive[i] = 0;
  let n = 0;
  const rows = 8;
  const cols = 12;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (n >= MAX_BLOCKS) return;
      blockActive[n] = 1;
      blockW[n] = 58;
      blockH[n] = 18;
      blockX[n] = 40 + c * 62;
      blockY[n] = 40 + r * 24;
      let mask = 0;
      if (r < 2) mask |= BLOCK_ARMORED;
      if ((r + c) % 7 === 0) mask |= BLOCK_EXPLOSIVE;
      if ((r + c) % 9 === 0) mask |= BLOCK_GHOST;
      blockMask[n] = mask;
      blockHP[n] = (mask & BLOCK_ARMORED) ? 2 : 1;
      n++;
    }
  }
}

function intersectAABB(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function resolveBallVsBlock(i) {
  const nx = ball.x;
  const ny = ball.y;
  const px = ball.px;
  const py = ball.py;
  const bx = blockX[i];
  const by = blockY[i];
  const bw = blockW[i];
  const bh = blockH[i];

  const nowHit = intersectAABB(nx - ball.r, ny - ball.r, ball.r * 2, ball.r * 2, bx, by, bw, bh);
  if (!nowHit) return false;

  const prevHit = intersectAABB(px - ball.r, py - ball.r, ball.r * 2, ball.r * 2, bx, by, bw, bh);
  if (!prevHit) {
    const enteredLeft = px + ball.r <= bx;
    const enteredRight = px - ball.r >= bx + bw;
    const enteredTop = py + ball.r <= by;
    const enteredBottom = py - ball.r >= by + bh;
    if (enteredLeft || enteredRight) ball.vx *= -1;
    if (enteredTop || enteredBottom) ball.vy *= -1;
  } else {
    ball.vy *= -1;
  }

  const mask = blockMask[i];
  if (!(mask & BLOCK_GHOST)) {
    blockHP[i] = Math.max(0, blockHP[i] - 1);
    if (blockHP[i] === 0) {
      blockActive[i] = 0;
      score += 25;
      updateHighScore("corebreaker", score);
      if (Math.random() < 0.25) spawnPowerup(bx + bw * 0.5, by + bh * 0.5);
      if (mask & BLOCK_EXPLOSIVE) {
        screenShake(7, 0.25);
        for (let j = 0; j < MAX_BLOCKS; j++) {
          if (!blockActive[j] || j === i) continue;
          const dx = blockX[j] - bx;
          const dy = blockY[j] - by;
          if (dx * dx + dy * dy < 80 * 80) {
            blockHP[j] = 0;
            blockActive[j] = 0;
            score += 15;
          }
        }
      }
      spawnImpactParticles(bx + bw * 0.5, by + bh * 0.5, 12);
    }
  }
  screenShake(3, 0.1);
  return true;
}

export function updateCoreBreaker() {
  const dt = FIXED_DT;
  if (state.currentGame !== "corebreaker") return;

  paddle.x += moveDir * paddle.speed * dt;
  paddle.x = Math.max(0, Math.min(WIDTH - paddle.w, paddle.x));

  ball.px = ball.x;
  ball.py = ball.y;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x - ball.r < 0 || ball.x + ball.r > WIDTH) {
    ball.vx *= -1;
    ball.x = Math.max(ball.r, Math.min(WIDTH - ball.r, ball.x));
  }
  if (ball.y - ball.r < 0) {
    ball.vy *= -1;
    ball.y = ball.r;
  }

  if (intersectAABB(ball.x - ball.r, ball.y - ball.r, ball.r * 2, ball.r * 2, paddle.x, paddle.y, paddle.w, paddle.h)) {
    const t = (ball.x - paddle.x) / paddle.w;
    const ang = (t - 0.5) * 1.2;
    const speed = Math.hypot(ball.vx, ball.vy);
    ball.vx = Math.sin(ang) * speed;
    ball.vy = -Math.abs(Math.cos(ang) * speed);
    ball.y = paddle.y - ball.r - 1;
  }

  for (let i = 0; i < MAX_BLOCKS; i++) {
    if (!blockActive[i]) continue;
    if (resolveBallVsBlock(i)) break;
  }

  if (ball.y - ball.r > HEIGHT) {
    lives -= 1;
    if (lives <= 0) {
      showGameOver("corebreaker", score);
      if (score >= 1500) unlockAchievement("brick_breaker");
      return;
    }
    ball.x = WIDTH * 0.5;
    ball.y = HEIGHT * 0.65;
    ball.vx = 220;
    ball.vy = -250;
    screenShake(8, 0.2);
  }

  for (let i = 0; i < MAX_POWERUPS; i++) {
    if (!puActive[i]) continue;
    puY[i] += puVY[i] * dt;
    if (intersectAABB(puX[i] - 8, puY[i] - 8, 16, 16, paddle.x, paddle.y, paddle.w, paddle.h)) {
      if (puType[i] === 1) paddle.w = Math.min(160, paddle.w + 20);
      else lives = Math.min(5, lives + 1);
      freePowerup(i);
      showToast("POWER-UP", "⚡");
      continue;
    }
    if (puY[i] > HEIGHT + 20) freePowerup(i);
  }

  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (!pActive[i]) continue;
    pTTL[i] -= dt;
    if (pTTL[i] <= 0) {
      freeParticle(i);
      continue;
    }
    pX[i] += pVX[i] * dt;
    pY[i] += pVY[i] * dt;
    pVY[i] += 200 * dt;
  }

  if (shakeTime > 0) {
    shakeTime -= dt;
    if (shakeTime <= 0) shakeMag = 0;
  }

  setText("coreBreakerScore", `SCORE: ${score} | LIVES: ${lives}`);
}

export function drawCoreBreaker() {
  if (state.currentGame !== "corebreaker") return;
  const ox = shakeTime > 0 ? (Math.random() - 0.5) * shakeMag : 0;
  const oy = shakeTime > 0 ? (Math.random() - 0.5) * shakeMag : 0;

  draw.clear("#06080f", 0, 0, WIDTH, HEIGHT);
  draw.rect("#66ffcc", paddle.x + ox, paddle.y + oy, paddle.w, paddle.h);
  draw.rect("#ffffff", ball.x - ball.r + ox, ball.y - ball.r + oy, ball.r * 2, ball.r * 2);

  for (let i = 0; i < MAX_BLOCKS; i++) {
    if (!blockActive[i]) continue;
    const m = blockMask[i];
    const c = m & BLOCK_EXPLOSIVE ? "#ff6a3d" : m & BLOCK_ARMORED ? "#88aaff" : m & BLOCK_GHOST ? "#9f73ff" : "#38f275";
    draw.rect(c, blockX[i] + ox, blockY[i] + oy, blockW[i], blockH[i]);
  }

  for (let i = 0; i < MAX_POWERUPS; i++) {
    if (puActive[i]) draw.rect("#ffe066", puX[i] - 6 + ox, puY[i] - 6 + oy, 12, 12);
  }

  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (pActive[i]) draw.rect("#ffffff", pX[i] + ox, pY[i] + oy, 2, 2);
  }

  draw.flush();
}

export function initCoreBreaker() {
  state.currentGame = "corebreaker";
  loadHighScores();

  const canvas = document.getElementById("coreBreakerCanvas");
  if (!canvas) return;
  ctx = canvas.getContext("2d");
  draw = new DrawSystem(ctx);
  kernel = new EngineKernel({ fixedHz: 60 });

  score = 0;
  lives = 3;
  moveDir = 0;
  paddle.w = 100;
  paddle.x = 350;
  ball.x = WIDTH * 0.5;
  ball.y = HEIGHT * 0.65;
  ball.vx = 220;
  ball.vy = -250;
  shakeTime = 0;
  shakeMag = 0;

  initBricks();
  resetPools();
  setText("coreBreakerScore", "SCORE: 0 | LIVES: 3");
  kernel.start(updateCoreBreaker, drawCoreBreaker, { startPausedUntilInput: true });
}

document.addEventListener("keydown", (event) => {
  if (isInputFocused(event)) return;
  if (state.currentGame !== "corebreaker") return;
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") moveDir = -1;
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") moveDir = 1;
});

document.addEventListener("keyup", (event) => {
  if (state.currentGame !== "corebreaker") return;
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    if (moveDir < 0) moveDir = 0;
  }
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    if (moveDir > 0) moveDir = 0;
  }
});

registerGameStop(() => {
  kernel?.stop();
});
