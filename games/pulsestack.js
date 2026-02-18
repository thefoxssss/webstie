import { registerGameStop, setText, showToast, state, updateHighScore } from "../core.js";

const WIDTH = 800;
const HEIGHT = 420;
const DURATION_MS = 28000;

let run = null;

function stop() {
  if (!run) return;
  window.clearInterval(run.timer);
  window.cancelAnimationFrame(run.raf);
  if (run.canvas) run.canvas.onpointerdown = null;
  run = null;
}

function draw(ctx, pulseX, stackHeight, remainingMs, score) {
  ctx.fillStyle = "#0f0716";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = "#3b205e";
  for (let y = 0; y < HEIGHT; y += 35) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  const zoneW = 120;
  const zoneX = WIDTH * 0.5 - zoneW * 0.5;
  ctx.fillStyle = "#77ffe033";
  ctx.fillRect(zoneX, 30, zoneW, HEIGHT - 60);

  ctx.fillStyle = "#bf7cff";
  ctx.beginPath();
  ctx.arc(pulseX, HEIGHT - 28, 16, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < stackHeight; i++) {
    const w = 44;
    const h = 10;
    const x = WIDTH * 0.5 - w * 0.5;
    const y = HEIGHT - 14 - i * (h + 3);
    ctx.fillStyle = i % 2 ? "#b586ff" : "#77ffe0";
    ctx.fillRect(x, y - h, w, h);
  }

  ctx.fillStyle = "#d7cbff";
  ctx.font = "bold 15px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`STACK: ${stackHeight}`, 14, 26);
  ctx.fillText(`SCORE: ${Math.floor(score)}`, 14, 48);
  ctx.textAlign = "right";
  ctx.fillText(`TIME: ${(remainingMs / 1000).toFixed(1)}s`, WIDTH - 14, 26);
}

export function initPulseStack() {
  stop();
  state.currentGame = "pulsestack";

  const canvas = document.getElementById("pulsestackCanvas");
  const action = document.getElementById("pulsestackAction");
  if (!canvas || !action) return;
  const ctx = canvas.getContext("2d");

  let score = 0;
  let stackHeight = 0;
  let combo = 1;
  let pulseX = WIDTH * 0.5;
  let dir = 1;
  let remainingMs = DURATION_MS;

  setText("pulsestackHud", "TIME YOUR TAP INSIDE THE CENTER ZONE TO BUILD THE STACK");
  setText("pulsestackScore", "SCORE: 0");
  setText("pulsestackTimer", `TIME: ${(DURATION_MS / 1000).toFixed(1)}s`);
  action.disabled = true;
  action.textContent = "ROUND LIVE";

  canvas.onpointerdown = () => {
    const centerDist = Math.abs(pulseX - WIDTH * 0.5);
    if (centerDist <= 48) {
      combo = Math.min(10, combo + 1);
      stackHeight += 1;
      score += 8 + combo * 2;
    } else {
      combo = 1;
      stackHeight = Math.max(0, stackHeight - 2);
      score = Math.max(0, score - 10);
    }
    setText("pulsestackScore", `SCORE: ${Math.floor(score)}`);
    setText("pulsestackHud", `STACK: ${stackHeight} | COMBO: ${combo}x`);
    updateHighScore("pulsestack", Math.floor(score));
  };

  const timer = window.setInterval(() => {
    remainingMs -= 100;
    if (remainingMs <= 0) {
      const finalScore = Math.floor(score + stackHeight * 5);
      stop();
      updateHighScore("pulsestack", finalScore);
      showToast(`PULSE STACK: ${finalScore} PTS`, "📶");
      action.disabled = false;
      action.textContent = "PLAY AGAIN";
      action.onclick = initPulseStack;
      return;
    }
    setText("pulsestackTimer", `TIME: ${(remainingMs / 1000).toFixed(1)}s`);
  }, 100);

  let last = performance.now();
  function frame(now) {
    if (!run) return;
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    pulseX += dir * dt * 380;
    if (pulseX < 25 || pulseX > WIDTH - 25) dir *= -1;
    draw(ctx, pulseX, stackHeight, remainingMs, score);
    run.raf = window.requestAnimationFrame(frame);
  }

  run = { timer, raf: 0, canvas };
  run.raf = window.requestAnimationFrame(frame);
  registerGameStop(stop);
}
