import {
  registerGameStop,
  setText,
  showGameOver,
  unlockAchievement,
  updateHighScore,
  loadHighScores,
  state,
  EngineKernel,
  DrawSystem,
} from "../core.js";

const WIDTH = 800;
const HEIGHT = 450;
const GRID = 40;
const COLS = Math.ceil(WIDTH / GRID);
const ROWS = Math.ceil(HEIGHT / GRID);
const CELL_COUNT = COLS * ROWS;

const MAX_ENEMIES = 140;
const MAX_BULLETS = 260;
const MAX_PARTICLES = 500;

const eX = new Float32Array(MAX_ENEMIES);
const eY = new Float32Array(MAX_ENEMIES);
const eVX = new Float32Array(MAX_ENEMIES);
const eVY = new Float32Array(MAX_ENEMIES);
const eSpeed = new Float32Array(MAX_ENEMIES);
const eActive = new Uint8Array(MAX_ENEMIES);

const bX = new Float32Array(MAX_BULLETS);
const bY = new Float32Array(MAX_BULLETS);
const bVX = new Float32Array(MAX_BULLETS);
const bVY = new Float32Array(MAX_BULLETS);
const bTTL = new Float32Array(MAX_BULLETS);
const bActive = new Uint8Array(MAX_BULLETS);
const bFree = new Uint16Array(MAX_BULLETS);
let bTop = 0;

const pX = new Float32Array(MAX_PARTICLES);
const pY = new Float32Array(MAX_PARTICLES);
const pVX = new Float32Array(MAX_PARTICLES);
const pVY = new Float32Array(MAX_PARTICLES);
const pTTL = new Float32Array(MAX_PARTICLES);
const pActive = new Uint8Array(MAX_PARTICLES);
const pFree = new Uint16Array(MAX_PARTICLES);
let pTop = 0;

const cellHead = new Int16Array(CELL_COUNT);
const nextEnemy = new Int16Array(MAX_ENEMIES);

const player = { x: WIDTH * 0.5, y: HEIGHT - 50 };
let targetX = player.x;
let targetY = 80;

let draw;
let kernel;
let score = 0;
let spawnTick = 0;
let fireCooldown = 0;

function resetPools() {
  bTop = MAX_BULLETS;
  pTop = MAX_PARTICLES;
  for (let i = 0; i < MAX_BULLETS; i++) {
    bActive[i] = 0;
    bFree[i] = MAX_BULLETS - i - 1;
  }
  for (let i = 0; i < MAX_PARTICLES; i++) {
    pActive[i] = 0;
    pFree[i] = MAX_PARTICLES - i - 1;
  }
}

function allocBullet() {
  if (bTop <= 0) return -1;
  const i = bFree[--bTop];
  bActive[i] = 1;
  return i;
}
function freeBullet(i) {
  bActive[i] = 0;
  bFree[bTop++] = i;
}

function allocParticle() {
  if (pTop <= 0) return -1;
  const i = pFree[--pTop];
  pActive[i] = 1;
  return i;
}
function freeParticle(i) {
  pActive[i] = 0;
  pFree[pTop++] = i;
}

function spawnEnemy() {
  for (let i = 0; i < MAX_ENEMIES; i++) {
    if (eActive[i]) continue;
    eActive[i] = 1;
    eX[i] = 20 + Math.random() * (WIDTH - 40);
    eY[i] = -20 - Math.random() * 100;
    eVX[i] = 0;
    eVY[i] = 0;
    eSpeed[i] = 40 + Math.random() * 45;
    return;
  }
}

function shoot() {
  const i = allocBullet();
  if (i === -1) return;
  bX[i] = player.x;
  bY[i] = player.y;
  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const inv = 1 / Math.max(1, Math.hypot(dx, dy));
  bVX[i] = dx * inv * 440;
  bVY[i] = dy * inv * 440;
  bTTL[i] = 1.5;
}

function explode(x, y) {
  for (let i = 0; i < 18; i++) {
    const p = allocParticle();
    if (p === -1) break;
    const a = Math.random() * Math.PI * 2;
    const s = 50 + Math.random() * 140;
    pX[p] = x;
    pY[p] = y;
    pVX[p] = Math.cos(a) * s;
    pVY[p] = Math.sin(a) * s;
    pTTL[p] = 0.25 + Math.random() * 0.35;
  }
}

function rebuildGrid() {
  cellHead.fill(-1);
  for (let i = 0; i < MAX_ENEMIES; i++) {
    if (!eActive[i]) continue;
    const cx = Math.max(0, Math.min(COLS - 1, (eX[i] / GRID) | 0));
    const cy = Math.max(0, Math.min(ROWS - 1, (eY[i] / GRID) | 0));
    const cell = cy * COLS + cx;
    nextEnemy[i] = cellHead[cell];
    cellHead[cell] = i;
  }
}

