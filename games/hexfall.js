import { registerGameStop, setText, showToast, state, updateHighScore } from "../core.js";

const WIDTH = 800;
const HEIGHT = 420;
const ROUND_MS = 25000;

let run = null;

function stop() {
  if (!run) return;
  window.clearInterval(run.timer);
  window.cancelAnimationFrame(run.raf);
  if (run.canvas) run.canvas.onpointerdown = null;
  run = null;
}

function makeTile() {
  const radius = 20 + Math.random() * 20;
  return {
    x: 60 + Math.random() * (WIDTH - 120),
    y: -40 - Math.random() * 120,
    radius,
    speed: 70 + Math.random() * 120,
    color: `hsl(${180 + Math.random() * 140}, 85%, 58%)`,
  };
}

export function initHexfall() {
  stop();
  state.currentGame = "hexfall";

  const canvas = document.getElementById("hexfallCanvas");
  const action = document.getElementById("hexfallAction");
  if (!canvas || !action) return;
  const ctx = canvas.getContext("2d");

  let score = 0;
  let remaining = ROUND_MS;
  let started = false;
  let lastTs = performance.now();
  const tiles = Array.from({ length: 8 }, makeTile);

  setText("hexfallScore", "SCORE: 0");
  setText("hexfallTimer", `TIME: ${(ROUND_MS / 1000).toFixed(1)}s`);
  setText("hexfallHud", "TAP FALLING NODES BEFORE THEY HIT THE FLOOR");

  action.disabled = true;
  action.textContent = "ROUND LIVE";

  canvas.onpointerdown = (event) => {
    started = true;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;

    const hit = tiles.find((tile) => {
      const dx = x - tile.x;
      const dy = y - tile.y;
      return dx * dx + dy * dy <= tile.radius * tile.radius;
    });

    if (!hit) {
      score = Math.max(0, score - 8);
    } else {
      score += Math.round(12 + hit.radius);
      Object.assign(hit, makeTile());
      hit.y = -30;
    }

    setText("hexfallScore", `SCORE: ${Math.floor(score)}`);
    updateHighScore("hexfall", Math.floor(score));
  };

  const timer = window.setInterval(() => {
    if (!started) return;
    remaining -= 100;
    setText("hexfallTimer", `TIME: ${(Math.max(0, remaining) / 1000).toFixed(1)}s`);
    if (remaining <= 0) {
      const finalScore = Math.floor(score);
      stop();
      updateHighScore("hexfall", finalScore);
      showToast(`HEX FALL: ${finalScore} PTS`, "🔷");
      action.disabled = false;
      action.textContent = "PLAY AGAIN";
      action.onclick = initHexfall;
    }
  }, 100);

  function frame(ts) {
    if (!run) return;
    const dt = started ? Math.min(0.04, (ts - lastTs) / 1000) : 0;
    lastTs = ts;

    ctx.fillStyle = "#051018";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const floorY = HEIGHT - 30;
    ctx.fillStyle = "#153047";
    ctx.fillRect(0, floorY, WIDTH, HEIGHT - floorY);

    tiles.forEach((tile) => {
      tile.y += tile.speed * dt;
      if (tile.y + tile.radius >= floorY) {
        score = Math.max(0, score - 20);
        Object.assign(tile, makeTile());
      }

      ctx.fillStyle = tile.color;
      ctx.beginPath();
      ctx.arc(tile.x, tile.y, tile.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    ctx.fillStyle = "rgba(120, 220, 255, 0.9)";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("HEX FALL", 14, 24);

    run.raf = window.requestAnimationFrame(frame);
  }

  run = { canvas, timer, raf: 0 };
  run.raf = window.requestAnimationFrame(frame);
  registerGameStop(stop);
}
