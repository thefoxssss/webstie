import { registerGameStop, setText, showToast, state, updateHighScore } from "../core.js";

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

function spawnByte(wave) {
  const tierRoll = Math.random();
  let hp = 1;
  let size = 12;
  let speed = 70 + wave * 3 + Math.random() * 30;

  if (tierRoll > 0.88) {
    hp = 3;
    size = 20;
    speed *= 0.72;
  } else if (tierRoll > 0.62) {
    hp = 2;
    size = 16;
    speed *= 0.85;
  }

  return {
    x: 24 + Math.random() * (WIDTH - 48),
    y: -30 - Math.random() * 140,
    vx: -28 + Math.random() * 56,
    vy: speed,
    hp,
    maxHp: hp,
    size,
  };
}

function spawnPowerup() {
  return {
    x: 30 + Math.random() * (WIDTH - 60),
    y: -20,
    vy: 90,
    size: 12,
    kind: Math.random() < 0.5 ? "patch" : "overclock",
  };
}

function fireShot(game, spread = 0) {
  game.shots.push({
    x: game.player.x + spread,
    y: game.player.y - 20,
    vy: -460,
    ttl: 1.2,
  });
}

function hud(game) {
  setText("byteblitzScore", `SCORE: ${Math.floor(game.score)}`);
  setText(
    "byteblitzHud",
    `INTEGRITY ${game.integrity}% | WAVE ${game.wave} | MULTI x${game.multiplier.toFixed(1)}${game.overclockMs > 0 ? " | OVERCLOCK" : ""}`,
  );
}

