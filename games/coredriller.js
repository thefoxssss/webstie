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

const WIDTH = 820;
const HEIGHT = 500;
const FIXED_DT = 1 / 60;
const LAYER_HEIGHT = 100;
const SEGMENT_W = 56;
const COLS = Math.ceil(WIDTH / SEGMENT_W) + 1;

const drill = {
  x: WIDTH * 0.5,
  y: 84,
  px: WIDTH * 0.5,
  py: 84,
  vx: 0,
  vy: 0,
  fuel: 100,
  heat: 0,
  hull: 100,
};

let draw;
let kernel;
let score = 0;
let depth = 0;
let layer = 0;
let worldOffset = 0;
let leftOn = false;
let rightOn = false;
let thrustOn = false;
let brakeOn = false;
let terrain = [];

const upgrades = {
  fuel: 0,
  coolant: 0,
  drill: 0,
};
let upgradePoints = 0;

function maxFuel() {
  return 100 + upgrades.fuel * 24;
}

function maxHeat() {
  return 100 + upgrades.coolant * 18;
}

function regenLayer(targetLayer) {
  const next = [];
  const richness = 1 + targetLayer * 0.08;
  for (let i = 0; i < COLS; i += 1) {
    const hardness = 20 + Math.random() * 25 * richness;
    const ore = Math.random() < Math.min(0.7, 0.28 + targetLayer * 0.025);
    const vent = Math.random() < Math.max(0.05, 0.2 - targetLayer * 0.01);
    next.push({ hardness, ore, vent });
  }
  terrain = next;
}

function applyUpgrade(key) {
  if (upgradePoints <= 0) return;
  if (key === "1") upgrades.fuel += 1;
  if (key === "2") upgrades.coolant += 1;
  if (key === "3") upgrades.drill += 1;
  if (!["1", "2", "3"].includes(key)) return;
  upgradePoints -= 1;
  showToast(`RIG UPGRADED (${key})`, "⚙️");
}

function resetRun() {
  drill.x = WIDTH * 0.5;
  drill.y = 84;
  drill.vx = 0;
  drill.vy = 0;
  drill.fuel = maxFuel();
  drill.heat = 0;
  drill.hull = 100;
  leftOn = false;
  rightOn = false;
  thrustOn = false;
  brakeOn = false;
  worldOffset = 0;
  depth = 0;
  layer = 0;
  regenLayer(layer);
}

function updateHud() {
  setText(
    "coreDrillerHud",
    `DEPTH:${Math.floor(depth)}m SCORE:${Math.floor(score)} FUEL:${drill.fuel.toFixed(0)} HEAT:${drill.heat.toFixed(0)}/${maxHeat().toFixed(0)} HULL:${drill.hull.toFixed(0)} UP:${upgradePoints} [1:FUEL 2:COOL 3:DRILL]`
  );
}

export function updateCoreDriller() {
  if (state.currentGame !== "coredriller") return;
  const dt = FIXED_DT;

  drill.px = drill.x;
  drill.py = drill.y;

  const steer = 56 + upgrades.drill * 6;
  if (leftOn) drill.vx -= steer * dt;
  if (rightOn) drill.vx += steer * dt;

  const thrustPower = 78 + upgrades.drill * 8;
  if (thrustOn && drill.fuel > 0) {
    drill.vy += thrustPower * dt;
    drill.fuel = Math.max(0, drill.fuel - (11 - upgrades.fuel * 0.55) * dt);
    drill.heat += (13 - upgrades.coolant * 0.75) * dt;
  } else {
    drill.vy += 28 * dt;
  }

  if (brakeOn && drill.fuel > 0) {
    drill.vy -= 52 * dt;
    drill.fuel = Math.max(0, drill.fuel - 8 * dt);
  }

  drill.vx *= 0.93;
  drill.vy = Math.min(160, Math.max(-60, drill.vy));
  drill.x = Math.max(18, Math.min(WIDTH - 18, drill.x + drill.vx * dt));
  drill.y += drill.vy * dt;

  if (drill.heat > 0) drill.heat = Math.max(0, drill.heat - (7 + upgrades.coolant * 1.6) * dt);
  if (drill.heat >= maxHeat()) {
    drill.hull -= 18 * dt;
  }

  while (drill.y > HEIGHT * 0.55) {
    drill.y -= 14;
    worldOffset += 14;
    depth += 14;
    score += 1.6;
  }

  const nextLayer = Math.floor(depth / LAYER_HEIGHT);
  if (nextLayer !== layer) {
    layer = nextLayer;
    regenLayer(layer);
    upgradePoints += 1;
    showToast(`NEW STRATUM ${layer} // +1 UPGRADE`, "🪨");
    if (layer >= 10) unlockAchievement("void_veteran");
  }

  const col = Math.max(0, Math.min(COLS - 1, Math.floor(drill.x / SEGMENT_W)));
  const segment = terrain[col];
  if (segment) {
    const crush = Math.max(0, drill.vy * 0.22) * (1 + layer * 0.03);
    segment.hardness -= crush * (1 + upgrades.drill * 0.16) * dt;
    drill.heat += Math.max(0, crush * 0.36) * dt;

    if (segment.hardness <= 0) {
      if (segment.ore) {
        const oreValue = 120 + layer * 20;
        score += oreValue;
        showToast(`ORE CACHE +${oreValue}`, "💎");
      }
      if (segment.vent) {
        drill.heat = Math.max(0, drill.heat - 30);
        drill.fuel = Math.min(maxFuel(), drill.fuel + 10);
        showToast("GEOTHERMAL VENT STABILIZED", "🌬️");
      }
      terrain[col] = {
        hardness: 24 + Math.random() * 28 * (1 + layer * 0.04),
        ore: Math.random() < Math.min(0.7, 0.2 + layer * 0.02),
        vent: Math.random() < 0.1,
      };
    }
  }

  if (drill.fuel <= 0 && drill.vy <= 0) drill.hull -= 4 * dt;
  if (drill.hull <= 0) {
    updateHighScore("coredriller", Math.floor(score));
    showGameOver("coredriller", Math.floor(score));
    return;
  }

  updateHighScore("coredriller", Math.floor(score));
  updateHud();
}

