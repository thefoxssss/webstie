// Geometry-inspired endless runner with rotating cube and themed level presets.
import {
  registerGameStop,
  showGameOver,
  setText,
  updateHighScore,
  loadHighScores,
  showToast,
  consumeShield,
  state,
  hasActiveItem,
} from "../core.js";

const GEO_LEVELS = [
  { id: "stereo_madness", name: "Stereo Madness", speed: 5.2, gravity: 0.85, jump: 12, pattern: ["block", "spike", "gap", "block"] },
  { id: "back_on_track", name: "Back on Track", speed: 5.4, gravity: 0.88, jump: 12.2, pattern: ["spike", "gap", "block", "spike"] },
  { id: "polargeist", name: "Polargeist", speed: 5.6, gravity: 0.9, jump: 12.2, pattern: ["spike", "spike", "gap", "block"] },
  { id: "dry_out", name: "Dry Out", speed: 5.7, gravity: 0.92, jump: 12.4, pattern: ["block", "gap", "spike", "spike"] },
  { id: "base_after_base", name: "Base After Base", speed: 5.8, gravity: 0.93, jump: 12.5, pattern: ["block", "spike", "block", "gap"] },
  { id: "cant_let_go", name: "Can't Let Go", speed: 6, gravity: 0.95, jump: 12.8, pattern: ["spike", "block", "spike", "gap"] },
  { id: "jumper", name: "Jumper", speed: 6.1, gravity: 0.96, jump: 12.8, pattern: ["gap", "spike", "block", "spike"] },
  { id: "time_machine", name: "Time Machine", speed: 6.3, gravity: 1, jump: 13, pattern: ["spike", "spike", "block", "gap"] },
  { id: "cycles", name: "Cycles", speed: 6.4, gravity: 1, jump: 13, pattern: ["block", "spike", "spike", "gap"] },
  { id: "xstep", name: "xStep", speed: 6.5, gravity: 1.01, jump: 13, pattern: ["spike", "gap", "spike", "block"] },
  { id: "clutterfunk", name: "Clutterfunk", speed: 6.8, gravity: 1.02, jump: 13.1, pattern: ["spike", "spike", "spike", "gap"] },
  { id: "toe", name: "Theory of Everything", speed: 6.9, gravity: 1.02, jump: 13.1, pattern: ["block", "spike", "spike", "block"] },
  { id: "electroman", name: "Electroman Adventures", speed: 7, gravity: 1.03, jump: 13.2, pattern: ["gap", "block", "spike", "spike"] },
  { id: "clubstep", name: "Clubstep", speed: 7.2, gravity: 1.03, jump: 13.2, pattern: ["spike", "spike", "block", "spike"] },
  { id: "electrodynamix", name: "Electrodynamix", speed: 7.3, gravity: 1.04, jump: 13.3, pattern: ["spike", "gap", "spike", "spike"] },
  { id: "hexagon_force", name: "Hexagon Force", speed: 7.4, gravity: 1.04, jump: 13.3, pattern: ["block", "spike", "gap", "spike"] },
  { id: "blast_processing", name: "Blast Processing", speed: 7.5, gravity: 1.05, jump: 13.4, pattern: ["gap", "spike", "gap", "block"] },
  { id: "toe2", name: "Theory of Everything 2", speed: 7.6, gravity: 1.05, jump: 13.5, pattern: ["spike", "spike", "gap", "spike"] },
  { id: "geometrical_dominator", name: "Geometrical Dominator", speed: 7.7, gravity: 1.06, jump: 13.5, pattern: ["block", "block", "spike", "gap"] },
  { id: "deadlocked", name: "Deadlocked", speed: 7.9, gravity: 1.07, jump: 13.6, pattern: ["spike", "spike", "spike", "block"] },
  { id: "fingerdash", name: "Fingerdash", speed: 8, gravity: 1.08, jump: 13.6, pattern: ["gap", "spike", "block", "spike"] },
  { id: "dash", name: "Dash", speed: 8.2, gravity: 1.1, jump: 13.8, pattern: ["spike", "block", "spike", "spike"] },
];

