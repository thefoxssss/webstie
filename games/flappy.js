import { registerGameStop, showGameOver, setText, updateHighScore, loadHighScores, state } from "../core.js";

let fBird = {};
let fPipes = [];
let fScore = 0;
let fAnim;
let fSpawnTimer = 0;
let fDifficultyTimer = 0;
const baseGap = 190;
const baseSpeed = 2.4;

export function initFlappy() {
  state.currentGame = "flappy";
  loadHighScores();
  fBird = { x: 60, y: 300, dy: 0 };
  fPipes = [];
  fScore = 0;
  fSpawnTimer = 0;
  fDifficultyTimer = 0;
  fBird = { x: 50, y: 300, dy: 0 };
  fPipes = [];
  fScore = 0;
  setText("flappyScore", "SCORE: 0");
  loopFlappy();
}

function loopFlappy() {
  if (state.currentGame !== "flappy") return;
  const ctx = document.getElementById("flappyCanvas").getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 400, 600);
  if (state.keysPressed[" "]) {
    fBird.dy = -7.5;
    state.keysPressed[" "] = false;
  }
  fBird.dy += 0.35;
    fBird.dy = -6;
    state.keysPressed[" "] = false;
  }
  fBird.dy += 0.4;
  fBird.y += fBird.dy;
  ctx.fillStyle = "#fff";
  ctx.fillRect(fBird.x, fBird.y, 20, 20);
  if (fBird.y > 600 || fBird.y < 0) {
    showGameOver("flappy", fScore);
    return;
  }
  fSpawnTimer += 1;
  fDifficultyTimer += 1;
  const gap = Math.max(170, baseGap - Math.floor(fDifficultyTimer / 900) * 10);
  const speed = Math.min(3.2, baseSpeed + Math.floor(fDifficultyTimer / 1200) * 0.1);
  const spawnInterval = Math.max(110, 170 - Math.floor(fDifficultyTimer / 900) * 10);
  if (fSpawnTimer >= spawnInterval) {
    const minHeight = 80;
    const maxHeight = 600 - gap - 80;
    const topHeight = Math.floor(Math.random() * (maxHeight - minHeight) + minHeight);
    fPipes.push({ x: 400, gap, h: topHeight });
    fSpawnTimer = 0;
  }
  for (let i = fPipes.length - 1; i >= 0; i--) {
    const p = fPipes[i];
    p.x -= speed;
  if (Math.random() < 0.015) {
    fPipes.push({ x: 400, gap: 150, h: Math.random() * 300 + 50 });
  }
  for (let i = fPipes.length - 1; i >= 0; i--) {
    const p = fPipes[i];
    p.x -= 3;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent");
    ctx.fillRect(p.x, 0, 40, p.h);
    ctx.fillRect(p.x, p.h + p.gap, 40, 600);
    if (fBird.x + 20 > p.x && fBird.x < p.x + 40 && (fBird.y < p.h || fBird.y + 20 > p.h + p.gap)) {
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

document.getElementById("flappyCanvas").onclick = () => {
  if (state.currentGame === "flappy") fBird.dy = -6;
};

registerGameStop(() => {
  if (fAnim) cancelAnimationFrame(fAnim);
});
