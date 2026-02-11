// Flappy-style game with pipes, gravity, and tap-to-flap controls.
import {
  registerGameStop,
  showGameOver,
  showToast,
  setText,
  updateHighScore,
  loadHighScores,
  consumeShield,
  state,
} from "../core.js";

let fBird = {};
let fPipes = [];
let fScore = 0;
let fAnim;
let fLastTime = 0;
let fSpawnAccumulator = 0;

const FLAP_STRENGTH = -7;
const GRAVITY = 0.5;
const BASE_PIPE_SPEED = 2.2;
const BASE_PIPE_GAP = 200;
const MIN_PIPE_GAP = 130;
const BASE_PIPE_SPAWN_CHANCE = 0.01;
const MAX_PIPE_SPAWN_CHANCE = 0.03;
const PIPE_MIN_DISTANCE = 220;
const BASE_FRAME_MS = 1000 / 60;
const MAX_DT_FRAMES = 2.5;

function getDifficultyFactor() {
  return Math.min(fScore, 30) / 30;
}

function getPipeSpeed() {
  return BASE_PIPE_SPEED + getDifficultyFactor() * 1.8;
}

function getPipeGap() {
  return BASE_PIPE_GAP - getDifficultyFactor() * (BASE_PIPE_GAP - MIN_PIPE_GAP);
}

function getPipeSpawnChance() {
  return (
    BASE_PIPE_SPAWN_CHANCE +
    getDifficultyFactor() * (MAX_PIPE_SPAWN_CHANCE - BASE_PIPE_SPAWN_CHANCE)
  );
}

export function initFlappy() {
  state.currentGame = "flappy";
  loadHighScores();
  fBird = { x: 50, y: 300, dy: 0 };
  fPipes = [];
  fScore = 0;
  fLastTime = 0;
  fSpawnAccumulator = 0;
  setText("flappyScore", "SCORE: 0");
  loopFlappy(performance.now());
}

// Main game loop: physics update, pipe spawn, collision, render.
function loopFlappy(now) {
  if (state.currentGame !== "flappy") return;
  const dtFrames = fLastTime
    ? Math.min((now - fLastTime) / BASE_FRAME_MS, MAX_DT_FRAMES)
    : 1;
  fLastTime = now;

  const ctx = document.getElementById("flappyCanvas").getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 400, 600);
  if (state.keysPressed[" "]) {
    fBird.dy = FLAP_STRENGTH;
    state.keysPressed[" "] = false;
  }
  fBird.dy += GRAVITY * dtFrames;
  fBird.y += fBird.dy * dtFrames;
  ctx.fillStyle = "#fff";
  ctx.fillRect(fBird.x, fBird.y, 20, 20);
  if (fBird.y > 600 || fBird.y < 0) {
    if (consumeShield()) {
      fBird.y = Math.max(0, Math.min(580, fBird.y));
      fBird.dy = 0;
      showToast("SHIELD USED", "🛡️");
      fAnim = requestAnimationFrame(loopFlappy);
      return;
    }
    showGameOver("flappy", fScore);
    return;
  }
  const lastPipe = fPipes[fPipes.length - 1];
  const canSpawnPipe = !lastPipe || lastPipe.x < 400 - PIPE_MIN_DISTANCE;
  fSpawnAccumulator = Math.min(1.5, fSpawnAccumulator + getPipeSpawnChance() * dtFrames);
  if (canSpawnPipe && fSpawnAccumulator >= 1) {
    fSpawnAccumulator -= 1;
    fPipes.push({ x: 400, gap: getPipeGap(), h: Math.random() * 250 + 50 });
  }
  for (let i = fPipes.length - 1; i >= 0; i--) {
    const p = fPipes[i];
    p.x -= getPipeSpeed() * dtFrames;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent");
    ctx.fillRect(p.x, 0, 40, p.h);
    ctx.fillRect(p.x, p.h + p.gap, 40, 600);
    if (
      fBird.x + 20 > p.x &&
      fBird.x < p.x + 40 &&
      (fBird.y < p.h || fBird.y + 20 > p.h + p.gap)
    ) {
      if (consumeShield()) {
        fPipes.splice(i, 1);
        showToast("SHIELD USED", "🛡️");
        continue;
      }
      showGameOver("flappy", fScore);
      return;
    }
    if (p.x < -40) {
      fPipes.splice(i, 1);
      fScore++;
      updateHighScore("flappy", fScore);
      setText("flappyScore", "SCORE: " + fScore);
    }
  }
  fAnim = requestAnimationFrame(loopFlappy);
}

// Click/tap to flap.
document.getElementById("flappyCanvas").onclick = () => {
  if (state.currentGame === "flappy") fBird.dy = FLAP_STRENGTH;
};

// Cancel animation loop on exit.
registerGameStop(() => {
  if (fAnim) cancelAnimationFrame(fAnim);
});
