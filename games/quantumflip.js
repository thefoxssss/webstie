import { registerGameStop, setText, showToast, state, updateHighScore } from "../core.js";

const WIDTH = 800;
const HEIGHT = 420;
const DURATION_MS = 34000;

let run = null;

function stop() {
  if (!run) return;
  window.clearInterval(run.timer);
  window.cancelAnimationFrame(run.raf);
  if (run.canvas) run.canvas.onpointerdown = null;
  run = null;
}

function spawnParticle() {
  return {
    x: 40 + Math.random() * 720,
    y: -20,
    r: 12 + Math.random() * 10,
    vy: 90 + Math.random() * 65,
    phase: Math.random() < 0.5 ? 0 : 1,
  };
}

export function initQuantumFlip() {
  stop();
  state.currentGame = "quantumflip";

  const canvas = document.getElementById("quantumflipCanvas");
  const action = document.getElementById("quantumflipAction");
  if (!canvas || !action) return;
  const ctx = canvas.getContext("2d");

  let score = 0;
  let remainingMs = DURATION_MS;
  let worldPhase = 0;
  let flipInMs = 3800;
  let particles = Array.from({ length: 7 }, spawnParticle);

  setText("quantumflipScore", "SCORE: 0");
  setText("quantumflipTimer", `TIME: ${(DURATION_MS / 1000).toFixed(1)}s`);
  setText("quantumflipHud", "ONLY COLLAPSE PARTICLES THAT MATCH THE CURRENT PHASE");

  action.disabled = true;
  action.textContent = "ROUND LIVE";

  canvas.onpointerdown = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;

    const hitIdx = particles.findIndex((p) => Math.hypot(p.x - x, p.y - y) <= p.r + 5);
    if (hitIdx === -1) {
      score = Math.max(0, score - 7);
    } else {
      const p = particles[hitIdx];
      if (p.phase === worldPhase) {
        score += 14;
      } else {
        score = Math.max(0, score - 12);
      }
      particles[hitIdx] = spawnParticle();
    }

    setText("quantumflipScore", `SCORE: ${Math.floor(score)}`);
    updateHighScore("quantumflip", Math.floor(score));
  };

  const timer = window.setInterval(() => {
    remainingMs -= 100;
    flipInMs -= 100;
    if (flipInMs <= 0) {
      worldPhase = worldPhase ? 0 : 1;
      flipInMs = 3800;
      showToast("QUANTUM FLIP", "⚛️");
    }

    setText("quantumflipTimer", `TIME: ${(Math.max(0, remainingMs) / 1000).toFixed(1)}s`);
    setText("quantumflipHud", `PHASE: ${worldPhase ? "POSITIVE" : "NEGATIVE"}`);

    if (remainingMs <= 0) {
      const finalScore = Math.floor(score);
      stop();
      updateHighScore("quantumflip", finalScore);
      showToast(`QUANTUM FLIP: ${finalScore} PTS`, "⚛️");
      action.disabled = false;
      action.textContent = "PLAY AGAIN";
      action.onclick = initQuantumFlip;
    }
  }, 100);

  let last = performance.now();
  function frame(now) {
    if (!run) return;
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;

    ctx.fillStyle = worldPhase ? "#24124d" : "#0b0720";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    particles.forEach((p, i) => {
      p.y += p.vy * dt;
      if (p.y > HEIGHT + 30) particles[i] = spawnParticle();
      ctx.fillStyle = p.phase ? "#7fffd4" : "#9b8cff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0a0f17";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(p.phase ? "+" : "-", p.x, p.y + 4);
    });

    run.raf = window.requestAnimationFrame(frame);
  }

  run = { timer, raf: 0, canvas };
  run.raf = window.requestAnimationFrame(frame);
  registerGameStop(stop);
}
