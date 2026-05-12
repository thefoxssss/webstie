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

// 10-row tilemap formats. 'b' = block, 's' = spike, ' ' = empty space.
const EASY_GRID = [
  "                                                                                                                                                      ",
  "                                                                                                                                                      ",
  "                                                                                                                                                      ",
  "                                                                                                                                                      ",
  "                                                                                                                                                      ",
  "                                                                                                                                                      ",
  "                                                                          bbbbb                                                                       ",
  "                                                     bbbb                                      bbbb                                                   ",
  "                                s          bbbb       bb        s          bb         s s       bb               s s          bbbb                    ",
  "            s         s        bbb         bbbbb               bbb        bbbb       bbbbb     bbbb             bbbbb        bbbb                     "
];

const NORMAL_GRID = [
  "                                                                                                                                                      ",
  "                                                                                                                                                      ",
  "                                                                                                                                                      ",
  "                                                                                                                                                      ",
  "                                                                                                                                                      ",
  "                                                                         bbb                                               bbbb                       ",
  "                                                     b                                                  bbbb                                          ",
  "                                          bbbb      bbb       s                     s   s                                           s                 ",
  "                              bbbb         bb      bbbbb     bbb                   bbb bbb               bb                 bb     bbb                ",
  "             s        s        bb         bbbb    bbbbbbb                                               bbbb               bbbb                       "
];

const HARD_GRID = [
  "                                                                                                                                                      ",
  "                                                                                                                                                      ",
  "                                                                                                                                                      ",
  "                                                                                                                                                      ",
  "                                                                                                   bbbb                                               ",
  "                                                     bbbb                 bbbb                                                                        ",
  "                                       bbbb                     s   s                 s   s                 s   s   s                                 ",
  "                           s   s                               bbb bbb               bbb bbb               bbb bbb bbb                                ",
  "                 s   s      bbb                                                                                                                       ",
  "                bbb bbb                                                                                                                               "
];

const GEO_LEVELS = [
  { id: "stereo_madness", name: "Level 1 - Easy", speed: 5.2, gravity: 0.85, jump: 12, grid: EASY_GRID },
  { id: "back_on_track", name: "Level 2 - Normal", speed: 6.0, gravity: 0.95, jump: 12.8, grid: NORMAL_GRID },
  { id: "polargeist", name: "Level 3 - Hard", speed: 7.0, gravity: 1.03, jump: 13.2, grid: HARD_GRID },
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
  gPlayer = { x: 100, y: 300, w: 30, h: 30, dy: 0, ang: 0, grounded: true, prevY: 300 };
  gObs = [];
  gScore = 0;
  gLastTime = 0;
  geoStarted = false;
  gFinished = false;
  gTotalObstacles = 0;

  // Build the level from the grid
  const startXOffset = 800; // Delay before first obstacle appears
  const tileSize = 30;
  const grid = gCurrentLevel.grid;
  // grid[9] is the floor row, so y = 320.
  // Row i corresponds to y = 320 - (9 - i) * tileSize.
  for (let r = 0; r < grid.length; r++) {
    const rowStr = grid[r];
    const yPos = 320 - (9 - r) * tileSize;
    for (let c = 0; c < rowStr.length; c++) {
      const char = rowStr[c];
      if (char === "b") {
        gObs.push({ x: startXOffset + c * tileSize, y: yPos, w: tileSize, h: tileSize, type: "block", passed: false });
        gTotalObstacles++;
      } else if (char === "s") {
        gObs.push({ x: startXOffset + c * tileSize, y: yPos, w: tileSize, h: tileSize, type: "spike", passed: false });
        gTotalObstacles++;
      }
    }
  }

  updateGeoHud();
  bindGeoControls();
  loopGeometry(ctx, performance.now());
}

function applySelectedLevel(levelId) {
  gCurrentLevel = GEO_LEVELS.find((level) => level.id === levelId) || GEO_LEVELS[0];
  gSpeed = gCurrentLevel.speed;
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

  // First, move all obstacles
  if (geoStarted && !gFinished) {
    for (let i = 0; i < gObs.length; i++) {
      gObs[i].x -= currentSpeed * simDtFrames;
    }
  }

  // Update Y position
  gPlayer.prevY = gPlayer.y;
  gPlayer.dy += gCurrentLevel.gravity * simDtFrames;
  gPlayer.y += gPlayer.dy * simDtFrames;

  // Determine highest floor under player
  let highestFloorY = 350; // Default floor (matches player bottom when on the visual floor line at y=350)
  let onBlock = false;

  for (let i = 0; i < gObs.length; i++) {
    const o = gObs[i];
    if (o.type !== "block") continue;
    // Check horizontal overlap
    if (gPlayer.x < o.x + o.w && gPlayer.x + gPlayer.w > o.x) {
      // Check if player was above the block in the previous frame
      // Allow slight leniency (0.1) for floating point inaccuracies
      if (gPlayer.prevY + gPlayer.h <= o.y + 0.1) {
        if (o.y < highestFloorY) {
          highestFloorY = o.y;
          onBlock = true;
        }
      }
    }
  }

  if (gPlayer.y + gPlayer.h > highestFloorY) {
    gPlayer.y = highestFloorY - gPlayer.h;
    gPlayer.dy = 0;
    gPlayer.grounded = true;
    gPlayer.ang = Math.round(gPlayer.ang / (Math.PI / 2)) * (Math.PI / 2);
  } else {
    gPlayer.grounded = false; // Player might have fallen off a block
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

  for (let i = gObs.length - 1; i >= 0; i--) {
    const o = gObs[i];

    // Only render if roughly on screen
    if (o.x < 800 && o.x + o.w > -50) {
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
    }

    if (
      !gFinished &&
      gPlayer.x < o.x + o.w - 4 && // tight hitbox
      gPlayer.x + gPlayer.w > o.x + 4 &&
      gPlayer.y < o.y + o.h - 4 &&
      gPlayer.y + gPlayer.h > o.y + 4
    ) {
      // If it's a block, we only collide if we aren't standing on it (handled by floor check)
      if (o.type === "spike" || (o.type === "block" && gPlayer.y + gPlayer.h > o.y + 5)) {
        const shieldResult = consumeShield("geo");
        if (shieldResult) {
          gScore++; // Count destroyed obstacle towards level completion
          gObs.splice(i, 1);
          if (shieldResult === "activated") showToast("SHIELD ACTIVATED", "🛡️");
          continue;
        }
        let pct = Math.floor((gScore / gTotalObstacles) * 100);
        if (pct > 100) pct = 100;
        showGameOver("geo", `${pct}%`);
        return;
      }
    }

    if (!o.passed && o.x + o.w < gPlayer.x) {
      o.passed = true;
      gScore++;
      updateGeoHud();
    }

    if (o.x < -50) {
      gObs.splice(i, 1);
    }
  }

  // Win condition:
  // Passed all obstacles
  if (geoStarted && !gFinished && gScore >= gTotalObstacles) {
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
