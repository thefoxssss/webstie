// Firebase-backed multiplayer physics arena inspired by bonk-style gameplay.
import { registerGameStop, setText, showToast, state, firebase } from "../core.js";

const { doc, setDoc, getDoc, updateDoc, onSnapshot, runTransaction } = firebase;

const ROOM_PREFIX = "ba_";
const MAX_PLAYERS = 4;
const TICK_MS = 1000 / 40;
const MOVE_ACCEL = 0.8;
const AIR_CONTROL = 0.45;
const FRICTION = 0.86;
const GRAVITY = 0.65;
const JUMP_FORCE = 11.5;
const BUMP_FORCE = 2.3;
const BOUNCE_RESTITUTION = 0.88;
const START_RADIUS = 280;
const SHRINK_PER_SEC = 3.1;
const PLAYER_RADIUS = 16;
const FLOOR_Y = 388;
const CEIL_Y = 46;
const LEFT_WALL = 42;
const RIGHT_WALL = 738;
const CLIENT_PREDICTION_MS = 70;

let roomCode = null;
let myPlayerId = null;
let isHost = false;
let unsubRoom = null;
let hostLoop = null;
let localState = null;
let lastSnapshotAt = 0;
let keyState = { up: false, down: false, left: false, right: false };

function roomRef(code) {
  return doc(firebase.db, "gooner_terminal_rooms", ROOM_PREFIX + code);
}

function randomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function arenaCenter() {
  return { x: (LEFT_WALL + RIGHT_WALL) / 2, y: FLOOR_Y };
}

function makeSpawn(index) {
  const { x, y } = arenaCenter();
  const angle = (Math.PI * 2 * index) / MAX_PLAYERS;
  return {
    x: x + Math.cos(angle) * 190,
    y: FLOOR_Y - 140 - Math.sin(angle) * 55,
  };
}

function makePlayer(uid, name, index) {
  const spawn = makeSpawn(index);
  return {
    uid,
    name,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    radius: PLAYER_RADIUS,
    grounded: false,
    alive: true,
    score: 0,
  };
}

function resetOverlay() {
  state.currentGame = "bonk";
  document.getElementById("baMenu").style.display = "flex";
  document.getElementById("baLobby").style.display = "none";
  document.getElementById("baGame").style.display = "none";
  setText("baStatus", "CREATE OR JOIN A ROOM");
  setText("baLobbyStatus", "CREATE OR JOIN A ROOM");
  setText("baHint", "LEFT/RIGHT TO MOVE • UP TO JUMP");
  setText("baWinner", "");
  const joinInput = document.getElementById("joinBACode");
  if (joinInput) joinInput.value = "";
  localState = null;
}

export function initBonkArena() {
  stopSession();
  resetOverlay();
}

function stopSession() {
  if (unsubRoom) unsubRoom();
  if (hostLoop) clearInterval(hostLoop);
  unsubRoom = null;
  hostLoop = null;
  roomCode = null;
  myPlayerId = null;
  isHost = false;
}

async function createRoom() {
  if (!state.myUid) return alert("OFFLINE");
  const code = randomCode();
  const ref = roomRef(code);
  myPlayerId = "p1";
  await setDoc(ref, {
    code,
    hostUid: state.myUid,
    status: "lobby",
    createdAt: Date.now(),
    startedAt: 0,
    arenaRadius: START_RADIUS,
    winner: "",
    players: {
      p1: makePlayer(state.myUid, state.myName, 0),
    },
    inputs: {
      p1: { up: false, down: false, left: false, right: false, ts: Date.now() },
    },
  });
  joinRoom(code, "p1", true);
}

