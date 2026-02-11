// Neon dodge mini-game: weave through falling shards.
import {
  registerGameStop,
  checkLossStreak,
  resetLossStreak,
  setText,
  showGameOver,
  showToast,
  unlockAchievement,
  updateHighScore,
  loadHighScores,
  consumeShield,
  state,
  hasActiveItem,
} from "../core.js";

let dCtx;
let dCv;
let player = {};
let shards = [];
let dScore = 0;
let dElapsed = 0;
let dAnim;
let spawnRate = 70;
let sideRate = 200;
let wallRate = 520;
let spawnTimer = 0;
let sideTimer = 0;
let wallTimer = 0;
let dLastTime = 0;

const CANVAS_W = 700;
const CANVAS_H = 450;
const FPS = 60;
const FRAME_MS = 1000 / FPS;
const MAX_DT_FRAMES = 2.5;

export function initDodge() {
  state.currentGame = "dodge";
  loadHighScores();
  dCv = document.getElementById("dodgeCanvas");
  dCtx = dCv.getContext("2d");
  player = {
    x: CANVAS_W / 2 - 15,
    y: CANVAS_H - 60,
    w: 30,
    h: 30,
    speed: 4.5,
  };
  shards = [];
  dScore = 0;
  dElapsed = 0;
  spawnRate = 70;
  sideRate = 200;
  wallRate = 520;
  spawnTimer = 0;
  sideTimer = 0;
  wallTimer = 0;
  dLastTime = 0;
  setText("dodgeScore", "TIME: 0s");
  loopDodge(performance.now());
}

function spawnShard() {
  const size = 18 + Math.random() * 26;
  shards.push({
    x: Math.random() * (CANVAS_W - size),
    y: -size,
    w: size,
    h: size,
    speed: 2.8 + Math.random() * 2.8 + dScore * 0.05,
    type: "fall",
  });
}

function spawnSideShard() {
  const width = 60 + Math.random() * 90;
  const height = 16 + Math.random() * 12;
  const fromLeft = Math.random() > 0.5;
  shards.push({
    x: fromLeft ? -width : CANVAS_W + width,
    y: 40 + Math.random() * (CANVAS_H - 80),
    w: width,
    h: height,
    speed: 3 + Math.random() * 2.5 + dScore * 0.03,
    type: fromLeft ? "side-left" : "side-right",
  });
}

function spawnDiagonalShard() {
  const size = 16 + Math.random() * 16;
  const fromLeft = Math.random() > 0.5;
  shards.push({
    x: fromLeft ? -size : CANVAS_W + size,
    y: 30 + Math.random() * (CANVAS_H * 0.45),
    w: size,
    h: size,
    speed: 2.8 + Math.random() * 2 + dScore * 0.035,
    drift: (1.2 + Math.random() * 1.4) * (fromLeft ? 1 : -1),
    type: "diag",
  });
}

function spawnWallAttack() {
  const gapSize = 72;
  const thickness = 28;
  const speed = 2.7 + Math.random() * 0.8 + dScore * 0.02;
  const direction = Math.floor(Math.random() * 4);

  if (direction < 2) {
    const gapStart = 30 + Math.random() * (CANVAS_W - gapSize - 60);
    const y = direction === 0 ? -thickness : CANVAS_H + thickness;
    const type = direction === 0 ? "wall-down" : "wall-up";
    shards.push({
      x: 0,
      y,
      w: gapStart,
      h: thickness,
      speed,
      type,
    });
    shards.push({
      x: gapStart + gapSize,
      y,
      w: CANVAS_W - (gapStart + gapSize),
      h: thickness,
      speed,
      type,
    });
  } else {
    const gapStart = 30 + Math.random() * (CANVAS_H - gapSize - 60);
    const x = direction === 2 ? -thickness : CANVAS_W + thickness;
    const type = direction === 2 ? "wall-right" : "wall-left";
    shards.push({
      x,
      y: 0,
      w: thickness,
      h: gapStart,
      speed,
      type,
    });
    shards.push({
      x,
      y: gapStart + gapSize,
      w: thickness,
      h: CANVAS_H - (gapStart + gapSize),
      speed,
      type,
    });
  }
}

