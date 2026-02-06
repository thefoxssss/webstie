// Neon dodge mini-game: weave through falling shards.
import {
  registerGameStop,
  checkLossStreak,
  resetLossStreak,
  setText,
  showGameOver,
  unlockAchievement,
  updateHighScore,
  loadHighScores,
  state,
} from "../core.js";

let dCtx;
let dCv;
let player = {};
let shards = [];
let dScore = 0;
let dFrame = 0;
let dAnim;
let spawnRate = 80;

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
  spawnRate = 80;
  setText("dodgeScore", "SCORE: 0");
  loopDodge();
}

function spawnShard() {
  const size = 16 + Math.random() * 20;
  shards.push({
    x: Math.random() * (CANVAS_W - size),
    y: -size,
    w: size,
    h: size,
    speed: 2 + Math.random() * 2 + dScore * 0.03,
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
    if (spawnRate > 35) spawnRate -= 1;
  }

  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent");
  dCtx.fillStyle = accent;
  dCtx.fillRect(player.x, player.y, player.w, player.h);

  const shardSlowdown = state.myInventory.includes("item_dodge_stabilizer") ? 0.75 : 1;

  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    s.y += s.speed * shardSlowdown;
    dCtx.fillStyle = "#fff";
    dCtx.fillRect(s.x, s.y, s.w, s.h);

    if (
      player.x < s.x + s.w &&
      player.x + player.w > s.x &&
      player.y < s.y + s.h &&
      player.y + player.h > s.y
    ) {
      checkLossStreak();
      showGameOver("dodge", dScore);
      return;
    }

    if (s.y > CANVAS_H + 20) {
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