async function joinRoomByCode() {
  const code = String(document.getElementById("joinBACode").value || "").trim();
  if (!code) return;
  const ref = roomRef(code);
  await runTransaction(firebase.db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) throw new Error("ROOM_404");
    const data = snap.data();
    if (data.status !== "lobby") throw new Error("MATCH_RUNNING");
    const players = data.players || {};
    const taken = Object.keys(players);
    if (taken.length >= MAX_PLAYERS) throw new Error("ROOM_FULL");
    const existing = taken.find((id) => players[id]?.uid === state.myUid);
    const pid = existing || `p${taken.length + 1}`;
    if (!existing) {
      players[pid] = makePlayer(state.myUid, state.myName, taken.length);
    }
    const inputs = data.inputs || {};
    inputs[pid] = { up: false, down: false, left: false, right: false, ts: Date.now() };
    t.update(ref, { players, inputs });
    myPlayerId = pid;
  }).then(() => {
    joinRoom(code, myPlayerId, false);
  }).catch((err) => {
    const msg = String(err?.message || "JOIN_FAILED");
    if (msg.includes("ROOM_404")) return alert("ROOM NOT FOUND");
    if (msg.includes("MATCH_RUNNING")) return alert("MATCH ALREADY STARTED");
    if (msg.includes("ROOM_FULL")) return alert("ROOM FULL");
    alert("FAILED TO JOIN ROOM");
  });
}

function joinRoom(code, pid, host) {
  roomCode = code;
  myPlayerId = pid;
  isHost = host;
  document.getElementById("baMenu").style.display = "none";
  document.getElementById("baLobby").style.display = "flex";
  setText("baRoomId", code);
  subscribeRoom();
}

function subscribeRoom() {
  if (unsubRoom) unsubRoom();
  unsubRoom = onSnapshot(roomRef(roomCode), (snap) => {
    if (!snap.exists()) {
      showToast("ROOM CLOSED", "⚠️");
      initBonkArena();
      return;
    }
    const data = snap.data();
    localState = data;
    lastSnapshotAt = performance.now();
    renderState(data);
    if (data.status === "playing" && isHost && !hostLoop) {
      startHostSim();
    }
    if (data.status !== "playing" && hostLoop) {
      clearInterval(hostLoop);
      hostLoop = null;
    }
  });
}

function renderState(data) {
  const players = data.players || {};
  const list = Object.entries(players)
    .map(([id, p]) => `<div>${id.toUpperCase()}: ${p.name}${p.alive ? "" : " ☠"}</div>`)
    .join("");
  document.getElementById("baPList").innerHTML = list || "<div>NO PLAYERS</div>";

  const status = data.status || "lobby";
  if (status === "lobby") {
    document.getElementById("baLobby").style.display = "flex";
    document.getElementById("baGame").style.display = "none";
    const canStart = isHost && Object.keys(players).length >= 2;
    document.getElementById("baStartBtn").style.display = canStart ? "inline-block" : "none";
    setText("baLobbyStatus", canStart ? "HOST CAN START" : "WAITING FOR PLAYERS");
    return;
  }

  document.getElementById("baLobby").style.display = "none";
  document.getElementById("baGame").style.display = "flex";
  const aliveCount = Object.values(players).filter((p) => p.alive).length;
  setText("baStatus", aliveCount > 1 ? "BOUNCE + SURVIVE" : "ROUND COMPLETE");
  setText("baHint", "LEFT/RIGHT TO MOVE • UP TO JUMP • KNOCK OTHERS OUT");
  setText("baWinner", data.winner ? `WINNER: ${data.winner}` : "");
  setText("baRadius", Math.max(0, Math.floor(data.arenaRadius || 0)));
  drawArena(data);
}

