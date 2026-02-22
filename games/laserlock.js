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

function newTarget() {
  return {
    x: 80 + Math.random() * 640,
    y: 70 + Math.random() * 280,
    age: 0,
    lockAt: 0.75 + Math.random() * 0.35,
  };
}

export function initLaserLock() {
  stop();
  state.currentGame = "laserlock";

  const canvas = document.getElementById("laserlockCanvas");
  const action = document.getElementById("laserlockAction");
  if (!canvas || !action) return;
  const ctx = canvas.getContext("2d");
  let started = false;

  let score = 0;
  let streak = 0;
  let remainingMs = DURATION_MS;
  let target = newTarget();

  setText("laserlockScore", "SCORE: 0");
  setText("laserlockTimer", `TIME: ${(DURATION_MS / 1000).toFixed(1)}s`);
  setText("laserlockHud", "WAIT FOR FULL LOCK RING, THEN FIRE");
  action.disabled = true;
  action.textContent = "ROUND LIVE";

  canvas.onpointerdown = (event) => {
    started = true;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    const dist = Math.hypot(target.x - x, target.y - y);
    const lockValue = Math.min(1, target.age / target.lockAt);

    if (dist <= 28 && lockValue > 0.92) {
      streak += 1;
      score += 18 + streak * 4;
      target = newTarget();
    } else {
      streak = 0;
      score = Math.max(0, score - 10);
    }

    setText("laserlockScore", `SCORE: ${Math.floor(score)}`);
    setText("laserlockHud", `LOCK STREAK: ${streak}`);
    updateHighScore("laserlock", Math.floor(score));
  };

  const timer = window.setInterval(() => {
    if (!started) return;
    remainingMs -= 100;
    setText("laserlockTimer", `TIME: ${(Math.max(0, remainingMs) / 1000).toFixed(1)}s`);
    if (remainingMs <= 0) {
      const finalScore = Math.floor(score + streak * 8);
      stop();
      updateHighScore("laserlock", finalScore);
      showToast(`LASER LOCK: ${finalScore} PTS`, "🔴");
      action.disabled = false;
      action.textContent = "PLAY AGAIN";
      action.onclick = initLaserLock;
    }
  }, 100);

  let last = performance.now();
  function frame(now) {
    if (!run) return;
    const dt = started ? Math.min(0.04, (now - last) / 1000) : 0;
    last = now;

    target.age += dt;
    if (target.age > target.lockAt + 0.5) {
      score = Math.max(0, score - 6);
      streak = 0;
      target = newTarget();
      setText("laserlockScore", `SCORE: ${Math.floor(score)}`);
    }

    ctx.fillStyle = "#17090a";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const lockValue = Math.min(1, target.age / target.lockAt);
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 45 - lockValue * 25, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#ff6b6b";
    ctx.beginPath();
    ctx.arc(target.x, target.y, 13, 0, Math.PI * 2);
    ctx.fill();

    run.raf = window.requestAnimationFrame(frame);
  }

  run = { timer, raf: 0, canvas };
  run.raf = window.requestAnimationFrame(frame);
  registerGameStop(stop);
}
