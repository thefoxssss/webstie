// Endless runner with obstacles, jump physics, and speed scaling.
import {
  registerGameStop,
  checkLossStreak,
  resetLossStreak,
  setText,
  showGameOver,
  showToast,
  updateHighScore,
  loadHighScores,
  consumeShield,
  state,
  hasActiveItem,
} from "../core.js";

let rCtx;
let rCv;
let player = {};
let rObs = [];
let rSpeed = 5;
let rScore = 0;
let rAnim;
let rSpawnTimer = 0;
let rLastTime = 0;

const BASE_FRAME_MS = 1000 / 60;
const MAX_DT_FRAMES = 2.5;

export function initRunner() {
  state.currentGame = "runner";
  loadHighScores();
  rCv = document.getElementById("runnerCanvas");
  rCtx = rCv.getContext("2d");
  player = { x: 50, y: 300, w: 30, h: 50, dy: 0, grounded: true, jumpForce: 12, gravity: 0.6 };
  rObs = [];
  rSpeed = 5;
  rScore = 0;
  rSpawnTimer = 0;
  rLastTime = 0;
  setText("runnerScoreBoard", "SCORE: 0");
  loopRunner(performance.now());
}

// Main runner loop: update physics, spawn obstacles, render, and score.
function loopRunner(now) {
  if (state.currentGame !== "runner") return;
  const dtFrames = rLastTime
    ? Math.min((now - rLastTime) / BASE_FRAME_MS, MAX_DT_FRAMES)
    : 1;
  rLastTime = now;
  rCtx.fillStyle = "#000";
  rCtx.fillRect(0, 0, 800, 400);
  rCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent");
  rCtx.lineWidth = 2;
  rCtx.beginPath();
  rCtx.moveTo(0, 350);
  rCtx.lineTo(800, 350);
  rCtx.stroke();
  const currentSpeed = rSpeed * (hasActiveItem("item_slowmo") ? 0.8 : 1);
  if ((state.keysPressed[" "] || state.keysPressed.ArrowUp) && player.grounded) {
    player.dy = -player.jumpForce;
    player.grounded = false;
  }
  player.dy += player.gravity * dtFrames;
  player.y += player.dy * dtFrames;
  if (player.y > 300) {
    player.y = 300;
    player.dy = 0;
    player.grounded = true;
  }
  rCtx.fillStyle = "#fff";
  rCtx.fillRect(player.x, player.y, player.w, player.h);
  rSpawnTimer += dtFrames;
  const spawnInterval = Math.max(40, Math.floor(1000 / currentSpeed));
  while (rSpawnTimer >= spawnInterval) {
    rSpawnTimer -= spawnInterval;
    const height = Math.random() > 0.7 ? 60 : 30;
    rObs.push({ x: 800, y: 350 - height, w: 20, h: height });
  }
  for (let i = rObs.length - 1; i >= 0; i--) {
    const o = rObs[i];
    o.x -= currentSpeed * dtFrames;
    rCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent");
    rCtx.fillRect(o.x, o.y, o.w, o.h);
    if (
      player.x < o.x + o.w &&
      player.x + player.w > o.x &&
      player.y < o.y + o.h &&
      player.y + player.h > o.y
    ) {
      if (consumeShield()) {
        rObs.splice(i, 1);
        showToast("SHIELD USED", "🛡️");
        continue;
      }
      checkLossStreak();
      showGameOver("runner", Math.floor(rScore));
      return;
    }
    if (o.x < -30) {
      rObs.splice(i, 1);
      rScore += 1;
      updateHighScore("runner", rScore);
      setText("runnerScoreBoard", "SCORE: " + rScore);
      if (rScore % 5 === 0) rSpeed += 0.5;
      resetLossStreak();
    }
  }
  rAnim = requestAnimationFrame(loopRunner);
}

// Mouse/tap jump support on the canvas.
document.getElementById("runnerCanvas").onclick = () => {
  if (state.currentGame === "runner" && player.grounded) {
    player.dy = -player.jumpForce;
    player.grounded = false;
  }
};

// Stop the animation when leaving the game.
registerGameStop(() => {
  if (rAnim) cancelAnimationFrame(rAnim);
});
