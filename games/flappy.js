import { registerGameStop, showGameOver, setText, updateHighScore, loadHighScores, state } from "../core.js";

let fBird = {};
let fPipes = [];
let fScore = 0;
let fAnim;

const FLAP_STRENGTH = -7;
const GRAVITY = 0.3;
const PIPE_SPEED = 2.2;
const PIPE_GAP = 200;
const PIPE_SPAWN_CHANCE = 0.01;
const PIPE_MIN_DISTANCE = 220;

export function initFlappy() {
  state.currentGame = "flappy";
  loadHighScores();
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
    fBird.dy = FLAP_STRENGTH;
    state.keysPressed[" "] = false;
  }
  fBird.dy += GRAVITY;
  fBird.y += fBird.dy;
  ctx.fillStyle = "#fff";
  ctx.fillRect(fBird.x, fBird.y, 20, 20);
  if (fBird.y > 600 || fBird.y < 0) {
    showGameOver("flappy", fScore);
    return;
  }
  const lastPipe = fPipes[fPipes.length - 1];
  const canSpawnPipe = !lastPipe || lastPipe.x < 400 - PIPE_MIN_DISTANCE;
  if (canSpawnPipe && Math.random() < PIPE_SPAWN_CHANCE) {
    fPipes.push({ x: 400, gap: PIPE_GAP, h: Math.random() * 250 + 50 });
  }
  for (let i = fPipes.length - 1; i >= 0; i--) {
    const p = fPipes[i];
    p.x -= PIPE_SPEED;
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
  if (state.currentGame === "flappy") fBird.dy = FLAP_STRENGTH;
};

registerGameStop(() => {
  if (fAnim) cancelAnimationFrame(fAnim);
});
