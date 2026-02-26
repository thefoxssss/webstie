import {
  registerGameStop,
  checkLossStreak,
  resetLossStreak,
  setText,
  showGameOver,
  showToast,
  updateHighScore,
  loadHighScores,
  consumeShield,
  state,
} from "../core.js";

const WIDTH = 900;
const HEIGHT = 500;
const LANE_X = [270, 450, 630];
const GROUND_Y = 380;

let canvas;
let ctx;
let rafId = 0;
let runToken = 0;

const runner = {
  lane: 1,
  y: 0,
  vy: 0,
  slidingTimer: 0,
};

let distance = 0;
let coins = 0;
let speed = 260;
let spawnTimer = 0;
let coinSpawnTimer = 0;

const obstacles = [];
const coinLines = [];

function resetState() {
  runner.lane = 1;
  runner.y = 0;
  runner.vy = 0;
  runner.slidingTimer = 0;
  distance = 0;
  coins = 0;
  speed = 260;
  spawnTimer = 0;
  coinSpawnTimer = 0;
  obstacles.length = 0;
  coinLines.length = 0;
  updateHud();
}

function updateHud() {
  const score = Math.floor(distance + coins * 25);
  setText("subwayHud", `SCORE: ${score} | COINS: ${coins} | SPEED: ${Math.floor(speed)} km/h`);
  updateHighScore("subwaysurfer", score);
}

function spawnObstacle() {
  const lane = Math.floor(Math.random() * 3);
  const typeRoll = Math.random();
  let type = "barrier";
  let h = 74;
  if (typeRoll > 0.68) {
    type = "train";
    h = 140;
  } else if (typeRoll > 0.35) {
    type = "duck";
    h = 42;
  }
  obstacles.push({ lane, z: 820, type, h, hit: false });
}

function spawnCoinLine() {
  const lane = Math.floor(Math.random() * 3);
  const count = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    coinLines.push({ lane, z: 860 + i * 55, taken: false });
  }
}

function handleInput(eventKey) {
  if (state.currentGame !== "subwaysurfer") return;
  if (eventKey === "ArrowLeft" || eventKey === "a" || eventKey === "A") runner.lane = Math.max(0, runner.lane - 1);
  if (eventKey === "ArrowRight" || eventKey === "d" || eventKey === "D") runner.lane = Math.min(2, runner.lane + 1);
  if ((eventKey === "ArrowUp" || eventKey === "w" || eventKey === "W" || eventKey === " ") && runner.y === 0) {
    runner.vy = 600;
  }
  if (eventKey === "ArrowDown" || eventKey === "s" || eventKey === "S") {
    runner.slidingTimer = 0.6;
  }
}

function runnerHitbox() {
  const baseHeight = runner.slidingTimer > 0 ? 38 : 82;
  const bottom = GROUND_Y - runner.y;
  return {
    lane: runner.lane,
    top: bottom - baseHeight,
    bottom,
    height: baseHeight,
  };
}

function obstacleWorldTop(obstacle) {
  return GROUND_Y - obstacle.h;
}

function collide(obstacle, playerBox) {
  if (obstacle.lane !== playerBox.lane) return false;
  if (obstacle.z < -40 || obstacle.z > 85) return false;
  const obstacleTop = obstacleWorldTop(obstacle);
  if (obstacle.type === "duck") {
    return playerBox.bottom > obstacleTop;
  }
  return playerBox.top < GROUND_Y && playerBox.bottom > obstacleTop;
}

function loseRun() {
  if (consumeShield()) {
    showToast("SHIELD BLOCKED CRASH", "🛡️");
    return false;
  }
  const score = Math.floor(distance + coins * 25);
  checkLossStreak();
  showGameOver("subwaysurfer", score);
  return true;
}

