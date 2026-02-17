import {
  registerGameStop,
  setText,
  showGameOver,
  showToast,
  unlockAchievement,
  updateHighScore,
  loadHighScores,
  state,
  EngineKernel,
  DrawSystem,
} from "../core.js";

const WIDTH = 800;
const HEIGHT = 500;
const FIXED_DT = 1 / 60;
const GRAVITY = 26;
const THRUST = 52;
const ROT_SPEED = 2.8;
const MAX_SAFE_VY = 28;
const MAX_SAFE_VX = 18;

const ship = {
  x: WIDTH * 0.5,
  y: 80,
  px: WIDTH * 0.5,
  py: 80,
  vx: 0,
  vy: 0,
  ang: -Math.PI / 2,
  pAng: -Math.PI / 2,
  fuel: 100,
};

const terrain = [
  [30, 460],
  [180, 410],
  [300, 430],
  [380, 390],
  [520, 390],
  [640, 440],
  [770, 420],
];

let thrustOn = false;
let leftOn = false;
let rightOn = false;
let draw;
let kernel;
let score = 0;

function signedDistanceToGround(x, y) {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < terrain.length - 1; i++) {
    const ax = terrain[i][0];
    const ay = terrain[i][1];
    const bx = terrain[i + 1][0];
    const by = terrain[i + 1][1];
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    const px = ax + (bx - ax) * t;
    const py = ay + (by - ay) * t;
    const d = Math.hypot(x - px, y - py);
    if (d < best) best = d;
  }
  return best;
}

function landingZoneY(x) {
  if (x < 380 || x > 520) return -1;
  return 390;
}

export function updateVoidMiner() {
  if (state.currentGame !== "voidminer") return;
  const dt = FIXED_DT;

  ship.px = ship.x;
  ship.py = ship.y;
  ship.pAng = ship.ang;

  if (leftOn) ship.ang -= ROT_SPEED * dt;
  if (rightOn) ship.ang += ROT_SPEED * dt;

  ship.vy += GRAVITY * dt;
  if (thrustOn && ship.fuel > 0) {
    ship.vx += Math.cos(ship.ang) * THRUST * dt;
    ship.vy += Math.sin(ship.ang) * THRUST * dt;
    ship.fuel = Math.max(0, ship.fuel - 18 * dt);
  }

  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;

  ship.x = Math.max(10, Math.min(WIDTH - 10, ship.x));

  const groundDist = signedDistanceToGround(ship.x, ship.y);
  if (groundDist < 11) {
    const padY = landingZoneY(ship.x);
    const safe =
      padY > 0 &&
      Math.abs(ship.vx) <= MAX_SAFE_VX &&
      Math.abs(ship.vy) <= MAX_SAFE_VY &&
      Math.abs(ship.ang + Math.PI / 2) < 0.3;

    if (safe) {
      score += Math.floor(ship.fuel * 10 + 500);
      updateHighScore("voidminer", score);
      unlockAchievement("soft_touchdown");
      showToast("SUCCESSFUL LANDING", "🛰️");
      ship.x = WIDTH * 0.5;
      ship.y = 90;
      ship.vx = 0;
      ship.vy = 0;
      ship.ang = -Math.PI / 2;
      ship.fuel = 100;
    } else {
      showGameOver("voidminer", score);
      if (score > 2000) unlockAchievement("void_veteran");
      return;
    }
  }

  score += dt * 2;
  setText("voidMinerHud", `FUEL: ${ship.fuel.toFixed(0)} | VX: ${ship.vx.toFixed(1)} | VY: ${ship.vy.toFixed(1)} | SCORE: ${Math.floor(score)}`);
}

export function drawVoidMiner(alpha) {
  if (state.currentGame !== "voidminer") return;
  const x = ship.px + (ship.x - ship.px) * alpha;
  const y = ship.py + (ship.y - ship.py) * alpha;
  const ang = ship.pAng + (ship.ang - ship.pAng) * alpha;

  draw.clear("#05070d", 0, 0, WIDTH, HEIGHT);

  for (let i = 0; i < terrain.length - 1; i++) {
    draw.line("#78ffce", 2, terrain[i][0], terrain[i][1], terrain[i + 1][0], terrain[i + 1][1]);
  }
  draw.line("#ffe066", 3, 380, 390, 520, 390);

  const noseX = x + Math.cos(ang) * 12;
  const noseY = y + Math.sin(ang) * 12;
  const leftX = x + Math.cos(ang + 2.5) * 10;
  const leftY = y + Math.sin(ang + 2.5) * 10;
  const rightX = x + Math.cos(ang - 2.5) * 10;
  const rightY = y + Math.sin(ang - 2.5) * 10;
  draw.line("#d6f0ff", 2, noseX, noseY, leftX, leftY);
  draw.line("#d6f0ff", 2, leftX, leftY, rightX, rightY);
  draw.line("#d6f0ff", 2, rightX, rightY, noseX, noseY);

  if (thrustOn && ship.fuel > 0) {
    const flameX = x - Math.cos(ang) * 12;
    const flameY = y - Math.sin(ang) * 12;
    draw.line("#ff7f50", 2, flameX, flameY, flameX - Math.cos(ang) * (8 + Math.random() * 6), flameY - Math.sin(ang) * (8 + Math.random() * 6));
  }

  draw.flush();
}

export function initVoidMiner() {
  state.currentGame = "voidminer";
  loadHighScores();

  const canvas = document.getElementById("voidMinerCanvas");
  if (!canvas) return;
  draw = new DrawSystem(canvas.getContext("2d"));
  kernel = new EngineKernel({ fixedHz: 60 });

  score = 0;
  ship.x = WIDTH * 0.5;
  ship.y = 80;
  ship.vx = 0;
  ship.vy = 0;
  ship.ang = -Math.PI / 2;
  ship.fuel = 100;
  thrustOn = false;
  leftOn = false;
  rightOn = false;

  setText("voidMinerHud", "FUEL: 100 | VX: 0.0 | VY: 0.0 | SCORE: 0");
  kernel.start(updateVoidMiner, drawVoidMiner);
}

document.addEventListener("keydown", (e) => {
  if (state.currentGame !== "voidminer") return;
  if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") thrustOn = true;
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") leftOn = true;
  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") rightOn = true;
});

document.addEventListener("keyup", (e) => {
  if (state.currentGame !== "voidminer") return;
  if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") thrustOn = false;
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") leftOn = false;
  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") rightOn = false;
});

registerGameStop(() => {
  kernel?.stop();
});