function drawArena(data) {
  const cv = document.getElementById("baCanvas");
  const ctx = cv.getContext("2d");
  const drawState = getClientRenderState(data);
  ctx.clearRect(0, 0, cv.width, cv.height);
  const grad = ctx.createLinearGradient(0, 0, 0, cv.height);
  grad.addColorStop(0, "#1f2644");
  grad.addColorStop(1, "#0a0a10");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cv.width, cv.height);

  const safeRadius = drawState.arenaRadius || START_RADIUS;
  const leftBound = Math.max(LEFT_WALL, arenaCenter().x - safeRadius);
  const rightBound = Math.min(RIGHT_WALL, arenaCenter().x + safeRadius);

  ctx.fillStyle = "rgba(255, 10, 10, 0.12)";
  ctx.fillRect(LEFT_WALL, CEIL_Y, leftBound - LEFT_WALL, FLOOR_Y - CEIL_Y + 28);
  ctx.fillRect(rightBound, CEIL_Y, RIGHT_WALL - rightBound, FLOOR_Y - CEIL_Y + 28);

  ctx.strokeStyle = "#ff2222";
  ctx.lineWidth = 3;
  ctx.shadowBlur = 16;
  ctx.shadowColor = "#ff4444";
  ctx.strokeRect(leftBound, CEIL_Y, rightBound - leftBound, FLOOR_Y - CEIL_Y);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#2e3044";
  ctx.fillRect(LEFT_WALL, FLOOR_Y, RIGHT_WALL - LEFT_WALL, 30);
  ctx.fillStyle = "#4b506d";
  for (let x = LEFT_WALL + 4; x < RIGHT_WALL; x += 28) {
    ctx.fillRect(x, FLOOR_Y + 4, 18, 3);
  }

  Object.entries(drawState.players || {}).forEach(([id, p], idx) => {
    const mine = id === myPlayerId;
    const px = p.x || 0;
    const py = p.y || 0;
    const bodyH = (p.radius || PLAYER_RADIUS) * 2;
    const bodyW = (p.radius || PLAYER_RADIUS) * 1.45;
    const headR = (p.radius || PLAYER_RADIUS) * 0.62;
    ctx.beginPath();
    ctx.roundRect(px - bodyW / 2, py - bodyH, bodyW, bodyH, 8);
    ctx.fillStyle = mine ? "#00ff9d" : ["#ffd700", "#4da3ff", "#ff5ea8", "#ffaa4d"][idx % 4];
    ctx.globalAlpha = p.alive ? 1 : 0.3;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py - bodyH - headR * 0.2, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = "12px 'Roboto Mono'";
    ctx.fillStyle = "#fff";
    ctx.fillText(p.name || id, px - 22, py - bodyH - 20);
  });
}

function getClientRenderState(data) {
  if (isHost || data.status !== "playing") return data;
  if (!myPlayerId || !data.players?.[myPlayerId]) return data;
  const elapsed = Math.min(CLIENT_PREDICTION_MS, performance.now() - lastSnapshotAt);
  if (elapsed <= 0) return data;
  const copy = structuredClone(data);
  const me = copy.players[myPlayerId];
  if (!me.alive) return copy;
  simulatePlayerStep(me, keyState, elapsed / TICK_MS, copy.arenaRadius || START_RADIUS);
  return copy;
}

async function startRound() {
  if (!isHost || !roomCode) return;
  const ref = roomRef(roomCode);
  await runTransaction(firebase.db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const ids = Object.keys(data.players || {});
    if (ids.length < 2) return;
    const players = { ...data.players };
    ids.forEach((id, i) => {
      const spawn = makeSpawn(i);
      players[id] = {
        ...players[id],
        x: spawn.x,
        y: spawn.y,
        vx: 0,
        vy: 0,
        grounded: false,
        alive: true,
      };
    });
    t.update(ref, {
      status: "playing",
      startedAt: Date.now(),
      arenaRadius: START_RADIUS,
      winner: "",
      players,
    });
  });
}

function startHostSim() {
  if (!isHost || hostLoop || !roomCode) return;
  hostLoop = setInterval(async () => {
    if (!localState || localState.status !== "playing") return;
    const next = simulateTick(localState);
    try {
      await updateDoc(roomRef(roomCode), {
        players: next.players,
        arenaRadius: next.arenaRadius,
        winner: next.winner,
        status: next.status,
      });
    } catch {
      // ignore race errors, next snapshot keeps us in sync.
    }
  }, TICK_MS);
}