function updatePlayer(dtFrames) {
  const left = state.keysPressed.ArrowLeft || state.keysPressed.a;
  const right = state.keysPressed.ArrowRight || state.keysPressed.d;
  const up = state.keysPressed.ArrowUp || state.keysPressed.w;
  const down = state.keysPressed.ArrowDown || state.keysPressed.s;
  if (left) player.x -= player.speed * dtFrames;
  if (right) player.x += player.speed * dtFrames;
  if (up) player.y -= player.speed * dtFrames;
  if (down) player.y += player.speed * dtFrames;
  player.x = Math.max(10, Math.min(CANVAS_W - player.w - 10, player.x));
  player.y = Math.max(10, Math.min(CANVAS_H - player.h - 10, player.y));
}

function drawHud() {
  dCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent");
  dCtx.lineWidth = 2;
  dCtx.strokeRect(8, 8, CANVAS_W - 16, CANVAS_H - 16);
}

function updateScoreFromTime() {
  const timeScore = Math.floor(dElapsed);
  if (timeScore === dScore) return;
  dScore = timeScore;
  updateHighScore("dodge", dScore);
  setText("dodgeScore", "TIME: " + dScore + "s");
  if (dScore === 25) unlockAchievement("grid_runner");
  resetLossStreak();
}

function loopDodge(now) {
  if (state.currentGame !== "dodge") return;
  const dtFrames = dLastTime
    ? Math.min((now - dLastTime) / FRAME_MS, MAX_DT_FRAMES)
    : 1;
  dLastTime = now;
  dElapsed += dtFrames / FPS;
  spawnTimer += dtFrames;
  sideTimer += dtFrames;
  wallTimer += dtFrames;
  dCtx.fillStyle = "#000";
  dCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  updatePlayer(dtFrames);
  drawHud();
  updateScoreFromTime();

  while (spawnTimer >= spawnRate) {
    spawnTimer -= spawnRate;
    spawnShard();
    if (Math.random() > 0.6) spawnShard();
    if (spawnRate > 30) spawnRate -= 1;
  }

  while (sideTimer >= sideRate) {
    sideTimer -= sideRate;
    spawnSideShard();
    if (dScore > 10 && Math.random() > 0.5) spawnDiagonalShard();
    if (sideRate > 120) sideRate -= 2;
  }

  while (wallTimer >= wallRate) {
    wallTimer -= wallRate;
    spawnWallAttack();
    if (wallRate > 400) wallRate -= 20;
  }

  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent");
  dCtx.fillStyle = accent;
  dCtx.fillRect(player.x, player.y, player.w, player.h);

  const shardSlowdown = hasActiveItem("item_dodge_stabilizer") ? 0.75 : 1;

  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    if (s.type === "fall") {
      s.y += s.speed * shardSlowdown * dtFrames;
    } else if (s.type === "diag") {
      s.y += s.speed * shardSlowdown * dtFrames;
      s.x += s.drift * shardSlowdown * dtFrames;
    } else if (s.type === "wall-down") {
      s.y += s.speed * shardSlowdown * dtFrames;
    } else if (s.type === "wall-up") {
      s.y -= s.speed * shardSlowdown * dtFrames;
    } else if (s.type === "wall-right") {
      s.x += s.speed * shardSlowdown * dtFrames;
    } else if (s.type === "wall-left") {
      s.x -= s.speed * shardSlowdown * dtFrames;
    } else {
      const dir = s.type === "side-left" ? 1 : -1;
      s.x += dir * s.speed * shardSlowdown * dtFrames;
    }

    const isWall = s.type.startsWith("wall-");
    dCtx.fillStyle = isWall ? "#ffd166" : s.type === "diag" ? "#9bf6ff" : "#fff";
    dCtx.fillRect(s.x, s.y, s.w, s.h);

    if (
      player.x < s.x + s.w &&
      player.x + player.w > s.x &&
      player.y < s.y + s.h &&
      player.y + player.h > s.y
    ) {
      if (consumeShield()) {
        shards.splice(i, 1);
        showToast("SHIELD USED", "🛡️");
        continue;
      }
      checkLossStreak();
      showGameOver("dodge", dScore);
      return;
    }

    if (s.y > CANVAS_H + 40 || s.y < -80 || s.x < -CANVAS_W || s.x > CANVAS_W * 2) {
      shards.splice(i, 1);
    }
  }

  dAnim = requestAnimationFrame(loopDodge);
}

registerGameStop(() => {
  if (dAnim) cancelAnimationFrame(dAnim);
});
