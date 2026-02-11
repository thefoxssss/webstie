// Pong game implementation with optional aimbot and difficulty tuning.
import {
  registerGameStop,
  beep,
  checkLossStreak,
  loadHighScores,
  resetLossStreak,
  setText,
  unlockAchievement,
  updateHighScore,
  state,
  hasActiveItem,
} from "../core.js";

let pCtx;
let pCv;
let ball = { x: 400, y: 300, dx: 5, dy: 5 };
let p1 = { y: 250, h: 80 };
let p2 = { y: 250, h: 80 };
let pSc = 0;
let aiSc = 0;
let pDiff = 0.08;
let pAnim;

export function setPongDiff(level) {
  pDiff = level === "hard" ? 0.15 : 0.08;
  resetBall();
}

// Initialize the Pong canvas and reset score/state.
export function initPong() {
  state.currentGame = "pong";
  loadHighScores();
  pCv = document.getElementById("pongCanvas");
  pCtx = pCv.getContext("2d");
  pSc = 0;
  aiSc = 0;
  resetBall();
  loopPong();
}

// Reset ball position and velocity to a new random serve.
function resetBall() {
  if (!pCv) return;
  ball.x = 400;
  ball.y = 300;
  ball.dx = Math.random() > 0.5 ? 6 : -6;
  ball.dy = Math.random() * 8 - 4;
}

// Main animation loop: update paddles, ball, scores, and render.
function loopPong() {
  if (state.currentGame !== "pong") return;
  pCtx.fillStyle = "rgba(0,0,0,0.2)";
  pCtx.fillRect(0, 0, 800, 600);
  if (hasActiveItem("item_aimbot")) {
    p1.y += (ball.y - p1.h / 2 - p1.y) * 0.1;
  } else {
    if (state.keysPressed.w || state.keysPressed.ArrowUp) p1.y -= 8;
    if (state.keysPressed.s || state.keysPressed.ArrowDown) p1.y += 8;
  }
  if (p1.y < 0) p1.y = 0;
  if (p1.y > 520) p1.y = 520;
  p2.y += (ball.y - p2.h / 2 - p2.y) * pDiff;
  if (p2.y < 0) p2.y = 0;
  if (p2.y > 520) p2.y = 520;
  pCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent");
  pCtx.fillRect(20, p1.y, 10, p1.h);
  pCtx.fillRect(770, p2.y, 10, p2.h);
  pCtx.beginPath();
  pCtx.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
  pCtx.fill();
  ball.x += ball.dx;
  ball.y += ball.dy;
  if (ball.y < 0 || ball.y > 600) ball.dy *= -1;
  if (ball.x < 30 && ball.y > p1.y && ball.y < p1.y + p1.h) {
    ball.dx = Math.abs(ball.dx) + 0.5;
    ball.x = 30;
    beep(600);
  }
  if (ball.x > 770 && ball.y > p2.y && ball.y < p2.y + p2.h) {
    ball.dx = -(Math.abs(ball.dx) + 0.5);
    ball.x = 770;
    beep(600);
  }
  if (ball.x < 0) {
    aiSc++;
    resetBall();
    beep(200);
    checkLossStreak();
    pSc = 0;
  }
  if (ball.x > 800) {
    pSc++;
    updateHighScore("pong", pSc);
    loadHighScores();
    resetBall();
    beep(800);
    resetLossStreak();
    if (pSc >= 10 && aiSc === 0) unlockAchievement("untouchable");
  }
  setText("pongScore", `${pSc} : ${aiSc}`);
  pAnim = requestAnimationFrame(loopPong);
}

// Clear animation frame when exiting the game.
registerGameStop(() => {
  if (pAnim) cancelAnimationFrame(pAnim);
});