let gPlayer = {};
let gObs = [];
let gScore = 0;
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
let gLevelSelectRef = null;

const BASE_FRAME_MS = 1000 / 60;
const MAX_DT_FRAMES = 2.5;

export function initGeometry() {
  state.currentGame = "geo";
  loadHighScores();
  const cv = document.getElementById("geoCanvas");
  const ctx = cv.getContext("2d");
  if (gAnim) cancelAnimationFrame(gAnim);
  gCanvasRef = cv;
  gOverlayRef = document.getElementById("overlayGeo");
  gLevelSelectRef = document.getElementById("geoLevelSelect");
  ensureLevelSelector();
  applySelectedLevel(gLevelSelectRef?.value || GEO_LEVELS[0].id);
  gPlayer = { x: 100, y: 300, w: 30, h: 30, dy: 0, ang: 0, grounded: true };
  gObs = [];
  gScore = 0;
  gSpawnDistanceRemaining = 0;
  gLastTime = 0;
  gLevelPatternIndex = 0;
  geoStarted = false;
  setText("geoScore", `LEVEL: ${gCurrentLevel.name} • SCORE: 0`);
  bindGeoControls();
  loopGeometry(ctx, performance.now());
}

function ensureLevelSelector() {
  if (!gLevelSelectRef || gLevelSelectRef.dataset.ready === "1") return;
  for (const level of GEO_LEVELS) {
    const option = document.createElement("option");
    option.value = level.id;
    option.textContent = level.name;
    gLevelSelectRef.appendChild(option);
  }
  gLevelSelectRef.value = gCurrentLevel.id;
  gLevelSelectRef.addEventListener("change", () => {
    if (state.currentGame !== "geo") return;
    initGeometry();
  });
  gLevelSelectRef.dataset.ready = "1";
}

function applySelectedLevel(levelId) {
  gCurrentLevel = GEO_LEVELS.find((level) => level.id === levelId) || GEO_LEVELS[0];
  gSpeed = gCurrentLevel.speed;
}

function spawnObstacle() {
  const spawnType = gCurrentLevel.pattern[gLevelPatternIndex % gCurrentLevel.pattern.length];
  gLevelPatternIndex += 1;
  if (spawnType === "gap") {
    gSpawnDistanceRemaining = 120 + Math.random() * 100;
    return;
  }
  gObs.push({
    x: 800,
    y: 320,
    w: 30,
    h: 30,
    type: spawnType,
  });
  gSpawnDistanceRemaining = 140 + Math.random() * 90;
}

// Main loop for the geometry runner: physics, obstacles, rendering.
function loopGeometry(ctx, now) {
  if (state.currentGame !== "geo") return;
  const dtFrames = gLastTime
    ? Math.min((now - gLastTime) / BASE_FRAME_MS, MAX_DT_FRAMES)
    : 0;
  const simDtFrames = geoStarted ? dtFrames : 0;
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
  gSpawnDistanceRemaining -= currentSpeed * simDtFrames;
  if (gSpawnDistanceRemaining <= 0 && Math.random() < 0.7) spawnObstacle();
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
      gPlayer.x < o.x + o.w - 5 &&
      gPlayer.x + gPlayer.w > o.x + 5 &&
      gPlayer.y < o.y + o.h - 5 &&
      gPlayer.y + gPlayer.h > o.y + 5
    ) {
      if (consumeShield("geo")) {
        gObs.splice(i, 1);
        showToast("SHIELD USED", "🛡️");
        continue;
      }
      showGameOver("geo", Math.floor(gScore));
      return;
    }
    if (o.x < -50) {
      gObs.splice(i, 1);
      gScore++;
      updateHighScore("geo", gScore);
      setText("geoScore", `LEVEL: ${gCurrentLevel.name} • SCORE: ${gScore}`);
    }
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
