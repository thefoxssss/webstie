import {
  registerGameStop,
  checkLossStreak,
  resetLossStreak,
  setText,
  showGameOver,
  showToast,
  unlockAchievement,
  updateHighScore,
  loadHighScores,
  consumeShield,
  getShieldStatusLabel,
  state,
  hasActiveItem,
} from "../core.js";

let hCtx;
let hCv;
let player = {};
let hexes = [];
let hScore = 0;
let hElapsed = 0;
let hAnim;
let spawnRate = 80;
let spawnTimer = 0;
let hLastTime = 0;
let hexfallStarted = false;

const CANVAS_W = 800;
const CANVAS_H = 450;
const FPS = 60;
const FRAME_MS = 1000 / FPS;
const MAX_DT_FRAMES = 2.5;

export function initHexfall() {
  state.currentGame = "hexfall";
  loadHighScores();
  hCv = document.getElementById("hexfallCanvas");
  hCtx = hCv.getContext("2d");
  player = {
    x: CANVAS_W / 2,
    y: CANVAS_H - 40,
    r: 12,
    speed: 5.5,
  };
  hexes = [];
  hScore = 0;
  hElapsed = 0;
  spawnRate = 80;
  spawnTimer = 0;
  hLastTime = 0;
  hexfallStarted = false;
  updateHexfallHud();
  loopHexfall(performance.now());
}

function spawnHex() {
  const size = 20 + Math.random() * 30;
  hexes.push({
    x: Math.random() * CANVAS_W,
    y: -size,
    r: size,
    speed: 2.0 + Math.random() * 3.0 + hScore * 0.05,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.1,
    hue: Math.random() * 360
  });
}

function updatePlayer(dtFrames) {
  const left = state.keysPressed.ArrowLeft || state.keysPressed.a;
  const right = state.keysPressed.ArrowRight || state.keysPressed.d;
  const up = state.keysPressed.ArrowUp || state.keysPressed.w;
  const down = state.keysPressed.ArrowDown || state.keysPressed.s;
  if (left) player.x -= player.speed * dtFrames;
  if (right) player.x += player.speed * dtFrames;
  if (up) player.y -= player.speed * dtFrames;
  if (down) player.y += player.speed * dtFrames;
  player.x = Math.max(player.r, Math.min(CANVAS_W - player.r, player.x));
  player.y = Math.max(player.r, Math.min(CANVAS_H - player.r, player.y));
}

function drawHud() {
  hCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent");
  hCtx.lineWidth = 2;
  hCtx.strokeRect(4, 4, CANVAS_W - 8, CANVAS_H - 8);
}

function updateHexfallHud() {
  setText("hexfallScore", `TIME: ${hScore}s • ${getShieldStatusLabel("hexfall")}`);
}

function updateScoreFromTime() {
  const timeScore = Math.floor(hElapsed);
  if (timeScore === hScore) return;
  hScore = timeScore;
  updateHighScore("hexfall", hScore);
  updateHexfallHud();
  if (hScore === 30) unlockAchievement("hex_master");
  resetLossStreak();
}

function drawHexagon(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = rot + (Math.PI / 3) * i;
    const px = x + r * Math.cos(angle);
    const py = y + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// Simple circle collision
function checkCollision(px, py, pr, hx, hy, hr) {
  const dx = px - hx;
  const dy = py - hy;
  // Approximate hex as a circle with slightly smaller radius to be forgiving
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < pr + hr * 0.85;
}

function loopHexfall(now) {
  if (state.currentGame !== "hexfall") return;
  updateHexfallHud();
  const movementInput =
    state.keysPressed.ArrowLeft || state.keysPressed.a || state.keysPressed.ArrowRight || state.keysPressed.d ||
    state.keysPressed.ArrowUp || state.keysPressed.w || state.keysPressed.ArrowDown || state.keysPressed.s;
  if (movementInput) hexfallStarted = true;
  const dtFrames = hexfallStarted && hLastTime
    ? Math.min((now - hLastTime) / FRAME_MS, MAX_DT_FRAMES)
    : 0;
  hLastTime = now;
  hElapsed += dtFrames / FPS;
  spawnTimer += dtFrames;

  hCtx.fillStyle = "#000";
  hCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Background cool effect
  const pulse = (Math.sin(now * 0.002) + 1) * 0.5;
  hCtx.globalAlpha = 0.05 + pulse * 0.05;
  hCtx.strokeStyle = "#fff";
  hCtx.lineWidth = 1;
  drawHexagon(hCtx, CANVAS_W/2, CANVAS_H/2, CANVAS_H * 0.8 + pulse * 20, now * 0.0005);
  hCtx.stroke();
  hCtx.globalAlpha = 1.0;

  updatePlayer(dtFrames);
  drawHud();
  updateScoreFromTime();

  while (spawnTimer >= spawnRate) {
    spawnTimer -= spawnRate;
    spawnHex();
    if (Math.random() > 0.4) spawnHex(); // Spawn multiple
    if (Math.random() > 0.8) spawnHex();
    if (spawnRate > 20) spawnRate -= 0.5;
  }

  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent");
  hCtx.fillStyle = accent;
  hCtx.beginPath();
  hCtx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  hCtx.fill();

  // Neon glow player
  hCtx.shadowBlur = 10;
  hCtx.shadowColor = accent;
  hCtx.fill();
  hCtx.shadowBlur = 0;

  const hexSlowdown = hasActiveItem("item_dodge_stabilizer") ? 0.75 : 1;

  for (let i = hexes.length - 1; i >= 0; i--) {
    const h = hexes[i];
    h.y += h.speed * hexSlowdown * dtFrames;
    h.rot += h.rotSpeed * hexSlowdown * dtFrames;

    hCtx.strokeStyle = `hsl(${h.hue}, 100%, 60%)`;
    hCtx.fillStyle = `hsla(${h.hue}, 100%, 60%, 0.2)`;
    hCtx.lineWidth = 2;
    hCtx.shadowBlur = 8;
    hCtx.shadowColor = hCtx.strokeStyle;
    drawHexagon(hCtx, h.x, h.y, h.r, h.rot);
    hCtx.fill();
    hCtx.stroke();
    hCtx.shadowBlur = 0; // Reset for next items

    if (checkCollision(player.x, player.y, player.r, h.x, h.y, h.r)) {
      const shieldResult = consumeShield("hexfall");
      if (shieldResult) {
        hexes.splice(i, 1);
        if (shieldResult === "activated") showToast("SHIELD ACTIVATED", "🛡️");
        continue;
      }
      checkLossStreak();
      showGameOver("hexfall", hScore);
      return;
    }

    if (h.y > CANVAS_H + h.r) {
      hexes.splice(i, 1);
    }
  }

  hAnim = requestAnimationFrame(loopHexfall);
}

registerGameStop(() => {
  if (hAnim) cancelAnimationFrame(hAnim);
});
