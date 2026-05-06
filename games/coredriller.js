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

const WIDTH = 820;
const HEIGHT = 500;
const FIXED_DT = 1 / 60;
const GROUND_Y = 300;

let draw;
let kernel;

const input = { left: false, right: false, up: false, down: false };

const drill = {
  x: WIDTH / 2,
  y: 80,
  vx: 0,
  vy: 0,
  fuel: 100,
  heat: 0,
  hull: 100,
};

let score = 0;
let depth = 0;
let layer = 0;
let combo = 0;
let upgradePoints = 0;
let heatCap = 100;
let fuelCap = 100;
let drillPower = 1;
let oreNodes = [];

function spawnOreNodes() {
  oreNodes = Array.from({ length: 12 }, () => ({
    x: 40 + Math.random() * (WIDTH - 80),
    y: GROUND_Y + 20 + Math.random() * (HEIGHT - GROUND_Y - 30),
    r: 8 + Math.random() * 8,
    hp: 15 + layer * 4 + Math.random() * 10,
    value: 40 + layer * 10 + Math.floor(Math.random() * 30),
  }));
}

function resetRun() {
  drill.x = WIDTH / 2;
  drill.y = 80;
  drill.vx = 0;
  drill.vy = 0;
  drill.fuel = fuelCap;
  drill.heat = 0;
  drill.hull = 100;
  score = 0;
  depth = 0;
  layer = 0;
  combo = 0;
  upgradePoints = 0;
  fuelCap = 100;
  heatCap = 100;
  drillPower = 1;
  spawnOreNodes();
}

function hud() {
  setText(
    "coreDrillerHud",
    `DEPTH:${Math.floor(depth)}m SCORE:${Math.floor(score)} FUEL:${Math.floor(drill.fuel)}/${fuelCap} HEAT:${Math.floor(drill.heat)}/${heatCap} HULL:${Math.floor(drill.hull)} UP:${upgradePoints} [1:FUEL 2:COOL 3:DRILL]`
  );
}

function applyUpgrade(key) {
  if (upgradePoints <= 0) return;
  if (key === "1") {
    fuelCap += 20;
    drill.fuel = Math.min(fuelCap, drill.fuel + 25);
  } else if (key === "2") {
    heatCap += 20;
    drill.heat = Math.max(0, drill.heat - 20);
  } else if (key === "3") {
    drillPower += 0.25;
  } else {
    return;
  }
  upgradePoints -= 1;
  showToast("RIG UPGRADED", "⚙️");
}

function mineOre(dt) {
  for (let i = oreNodes.length - 1; i >= 0; i -= 1) {
    const ore = oreNodes[i];
    const dx = ore.x - drill.x;
    const dy = ore.y - drill.y;
    const dist = Math.hypot(dx, dy);
    if (dist < ore.r + 12) {
      const damage = (8 + Math.max(0, drill.vy) * 0.08) * drillPower * dt * 60;
      ore.hp -= damage;
      drill.heat += 0.25 * damage * dt;
      if (ore.hp <= 0) {
        score += ore.value + combo * 5;
        combo += 1;
        drill.fuel = Math.min(fuelCap, drill.fuel + 4);
        oreNodes.splice(i, 1);
        showToast(`ORE +${ore.value}`, "💎");
      }
    }
  }
  if (!oreNodes.length) {
    upgradePoints += 1;
    layer += 1;
    spawnOreNodes();
    showToast(`NEW STRATUM ${layer}`, "🪨");
    if (layer >= 10) unlockAchievement("void_veteran");
  }
}

function update() {
  if (state.currentGame !== "coredriller") return;
  const dt = FIXED_DT;

  const accelX = 90;
  if (input.left) drill.vx -= accelX * dt;
  if (input.right) drill.vx += accelX * dt;

  if (input.up && drill.fuel > 0) {
    drill.vy += 110 * dt;
    drill.fuel = Math.max(0, drill.fuel - 12 * dt);
    drill.heat += 14 * dt;
  } else {
    drill.vy += 34 * dt;
  }

  if (input.down && drill.fuel > 0) {
    drill.vy -= 75 * dt;
    drill.fuel = Math.max(0, drill.fuel - 8 * dt);
  }

  drill.vx *= 0.92;
  drill.vy = Math.max(-70, Math.min(180, drill.vy));
  drill.x = Math.max(12, Math.min(WIDTH - 12, drill.x + drill.vx * dt));
  drill.y += drill.vy * dt;

  if (drill.y < 40) {
    drill.y = 40;
    drill.vy = Math.max(0, drill.vy);
  }

  while (drill.y > HEIGHT * 0.6) {
    drill.y -= 10;
    depth += 10;
    score += 1.2;
  }

  if (drill.heat > 0) drill.heat = Math.max(0, drill.heat - 8 * dt);
  if (drill.heat >= heatCap) drill.hull -= 14 * dt;
  if (drill.fuel <= 0 && input.up) drill.hull -= 6 * dt;

  mineOre(dt);

  if (drill.hull <= 0) {
    const final = Math.floor(score);
    updateHighScore("coredriller", final);
    showGameOver("coredriller", final);
    return;
  }

  updateHighScore("coredriller", Math.floor(score));
  hud();
}

function drawGame() {
  if (state.currentGame !== "coredriller") return;

  draw.clear("#05060a", 0, 0, WIDTH, HEIGHT);
  draw.rect("#0d1424", 0, 0, WIDTH, GROUND_Y);
  draw.rect("#3a2c22", 0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);

  for (const ore of oreNodes) {
    draw.circle("#4de8ff", ore.x, ore.y, ore.r);
  }

  draw.rect("#d7e2ff", drill.x - 10, drill.y - 12, 20, 24);
  draw.line("#7fffd4", 2, drill.x, drill.y + 8, drill.x, drill.y + 20);

  draw.text("#8ab7ff", 12, 20, `STRATUM ${layer}`);
  draw.text("#8ab7ff", 12, 40, `COMBO ${combo}`);
  draw.flush();
}

export function initCoreDriller() {
  state.currentGame = "coredriller";
  loadHighScores();

  const canvas = document.getElementById("coreDrillerCanvas");
  if (!canvas) return;

  draw = new DrawSystem(canvas.getContext("2d"));
  kernel?.stop();
  kernel = new EngineKernel({ fixedHz: 60 });

  resetRun();
  hud();
  kernel.start(update, drawGame);
}

document.addEventListener("keydown", (e) => {
  if (isInputFocused(e)) return;
  if (state.currentGame !== "coredriller") return;
  const k = e.key.toLowerCase();
  if (e.key === "ArrowLeft" || k === "a") input.left = true;
  if (e.key === "ArrowRight" || k === "d") input.right = true;
  if (e.key === "ArrowUp" || k === "w") input.up = true;
  if (e.key === "ArrowDown" || k === "s") input.down = true;
  applyUpgrade(e.key);
});

document.addEventListener("keyup", (e) => {
  if (state.currentGame !== "coredriller") return;
  const k = e.key.toLowerCase();
  if (e.key === "ArrowLeft" || k === "a") input.left = false;
  if (e.key === "ArrowRight" || k === "d") input.right = false;
  if (e.key === "ArrowUp" || k === "w") input.up = false;
  if (e.key === "ArrowDown" || k === "s") input.down = false;
});

registerGameStop(() => {
  kernel?.stop();
});
