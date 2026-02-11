// Classic snake game with grid-based movement and point-based growth.
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
} from "../core.js";

let sCtx;
let sCv;
let snake = [];
let food = {};
let sD = "R";
let sNextD = "R";
let sSc = 0;
let sAnim;

export function initSnake() {
  state.currentGame = "snake";
  loadHighScores();
  sCv = document.getElementById("snakeCanvas");
  sCtx = sCv.getContext("2d");
  snake = [{ x: 10, y: 10 }];
  sD = "R";
  sNextD = "R";
  sSc = 0;
  setText("snakeScoreVal", 0);
  placeFood();
  loopSnake();
}

// Randomize a new food position within the grid.
function placeFood() {
  food = { x: Math.floor(Math.random() * 30), y: Math.floor(Math.random() * 20) };
}

// Main game loop: move, collide, draw, and schedule next tick.
function loopSnake() {
  if (state.currentGame !== "snake") return;
  const head = { x: snake[0].x, y: snake[0].y };
  let shieldSavedThisTick = false;
  sD = sNextD;
  if (sD === "R") head.x++;
  if (sD === "L") head.x--;
  if (sD === "U") head.y--;
  if (sD === "D") head.y++;
  const wallCollision = head.x < 0 || head.x >= 30 || head.y < 0 || head.y >= 20;
  const selfCollision = snake.some((s) => s.x === head.x && s.y === head.y);
  if (wallCollision || selfCollision) {
    if (consumeShield()) {
      head.x = Math.max(0, Math.min(29, head.x));
      head.y = Math.max(0, Math.min(19, head.y));
      snake = [{ x: head.x, y: head.y }];
      shieldSavedThisTick = true;
      showToast("SHIELD USED", "🛡️");
    } else {
      checkLossStreak();
      showGameOver("snake", sSc);
      return;
    }
  } else {
    snake.unshift(head);
  }
  if (head.x === food.x && head.y === food.y) {
    const pts = hasActiveItem("item_double") ? 20 : 10;
    sSc += pts;
    updateHighScore("snake", sSc);
    setText("snakeScoreVal", sSc);
    placeFood();
    beep(600);
    resetLossStreak();
    if (sSc >= 30) unlockAchievement("viper");
  } else if (!shieldSavedThisTick) {
    snake.pop();
  }
  sCtx.fillStyle = "#000";
  sCtx.fillRect(0, 0, 600, 400);
  sCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent");
  snake.forEach((s) => sCtx.fillRect(s.x * 20, s.y * 20, 18, 18));
  sCtx.fillStyle = "#fff";
  sCtx.fillRect(food.x * 20, food.y * 20, 18, 18);
  sAnim = setTimeout(loopSnake, 100);
}

// Translate keyboard input into the next movement direction.
document.addEventListener("keydown", (e) => {
  if (state.currentGame !== "snake") return;
  const key = e.key;
  if ((key === "ArrowUp" || key === "w") && sD !== "D") sNextD = "U";
  if ((key === "ArrowDown" || key === "s") && sD !== "U") sNextD = "D";
  if ((key === "ArrowLeft" || key === "a") && sD !== "R") sNextD = "L";
  if ((key === "ArrowRight" || key === "d") && sD !== "L") sNextD = "R";
});

// Clean up timers when the game is stopped.
registerGameStop(() => {
  if (sAnim) clearTimeout(sAnim);
});
