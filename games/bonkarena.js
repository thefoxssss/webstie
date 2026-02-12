// Firebase-backed multiplayer physics arena inspired by bonk-style gameplay.
import { registerGameStop, setText, showToast, state, firebase } from "../core.js";

const { doc, setDoc, getDoc, updateDoc, onSnapshot, runTransaction } = firebase;

const ROOM_PREFIX = "ba_";
const MAX_PLAYERS = 4;
const TICK_MS = 1000 / 30;
const MOVE_ACCEL = 0.75;
const FRICTION = 0.92;
const BUMP_FORCE = 1.45;
const START_RADIUS = 230;
const SHRINK_PER_SEC = 3.6;
const PLAYER_RADIUS = 16;

let roomCode = null;
let myPlayerId = null;
let isHost = false;
let unsubRoom = null;
let hostLoop = null;
let localState = null;
let keyState = { up: false, down: false, left: false, right: false };

function roomRef(code) {
  return doc(firebase.db, "gooner_terminal_rooms", ROOM_PREFIX + code);
}

function randomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function arenaCenter() {
  return { x: 390, y: 230 };
}

function makeSpawn(index) {
  const { x, y } = arenaCenter();
  const angle = (Math.PI * 2 * index) / MAX_PLAYERS;
  return {
    x: x + Math.cos(angle) * 110,
    y: y + Math.sin(angle) * 110,
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
  setText("baHint", "WASD / ARROWS TO DASH");
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
  setText("baStatus", aliveCount > 1 ? "SURVIVE THE SHRINK" : "ROUND COMPLETE");
  setText("baHint", "BUMP OTHERS OUTSIDE THE RING");
  setText("baWinner", data.winner ? `WINNER: ${data.winner}` : "");
  setText("baRadius", Math.max(0, Math.floor(data.arenaRadius || 0)));
  drawArena(data);
}

function drawArena(data) {
  const cv = document.getElementById("baCanvas");
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(0, 0, cv.width, cv.height);

  const { x: cx, y: cy } = arenaCenter();
  const arenaRadius = data.arenaRadius || START_RADIUS;
  ctx.beginPath();
  ctx.arc(cx, cy, arenaRadius, 0, Math.PI * 2);
  ctx.strokeStyle = "#ff0606";
  ctx.lineWidth = 4;
  ctx.shadowBlur = 15;
  ctx.shadowColor = "#ff0606";
  ctx.stroke();
  ctx.shadowBlur = 0;

  Object.entries(data.players || {}).forEach(([id, p], idx) => {
    const mine = id === myPlayerId;
    ctx.beginPath();
    ctx.arc(p.x || 0, p.y || 0, p.radius || PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = mine ? "#00ff9d" : ["#ffd700", "#4da3ff", "#ff5ea8", "#ffaa4d"][idx % 4];
    ctx.globalAlpha = p.alive ? 1 : 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = "12px 'Roboto Mono'";
    ctx.fillStyle = "#fff";
    ctx.fillText(p.name || id, (p.x || 0) - 22, (p.y || 0) - 22);
  });
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
  const { x: cx, y: cy } = arenaCenter();

  Object.keys(players).forEach((id) => {
    const p = players[id];
    if (!p.alive) return;
    const input = inputs[id] || {};
    const ax = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const ay = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    p.vx = (p.vx + ax * MOVE_ACCEL) * FRICTION;
    p.vy = (p.vy + ay * MOVE_ACCEL) * FRICTION;
    p.x += p.vx;
    p.y += p.vy;
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
    const distToCenter = Math.hypot((p.x || 0) - cx, (p.y || 0) - cy);
    if (distToCenter > radius + 8) {
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
