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

function spawnGate() {
  return {
    x: 80 + Math.random() * 640,
    y: 70 + Math.random() * 250,
    w: 80 + Math.random() * 60,
    h: 26 + Math.random() * 24,
    hp: 3,
    decay: 0.15 + Math.random() * 0.2,
  };
}

export function initGlitchGate() {
  stop();
  state.currentGame = "glitchgate";
  const canvas = document.getElementById("glitchgateCanvas");
  const action = document.getElementById("glitchgateAction");
  if (!canvas || !action) return;
  const ctx = canvas.getContext("2d");
  let started = false;

  let score = 0;
  let remainingMs = DURATION_MS;
  let integrity = 100;
  let gates = [spawnGate(), spawnGate()];

  setText("glitchgateScore", "SCORE: 0");
  setText("glitchgateTimer", `TIME: ${(DURATION_MS / 1000).toFixed(1)}s`);
  setText("glitchgateHud", "PATCH GATES BEFORE THEY FULLY CORRUPT");

  action.disabled = true;
  action.textContent = "ROUND LIVE";

  canvas.onpointerdown = (event) => {
    started = true;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;

    let hit = false;
    for (const gate of gates) {
      if (x >= gate.x && x <= gate.x + gate.w && y >= gate.y && y <= gate.y + gate.h) {
        gate.hp -= 1;
        score += 12;
        hit = true;
        if (gate.hp <= 0) {
          score += 18;
          Object.assign(gate, spawnGate());
        }
        break;
      }
    }
    if (!hit) {
      score = Math.max(0, score - 8);
      integrity = Math.max(0, integrity - 2);
    }
    setText("glitchgateScore", `SCORE: ${Math.floor(score)}`);
    setText("glitchgateHud", `INTEGRITY: ${Math.floor(integrity)}% | ACTIVE GATES: ${gates.length}`);
    updateHighScore("glitchgate", Math.floor(score));
  };

  const timer = window.setInterval(() => {
    if (!started) return;
    remainingMs -= 100;
    if (remainingMs % 2500 === 0 && gates.length < 5) gates.push(spawnGate());
    setText("glitchgateTimer", `TIME: ${(Math.max(0, remainingMs) / 1000).toFixed(1)}s`);
    if (remainingMs <= 0 || integrity <= 0) {
      const finalScore = Math.floor(score + integrity * 2);
      stop();
      updateHighScore("glitchgate", finalScore);
      showToast(`GLITCH GATE: ${finalScore} PTS`, "🧩");
      action.disabled = false;
      action.textContent = "PLAY AGAIN";
      action.onclick = initGlitchGate;
    }
  }, 100);

  let last = performance.now();
  function frame(now) {
    if (!run) return;
    const dt = started ? Math.min(0.04, (now - last) / 1000) : 0;
    last = now;

    ctx.fillStyle = "#090909";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (const gate of gates) {
      gate.hp -= gate.decay * dt;
      if (gate.hp <= 0) {
        integrity = Math.max(0, integrity - 8);
        Object.assign(gate, spawnGate());
      }

      const fill = Math.max(0, gate.hp / 3);
      ctx.fillStyle = `rgba(255,77,77,${0.2 + (1 - fill) * 0.6})`;
      ctx.fillRect(gate.x - 4, gate.y - 4, gate.w + 8, gate.h + 8);
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(gate.x, gate.y, gate.w * fill, gate.h);
      ctx.strokeStyle = "#ff4d4d";
      ctx.strokeRect(gate.x, gate.y, gate.w, gate.h);
    }

    run.raf = window.requestAnimationFrame(frame);
  }

  run = { timer, raf: 0, canvas };
  run.raf = window.requestAnimationFrame(frame);
  registerGameStop(stop);
}
