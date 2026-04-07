import { registerGameStop, setText, showToast, state, updateHighScore, isInputFocused } from "../core.js";

const WIDTH = 800;
const HEIGHT = 420;
const DURATION_MS = 60000;

let run = null;

function stop() {
  if (!run) return;
  window.clearInterval(run.timer);
  window.cancelAnimationFrame(run.raf);
  if (run.canvas) run.canvas.onpointerdown = null;
  document.removeEventListener("keydown", run.onKeyDown);
  document.removeEventListener("keyup", run.onKeyUp);
  run = null;
}

function spawnCore(worldPhase) {
  const phase = Math.random() < 0.62 ? worldPhase : worldPhase ? 0 : 1;
  return {
    x: 50 + Math.random() * 700,
    y: 45 + Math.random() * 330,
    r: 11 + Math.random() * 9,
    vx: -50 + Math.random() * 100,
    vy: -50 + Math.random() * 100,
    phase,
  };
}

function spawnHunter(worldPhase, wave) {
  const side = Math.random() < 0.5 ? 0 : 1;
  return {
    x: side ? WIDTH + 30 : -30,
    y: 30 + Math.random() * (HEIGHT - 60),
    r: 14,
    phase: worldPhase ? 0 : 1,
    speed: 80 + wave * 7 + Math.random() * 35,
  };
}