function seekArrive(i, dt) {
  const dx = player.x - eX[i];
  const dy = player.y - 40 - eY[i];
  const dist = Math.hypot(dx, dy);
  const slowRadius = 120;
  const speed = eSpeed[i] * Math.min(1, dist / slowRadius);
  const inv = 1 / Math.max(1, dist);
  const dvx = dx * inv * speed - eVX[i];
  const dvy = dy * inv * speed - eVY[i];
  eVX[i] += dvx * Math.min(1, dt * 4);
  eVY[i] += dvy * Math.min(1, dt * 4);
}

export function updateNeonDefender(dt) {
  if (state.currentGame !== "neondefender") return;

  spawnTick += 1;
  if (spawnTick % 24 === 0) spawnEnemy();
  if (spawnTick % 240 === 0) spawnEnemy();

  fireCooldown -= dt;
  if (fireCooldown <= 0) {
    shoot();
    fireCooldown = 0.08;
  }

  for (let i = 0; i < MAX_ENEMIES; i++) {
    if (!eActive[i]) continue;
    seekArrive(i, dt);
    eX[i] += eVX[i] * dt;
    eY[i] += eVY[i] * dt;
    if (eY[i] > HEIGHT - 30) {
      showGameOver("neondefender", score);
      if (score >= 100) unlockAchievement("neon_guardian");
      return;
    }
  }

  rebuildGrid();

  for (let i = 0; i < MAX_BULLETS; i++) {
    if (!bActive[i]) continue;
    bX[i] += bVX[i] * dt;
    bY[i] += bVY[i] * dt;
    bTTL[i] -= dt;
    if (bTTL[i] <= 0 || bX[i] < -10 || bX[i] > WIDTH + 10 || bY[i] < -10 || bY[i] > HEIGHT + 10) {
      freeBullet(i);
      continue;
    }

    const cx = Math.max(0, Math.min(COLS - 1, (bX[i] / GRID) | 0));
    const cy = Math.max(0, Math.min(ROWS - 1, (bY[i] / GRID) | 0));
    let killed = false;
    for (let oy = -1; oy <= 1 && !killed; oy++) {
      const yy = cy + oy;
      if (yy < 0 || yy >= ROWS) continue;
      for (let ox = -1; ox <= 1 && !killed; ox++) {
        const xx = cx + ox;
        if (xx < 0 || xx >= COLS) continue;
        let e = cellHead[yy * COLS + xx];
        while (e !== -1) {
          const dx = bX[i] - eX[e];
          const dy = bY[i] - eY[e];
          if (dx * dx + dy * dy <= 14 * 14) {
            eActive[e] = 0;
            freeBullet(i);
            explode(eX[e], eY[e]);
            score += 1;
            updateHighScore("neondefender", score);
            killed = true;
            break;
          }
          e = nextEnemy[e];
        }
      }
    }
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
    pVX[i] *= 0.97;
    pVY[i] = pVY[i] * 0.97 + 80 * dt;
  }

  setText("neonDefenderScore", `SCORE: ${score}`);
}

export function drawNeonDefender() {
  if (state.currentGame !== "neondefender") return;
  draw.clear("#050510", 0, 0, WIDTH, HEIGHT);

  draw.rect("#00f5ff", player.x - 10, player.y - 8, 20, 16);
  draw.line("#19335f", 1, 0, HEIGHT - 30, WIDTH, HEIGHT - 30);

  for (let i = 0; i < MAX_ENEMIES; i++) if (eActive[i]) draw.rect("#ff3a7a", eX[i] - 8, eY[i] - 8, 16, 16);
  for (let i = 0; i < MAX_BULLETS; i++) if (bActive[i]) draw.rect("#b0f8ff", bX[i] - 2, bY[i] - 2, 4, 4);
  for (let i = 0; i < MAX_PARTICLES; i++) if (pActive[i]) draw.rect("#ffd166", pX[i], pY[i], 2, 2);

  draw.flush();
}

export function initNeonDefender() {
  state.currentGame = "neondefender";
  loadHighScores();

  const canvas = document.getElementById("neonDefenderCanvas");
  if (!canvas) return;
  draw = new DrawSystem(canvas.getContext("2d"));
  kernel = new EngineKernel({ fixedHz: 60 });

  score = 0;
  spawnTick = 0;
  fireCooldown = 0;
  targetX = WIDTH * 0.5;
  targetY = 40;
  for (let i = 0; i < MAX_ENEMIES; i++) eActive[i] = 0;
  resetPools();

  setText("neonDefenderScore", "SCORE: 0");
  kernel.start(updateNeonDefender, drawNeonDefender, { startPausedUntilInput: true });
}

document.addEventListener("mousemove", (event) => {
  if (state.currentGame !== "neondefender") return;
  const rect = document.getElementById("neonDefenderCanvas")?.getBoundingClientRect();
  if (!rect) return;
  targetX = ((event.clientX - rect.left) / rect.width) * WIDTH;
  targetY = ((event.clientY - rect.top) / rect.height) * HEIGHT;
});

registerGameStop(() => {
  kernel?.stop();
});