function simulateTick(data) {
  const players = structuredClone(data.players || {});
  const inputs = data.inputs || {};
  const radius = Math.max(40, (data.arenaRadius || START_RADIUS) - SHRINK_PER_SEC / 30);
  const { x: cx } = arenaCenter();
  const leftBound = Math.max(LEFT_WALL, cx - radius);
  const rightBound = Math.min(RIGHT_WALL, cx + radius);

  Object.keys(players).forEach((id) => {
    const p = players[id];
    if (!p.alive) return;
    const input = inputs[id] || {};
    simulatePlayerStep(p, input, 1, radius);

    if (p.x - p.radius < leftBound) {
      p.x = leftBound + p.radius;
      p.vx = Math.abs(p.vx) * BOUNCE_RESTITUTION;
    }
    if (p.x + p.radius > rightBound) {
      p.x = rightBound - p.radius;
      p.vx = -Math.abs(p.vx) * BOUNCE_RESTITUTION;
    }
    if (p.y - p.radius < CEIL_Y) {
      p.y = CEIL_Y + p.radius;
      p.vy = Math.abs(p.vy) * 0.65;
    }
  });

  const ids = Object.keys(players);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = players[ids[i]];
      const b = players[ids[j]];
      if (!a.alive || !b.alive) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const minDist = (a.radius || PLAYER_RADIUS) + (b.radius || PLAYER_RADIUS);
      if (dist < minDist) {
        const nx = dx / dist;
        const ny = dy / dist;
        const push = (minDist - dist) * 0.55;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        a.vx -= nx * BUMP_FORCE;
        a.vy -= ny * BUMP_FORCE;
        b.vx += nx * BUMP_FORCE;
        b.vy += ny * BUMP_FORCE;
      }
    }
  }

  ids.forEach((id) => {
    const p = players[id];
    if (!p.alive) return;
    const outX = p.x < leftBound - p.radius - 8 || p.x > rightBound + p.radius + 8;
    const outBottom = p.y > FLOOR_Y + 34;
    if (outX || outBottom) {
      p.alive = false;
      p.vx = 0;
      p.vy = 0;
    }
  });

  const survivors = Object.values(players).filter((p) => p.alive);
  let winner = "";
  let status = "playing";
  if (survivors.length <= 1) {
    status = "finished";
    winner = survivors[0]?.name || "NO ONE";
  }

  return { players, arenaRadius: radius, winner, status };
}

function simulatePlayerStep(player, input, dt, radius) {
  const move = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const control = player.grounded ? MOVE_ACCEL : AIR_CONTROL;
  player.vx += move * control * dt;
  player.vx *= Math.pow(FRICTION, dt);

  if (input.up && player.grounded) {
    player.vy = -JUMP_FORCE;
    player.grounded = false;
  }
  player.vy += GRAVITY * dt;

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  const floor = FLOOR_Y - (player.radius || PLAYER_RADIUS);
  if (player.y >= floor) {
    player.y = floor;
    if (Math.abs(player.vy) > 2.4) {
      player.vy = -Math.abs(player.vy) * BOUNCE_RESTITUTION;
      player.grounded = false;
    } else {
      player.vy = 0;
      player.grounded = true;
    }
  }

  if (radius < 50) {
    player.vx *= 0.96;
  }
}

async function publishInput() {
  if (!roomCode || !myPlayerId || !localState || localState.status !== "playing") return;
  try {
    await updateDoc(roomRef(roomCode), {
      [`inputs.${myPlayerId}`]: { ...keyState, ts: Date.now() },
    });
  } catch {
    // ignore momentary connection issues.
  }
}

function onKeyChange(down, key) {
  if (state.currentGame !== "bonk") return;
  const upKey = key.toLowerCase();
  let changed = false;
  if (["w", "arrowup"].includes(upKey)) {
    changed = keyState.up !== down;
    keyState.up = down;
  }
  if (["s", "arrowdown"].includes(upKey)) {
    changed = keyState.down !== down;
    keyState.down = down;
  }
  if (["a", "arrowleft"].includes(upKey)) {
    changed = keyState.left !== down;
    keyState.left = down;
  }
  if (["d", "arrowright"].includes(upKey)) {
    changed = keyState.right !== down;
    keyState.right = down;
  }
  if (changed) publishInput();
}

document.addEventListener("keydown", (e) => onKeyChange(true, e.key));
document.addEventListener("keyup", (e) => onKeyChange(false, e.key));

document.getElementById("btnCreateBA").onclick = createRoom;
document.getElementById("btnJoinBA").onclick = joinRoomByCode;
document.getElementById("baStartBtn").onclick = startRound;
document.getElementById("baReplayBtn").onclick = async () => {
  if (!isHost || !roomCode) return;
  await startRound();
};

registerGameStop(() => {
  keyState = { up: false, down: false, left: false, right: false };
  stopSession();
});
