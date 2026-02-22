import { registerGameStop, setText, showToast, state, updateHighScore } from "../core.js";

const WIDTH = 800;
const HEIGHT = 420;
const DURATION_MS = 32000;
const ORB_COUNT = 7;

let run = null;

function stop() {
  if (!run) return;
  window.clearInterval(run.timer);
  window.cancelAnimationFrame(run.raf);
  if (run.canvas) run.canvas.onpointerdown = null;
  run = null;
}

function makeOrb() {
  return {
    x: 60 + Math.random() * 680,
    y: 60 + Math.random() * 300,
    r: 18 + Math.random() * 16,
  };
}

export function initOrbWeaver() {
  stop();
  state.currentGame = "orbweaver";
  const canvas = document.getElementById("orbweaverCanvas");
  const action = document.getElementById("orbweaverAction");
  if (!canvas || !action) return;
  const ctx = canvas.getContext("2d");
  let started = false;

  let score = 0;
  let remainingMs = DURATION_MS;
  let path = [];
  let orbs = Array.from({ length: ORB_COUNT }, makeOrb);
  let nextIdx = Math.floor(Math.random() * ORB_COUNT);

  setText("orbweaverScore", "SCORE: 0");
  setText("orbweaverTimer", `TIME: ${(DURATION_MS / 1000).toFixed(1)}s`);
  setText("orbweaverHud", "WEAVE A CHAIN: HIT THE GLOWING ORB, THEN FOLLOW THE NEXT LINK");
  action.disabled = true;
  action.textContent = "ROUND LIVE";

  canvas.onpointerdown = (event) => {
    started = true;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;

    const hitIdx = orbs.findIndex((o) => Math.hypot(o.x - x, o.y - y) <= o.r + 4);
    if (hitIdx === -1) {
      path = [];
      score = Math.max(0, score - 8);
    } else if (hitIdx === nextIdx) {
      path.push({ x: orbs[hitIdx].x, y: orbs[hitIdx].y });
      const bonus = 10 + path.length * 4;
      score += bonus;
      orbs[hitIdx] = makeOrb();
      nextIdx = Math.floor(Math.random() * ORB_COUNT);
      if (path.length >= 6) {
        score += 35;
        path = [];
      }
    } else {
      path = [];
      score = Math.max(0, score - 4);
      nextIdx = hitIdx;
    }

    setText("orbweaverScore", `SCORE: ${Math.floor(score)}`);
    setText("orbweaverHud", `CURRENT WEAVE: ${path.length} LINKS`);
    updateHighScore("orbweaver", Math.floor(score));
  };

  const timer = window.setInterval(() => {
    if (!started) return;
    remainingMs -= 100;
    setText("orbweaverTimer", `TIME: ${(Math.max(0, remainingMs) / 1000).toFixed(1)}s`);
    if (remainingMs <= 0) {
      const finalScore = Math.floor(score + path.length * 10);
      stop();
      updateHighScore("orbweaver", finalScore);
      showToast(`ORB WEAVER: ${finalScore} PTS`, "🟣");
      action.disabled = false;
      action.textContent = "PLAY AGAIN";
      action.onclick = initOrbWeaver;
    }
  }, 100);

  function frame(now) {
    if (!run) return;
    ctx.fillStyle = "#07140f";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (path.length > 1) {
      ctx.strokeStyle = "#74ffa5";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
    }

    orbs.forEach((orb, i) => {
      const pulse = 1 + Math.sin(now * 0.004 + i) * 0.08;
      ctx.fillStyle = i === nextIdx ? "#a6f3ff" : "#74ffa5";
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.r * pulse, 0, Math.PI * 2);
      ctx.fill();
    });

    run.raf = window.requestAnimationFrame(frame);
  }

  run = { timer, raf: 0, canvas };
  run.raf = window.requestAnimationFrame(frame);
  registerGameStop(stop);
}
