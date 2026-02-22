import { registerGameStop, setText, showToast, state, updateHighScore } from "../core.js";

const WIDTH = 800;
const HEIGHT = 420;
const WORLD_W = 2200;
const WORLD_H = 1400;
const PLAYER_SPEED = 220;

let run = null;

function stopMooMooIo() {
  if (!run) return;
  window.cancelAnimationFrame(run.raf);
  window.clearInterval(run.tickInterval);
  window.clearInterval(run.incomeInterval);
  document.removeEventListener("keydown", run.onKeyDown);
  document.removeEventListener("keyup", run.onKeyUp);
  if (run.canvas) run.canvas.onpointerdown = null;
  run = null;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function spawnResource(id) {
  const typeRoll = Math.random();
  let type = "tree";
  if (typeRoll > 0.75) type = "rock";
  if (typeRoll > 0.9) type = "bush";
  const hp = type === "rock" ? 5 : type === "tree" ? 4 : 3;
  return {
    id,
    type,
    x: rand(60, WORLD_W - 60),
    y: rand(60, WORLD_H - 60),
    hp,
    maxHp: hp,
  };
}

function makeAgent(name, isHuman = false) {
  return {
    id: `${name}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    isHuman,
    ai: !isHuman,
    x: rand(180, WORLD_W - 180),
    y: rand(180, WORLD_H - 180),
    dirX: 0,
    dirY: 0,
    hp: 100,
    wood: 20,
    stone: 10,
    food: 8,
    cash: 50,
    level: 1,
    targetId: null,
    hitCd: 0,
    thinkCd: 0,
    buildCd: rand(2, 4),
    score: 0,
  };
}

function makeStructure(ownerId, type, x, y) {
  const defs = {
    wall: { hp: 120, color: "#8d6b4f" },
    farm: { hp: 95, color: "#4c9a44" },
    autominer: { hp: 90, color: "#7a8fb8" },
    turret: { hp: 80, color: "#b84c4c" },
  };
  return {
    id: `${type}-${Math.random().toString(36).slice(2, 8)}`,
    ownerId,
    type,
    x,
    y,
    hp: defs[type].hp,
    maxHp: defs[type].hp,
    color: defs[type].color,
  };
}

function createWorld() {
  const resources = Array.from({ length: 140 }, (_, i) => spawnResource(i));
  return {
    resources,
    structures: [],
    nextResourceId: resources.length,
  };
}

function resourceYield(type) {
  if (type === "rock") return { stone: 7, cash: 3 };
  if (type === "bush") return { food: 6, cash: 2 };
  return { wood: 8, cash: 2 };
}

function nearestResource(world, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const res of world.resources) {
    const d = Math.hypot(res.x - x, res.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = res;
    }
  }
  return best;
}

function canAfford(agent, cost) {
  return agent.wood >= (cost.wood || 0) && agent.stone >= (cost.stone || 0) && agent.cash >= (cost.cash || 0);
}

function spend(agent, cost) {
  agent.wood -= cost.wood || 0;
  agent.stone -= cost.stone || 0;
  agent.cash -= cost.cash || 0;
}

function buildForAgent(runData, agent, type, x, y) {
  const costs = {
    wall: { wood: 20, stone: 5 },
    farm: { wood: 24, cash: 25 },
    autominer: { wood: 15, stone: 30, cash: 30 },
    turret: { wood: 12, stone: 22, cash: 20 },
  };
  const cost = costs[type];
  if (!cost || !canAfford(agent, cost)) return false;
  spend(agent, cost);
  runData.world.structures.push(makeStructure(agent.id, type, x, y));
  if (agent.isHuman) showToast(`${type.toUpperCase()} BUILT`, "🏗️");
  return true;
}

function hitResource(agent, res, world) {
  if (!res) return;
  res.hp -= 1;
  if (res.hp > 0) return;
  const gain = resourceYield(res.type);
  agent.wood += gain.wood || 0;
  agent.stone += gain.stone || 0;
  agent.food += gain.food || 0;
  agent.cash += gain.cash || 0;
  agent.score += 10;
  world.resources = world.resources.filter((item) => item.id !== res.id);
  world.resources.push(spawnResource(world.nextResourceId++));
}

function processAi(runData, ai, dt) {
  ai.thinkCd -= dt;
  ai.hitCd -= dt;
  ai.buildCd -= dt;

  if (ai.thinkCd <= 0) {
    ai.thinkCd = rand(0.2, 0.8);
    const target = nearestResource(runData.world, ai.x, ai.y);
    ai.targetId = target?.id || null;
  }

  const target = runData.world.resources.find((res) => res.id === ai.targetId) || nearestResource(runData.world, ai.x, ai.y);
  if (target) {
    const dx = target.x - ai.x;
    const dy = target.y - ai.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    ai.x += (dx / dist) * PLAYER_SPEED * 0.66 * dt;
    ai.y += (dy / dist) * PLAYER_SPEED * 0.66 * dt;
    if (dist < 44 && ai.hitCd <= 0) {
      ai.hitCd = 0.45;
      hitResource(ai, target, runData.world);
    }
  }

  if (ai.buildCd <= 0) {
    ai.buildCd = rand(4, 8);
    const choices = ["wall", "farm", "autominer", "turret"];
    buildForAgent(runData, ai, choices[(Math.random() * choices.length) | 0], ai.x + rand(-45, 45), ai.y + rand(-45, 45));
  }

  ai.x = Math.max(16, Math.min(WORLD_W - 16, ai.x));
  ai.y = Math.max(16, Math.min(WORLD_H - 16, ai.y));
}

function updateHud(runData) {
  const p = runData.player;
  setText("moomooioHud", `MOO ${runData.mode.toUpperCase()} | LOBBY: ${runData.agents.length} (AI: ${runData.agents.filter((a) => a.ai).length})`);
  setText("moomooioResources", `WOOD ${Math.floor(p.wood)} | STONE ${Math.floor(p.stone)} | FOOD ${Math.floor(p.food)} | CASH $${Math.floor(p.cash)} | BASE LV ${p.level}`);
  setText("moomooioScore", `SCORE: ${Math.floor(p.score)}`);
}

function updateCamera(runData) {
  const p = runData.player;
  runData.cameraX = Math.max(0, Math.min(WORLD_W - WIDTH, p.x - WIDTH * 0.5));
  runData.cameraY = Math.max(0, Math.min(WORLD_H - HEIGHT, p.y - HEIGHT * 0.5));
}

function draw(runData) {
  const { ctx } = runData;
  ctx.fillStyle = "#122014";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.translate(-runData.cameraX, -runData.cameraY);

  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  for (let x = 0; x <= WORLD_W; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD_H);
    ctx.stroke();
  }
  for (let y = 0; y <= WORLD_H; y += 100) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_W, y);
    ctx.stroke();
  }

  for (const res of runData.world.resources) {
    ctx.fillStyle = res.type === "tree" ? "#3d8b3d" : res.type === "rock" ? "#8a8e97" : "#7ca355";
    const radius = res.type === "rock" ? 18 : 20;
    ctx.beginPath();
    ctx.arc(res.x, res.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const s of runData.world.structures) {
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x - 14, s.y - 14, 28, 28);
  }

  for (const agent of runData.agents) {
    ctx.fillStyle = agent.isHuman ? "#f5d76e" : "#66b8ff";
    ctx.beginPath();
    ctx.arc(agent.x, agent.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "10px monospace";
    ctx.fillText(agent.name, agent.x - 22, agent.y - 18);
  }

  ctx.restore();
}

function doIncomeTick(runData) {
  for (const agent of runData.agents) {
    const own = runData.world.structures.filter((s) => s.ownerId === agent.id);
    const farms = own.filter((s) => s.type === "farm").length;
    const miners = own.filter((s) => s.type === "autominer").length;
    const turrets = own.filter((s) => s.type === "turret").length;
    agent.cash += farms * 6 + miners * 5 + agent.level * 1.5;
    agent.stone += miners * 2;
    agent.score += farms * 2 + miners * 3 + turrets;
  }
  updateHighScore("moomooio", Math.floor(runData.player.score));
  updateHud(runData);
}

function handleBuildShortcut(runData, code) {
  const p = runData.player;
  const forwardX = p.x + 28;
  const forwardY = p.y;
  if (code === "Digit1") buildForAgent(runData, p, "wall", forwardX, forwardY);
  if (code === "Digit2") buildForAgent(runData, p, "farm", forwardX, forwardY);
  if (code === "Digit3") buildForAgent(runData, p, "autominer", forwardX, forwardY);
  if (code === "Digit4") buildForAgent(runData, p, "turret", forwardX, forwardY);
}

export function initMooMooIo() {
  stopMooMooIo();
  state.currentGame = "moomooio";

  const canvas = document.getElementById("moomooioCanvas");
  const action = document.getElementById("moomooioAction");
  const addPlayerBtn = document.getElementById("moomooioAddPlayer");
  const modeToggle = document.getElementById("moomooioMode");
  if (!canvas || !action || !addPlayerBtn || !modeToggle) return;
  const ctx = canvas.getContext("2d");

  const mode = modeToggle.value || "online";
  const player = makeAgent("YOU", true);
  const agents = [player];
  const aiCount = mode === "offline" ? 12 : 8;
  for (let i = 1; i <= aiCount; i++) agents.push(makeAgent(`AI_${i}`));

  const runData = {
    canvas,
    ctx,
    mode,
    world: createWorld(),
    agents,
    player,
    pressed: new Set(),
    cameraX: 0,
    cameraY: 0,
    lastTs: performance.now(),
    raf: 0,
    tickInterval: 0,
    incomeInterval: 0,
  };

  action.disabled = false;
  action.textContent = "RESTART RAID";
  action.onclick = () => initMooMooIo();

  addPlayerBtn.onclick = () => {
    const newcomer = makeAgent(`GUEST_${runData.agents.length}`);
    runData.agents.push(newcomer);
    showToast("NEW PLAYER JOINED LOBBY", "🧑");
    updateHud(runData);
  };

  modeToggle.onchange = () => {
    showToast("RESTART MATCH TO SWITCH MODE", "ℹ️");
  };

  const onKeyDown = (event) => {
    runData.pressed.add(event.code);
    if (["Digit1", "Digit2", "Digit3", "Digit4"].includes(event.code)) handleBuildShortcut(runData, event.code);
    if (event.code === "Space") {
      event.preventDefault();
      const near = nearestResource(runData.world, player.x, player.y);
      if (near && Math.hypot(near.x - player.x, near.y - player.y) < 48) hitResource(player, near, runData.world);
    }
    if (event.code === "KeyU") {
      const upgradeCost = { cash: 90 + player.level * 65, wood: 25 + player.level * 10, stone: 20 + player.level * 10 };
      if (canAfford(player, upgradeCost)) {
        spend(player, upgradeCost);
        player.level += 1;
        player.score += 40;
        showToast(`BASE UPGRADED TO LV ${player.level}`, "⬆️");
      }
    }
  };

  const onKeyUp = (event) => runData.pressed.delete(event.code);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  runData.tickInterval = window.setInterval(() => doIncomeTick(runData), 1000);
  runData.incomeInterval = window.setInterval(() => {
    while (runData.world.resources.length < 140) runData.world.resources.push(spawnResource(runData.world.nextResourceId++));
  }, 1800);

  const frame = (ts) => {
    const dt = Math.min(0.05, (ts - runData.lastTs) / 1000 || 0.016);
    runData.lastTs = ts;

    let moveX = 0;
    let moveY = 0;
    if (runData.pressed.has("KeyW") || runData.pressed.has("ArrowUp")) moveY -= 1;
    if (runData.pressed.has("KeyS") || runData.pressed.has("ArrowDown")) moveY += 1;
    if (runData.pressed.has("KeyA") || runData.pressed.has("ArrowLeft")) moveX -= 1;
    if (runData.pressed.has("KeyD") || runData.pressed.has("ArrowRight")) moveX += 1;
    const mag = Math.hypot(moveX, moveY);
    if (mag > 0) {
      player.x += (moveX / mag) * PLAYER_SPEED * dt;
      player.y += (moveY / mag) * PLAYER_SPEED * dt;
    }
    player.x = Math.max(16, Math.min(WORLD_W - 16, player.x));
    player.y = Math.max(16, Math.min(WORLD_H - 16, player.y));

    for (const agent of runData.agents) {
      if (!agent.ai) continue;
      processAi(runData, agent, dt);
    }

    updateCamera(runData);
    draw(runData);
    updateHud(runData);
    runData.raf = requestAnimationFrame(frame);
  };

  run = {
    ...runData,
    onKeyDown,
    onKeyUp,
  };

  updateHud(runData);
  runData.raf = requestAnimationFrame(frame);
}

registerGameStop("moomooio", stopMooMooIo);
