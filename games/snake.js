import { registerGameStop, beep, checkLossStreak, resetLossStreak, setText, showGameOver, unlockAchievement, updateHighScore, loadHighScores, state } from "../core.js";

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

function placeFood() {
  food = { x: Math.floor(Math.random() * 30), y: Math.floor(Math.random() * 20) };
}

function loopSnake() {
  if (state.currentGame !== "snake") return;
  const head = { x: snake[0].x, y: snake[0].y };
  sD = sNextD;
  if (sD === "R") head.x++;
  if (sD === "L") head.x--;
  if (sD === "U") head.y--;
  if (sD === "D") head.y++;
  if (head.x < 0 || head.x >= 30 || head.y < 0 || head.y >= 20 || snake.some((s) => s.x === head.x && s.y === head.y)) {
    checkLossStreak();
    showGameOver("snake", sSc);
    return;
  }
  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    const pts = state.myInventory.includes("item_double") ? 20 : 10;
    sSc += pts;
    updateHighScore("snake", sSc);
    setText("snakeScoreVal", sSc);
    placeFood();
    beep(600);
    resetLossStreak();
    if (sSc >= 30) unlockAchievement("viper");
  } else {
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

document.addEventListener("keydown", (e) => {
  if (state.currentGame !== "snake") return;
  const key = e.key;
  if ((key === "ArrowUp" || key === "w") && sD !== "D") sNextD = "U";
  if ((key === "ArrowDown" || key === "s") && sD !== "U") sNextD = "D";
  if ((key === "ArrowLeft" || key === "a") && sD !== "R") sNextD = "L";
  if ((key === "ArrowRight" || key === "d") && sD !== "L") sNextD = "R";
});

registerGameStop(() => {
  if (sAnim) clearTimeout(sAnim);
});