export function drawCoreDriller(alpha) {
  if (state.currentGame !== "coredriller") return;
  const x = drill.px + (drill.x - drill.px) * alpha;
  const y = drill.py + (drill.y - drill.py) * alpha;

  draw.clear("#05060a", 0, 0, WIDTH, HEIGHT);

  for (let i = 0; i < COLS; i += 1) {
    const segment = terrain[i];
    if (!segment) continue;
    const hardRatio = Math.max(0, Math.min(1, segment.hardness / 48));
    const shade = Math.floor(40 + hardRatio * 110);
    const color = `rgb(${shade}, ${Math.floor(shade * 0.8)}, ${Math.floor(shade * 0.55)})`;
    draw.rect(color, i * SEGMENT_W, HEIGHT * 0.58, SEGMENT_W - 2, HEIGHT * 0.45);

    if (segment.ore) {
      draw.circle("#5ff6ff", i * SEGMENT_W + SEGMENT_W * 0.5, HEIGHT * 0.72, 6);
    }
    if (segment.vent) {
      draw.circle("#82ffa0", i * SEGMENT_W + SEGMENT_W * 0.38, HEIGHT * 0.79, 4);
    }
  }

  draw.rect("#0d1424", 0, 0, WIDTH, HEIGHT * 0.58);

  draw.rect("#e4ecff", x - 10, y - 14, 20, 28);
  draw.rect("#7cf7ff", x - 3, y + 12, 6, 10);
  if (thrustOn && drill.fuel > 0) {
    draw.line("#ff7f50", 2, x, y + 22, x, y + 35 + Math.random() * 10);
  }

  draw.line("#2df2ff", 1, x, y + 15, x, HEIGHT * 0.58);

  draw.text(`#8ab7ff`, 14, 20, `STRATUM ${layer}`);
  draw.text(`#8ab7ff`, 14, 40, `OFFSET ${Math.floor(worldOffset)}m`);

  draw.flush();
}

export function initCoreDriller() {
  state.currentGame = "coredriller";
  loadHighScores();

  const canvas = document.getElementById("coreDrillerCanvas");
  if (!canvas) return;
  draw = new DrawSystem(canvas.getContext("2d"));
  kernel = new EngineKernel({ fixedHz: 60 });

  score = 0;
  upgradePoints = 0;
  upgrades.fuel = 0;
  upgrades.coolant = 0;
  upgrades.drill = 0;

  resetRun();
  updateHud();
  kernel.start(updateCoreDriller, drawCoreDriller, { startPausedUntilInput: true });
}

document.addEventListener("keydown", (e) => {
  if (state.currentGame !== "coredriller") return;
  const key = e.key.toLowerCase();
  if (e.key === "ArrowLeft" || key === "a") leftOn = true;
  if (e.key === "ArrowRight" || key === "d") rightOn = true;
  if (e.key === "ArrowUp" || key === "w") thrustOn = true;
  if (e.key === "ArrowDown" || key === "s") brakeOn = true;
  applyUpgrade(e.key);
});

document.addEventListener("keyup", (e) => {
  if (state.currentGame !== "coredriller") return;
  const key = e.key.toLowerCase();
  if (e.key === "ArrowLeft" || key === "a") leftOn = false;
  if (e.key === "ArrowRight" || key === "d") rightOn = false;
  if (e.key === "ArrowUp" || key === "w") thrustOn = false;
  if (e.key === "ArrowDown" || key === "s") brakeOn = false;
});

registerGameStop(() => {
  kernel?.stop();
});
