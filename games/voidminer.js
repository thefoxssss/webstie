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
  isInputFocused,
} from "../core.js";

const WIDTH = 800;
const HEIGHT = 500;
const FIXED_DT = 1 / 60;
const BASE_GRAVITY = 24;
const BASE_THRUST = 50;
const ROT_SPEED = 2.8;

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
  shield: 0,
};

let terrain = [];
let landingZone = { x1: 360, x2: 500, y: 390 };

let thrustOn = false;
let leftOn = false;
let rightOn = false;
let draw;
let kernel;
let fullscreenBtn;
let score = 0;
let level = 1;
let upgradePoints = 0;

const upgrades = {
  fuelTank: 0,
  thrusters: 0,
  stabilizer: 0,
  shield: 0,
};

const wind = {
  force: 0,
  target: 0,
  timer: 0,
};

function normalizeAngle(angle) {
  const fullTurn = Math.PI * 2;
  return ((angle + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
}

function angleDelta(a, b) {
  return normalizeAngle(a - b);
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function maxFuel() {
  return 100 + upgrades.fuelTank * 25;
}

function generateTerrain(currentLevel) {
  const points = [];
  const steps = 9 + Math.min(5, Math.floor(currentLevel / 2));
  const padWidth = Math.max(80, 150 - currentLevel * 7);
  const padStart = randomRange(140, WIDTH - 140 - padWidth);
  const padEnd = padStart + padWidth;
  const padY = randomRange(340, 430);

  points.push([30, randomRange(390, 460)]);
  for (let i = 1; i < steps; i++) {
    const x = 30 + (740 / steps) * i;
    let y = randomRange(320, 465);

    if (x >= padStart - 25 && x <= padEnd + 25) y = padY;
    points.push([x, y]);
  }
  points.push([770, randomRange(390, 460)]);

  points.sort((a, b) => a[0] - b[0]);

  terrain = points;
  landingZone = { x1: padStart, x2: padEnd, y: padY };
}

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
  if (x < landingZone.x1 || x > landingZone.x2) return -1;
  return landingZone.y;
}

function difficultyScale() {
  return 1 + (level - 1) * 0.12;
}

function applyUpgrade(slot) {
  if (upgradePoints <= 0) return;
  if (slot === "1") upgrades.fuelTank += 1;
  if (slot === "2") upgrades.thrusters += 1;
  if (slot === "3") upgrades.stabilizer += 1;
  if (slot === "4") upgrades.shield += 1;
  if (!["1", "2", "3", "4"].includes(slot)) return;
  upgradePoints -= 1;
  showToast(`UPGRADE APPLIED (${slot})`, "⬆️");
}

function startNextRun() {
  level += 1;
  generateTerrain(level);

  ship.x = WIDTH * 0.5;
  ship.y = 90;
  ship.vx = 0;
  ship.vy = 0;
  ship.ang = -Math.PI / 2;
  ship.px = ship.x;
  ship.py = ship.y;
  ship.pAng = ship.ang;
  ship.fuel = maxFuel();
  ship.shield = upgrades.shield;

  wind.force = 0;
  wind.target = 0;
  wind.timer = 0;
}

function updateFullscreenButtonLabel() {
  if (!fullscreenBtn) return;
  fullscreenBtn.textContent = document.fullscreenElement ? "EXIT FULLSCREEN" : "FULLSCREEN";
}

async function toggleVoidMinerFullscreen() {
  const canvas = document.getElementById("voidMinerCanvas");
  if (!canvas) return;

  if (document.fullscreenElement === canvas) {
    await document.exitFullscreen();
  } else {
    await canvas.requestFullscreen();
  }
}

export function updateVoidMiner() {
  if (state.currentGame !== "voidminer") return;
  const dt = FIXED_DT;
  const scale = difficultyScale();

  ship.px = ship.x;
  ship.py = ship.y;
  ship.pAng = ship.ang;

  if (leftOn) ship.ang -= ROT_SPEED * dt * (1 + upgrades.stabilizer * 0.08);
  if (rightOn) ship.ang += ROT_SPEED * dt * (1 + upgrades.stabilizer * 0.08);
  ship.ang = normalizeAngle(ship.ang);

  wind.timer -= dt;
  if (wind.timer <= 0) {
    wind.timer = randomRange(1.2, 2.8);
    wind.target = randomRange(-10, 10) * Math.max(0, level - 1) * 0.16;
  }
  wind.force += (wind.target - wind.force) * 0.8 * dt;

  ship.vx += wind.force * dt;
  ship.vy += BASE_GRAVITY * scale * dt;

  const turbulenceChance = Math.max(0, (level - 3) * 0.0008);
  if (Math.random() < turbulenceChance) {
    ship.vx += randomRange(-8, 8) * dt;
    ship.vy += randomRange(-5, 4) * dt;
  }

  if (thrustOn && ship.fuel > 0) {
    const thrustScale = 1 + upgrades.thrusters * 0.14;
    ship.vx += Math.cos(ship.ang) * BASE_THRUST * thrustScale * dt;
    ship.vy += Math.sin(ship.ang) * BASE_THRUST * thrustScale * dt;

    const burnRate = (18 + Math.max(0, level - 1) * 1.1) * (1 - upgrades.fuelTank * 0.05);
    ship.fuel = Math.max(0, ship.fuel - burnRate * dt);
  }

  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;

  ship.x = Math.max(10, Math.min(WIDTH - 10, ship.x));

  if (ship.y < 8) {
    ship.y = 8;
    ship.vy = Math.max(ship.vy, 0);
  }

  if (ship.y > HEIGHT + 14) {
    if (ship.shield > 0) {
      ship.shield -= 1;
      ship.y = HEIGHT - 24;
      ship.vx *= 0.4;
      ship.vy = -Math.max(12, Math.abs(ship.vy) * 0.35);
      showToast("BOUNDARY SHIELD TRIGGERED", "🛡️");
    } else {
      showGameOver("voidminer", Math.floor(score));
      return;
    }
  }

  const groundDist = signedDistanceToGround(ship.x, ship.y);
  if (groundDist < 11) {
    const padY = landingZoneY(ship.x);
    const safeVx = Math.max(7, 18 - level * 0.7 + upgrades.stabilizer * 1.5);
    const safeVy = Math.max(11, 28 - level * 0.85 + upgrades.stabilizer * 1.8);
    const safeAngle = 0.3 + upgrades.stabilizer * 0.03;
    const safe =
      padY > 0 &&
      Math.abs(ship.vx) <= safeVx &&
      Math.abs(ship.vy) <= safeVy &&
      Math.abs(angleDelta(ship.ang, -Math.PI / 2)) < safeAngle;

    if (safe) {
      const levelReward = 400 + level * 180;
      score += Math.floor(ship.fuel * 8 + levelReward);
      updateHighScore("voidminer", score);

      if (level >= 5) unlockAchievement("soft_touchdown");
      if (Math.floor(score) > 3000) unlockAchievement("void_veteran");

      upgradePoints += 1;
      showToast(`LANDING SECURE | +1 UPGRADE (${upgradePoints})`, "🛰️");
      startNextRun();
    } else if (ship.shield > 0) {
      ship.shield -= 1;
      ship.vx *= -0.25;
      ship.vy = -Math.abs(ship.vy) * 0.25;
      ship.y -= 14;
      showToast("SHIELD SAVED YOU", "🛡️");
    } else {
      showGameOver("voidminer", Math.floor(score));
      return;
    }
  }

  score += dt * (2 + level * 0.4);
  setText(
    "voidMinerHud",
    `LVL:${level} FUEL:${ship.fuel.toFixed(0)} VX:${ship.vx.toFixed(1)} VY:${ship.vy.toFixed(1)} WIND:${wind.force.toFixed(1)} SCORE:${Math.floor(score)} UP:${upgradePoints} [1:TANK 2:THRUST 3:STAB 4:SHIELD]`
  );
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
  draw.line("#ffe066", 3, landingZone.x1, landingZone.y, landingZone.x2, landingZone.y);

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

  if (Math.abs(wind.force) > 0.5) {
    const windY = 50;
    const dir = Math.sign(wind.force) || 1;
    const len = Math.min(70, Math.abs(wind.force) * 10);
    draw.line("#7aa2ff", 2, WIDTH / 2 - len * dir, windY, WIDTH / 2 + len * dir, windY);
  }

  draw.flush();
}

export function initVoidMiner() {
  state.currentGame = "voidminer";
  loadHighScores();

  const canvas = document.getElementById("voidMinerCanvas");
  if (!canvas) return;
  fullscreenBtn = document.getElementById("voidMinerFullscreenBtn");
  if (fullscreenBtn && !fullscreenBtn.dataset.bound) {
    fullscreenBtn.dataset.bound = "1";
    fullscreenBtn.addEventListener("click", async () => {
      try {
        await toggleVoidMinerFullscreen();
      } catch (error) {
        console.warn("Void Miner fullscreen toggle failed", error);
      }
      updateFullscreenButtonLabel();
    });
  }
  updateFullscreenButtonLabel();

  draw = new DrawSystem(canvas.getContext("2d"));
  kernel = new EngineKernel({ fixedHz: 60 });

  score = 0;
  level = 1;
  upgradePoints = 0;
  upgrades.fuelTank = 0;
  upgrades.thrusters = 0;
  upgrades.stabilizer = 0;
  upgrades.shield = 0;

  generateTerrain(level);

  ship.x = WIDTH * 0.5;
  ship.y = 80;
  ship.vx = 0;
  ship.vy = 0;
  ship.ang = -Math.PI / 2;
  ship.px = ship.x;
  ship.py = ship.y;
  ship.pAng = ship.ang;
  ship.fuel = maxFuel();
  ship.shield = 0;
  thrustOn = false;
  leftOn = false;
  rightOn = false;

  setText("voidMinerHud", "LVL:1 FUEL:100 VX:0.0 VY:0.0 WIND:0.0 SCORE:0 UP:0");
  kernel.start(updateVoidMiner, drawVoidMiner, { startPausedUntilInput: true });
}

document.addEventListener("keydown", (e) => {
  if (isInputFocused(e)) return;
  if (state.currentGame !== "voidminer") return;
  if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") thrustOn = true;
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") leftOn = true;
  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") rightOn = true;
  applyUpgrade(e.key);
});

document.addEventListener("keyup", (e) => {
  if (state.currentGame !== "voidminer") return;
  if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") thrustOn = false;
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") leftOn = false;
  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") rightOn = false;
});

document.addEventListener("fullscreenchange", updateFullscreenButtonLabel);

registerGameStop(() => {
  kernel?.stop();
});
