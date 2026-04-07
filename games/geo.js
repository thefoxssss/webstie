// Geometry-inspired endless runner with rotating cube and themed level presets.
import {
  registerGameStop,
  showGameOver,
  setText,
  updateHighScore,
  loadHighScores,
  showToast,
  consumeShield,
  getShieldStatusLabel,
  state,
  hasActiveItem,
  isInputFocused,
} from "../core.js";

// Helper to build a long sequence. 'b' = block, 's' = spike, 'g' = gap, 'd' = double spike, 't' = triple block, '_' = long gap
function parsePattern(str) {
  return str.split("").filter(c => c !== " ");
}

const EASY_PATTERN = parsePattern("b_s_b_b_s_g_b_s_s_g_b_b_s_b_g_s_g_b_s_b_b_s_g_b_g_s_b_s_b_g_b_b_b_s_s_g_b_b_s_b_g_s_b_s_g_b_b_s_g_b_b_b_s_s_g_b_s_b");
const NORMAL_PATTERN = parsePattern("s_s_g_b_s_g_b_b_s_g_b_s_s_b_g_b_s_b_s_g_s_s_b_g_b_s_b_b_s_g_s_b_s_s_g_b_b_s_b_s_g_s_s_b_g_b_b_b_s_s_g_s_s_g_b_s_b_s_b");
const HARD_PATTERN = parsePattern("b_s_s_g_s_s_g_b_b_s_s_g_s_g_s_b_b_s_s_g_b_s_b_s_s_g_s_s_b_b_s_s_g_b_b_s_g_s_s_b_g_s_s_s_g_b_b_s_s_g_s_b_s_s_g_s_s_s_g_b_b");

const GEO_LEVELS = [
  { id: "stereo_madness", name: "Level 1 - Easy", speed: 5.2, gravity: 0.85, jump: 12, sequence: EASY_PATTERN },
  { id: "back_on_track", name: "Level 2 - Normal", speed: 6.0, gravity: 0.95, jump: 12.8, sequence: NORMAL_PATTERN },
  { id: "polargeist", name: "Level 3 - Hard", speed: 7.0, gravity: 1.03, jump: 13.2, sequence: HARD_PATTERN },
];

let gPlayer = {};
let gObs = [];
let gScore = 0; // Number of obstacles passed
let gSpeed = 6;
let gAnim;
let gControlsBound = false;
let gJumpHandler = null;
let gKeyHandler = null;
let gCanvasRef = null;
let gOverlayRef = null;
let gSpawnDistanceRemaining = 0;
let gLastTime = 0;
let geoStarted = false;
let gLevelPatternIndex = 0;
let gCurrentLevel = GEO_LEVELS[0];
let gTotalObstacles = 0;
let gFinished = false;

const BASE_FRAME_MS = 1000 / 60;
const MAX_DT_FRAMES = 2.5;

function updateGeoHud() {
  if (!geoStarted && !gFinished && gScore === 0) {
    setText("geoScore", `LEVEL: ${gCurrentLevel.name} • 0% • ${getShieldStatusLabel("geo")}`);
    return;
  }
  let pct = Math.floor((gScore / gTotalObstacles) * 100);
  if (pct > 100) pct = 100;
  if (gFinished) pct = 100;
  setText("geoScore", `LEVEL: ${gCurrentLevel.name} • ${pct}% • ${getShieldStatusLabel("geo")}`);
}

window.showGeoMenu = () => {
  document.getElementById("geoMenu").style.display = "block";
  document.getElementById("geoGame").style.display = "none";
  if (gAnim) cancelAnimationFrame(gAnim);
};

window.startGeoLevel = (levelId) => {
  document.getElementById("geoMenu").style.display = "none";
  document.getElementById("geoGame").style.display = "block";
  initGeometry(levelId);
};

export function initGeometry(levelId = "stereo_madness") {
  state.currentGame = "geo";
  loadHighScores();
  const cv = document.getElementById("geoCanvas");
  const ctx = cv.getContext("2d");
  if (gAnim) cancelAnimationFrame(gAnim);
  gCanvasRef = cv;
  gOverlayRef = document.getElementById("overlayGeo");

  applySelectedLevel(levelId);
  gPlayer = { x: 100, y: 300, w: 30, h: 30, dy: 0, ang: 0, grounded: true };
  gObs = [];
  gScore = 0;
  gSpawnDistanceRemaining = 200; // Initial delay
  gLastTime = 0;
  gLevelPatternIndex = 0;
  geoStarted = false;
  gFinished = false;
  gTotalObstacles = gCurrentLevel.sequence.filter(c => c === "b" || c === "s").length;

  updateGeoHud();
  bindGeoControls();
  loopGeometry(ctx, performance.now());
}

function applySelectedLevel(levelId) {
  gCurrentLevel = GEO_LEVELS.find((level) => level.id === levelId) || GEO_LEVELS[0];
  gSpeed = gCurrentLevel.speed;
}

function spawnObstacle() {
  if (gLevelPatternIndex >= gCurrentLevel.sequence.length) {
    // End of level
    gSpawnDistanceRemaining = 9999;
    return;
  }

  const spawnType = gCurrentLevel.sequence[gLevelPatternIndex];
  gLevelPatternIndex += 1;

  if (spawnType === "g") {
    gSpawnDistanceRemaining = 120;
  } else if (spawnType === "_") {
    gSpawnDistanceRemaining = 200;
  } else if (spawnType === "b") {
    gObs.push({ x: 800, y: 320, w: 30, h: 30, type: "block" });
    gSpawnDistanceRemaining = 30; // Close together if immediately followed by another
  } else if (spawnType === "s") {
    gObs.push({ x: 800, y: 320, w: 30, h: 30, type: "spike" });
    gSpawnDistanceRemaining = 30;
  } else {
    gSpawnDistanceRemaining = 100;
  }
}