function update(dt) {
  if (state.currentGame !== "subwaysurfer") return;

  speed = Math.min(620, speed + dt * 4.8);
  distance += dt * (speed * 0.12);

  runner.vy -= 1700 * dt;
  runner.y = Math.max(0, runner.y + runner.vy * dt);
  if (runner.y === 0) runner.vy = 0;
  runner.slidingTimer = Math.max(0, runner.slidingTimer - dt);

  spawnTimer += dt;
  coinSpawnTimer += dt;
  if (spawnTimer > Math.max(0.5, 1.35 - speed / 700)) {
    spawnTimer = 0;
    spawnObstacle();
  }
  if (coinSpawnTimer > 1.25) {
    coinSpawnTimer = 0;
    spawnCoinLine();
  }

  for (const obstacle of obstacles) obstacle.z -= speed * dt;
  for (const coin of coinLines) coin.z -= speed * dt;

  const playerBox = runnerHitbox();
  for (const obstacle of obstacles) {
    if (obstacle.hit) continue;
    if (collide(obstacle, playerBox)) {
      obstacle.hit = true;
      if (loseRun()) return;
    }
  }

  for (const coin of coinLines) {
    if (coin.taken) continue;
    if (coin.lane !== runner.lane) continue;
    if (coin.z < 20 && coin.z > -35 && runner.y < 120) {
      coin.taken = true;
      coins += 1;
      resetLossStreak();
    }
  }

  while (obstacles.length && obstacles[0].z < -80) obstacles.shift();
  while (coinLines.length && coinLines[0].z < -80) coinLines.shift();
  updateHud();
}

function drawTrack() {
  ctx.fillStyle = "#070f16";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, "#1a2f46");
  grad.addColorStop(1, "#0a0d10");
  ctx.fillStyle = grad;
  ctx.fillRect(180, 20, 540, 430);

  ctx.strokeStyle = "#93b8dd";
  ctx.lineWidth = 6;
  ctx.strokeRect(180, 20, 540, 430);

  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const x = 180 + i * 180;
    ctx.strokeStyle = "rgba(170,220,255,0.38)";
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x, 450);
    ctx.stroke();
  }
}

function projectRect(lane, z, h, color) {
  const x = LANE_X[lane];
  const scale = Math.max(0.2, 1 - z / 1000);
  const width = 80 * scale;
  const height = h * scale;
  const y = GROUND_Y - height - z * 0.1;
  ctx.fillStyle = color;
  ctx.fillRect(x - width / 2, y, width, height);
}

function render() {
  drawTrack();

  for (const coin of coinLines) {
    if (coin.taken) continue;
    const x = LANE_X[coin.lane];
    const scale = Math.max(0.2, 1 - coin.z / 1000);
    const y = GROUND_Y - 70 * scale - coin.z * 0.1;
    const r = 12 * scale;
    ctx.fillStyle = "#ffd34d";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const obstacle of obstacles) {
    const color = obstacle.type === "train" ? "#ef5350" : obstacle.type === "duck" ? "#a5d6a7" : "#ffb74d";
    projectRect(obstacle.lane, obstacle.z, obstacle.h, color);
  }

  const playerX = LANE_X[runner.lane];
  const bodyH = runner.slidingTimer > 0 ? 36 : 84;
  const bodyW = runner.slidingTimer > 0 ? 92 : 54;
  const y = GROUND_Y - bodyH - runner.y;
  ctx.fillStyle = "#5ef2e6";
  ctx.fillRect(playerX - bodyW / 2, y, bodyW, bodyH);

  ctx.fillStyle = "#d9fbff";
  ctx.font = "18px monospace";
  ctx.fillText("A/D OR ←/→ SWITCH LANES • W/SPACE JUMP • S/↓ ROLL", 205, 485);
}

function frame(now, prev = now, token = runToken) {
  if (token !== runToken || state.currentGame !== "subwaysurfer") return;
  const dt = Math.min(0.033, Math.max(0.001, (now - prev) / 1000));
  update(dt);
  render();
  rafId = requestAnimationFrame((next) => frame(next, now, token));
}

export function initSubwaySurfer() {
  state.currentGame = "subwaysurfer";
  loadHighScores();
  canvas = document.getElementById("subwayCanvas");
  ctx = canvas.getContext("2d");
  setText("hsSubwaysurfer", localStorage.getItem("hs_subwaysurfer") || 0);
  resetState();
  runToken += 1;
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame((now) => frame(now, now, runToken));
}

document.addEventListener("keydown", (event) => {
  handleInput(event.key);
});

document.getElementById("subwayCanvas")?.addEventListener("click", () => {
  if (state.currentGame !== "subwaysurfer") return;
  runner.vy = 600;
});

registerGameStop(() => {
  runToken += 1;
  cancelAnimationFrame(rafId);
});
