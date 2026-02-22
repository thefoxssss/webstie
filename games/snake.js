// Snake template using shared rAF loop + buffered inputs.
import {
  registerGameStop,
  beep,
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
  dispatch,
  subscribeToGameLoop,
  unsubscribeFromGameLoop,
} from "../core.js";

const GRID_W = 30;
const GRID_H = 20;
const CELL = 20;
const STEP_SECONDS = 0.1;

let sCtx;
let sCv;
let snake = [];
let food = { x: 0, y: 0 };
let currentDir = "R";
let score = 0;
let stepAccumulator = 0;
let inputQueue = [];
let snakeStarted = false;

const opposite = { U: "D", D: "U", L: "R", R: "L" };
const toVec = {
  U: { x: 0, y: -1 },
  D: { x: 0, y: 1 },
  L: { x: -1, y: 0 },
  R: { x: 1, y: 0 },
};

export function initSnake() {
  dispatch({ type: "SET_CURRENT_GAME", payload: "snake" });
  loadHighScores();
  sCv = document.getElementById("snakeCanvas");
  sCtx = sCv.getContext("2d");
  snake = [{ x: 10, y: 10 }];
  food = randomFood();
  currentDir = "R";
  score = 0;
  stepAccumulator = 0;
  inputQueue = [];
  snakeStarted = false;
  setText("snakeScoreVal", 0);
  subscribeToGameLoop("snake", onFrame);
}

function randomFood() {
  return { x: Math.floor(Math.random() * GRID_W), y: Math.floor(Math.random() * GRID_H) };
}

function queueDirection(nextDir) {
  snakeStarted = true;
  const last = inputQueue[inputQueue.length - 1] || currentDir;
  if (nextDir === last || opposite[nextDir] === last) return;
  if (inputQueue.length < 2) inputQueue.push(nextDir);
}

function consumeInput() {
  const next = inputQueue.shift();
  if (next && opposite[next] !== currentDir) currentDir = next;
}

function onFrame(dt) {
  if (state.currentGame !== "snake") return;
  if (!snakeStarted) {
    draw();
    return;
  }
  stepAccumulator += dt;
  while (stepAccumulator >= STEP_SECONDS) {
    stepAccumulator -= STEP_SECONDS;
    tick();
  }
  draw();
}

function tick() {
  consumeInput();
  const vec = toVec[currentDir];
  const head = { x: snake[0].x + vec.x, y: snake[0].y + vec.y };
  const wall = head.x < 0 || head.x >= GRID_W || head.y < 0 || head.y >= GRID_H;
  const self = snake.some((s) => s.x === head.x && s.y === head.y);

  if (wall || self) {
    if (consumeShield()) {
      snake = [{ x: Math.max(0, Math.min(GRID_W - 1, head.x)), y: Math.max(0, Math.min(GRID_H - 1, head.y)) }];
      showToast("SHIELD USED", "🛡️");
      return;
    }
    checkLossStreak();
    showGameOver("snake", score);
    unsubscribeFromGameLoop("snake");
    return;
  }

  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    const pts = hasActiveItem("item_double") ? 20 : 10;
    score += pts;
    updateHighScore("snake", score);
    setText("snakeScoreVal", score);
    food = randomFood();
    beep(600);
    resetLossStreak();
    if (score >= 30) unlockAchievement("viper");
  } else {
    snake.pop();
  }
}

function draw() {
  sCtx.fillStyle = "#000";
  sCtx.fillRect(0, 0, 600, 400);
  sCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent");
  snake.forEach((s) => sCtx.fillRect(s.x * CELL, s.y * CELL, 18, 18));
  sCtx.fillStyle = "#fff";
  sCtx.fillRect(food.x * CELL, food.y * CELL, 18, 18);
}

document.addEventListener("keydown", (e) => {
  if (state.currentGame !== "snake") return;
  const key = e.key;
  if (key === "ArrowUp" || key === "w") queueDirection("U");
  if (key === "ArrowDown" || key === "s") queueDirection("D");
  if (key === "ArrowLeft" || key === "a") queueDirection("L");
  if (key === "ArrowRight" || key === "d") queueDirection("R");
});

registerGameStop(() => {
  unsubscribeFromGameLoop("snake");
});
