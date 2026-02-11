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
let dFrame = 0;
let dAnim;
let spawnRate = 70;
let sideRate = 200;

const CANVAS_W = 700;
const CANVAS_H = 450;

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
  dFrame = 0;
  spawnRate = 70;
  sideRate = 200;
  setText("dodgeScore", "SCORE: 0");
  loopDodge();
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

function updatePlayer() {
  const left = state.keysPressed.ArrowLeft || state.keysPressed.a;
  const right = state.keysPressed.ArrowRight || state.keysPressed.d;
  const up = state.keysPressed.ArrowUp || state.keysPressed.w;
  const down = state.keysPressed.ArrowDown || state.keysPressed.s;
  if (left) player.x -= player.speed;
  if (right) player.x += player.speed;
  if (up) player.y -= player.speed;
  if (down) player.y += player.speed;
  player.x = Math.max(10, Math.min(CANVAS_W - player.w - 10, player.x));
  player.y = Math.max(10, Math.min(CANVAS_H - player.h - 10, player.y));
}

function drawHud() {
  dCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent");
  dCtx.lineWidth = 2;
  dCtx.strokeRect(8, 8, CANVAS_W - 16, CANVAS_H - 16);
}

function loopDodge() {
  if (state.currentGame !== "dodge") return;
  dFrame++;
  dCtx.fillStyle = "#000";
  dCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  updatePlayer();
  drawHud();

  if (dFrame % spawnRate === 0) {
    spawnShard();
    if (Math.random() > 0.6) spawnShard();
    if (spawnRate > 30) spawnRate -= 1;
  }

  if (dFrame % sideRate === 0) {
    spawnSideShard();
    if (sideRate > 120) sideRate -= 2;
  }

  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent");
  dCtx.fillStyle = accent;
  dCtx.fillRect(player.x, player.y, player.w, player.h);

  const shardSlowdown = hasActiveItem("item_dodge_stabilizer") ? 0.75 : 1;

  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    if (s.type === "fall") {
      s.y += s.speed * shardSlowdown;
    } else {
      const dir = s.type === "side-left" ? 1 : -1;
      s.x += dir * s.speed * shardSlowdown;
    }
    dCtx.fillStyle = "#fff";
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

    if (s.y > CANVAS_H + 20 || s.x < -CANVAS_W || s.x > CANVAS_W * 2) {
      shards.splice(i, 1);
      dScore += 1;
      updateHighScore("dodge", dScore);
      setText("dodgeScore", "SCORE: " + dScore);
      if (dScore === 25) unlockAchievement("grid_runner");
      resetLossStreak();
    }
  }

  dAnim = requestAnimationFrame(loopDodge);
}

registerGameStop(() => {
  if (dAnim) cancelAnimationFrame(dAnim);
});
