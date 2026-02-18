import { registerGameStop, setText, showToast, state, updateHighScore } from "../core.js";

const WIDTH = 800;
const HEIGHT = 420;
const DURATION_MS = 32000;

let run = null;

function stop() {
  if (!run) return;
  window.clearInterval(run.timer);
  window.cancelAnimationFrame(run.raf);
  if (run.canvas) run.canvas.onpointerdown = null;
  run = null;
}

function spawnNode(lane) {
  return {
    lane,
    x: WIDTH + 30,
    y: 95 + lane * 115,
    speed: 170 + Math.random() * 90,
  };
}

export function initMetroMaze() {
  stop();
  state.currentGame = "metromaze";

  const canvas = document.getElementById("metromazeCanvas");
  const action = document.getElementById("metromazeAction");
  if (!canvas || !action) return;
  const ctx = canvas.getContext("2d");

  let score = 0;
  let remainingMs = DURATION_MS;
  let route = [0, 1, 2, 1, 0, 2];
  let routeIndex = 0;
  let nodes = [spawnNode(0), spawnNode(1), spawnNode(2)];

  setText("metromazeScore", "SCORE: 0");
  setText("metromazeTimer", `TIME: ${(DURATION_MS / 1000).toFixed(1)}s`);
  setText("metromazeHud", "FOLLOW ROUTE ORDER: CLICK NEXT LANE NODE");
  action.disabled = true;
  action.textContent = "ROUND LIVE";

  canvas.onpointerdown = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;

    const hit = nodes.find((node) => Math.hypot(node.x - x, node.y - y) <= 24);
    if (!hit) {
      score = Math.max(0, score - 8);
    } else if (hit.lane === route[routeIndex]) {
      score += 16;
      routeIndex = (routeIndex + 1) % route.length;
      hit.x = WIDTH + 20;
      hit.speed += 6;
    } else {
      score = Math.max(0, score - 12);
      routeIndex = 0;
    }

    setText("metromazeScore", `SCORE: ${Math.floor(score)}`);
    setText("metromazeHud", `NEXT LANE: ${route[routeIndex] + 1}`);
    updateHighScore("metromaze", Math.floor(score));
  };

  const timer = window.setInterval(() => {
    remainingMs -= 100;
    setText("metromazeTimer", `TIME: ${(Math.max(0, remainingMs) / 1000).toFixed(1)}s`);
    if (remainingMs <= 0) {
      const finalScore = Math.floor(score + routeIndex * 6);
      stop();
      updateHighScore("metromaze", finalScore);
      showToast(`METRO MAZE: ${finalScore} PTS`, "🚇");
      action.disabled = false;
      action.textContent = "PLAY AGAIN";
      action.onclick = initMetroMaze;
    }
  }, 100);

  let last = performance.now();
  function frame(now) {
    if (!run) return;
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;

    ctx.fillStyle = "#091219";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (let i = 0; i < 3; i++) {
      const y = 95 + i * 115;
      ctx.strokeStyle = i === route[routeIndex] ? "#f9ff9e" : "#2f5872";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }

    for (const node of nodes) {
      node.x -= node.speed * dt;
      if (node.x < -30) {
        score = Math.max(0, score - 5);
        node.x = WIDTH + 20;
      }
      ctx.fillStyle = "#8bcfff";
      ctx.beginPath();
      ctx.arc(node.x, node.y, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    run.raf = window.requestAnimationFrame(frame);
  }

  run = { timer, raf: 0, canvas };
  run.raf = window.requestAnimationFrame(frame);
  registerGameStop(stop);
}
