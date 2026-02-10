// Geometry-inspired endless runner with rotating cube and obstacles.
import {
  registerGameStop,
  showGameOver,
  setText,
  updateHighScore,
  loadHighScores,
  showToast,
  consumeShield,
  state,
} from "../core.js";

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

export function initGeometry() {
  state.currentGame = "geo";
  loadHighScores();
  const cv = document.getElementById("geoCanvas");
  const ctx = cv.getContext("2d");
  if (gAnim) cancelAnimationFrame(gAnim);
  gCanvasRef = cv;
  gOverlayRef = document.getElementById("overlayGeo");
  gPlayer = { x: 100, y: 300, w: 30, h: 30, dy: 0, ang: 0, grounded: true };
  gObs = [];
  gScore = 0;
  gSpeed = 6;
  gSpawnDistanceRemaining = 0;
  setText("geoScore", "SCORE: 0");
  bindGeoControls();
  loopGeometry(ctx);
}

// Main loop for the geometry runner: physics, obstacles, rendering.
function loopGeometry(ctx) {
  if (state.currentGame !== "geo") return;
  const cv = document.getElementById("geoCanvas");
  if (!ctx) ctx = cv.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 800, 400);
  const currentSpeed = gSpeed * (state.myInventory.includes("item_slowmo") ? 0.8 : 1);
  gPlayer.dy += 0.9;
  gPlayer.y += gPlayer.dy;
  if (gPlayer.y > 320) {
    gPlayer.y = 320;
    gPlayer.dy = 0;
    gPlayer.grounded = true;
    gPlayer.ang = Math.round(gPlayer.ang / (Math.PI / 2)) * (Math.PI / 2);
  } else {
    gPlayer.ang += 0.15;
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
  gSpawnDistanceRemaining -= currentSpeed;
  if (gSpawnDistanceRemaining <= 0 && Math.random() < 0.4) {
    gObs.push({
      x: 800,
      y: 320,
      w: 30,
      h: 30,
      type: Math.random() > 0.5 ? "spike" : "block",
    });
    gSpawnDistanceRemaining = 180 + Math.random() * 120;
  }
  for (let i = gObs.length - 1; i >= 0; i--) {
    const o = gObs[i];
    o.x -= currentSpeed;
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
      if (consumeShield()) {
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
      setText("geoScore", "SCORE: " + gScore);
    }
  }
  gAnim = requestAnimationFrame(() => loopGeometry(ctx));
}

// Apply a jump impulse if grounded.
function jumpGeo() {
  if (state.currentGame === "geo" && gPlayer.grounded) {
    gPlayer.dy = -13;
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