export function initByteBlitz() {
  stop();
  state.currentGame = "byteblitz";

  const canvas = document.getElementById("byteblitzCanvas");
  const action = document.getElementById("byteblitzAction");
  if (!canvas || !action) return;
  const ctx = canvas.getContext("2d");

  const game = {
    score: 0,
    remainingMs: DURATION_MS,
    spawnInMs: 500,
    powerupInMs: 6200,
    wave: 1,
    waveInMs: 7000,
    integrity: 100,
    multiplier: 1,
    overclockMs: 0,
    keys: { left: false, right: false },
    player: { x: WIDTH * 0.5, y: HEIGHT - 38, vx: 0 },
    bytes: [],
    shots: [],
    powerups: [],
    fireMs: 0,
  };

  setText("byteblitzTimer", `TIME: ${(DURATION_MS / 1000).toFixed(1)}s`);
  hud(game);

  action.disabled = true;
  action.textContent = "RUNNING";

  const onKeyDown = (event) => {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") game.keys.left = true;
    if (key === "arrowright" || key === "d") game.keys.right = true;
  };
  const onKeyUp = (event) => {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") game.keys.left = false;
    if (key === "arrowright" || key === "d") game.keys.right = false;
  };

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  canvas.onpointerdown = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    game.player.x = Math.max(28, Math.min(WIDTH - 28, x));
    fireShot(game);
  };

  const timer = window.setInterval(() => {
    game.remainingMs -= 100;
    game.spawnInMs -= 100;
    game.powerupInMs -= 100;
    game.waveInMs -= 100;
    if (game.overclockMs > 0) game.overclockMs -= 100;

    if (game.waveInMs <= 0) {
      game.wave += 1;
      game.waveInMs = 7000;
      game.multiplier = Math.min(5, game.multiplier + 0.2);
      showToast(`WAVE ${game.wave}`, "💾");
    }

    if (game.spawnInMs <= 0) {
      game.bytes.push(spawnByte(game.wave));
      if (Math.random() < 0.14 + game.wave * 0.01) game.bytes.push(spawnByte(game.wave));
      const base = 470 - game.wave * 14;
      game.spawnInMs = Math.max(170, base + Math.random() * 120);
    }

    if (game.powerupInMs <= 0) {
      game.powerups.push(spawnPowerup());
      game.powerupInMs = 8000 + Math.random() * 5000;
    }

    setText("byteblitzTimer", `TIME: ${(Math.max(0, game.remainingMs) / 1000).toFixed(1)}s`);
    hud(game);

    if (game.remainingMs <= 0 || game.integrity <= 0) {
      const finalScore = Math.floor(game.score + game.integrity * 2 + game.wave * 20);
      stop();
      updateHighScore("byteblitz", finalScore);
      showToast(`BYTE BLITZ: ${finalScore} PTS`, "💾");
      action.disabled = false;
      action.textContent = "PLAY AGAIN";
      action.onclick = initByteBlitz;
    }
  }, 100);

  let last = performance.now();
  function frame(now) {
    if (!run) return;
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;

    const accel = 580;
    if (game.keys.left) game.player.vx -= accel * dt;
    if (game.keys.right) game.player.vx += accel * dt;
    game.player.vx *= 0.86;
    game.player.x = Math.max(28, Math.min(WIDTH - 28, game.player.x + game.player.vx * dt));

    game.fireMs -= dt * 1000;
    const fireRate = game.overclockMs > 0 ? 55 : 120;
    if (game.fireMs <= 0) {
      fireShot(game);
      if (game.overclockMs > 0) {
        fireShot(game, -8);
        fireShot(game, 8);
      }
      game.fireMs = fireRate;
    }

    for (let i = game.shots.length - 1; i >= 0; i--) {
      const shot = game.shots[i];
      shot.y += shot.vy * dt;
      shot.ttl -= dt;
      if (shot.ttl <= 0 || shot.y < -10) game.shots.splice(i, 1);
    }

    for (let i = game.bytes.length - 1; i >= 0; i--) {
      const b = game.bytes[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < b.size || b.x > WIDTH - b.size) b.vx *= -1;

      for (let s = game.shots.length - 1; s >= 0; s--) {
        const shot = game.shots[s];
        if (Math.hypot(shot.x - b.x, shot.y - b.y) > b.size + 5) continue;
        game.shots.splice(s, 1);
        b.hp -= 1;
        if (b.hp <= 0) {
          const gain = (18 + b.maxHp * 9) * game.multiplier;
          game.score += gain;
          game.bytes.splice(i, 1);
          updateHighScore("byteblitz", Math.floor(game.score));
          break;
        }
      }

      if (i >= game.bytes.length) continue;
      if (b.y > HEIGHT - 24) {
        game.bytes.splice(i, 1);
        game.integrity = Math.max(0, game.integrity - (8 + b.maxHp * 5));
        game.multiplier = Math.max(1, game.multiplier - 0.3);
      }
    }

    for (let i = game.powerups.length - 1; i >= 0; i--) {
      const p = game.powerups[i];
      p.y += p.vy * dt;
      if (Math.hypot(p.x - game.player.x, p.y - game.player.y) < p.size + 14) {
        if (p.kind === "patch") {
          game.integrity = Math.min(100, game.integrity + 18);
          showToast("FIREWALL PATCH", "🩹");
        } else {
          game.overclockMs = 8500;
          showToast("OVERCLOCK ONLINE", "⚡");
        }
        game.powerups.splice(i, 1);
      } else if (p.y > HEIGHT + 20) {
        game.powerups.splice(i, 1);
      }
    }

    ctx.fillStyle = "#06152a";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (let i = 0; i < 36; i++) {
      const x = (i * 157) % WIDTH;
      const y = ((i * 63 + now * 0.05) % HEIGHT + HEIGHT) % HEIGHT;
      ctx.fillStyle = "rgba(99, 217, 255, 0.16)";
      ctx.fillRect(x, y, 3, 3);
    }

    ctx.fillStyle = "rgba(255, 99, 99, 0.2)";
    ctx.fillRect(0, HEIGHT - 24, WIDTH, 24);
    ctx.fillStyle = "#8de6ff";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("BUFFER", 12, HEIGHT - 8);

    for (const b of game.bytes) {
      const hpPct = b.hp / b.maxHp;
      ctx.fillStyle = b.maxHp === 3 ? "#ff6a6a" : b.maxHp === 2 ? "#ffb86a" : "#74e7ff";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#021019";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(b.hp), b.x, b.y + 4);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(b.x - b.size, b.y - b.size - 8, b.size * 2, 4);
      ctx.fillStyle = "#8effc7";
      ctx.fillRect(b.x - b.size, b.y - b.size - 8, b.size * 2 * hpPct, 4);
    }

    for (const shot of game.shots) {
      ctx.fillStyle = "#eaffff";
      ctx.fillRect(shot.x - 2, shot.y - 8, 4, 10);
    }

    for (const p of game.powerups) {
      ctx.fillStyle = p.kind === "patch" ? "#88ff9a" : "#ffe66d";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0b1020";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(p.kind === "patch" ? "+" : "⚡", p.x, p.y + 4);
    }

    ctx.fillStyle = game.overclockMs > 0 ? "#ffd56a" : "#51d9ff";
    ctx.beginPath();
    ctx.moveTo(game.player.x, game.player.y - 15);
    ctx.lineTo(game.player.x + 14, game.player.y + 12);
    ctx.lineTo(game.player.x - 14, game.player.y + 12);
    ctx.closePath();
    ctx.fill();

    const integrityBar = (game.integrity / 100) * 180;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(WIDTH - 198, 14, 184, 14);
    ctx.fillStyle = game.integrity > 45 ? "#62ffb0" : "#ff8570";
    ctx.fillRect(WIDTH - 196, 16, integrityBar, 10);

    run.raf = window.requestAnimationFrame(frame);
  }

  run = { timer, raf: 0, canvas, onKeyDown, onKeyUp };
  run.raf = window.requestAnimationFrame(frame);
  registerGameStop(stop);
}