// Main loop for the geometry runner: physics, obstacles, rendering.
function loopGeometry(ctx, now) {
  if (state.currentGame !== "geo") return;
  updateGeoHud();
  const dtFrames = gLastTime
    ? Math.min((now - gLastTime) / BASE_FRAME_MS, MAX_DT_FRAMES)
    : 0;
  const simDtFrames = (geoStarted && !gFinished) ? dtFrames : 0;
  gLastTime = now;

  const cv = document.getElementById("geoCanvas");
  if (!ctx) ctx = cv.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 800, 400);
  const currentSpeed = gSpeed * (hasActiveItem("item_slowmo") ? 0.8 : 1);
  gPlayer.dy += gCurrentLevel.gravity * simDtFrames;
  gPlayer.y += gPlayer.dy * simDtFrames;
  if (gPlayer.y > 320) {
    gPlayer.y = 320;
    gPlayer.dy = 0;
    gPlayer.grounded = true;
    gPlayer.ang = Math.round(gPlayer.ang / (Math.PI / 2)) * (Math.PI / 2);
  } else {
    gPlayer.ang += 0.15 * simDtFrames;
  }
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent");
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 350);
  ctx.lineTo(800, 350);
  ctx.stroke();
  ctx.save();
  ctx.translate(gPlayer.x + gPlayer.w / 2, gPlayer.y + gPlayer.h / 2);
  ctx.rotate(gPlayer.ang);
  ctx.fillStyle = "#fff";
  ctx.fillRect(-gPlayer.w / 2, -gPlayer.h / 2, gPlayer.w, gPlayer.h);
  ctx.restore();

  if (geoStarted && !gFinished) {
    gSpawnDistanceRemaining -= currentSpeed * simDtFrames;
    if (gSpawnDistanceRemaining <= 0) spawnObstacle();
  }

  for (let i = gObs.length - 1; i >= 0; i--) {
    const o = gObs[i];
    o.x -= currentSpeed * simDtFrames;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent");
    if (o.type === "spike") {
      ctx.beginPath();
      ctx.moveTo(o.x, o.y + 30);
      ctx.lineTo(o.x + 15, o.y);
      ctx.lineTo(o.x + 30, o.y + 30);
      ctx.fill();
    } else {
      ctx.fillRect(o.x, o.y, o.w, o.h);
    }
    if (
      !gFinished &&
      gPlayer.x < o.x + o.w - 5 &&
      gPlayer.x + gPlayer.w > o.x + 5 &&
      gPlayer.y < o.y + o.h - 5 &&
      gPlayer.y + gPlayer.h > o.y + 5
    ) {
      const shieldResult = consumeShield("geo");
      if (shieldResult) {
        gObs.splice(i, 1);
        if (shieldResult === "activated") showToast("SHIELD ACTIVATED", "🛡️");
        continue;
      }
      let pct = Math.floor((gScore / gTotalObstacles) * 100);
      if (pct > 100) pct = 100;
      showGameOver("geo", `${pct}%`);
      return;
    }
    if (o.x < -50) {
      gObs.splice(i, 1);
      gScore++;
      // We are done updating the highscore with just "score" and are using percentages instead for win/loss
      updateGeoHud();
    }
  }

  // Win condition:
  // All obstacles have been spawned, passed, and the screen is clear
  if (geoStarted && !gFinished && gLevelPatternIndex >= gCurrentLevel.sequence.length && gObs.length === 0) {
    gFinished = true;
    updateGeoHud();
    showToast("LEVEL COMPLETE!", "🏆");
    setTimeout(() => {
      window.showGeoMenu();
    }, 2000);
  }

  gAnim = requestAnimationFrame((nextNow) => loopGeometry(ctx, nextNow));
}

// Apply a jump impulse if grounded.
function jumpGeo() {
  if (state.currentGame === "geo" && gPlayer.grounded) {
    geoStarted = true;
    gPlayer.dy = -gCurrentLevel.jump;
    gPlayer.grounded = false;
  }
}

// Bind pointer/keyboard controls once per session.
function bindGeoControls() {
  if (gControlsBound || !gCanvasRef) return;
  gJumpHandler = (event) => {
    if (event && event.target && event.target.closest && event.target.closest(".exit-btn-fixed")) return;
    jumpGeo();
  };
  gKeyHandler = (e) => {
    if (isInputFocused(e)) return;
    if (e.key === " " || e.key === "ArrowUp") {
      e.preventDefault();
      jumpGeo();
    }
  };
  gCanvasRef.addEventListener("pointerdown", gJumpHandler);
  if (gOverlayRef) gOverlayRef.addEventListener("pointerdown", gJumpHandler);
  window.addEventListener("keydown", gKeyHandler);
  gControlsBound = true;
}

// Cleanup handler for controls.
function unbindGeoControls() {
  if (!gControlsBound || !gCanvasRef) return;
  gCanvasRef.removeEventListener("pointerdown", gJumpHandler);
  if (gOverlayRef) gOverlayRef.removeEventListener("pointerdown", gJumpHandler);
  window.removeEventListener("keydown", gKeyHandler);
  gControlsBound = false;
}

// Stop the animation loop and detach controls on exit.
registerGameStop(() => {
  if (gAnim) cancelAnimationFrame(gAnim);
  unbindGeoControls();
});