function tickHud(game) {
  setText("quantumflipScore", `SCORE: ${Math.floor(game.score)}`);
  setText(
    "quantumflipHud",
    `PHASE: ${game.worldPhase ? "POSITRON" : "NEUTRAL"} | STREAK x${game.streakMult.toFixed(1)} | SHIFT IN ${(game.flipInMs / 1000).toFixed(1)}s`,
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function initQuantumFlip() {
  stop();
  state.currentGame = "quantumflip";

  const canvas = document.getElementById("quantumflipCanvas");
  const action = document.getElementById("quantumflipAction");
  if (!canvas || !action) return;
  const ctx = canvas.getContext("2d");
  let started = false;

  const game = {
    score: 0,
    remainingMs: DURATION_MS,
    worldPhase: 0,
    flipInMs: 5500,
    streakMult: 1,
    keys: { up: false, down: false, left: false, right: false },
    player: { x: WIDTH * 0.5, y: HEIGHT * 0.5, vx: 0, vy: 0, r: 12, invuln: 0 },
    cores: [],
    hunters: [],
    wave: 1,
    waveInMs: 4200,
  };

  game.cores = Array.from({ length: 11 }, () => spawnCore(game.worldPhase));

  setText("quantumflipTimer", `TIME: ${(DURATION_MS / 1000).toFixed(1)}s`);
  tickHud(game);

  action.disabled = true;
  action.textContent = "ROUND LIVE";

  const onKeyDown = (event) => {
    if (isInputFocused(event)) return;
    started = true;
    if (!run) return;
    const key = event.key.toLowerCase();
    if (key === "w" || key === "arrowup") game.keys.up = true;
    if (key === "s" || key === "arrowdown") game.keys.down = true;
    if (key === "a" || key === "arrowleft") game.keys.left = true;
    if (key === "d" || key === "arrowright") game.keys.right = true;
  };
  const onKeyUp = (event) => {
    const key = event.key.toLowerCase();
    if (key === "w" || key === "arrowup") game.keys.up = false;
    if (key === "s" || key === "arrowdown") game.keys.down = false;
    if (key === "a" || key === "arrowleft") game.keys.left = false;
    if (key === "d" || key === "arrowright") game.keys.right = false;
  };

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  canvas.onpointerdown = (event) => {
    started = true;
    const rect = canvas.getBoundingClientRect();
    const tx = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const ty = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    const dx = tx - game.player.x;
    const dy = ty - game.player.y;
    const mag = Math.max(1, Math.hypot(dx, dy));
    game.player.vx += (dx / mag) * 220;
    game.player.vy += (dy / mag) * 220;
  };

  const timer = window.setInterval(() => {
    if (!started) return;
    game.remainingMs -= 100;
    game.flipInMs -= 100;
    game.waveInMs -= 100;

    if (game.flipInMs <= 0) {
      game.worldPhase = game.worldPhase ? 0 : 1;
      game.flipInMs = Math.max(2400, 5500 - game.wave * 170);
      game.streakMult = Math.max(1, game.streakMult - 0.3);
      showToast(`PHASE SHIFT: ${game.worldPhase ? "POSITRON" : "NEUTRAL"}`, "⚛️");
    }

    if (game.waveInMs <= 0) {
      game.wave += 1;
      game.waveInMs = 4200;
      game.hunters.push(spawnHunter(game.worldPhase, game.wave));
      if (game.wave % 3 === 0) game.hunters.push(spawnHunter(game.worldPhase, game.wave));
    }

    setText("quantumflipTimer", `TIME: ${(Math.max(0, game.remainingMs) / 1000).toFixed(1)}s`);
    tickHud(game);

    if (game.remainingMs <= 0) {
      const finalScore = Math.floor(game.score + game.wave * 8);
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
    const dt = started ? Math.min(0.04, (now - last) / 1000) : 0;
    last = now;

    const accel = 360;
    const drag = 0.92;
    if (game.keys.up) game.player.vy -= accel * dt;
    if (game.keys.down) game.player.vy += accel * dt;
    if (game.keys.left) game.player.vx -= accel * dt;
    if (game.keys.right) game.player.vx += accel * dt;

    game.player.vx *= drag;
    game.player.vy *= drag;
    game.player.x = clamp(game.player.x + game.player.vx * dt, game.player.r, WIDTH - game.player.r);
    game.player.y = clamp(game.player.y + game.player.vy * dt, game.player.r, HEIGHT - game.player.r);
    game.player.invuln = Math.max(0, game.player.invuln - dt);

    for (const core of game.cores) {
      core.x += core.vx * dt;
      core.y += core.vy * dt;
      if (core.x < core.r || core.x > WIDTH - core.r) core.vx *= -1;
      if (core.y < core.r || core.y > HEIGHT - core.r) core.vy *= -1;

      const overlap = Math.hypot(core.x - game.player.x, core.y - game.player.y) < core.r + game.player.r;
      if (!overlap) continue;

      if (core.phase === game.worldPhase) {
        game.score += 14 * game.streakMult;
        game.streakMult = Math.min(4.6, game.streakMult + 0.1);
      } else {
        game.score = Math.max(0, game.score - 18);
        game.streakMult = 1;
        game.player.invuln = 0.6;
      }

      core.x = 50 + Math.random() * 700;
      core.y = 45 + Math.random() * 330;
      core.phase = Math.random() < 0.62 ? game.worldPhase : game.worldPhase ? 0 : 1;
      core.vx = -65 + Math.random() * 130;
      core.vy = -65 + Math.random() * 130;
      updateHighScore("quantumflip", Math.floor(game.score));
      tickHud(game);
    }

    for (const hunter of game.hunters) {
      const dx = game.player.x - hunter.x;
      const dy = game.player.y - hunter.y;
      const mag = Math.max(1, Math.hypot(dx, dy));
      hunter.x += (dx / mag) * hunter.speed * dt;
      hunter.y += (dy / mag) * hunter.speed * dt;

      const hit = Math.hypot(hunter.x - game.player.x, hunter.y - game.player.y) < hunter.r + game.player.r;
      if (hit && game.player.invuln <= 0) {
        game.score = Math.max(0, game.score - 40);
        game.streakMult = 1;
        game.player.invuln = 1.2;
        game.player.vx *= -0.4;
        game.player.vy *= -0.4;
        showToast("HUNTER IMPACT", "💥");
        tickHud(game);
      }
    }

    ctx.fillStyle = game.worldPhase ? "#1f153b" : "#070b1b";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (let i = 0; i < 44; i++) {
      const px = (i * 129) % WIDTH;
      const py = ((i * 67 + now * 0.04) % HEIGHT + HEIGHT) % HEIGHT;
      ctx.fillStyle = "rgba(160, 190, 255, 0.11)";
      ctx.fillRect(px, py, 2, 2);
    }

    for (const core of game.cores) {
      const same = core.phase === game.worldPhase;
      ctx.fillStyle = same ? "#89fff0" : "#ff7ab6";
      ctx.beginPath();
      ctx.arc(core.x, core.y, core.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#09101e";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(core.phase ? "+" : "-", core.x, core.y + 4);
    }

    for (const hunter of game.hunters) {
      ctx.fillStyle = hunter.phase ? "#f978c5" : "#a766ff";
      ctx.beginPath();
      ctx.arc(hunter.x, hunter.y, hunter.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.beginPath();
      ctx.arc(hunter.x, hunter.y, hunter.r + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = game.player.invuln > 0 ? "#ffd877" : "#f3f6ff";
    ctx.beginPath();
    ctx.arc(game.player.x, game.player.y, game.player.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#00f0ff";
    ctx.beginPath();
    ctx.arc(game.player.x, game.player.y, game.player.r + 4, 0, Math.PI * 2);
    ctx.stroke();

    run.raf = window.requestAnimationFrame(frame);
  }

  run = { timer, raf: 0, canvas, onKeyDown, onKeyUp };
  run.raf = window.requestAnimationFrame(frame);
  registerGameStop(stop);
}
