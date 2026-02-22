// Endless runner rebuilt around a data-oriented kernel with fixed-step simulation.
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
  EngineKernel,
  DrawSystem,
  InputBuffer,
} from "../core.js";

const WIDTH = 800;
const HEIGHT = 400;
const GROUND_Y = 350;
const PLAYER_W = 30;
const PLAYER_H = 50;
const PLAYER_X = 50;
const PLAYER_START_Y = 300;
const PLAYER_JUMP_FORCE = 12;
const PLAYER_GRAVITY = 0.6;
const MAX_OBSTACLES = 96;

const obstacleX = new Float32Array(MAX_OBSTACLES);
const obstacleY = new Float32Array(MAX_OBSTACLES);
const obstacleW = new Float32Array(MAX_OBSTACLES);
const obstacleH = new Float32Array(MAX_OBSTACLES);
const obstacleActive = new Uint8Array(MAX_OBSTACLES);
const obstaclePrevX = new Float32Array(MAX_OBSTACLES);

const freeList = new Uint16Array(MAX_OBSTACLES);
let freeTop = 0;

const player = {
  y: PLAYER_START_Y,
  prevY: PLAYER_START_Y,
  dy: 0,
  grounded: 1,
};

let ctx;
let drawSystem;
let kernel;
let inputBuffer;
let score = 0;
let speed = 5;
let spawnTicks = 0;
let groundColor = "#0f0";

function resetPool() {
  freeTop = MAX_OBSTACLES;
  for (let i = 0; i < MAX_OBSTACLES; i++) {
    obstacleActive[i] = 0;
    freeList[i] = MAX_OBSTACLES - 1 - i;
  }
}

function allocObstacle() {
  if (freeTop <= 0) return -1;
  const idx = freeList[--freeTop];
  obstacleActive[idx] = 1;
  return idx;
}

function freeObstacle(i) {
  obstacleActive[i] = 0;
  freeList[freeTop++] = i;
}

function queueJump(now = performance.now()) {
  inputBuffer.push("JUMP", now);
}

function spawnObstacle() {
  const idx = allocObstacle();
  if (idx === -1) return;
  const tall = Math.random() > 0.7;
  const h = tall ? 60 : 30;
  obstacleX[idx] = WIDTH;
  obstaclePrevX[idx] = WIDTH;
  obstacleY[idx] = GROUND_Y - h;
  obstacleW[idx] = 20;
  obstacleH[idx] = h;
}

function intersects(x, y, w, h, ox, oy, ow, oh) {
  return x < ox + ow && x + w > ox && y < oy + oh && y + h > oy;
}

function onTick(dt) {
  if (state.currentGame !== "runner") return;

  spawnTicks += 1;
  const currentSpeed = speed * (hasActiveItem("item_slowmo") ? 0.8 : 1);
  const spawnIntervalTicks = Math.max(24, Math.floor(60 / currentSpeed));

  const bufferedJump = inputBuffer.consume("JUMP", performance.now() - 120);
  if (bufferedJump && player.grounded) {
    player.dy = -PLAYER_JUMP_FORCE;
    player.grounded = 0;
  }

  player.prevY = player.y;
  player.dy += PLAYER_GRAVITY;
  player.y += player.dy;
  if (player.y > PLAYER_START_Y) {
    player.y = PLAYER_START_Y;
    player.dy = 0;
    player.grounded = 1;
  }

  if (spawnTicks >= spawnIntervalTicks) {
    spawnTicks = 0;
    spawnObstacle();
  }

  for (let i = 0; i < MAX_OBSTACLES; i++) {
    if (!obstacleActive[i]) continue;
    obstaclePrevX[i] = obstacleX[i];
    obstacleX[i] -= currentSpeed * (dt * 60);

    if (
      intersects(
        PLAYER_X,
        player.y,
        PLAYER_W,
        PLAYER_H,
        obstacleX[i],
        obstacleY[i],
        obstacleW[i],
        obstacleH[i]
      )
    ) {
      if (consumeShield()) {
        freeObstacle(i);
        showToast("SHIELD USED", "🛡️");
        continue;
      }
      checkLossStreak();
      showGameOver("runner", Math.floor(score));
      return;
    }

    if (obstacleX[i] < -30) {
      freeObstacle(i);
      score += 1;
      updateHighScore("runner", score);
      setText("runnerScoreBoard", `SCORE: ${score}`);
      if (score % 5 === 0) speed += 0.5;
      resetLossStreak();
    }
  }
}

function onRender(alpha) {
  if (state.currentGame !== "runner") return;
  drawSystem.clear("#000", 0, 0, WIDTH, HEIGHT);
  drawSystem.line(groundColor, 2, 0, GROUND_Y, WIDTH, GROUND_Y);

  const py = player.prevY + (player.y - player.prevY) * alpha;
  drawSystem.rect("#fff", PLAYER_X, py, PLAYER_W, PLAYER_H);

  for (let i = 0; i < MAX_OBSTACLES; i++) {
    if (!obstacleActive[i]) continue;
    const ox = obstaclePrevX[i] + (obstacleX[i] - obstaclePrevX[i]) * alpha;
    drawSystem.rect(groundColor, ox, obstacleY[i], obstacleW[i], obstacleH[i]);
  }

  drawSystem.flush();
}

export function initRunner() {
  state.currentGame = "runner";
  loadHighScores();

  const canvas = document.getElementById("runnerCanvas");
  ctx = canvas.getContext("2d");
  drawSystem = new DrawSystem(ctx);
  kernel = new EngineKernel({ fixedHz: 60 });
  inputBuffer = new InputBuffer(32);

  score = 0;
  speed = 5;
  spawnTicks = 0;
  player.y = PLAYER_START_Y;
  player.prevY = PLAYER_START_Y;
  player.dy = 0;
  player.grounded = 1;
  groundColor = getComputedStyle(document.documentElement).getPropertyValue("--accent") || "#0f0";
  resetPool();

  setText("runnerScoreBoard", "SCORE: 0");
  kernel.start(onTick, onRender, { startPausedUntilInput: true });
}

document.getElementById("runnerCanvas").onclick = () => {
  if (state.currentGame === "runner") queueJump();
};

document.addEventListener("keydown", (event) => {
  if (state.currentGame !== "runner") return;
  if (event.key === " " || event.key === "ArrowUp") queueJump();
});

registerGameStop(() => {
  kernel?.stop();
});
