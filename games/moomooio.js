import { registerGameStop, setText, showToast, state, updateHighScore } from "../core.js";

const WIDTH = 800;
const HEIGHT = 420;
const WORLD_W = 2400;
const WORLD_H = 1500;
const PLAYER_SPEED = 220;
const NETWORK_ROOM = "moomooio-room-v2";
const DAY_LENGTH = 45;
const NIGHT_LENGTH = 55;

let run = null;

function stopMooMooIo() {
  if (!run) return;
  window.cancelAnimationFrame(run.raf);
  window.clearInterval(run.tickInterval);
  window.clearInterval(run.incomeInterval);
  document.removeEventListener("keydown", run.onKeyDown);
  document.removeEventListener("keyup", run.onKeyUp);
  if (run.channel) {
    run.channel.postMessage({ type: "leave", sender: run.player.id });
    run.channel.close();
  }
  run = null;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function spawnResource(id) {
  const roll = Math.random();
  let type = "tree";
  if (roll > 0.72) type = "rock";
  if (roll > 0.9) type = "apple";
  const hp = type === "rock" ? 5 : type === "tree" ? 4 : 2;
  return { id, type, x: rand(60, WORLD_W - 60), y: rand(60, WORLD_H - 60), hp, maxHp: hp };
}

function makeAgent(name, isHuman = false) {
  return {
    id: `${name}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    isHuman,
    ai: !isHuman,
    x: rand(180, WORLD_W - 180),
    y: rand(180, WORLD_H - 180),
    hp: 100,
    wood: 25,
    stone: 15,
    food: 8,
    cash: 70,
    age: 1,
    xp: 0,
    score: 0,
    targetId: null,
    hitCd: 0,
    thinkCd: 0,
    buildCd: rand(2, 4),
    swing: 0,
    facing: 0,
  };
}

function makeStructure(ownerId, type, x, y) {
  const defs = {
    wall: { hp: 150, color: "#8d6b4f", range: 0, rate: 0, damage: 0 },
    goldmine: { hp: 100, color: "#e2b74f", range: 0, rate: 0, damage: 0 },
    arrow: { hp: 95, color: "#53a7ff", range: 170, rate: 0.9, damage: 10 },
    cannon: { hp: 120, color: "#b072ff", range: 130, rate: 1.6, damage: 24 },
    bomb: { hp: 110, color: "#f16f52", range: 120, rate: 2.0, damage: 35 },
  };
  const def = defs[type] || defs.wall;
  return {
    id: `${type}-${Math.random().toString(36).slice(2, 8)}`,
    ownerId,
    type,
    x,
    y,
    hp: def.hp,
    maxHp: def.hp,
    color: def.color,
    range: def.range,
    rate: def.rate,
    damage: def.damage,
    cool: rand(0, 0.5),
  };
}

function makeZombie(level) {
  const edge = (Math.random() * 4) | 0;
  let x = 0;
  let y = 0;
  if (edge === 0) { x = rand(20, WORLD_W - 20); y = 20; }
  if (edge === 1) { x = WORLD_W - 20; y = rand(20, WORLD_H - 20); }
  if (edge === 2) { x = rand(20, WORLD_W - 20); y = WORLD_H - 20; }
  if (edge === 3) { x = 20; y = rand(20, WORLD_H - 20); }
  const hp = 36 + level * 8;
  return { id: `z-${Math.random().toString(36).slice(2, 8)}`, x, y, hp, maxHp: hp, speed: 45 + level * 4, damage: 6 + level };
}

function createWorld(playerId) {
  const resources = Array.from({ length: 170 }, (_, i) => spawnResource(i));
  const baseX = WORLD_W * 0.5;
  const baseY = WORLD_H * 0.5;
  return {
    resources,
    structures: [makeStructure(playerId, "wall", baseX - 54, baseY), makeStructure(playerId, "wall", baseX + 54, baseY)],
    zombies: [],
    nextResourceId: resources.length,
    baseCore: { x: baseX, y: baseY, hp: 700, maxHp: 700 },
  };
}

function resourceYield(type) {
  if (type === "rock") return { stone: 7, cash: 3, xp: 12 };
  if (type === "apple") return { food: 8, cash: 2, xp: 8 };
  return { wood: 9, cash: 2, xp: 10 };
}

function nearest(items, x, y, filter = () => true) {
  let best = null;
  let bestDist = Infinity;
  for (const item of items) {
    if (!filter(item)) continue;
    const d = Math.hypot(item.x - x, item.y - y);
    if (d < bestDist) {
      best = item;
      bestDist = d;
    }
  }
  return best;
}

function canAfford(agent, cost) {
  return agent.wood >= (cost.wood || 0) && agent.stone >= (cost.stone || 0) && agent.cash >= (cost.cash || 0) && agent.age >= (cost.age || 0);
}

function spend(agent, cost) {
  agent.wood -= cost.wood || 0;
  agent.stone -= cost.stone || 0;
  agent.cash -= cost.cash || 0;
}

function maybeAgeUp(agent) {
  const needed = 65 + agent.age * 45;
  if (agent.xp < needed) return;
  agent.xp -= needed;
  agent.age += 1;
  agent.score += 35;
  if (agent.isHuman) showToast(`AGE UP: ${agent.age}`, "🧬");
}

function buildForAgent(runData, agent, type, x, y) {
  const costs = {
    wall: { wood: 24, stone: 8, age: 1 },
    goldmine: { wood: 18, stone: 16, cash: 20, age: 2 },
    arrow: { wood: 28, stone: 22, cash: 18, age: 3 },
    cannon: { wood: 35, stone: 34, cash: 40, age: 5 },
    bomb: { wood: 42, stone: 28, cash: 55, age: 6 },
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
  agent.xp += gain.xp || 0;
  agent.score += 10;
  maybeAgeUp(agent);
  world.resources = world.resources.filter((item) => item.id !== res.id);
  world.resources.push(spawnResource(world.nextResourceId++));
}

function swingAxe(runData, actor, forcedTarget = null) {
  actor.swing = 0.22;
  const target = forcedTarget || nearest(runData.world.resources, actor.x, actor.y);
  if (!target) return;
  actor.facing = Math.atan2(target.y - actor.y, target.x - actor.x);
  if (Math.hypot(target.x - actor.x, target.y - actor.y) < 56) hitResource(actor, target, runData.world);
}

function applyTowerDefenses(runData, dt) {
  for (const s of runData.world.structures) {
    if (s.range <= 0) continue;
    s.cool -= dt;
    if (s.cool > 0) continue;
    const target = nearest(runData.world.zombies, s.x, s.y, (z) => z.hp > 0 && Math.hypot(z.x - s.x, z.y - s.y) <= s.range);
    if (!target) continue;
    target.hp -= s.damage;
    s.cool = s.rate;
    if (target.hp <= 0) {
      runData.player.cash += 6;
      runData.player.score += 12;
      runData.player.xp += 5;
      maybeAgeUp(runData.player);
    }
  }
  runData.world.zombies = runData.world.zombies.filter((z) => z.hp > 0);
}

function updateZombies(runData, dt) {
  const { world } = runData;
  for (const z of world.zombies) {
    const targetStructure = nearest(world.structures, z.x, z.y, (s) => s.hp > 0);
    const core = world.baseCore;
    const target = targetStructure || core;
    const dx = target.x - z.x;
    const dy = target.y - z.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    if (dist > 16) {
      z.x += (dx / dist) * z.speed * dt;
      z.y += (dy / dist) * z.speed * dt;
    } else {
      if (target === core) core.hp -= z.damage * dt;
      else target.hp -= z.damage * dt;
    }
  }
  world.structures = world.structures.filter((s) => s.hp > 0);
}

function processAi(runData, ai, dt) {
  ai.thinkCd -= dt;
  ai.hitCd -= dt;
  ai.buildCd -= dt;
  ai.swing = Math.max(0, ai.swing - dt);

  if (ai.thinkCd <= 0) {
    ai.thinkCd = rand(0.2, 0.8);
    ai.targetId = nearest(runData.world.resources, ai.x, ai.y)?.id || null;
  }

  const target = runData.world.resources.find((res) => res.id === ai.targetId) || nearest(runData.world.resources, ai.x, ai.y);
  if (target) {
    const dx = target.x - ai.x;
    const dy = target.y - ai.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    ai.x += (dx / dist) * PLAYER_SPEED * 0.64 * dt;
    ai.y += (dy / dist) * PLAYER_SPEED * 0.64 * dt;
    if (dist < 48 && ai.hitCd <= 0) {
      ai.hitCd = 0.58;
      swingAxe(runData, ai, target);
    }
  }

  if (ai.buildCd <= 0) {
    ai.buildCd = rand(5, 9);
    const choices = ["wall", "goldmine", "arrow"];
    buildForAgent(runData, ai, choices[(Math.random() * choices.length) | 0], ai.x + rand(-45, 45), ai.y + rand(-45, 45));
  }

  ai.x = Math.max(16, Math.min(WORLD_W - 16, ai.x));
  ai.y = Math.max(16, Math.min(WORLD_H - 16, ai.y));
}

function phaseText(runData) {
  return runData.isNight ? `NIGHT ${runData.wave}` : "DAY";
}

function updateHud(runData) {
  const p = runData.player;
  setText("moomooioHud", `${phaseText(runData)} | LOBBY: ${runData.livePlayers + runData.agents.length} (AI: ${runData.agents.length}) | CORE ${Math.max(0, Math.floor(runData.world.baseCore.hp))}`);
  setText("moomooioResources", `AGE ${p.age} (${Math.floor(p.xp)} XP) | WOOD ${Math.floor(p.wood)} | STONE ${Math.floor(p.stone)} | APPLES ${Math.floor(p.food)} | GOLD ${Math.floor(p.cash)}`);
  setText("moomooioScore", `SCORE: ${Math.floor(p.score)}`);
}

function updateCamera(runData) {
  const p = runData.player;
  runData.cameraX = Math.max(0, Math.min(WORLD_W - WIDTH, p.x - WIDTH * 0.5));
  runData.cameraY = Math.max(0, Math.min(WORLD_H - HEIGHT, p.y - HEIGHT * 0.5));
}

function draw(runData) {
  const { ctx } = runData;
  const nightTint = runData.isNight ? "#071018" : "#102012";
  ctx.fillStyle = nightTint;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.translate(-runData.cameraX, -runData.cameraY);

  ctx.strokeStyle = runData.isNight ? "rgba(126,171,255,0.09)" : "rgba(255,255,255,0.07)";
  for (let x = 0; x <= WORLD_W; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD_H);
    ctx.stroke();
  }
  for (let y = 0; y <= WORLD_H; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_W, y);
    ctx.stroke();
  }

  const core = runData.world.baseCore;
  ctx.fillStyle = "#d7b043";
  ctx.beginPath();
  ctx.arc(core.x, core.y, 22, 0, Math.PI * 2);
  ctx.fill();

  for (const res of runData.world.resources) {
    if (res.type === "tree") {
      ctx.fillStyle = "#3a8b3a";
      ctx.beginPath();
      ctx.arc(res.x, res.y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6e4b2a";
      ctx.fillRect(res.x - 4, res.y + 8, 8, 14);
    } else if (res.type === "rock") {
      ctx.fillStyle = "#8a8e97";
      ctx.beginPath();
      ctx.arc(res.x, res.y, 17, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#c94747";
      ctx.beginPath();
      ctx.arc(res.x, res.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6cbf57";
      ctx.fillRect(res.x - 1, res.y - 13, 2, 5);
    }
  }

  for (const s of runData.world.structures) {
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x - 14, s.y - 14, 28, 28);
  }

  for (const z of runData.world.zombies) {
    ctx.fillStyle = "#86e15f";
    ctx.beginPath();
    ctx.arc(z.x, z.y, 11, 0, Math.PI * 2);
    ctx.fill();
  }

  const allPlayers = [runData.player, ...runData.agents, ...Object.values(runData.remotePlayers)];
  for (const agent of allPlayers) {
    ctx.fillStyle = agent.isHuman ? "#f5d76e" : agent.ai ? "#66b8ff" : "#ffa95e";
    ctx.beginPath();
    ctx.arc(agent.x, agent.y, 12, 0, Math.PI * 2);
    ctx.fill();

    const swingBoost = agent.swing > 0 ? Math.sin((agent.swing / 0.22) * Math.PI) * 12 : 0;
    const axeLen = 17 + swingBoost;
    ctx.strokeStyle = "#d5d7de";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(agent.x, agent.y);
    ctx.lineTo(agent.x + Math.cos(agent.facing) * axeLen, agent.y + Math.sin(agent.facing) * axeLen);
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = "10px monospace";
    ctx.fillText(`${agent.name} A${agent.age || 1}`, agent.x - 28, agent.y - 18);
  }

  ctx.restore();
}

function doIncomeTick(runData) {
  for (const agent of [runData.player, ...runData.agents]) {
    const own = runData.world.structures.filter((s) => s.ownerId === agent.id);
    const mines = own.filter((s) => s.type === "goldmine").length;
    agent.cash += mines * 6 + agent.age * 0.8;
    agent.score += mines * 2;
  }
  updateHighScore("moomooio", Math.floor(runData.player.score));
  updateHud(runData);
}

function handleBuildShortcut(runData, code) {
  const p = runData.player;
  const fx = p.x + Math.cos(p.facing) * 30;
  const fy = p.y + Math.sin(p.facing) * 30;
  if (code === "Digit1") buildForAgent(runData, p, "wall", fx, fy);
  if (code === "Digit2") buildForAgent(runData, p, "goldmine", fx, fy);
  if (code === "Digit3") buildForAgent(runData, p, "arrow", fx, fy);
  if (code === "Digit4") buildForAgent(runData, p, "cannon", fx, fy);
  if (code === "Digit5") buildForAgent(runData, p, "bomb", fx, fy);
}

function setupNetworking(runData) {
  if (runData.mode !== "online" || typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(NETWORK_ROOM);
  runData.channel = channel;

  channel.onmessage = (event) => {
    const msg = event.data;
    if (!msg || msg.sender === runData.player.id) return;
    if (msg.type === "state") {
      runData.remotePlayers[msg.sender] = {
        id: msg.sender,
        name: msg.name,
        x: msg.x,
        y: msg.y,
        age: msg.age,
        isHuman: false,
        ai: false,
        swing: msg.swing || 0,
        facing: msg.facing || 0,
      };
    }
    if (msg.type === "leave") delete runData.remotePlayers[msg.sender];
  };
}

function runDayNight(runData, dt) {
  runData.phaseTimer -= dt;
  if (runData.phaseTimer > 0) return;
  runData.isNight = !runData.isNight;
  if (runData.isNight) {
    runData.wave += 1;
    runData.phaseTimer = NIGHT_LENGTH;
    const count = 10 + runData.wave * 3;
    for (let i = 0; i < count; i++) runData.world.zombies.push(makeZombie(runData.wave));
    showToast(`NIGHT ${runData.wave}: ZOMBIES APPROACH`, "🌙");
  } else {
    runData.phaseTimer = DAY_LENGTH;
    showToast("DAYTIME: REBUILD & FARM", "☀️");
  }
}

export function initMooMooIo() {
  stopMooMooIo();
  state.currentGame = "moomooio";

  const canvas = document.getElementById("moomooioCanvas");
  const action = document.getElementById("moomooioAction");
  const modeToggle = document.getElementById("moomooioMode");
  if (!canvas || !action || !modeToggle) return;
  const ctx = canvas.getContext("2d");

  const mode = modeToggle.value || "online";
  const playerName = `YOU_${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const player = makeAgent(playerName, true);
  const aiCount = mode === "offline" ? 10 : 6;
  const agents = Array.from({ length: aiCount }, (_, i) => makeAgent(`AI_${i + 1}`));

  const runData = {
    canvas,
    ctx,
    mode,
    world: createWorld(player.id),
    agents,
    player,
    remotePlayers: {},
    livePlayers: 1,
    isNight: false,
    wave: 0,
    phaseTimer: DAY_LENGTH,
    pressed: new Set(),
    cameraX: 0,
    cameraY: 0,
    lastTs: performance.now(),
    raf: 0,
    tickInterval: 0,
    incomeInterval: 0,
    channel: null,
    onKeyDown: null,
    onKeyUp: null,
  };

  action.disabled = false;
  action.textContent = "RESTART RAID";
  action.onclick = () => initMooMooIo();

  modeToggle.onchange = () => showToast("RESTART MATCH TO SWITCH MODE", "ℹ️");

  const onKeyDown = (event) => {
    runData.pressed.add(event.code);
    if (["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"].includes(event.code)) handleBuildShortcut(runData, event.code);
    if (event.code === "Space") {
      event.preventDefault();
      swingAxe(runData, player);
    }
  };

  const onKeyUp = (event) => runData.pressed.delete(event.code);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  runData.onKeyDown = onKeyDown;
  runData.onKeyUp = onKeyUp;

  runData.tickInterval = window.setInterval(() => doIncomeTick(runData), 1000);
  runData.incomeInterval = window.setInterval(() => {
    while (runData.world.resources.length < 170) runData.world.resources.push(spawnResource(runData.world.nextResourceId++));
  }, 1800);

  setupNetworking(runData);

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
      player.facing = Math.atan2(moveY, moveX);
      player.x += (moveX / mag) * PLAYER_SPEED * dt;
      player.y += (moveY / mag) * PLAYER_SPEED * dt;
    }

    player.swing = Math.max(0, player.swing - dt);
    player.x = Math.max(16, Math.min(WORLD_W - 16, player.x));
    player.y = Math.max(16, Math.min(WORLD_H - 16, player.y));

    for (const agent of runData.agents) processAi(runData, agent, dt);
    runDayNight(runData, dt);
    applyTowerDefenses(runData, dt);
    updateZombies(runData, dt);

    if (runData.world.baseCore.hp <= 0) {
      showToast("CORE DESTROYED", "💀");
      stopMooMooIo();
      return;
    }

    if (runData.channel) {
      runData.channel.postMessage({
        type: "state",
        sender: player.id,
        name: player.name,
        x: player.x,
        y: player.y,
        age: player.age,
        facing: player.facing,
        swing: player.swing,
      });
      runData.livePlayers = 1 + Object.keys(runData.remotePlayers).length;
    }

    updateCamera(runData);
    draw(runData);
    updateHud(runData);
    runData.raf = requestAnimationFrame(frame);
  };

  run = runData;
  updateHud(runData);
  runData.raf = requestAnimationFrame(frame);
}

registerGameStop("moomooio", stopMooMooIo);
