import { registerGameStop, setText, showToast, state, updateHighScore } from "../core.js";

const WIDTH = 800;
const HEIGHT = 420;
const DURATION_MS = 30000;

let run = null;

function stop() {
  if (!run) return;
  window.clearInterval(run.timer);
  window.cancelAnimationFrame(run.raf);
  if (run.canvas) run.canvas.onpointerdown = null;
  run = null;
}

function spawnBlock(col) {
  return {
    col,
    x: 80 + col * 130,
    y: -40,
    w: 90,
    h: 28,
    hp: 1 + Math.floor(Math.random() * 3),
    vy: 70 + Math.random() * 35,
  };
}

export function initStackSmash() {
  stop();
  state.currentGame = "stacksmash";

  const canvas = document.getElementById("stacksmashCanvas");
  const action = document.getElementById("stacksmashAction");
  if (!canvas || !action) return;
  const ctx = canvas.getContext("2d");

  let score = 0;
  let remainingMs = DURATION_MS;
  let blocks = [0, 1, 2, 3, 4].map(spawnBlock);

  setText("stacksmashScore", "SCORE: 0");
  setText("stacksmashTimer", `TIME: ${(DURATION_MS / 1000).toFixed(1)}s`);
  setText("stacksmashHud", "SMASH FALLING STACKS BEFORE THEY REACH THE FLOOR");

  action.disabled = true;
  action.textContent = "ROUND LIVE";

  canvas.onpointerdown = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;

    const hit = blocks.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (!hit) {
      score = Math.max(0, score - 6);
    } else {
      hit.hp -= 1;
      score += 6;
      if (hit.hp <= 0) {
        score += 14;
        Object.assign(hit, spawnBlock(hit.col));
      }
    }

    setText("stacksmashScore", `SCORE: ${Math.floor(score)}`);
    updateHighScore("stacksmash", Math.floor(score));
  };

  const timer = window.setInterval(() => {
    remainingMs -= 100;
    setText("stacksmashTimer", `TIME: ${(Math.max(0, remainingMs) / 1000).toFixed(1)}s`);
    if (remainingMs <= 0) {
      const finalScore = Math.floor(score);
      stop();
      updateHighScore("stacksmash", finalScore);
      showToast(`STACK SMASH: ${finalScore} PTS`, "🪨");
      action.disabled = false;
      action.textContent = "PLAY AGAIN";
      action.onclick = initStackSmash;
    }
  }, 100);

  let last = performance.now();
  function frame(now) {
    if (!run) return;
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;

    ctx.fillStyle = "#1a1208";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#4c3116";
    ctx.fillRect(0, HEIGHT - 34, WIDTH, 34);

    for (const block of blocks) {
      block.y += block.vy * dt;
      if (block.y + block.h >= HEIGHT - 34) {
        score = Math.max(0, score - 15);
        Object.assign(block, spawnBlock(block.col));
      }

      ctx.fillStyle = block.hp === 1 ? "#ffc06b" : block.hp === 2 ? "#ff9a3c" : "#ff6a3c";
      ctx.fillRect(block.x, block.y, block.w, block.h);
      ctx.fillStyle = "#1a1208";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(block.hp), block.x + block.w / 2, block.y + 19);
    }

    run.raf = window.requestAnimationFrame(frame);
  }

  run = { timer, raf: 0, canvas };
  run.raf = window.requestAnimationFrame(frame);
  registerGameStop(stop);
}
