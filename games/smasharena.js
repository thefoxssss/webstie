// Smash-style platform fighter with local bot mode and Firebase online duels.
import { registerGameStop, setText, showToast, state, firebase } from "../core.js";

const { doc, setDoc, onSnapshot, runTransaction, updateDoc } = firebase;
const ROOM_PREFIX = "sa_";
const GRAVITY = 0.72;
const FRICTION = 0.86;
const GROUND_Y = 380;
const LEFT_EDGE = 28;
const RIGHT_EDGE = 752;
const TICK_MS = 1000 / 40;

let roomCode = null;
let myPlayerId = null;
let isHost = false;
let unsub = null;
let hostLoop = null;
let localLoop = null;
let localState = null;
let aiMode = false;
const keys = { left: false, right: false, up: false, atk: false };

function roomRef(code) {
  return doc(firebase.db, "gooner_terminal_rooms", ROOM_PREFIX + code);
}

function randomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function makeFighter(uid, name, side) {
  return {
    uid,
    name,
    x: side === "left" ? 220 : 560,
    y: 280,
    vx: 0,
    vy: 0,
    facing: side === "left" ? 1 : -1,
    jumps: 2,
    hp: 0,
    stun: 0,
    alive: true,
    atkCd: 0,
    color: side === "left" ? "#5ef2ff" : "#ff6cf8",
  };
}

function makeInput() {
  return { left: false, right: false, up: false, atk: false, ts: Date.now() };
}

function resetOverlay() {
  state.currentGame = "smasharena";
  document.getElementById("saMenu").style.display = "flex";
  document.getElementById("saLobby").style.display = "none";
  document.getElementById("saGame").style.display = "none";
  setText("saHudStatus", "PRACTICE YOUR MOVES");
  setText("saRoomId", "----");
  setText("saLobbyStatus", "CREATE OR JOIN");
  setText("saKO", "0 - 0");
  setText("saHint", "A/D MOVE • W JUMP • SPACE SMASH");
}

export function initSmashArena() {
  stopSession();
  resetOverlay();
}

function stopSession() {
  if (unsub) unsub();
  if (hostLoop) clearInterval(hostLoop);
  if (localLoop) clearInterval(localLoop);
  unsub = null;
  hostLoop = null;
  localLoop = null;
  roomCode = null;
  myPlayerId = null;
  isHost = false;
  aiMode = false;
  localState = null;
}

function aiInput(me, enemy) {
  if (!me?.alive || !enemy?.alive) return makeInput();
  return {
    left: enemy.x < me.x - 15,
    right: enemy.x > me.x + 15,
    up: Math.random() < 0.08 && me.jumps > 0,
    atk: Math.abs(enemy.x - me.x) < 70 && Math.abs(enemy.y - me.y) < 40 && Math.random() < 0.24,
    ts: Date.now(),
  };
}

function stepPlayer(p, input) {
  if (!p || !p.alive) return;
  if (p.stun > 0) p.stun -= 1;
  if (p.atkCd > 0) p.atkCd -= 1;
  const accel = p.stun > 0 ? 0.12 : 0.7;
  if (input.left) {
    p.vx -= accel;
    p.facing = -1;
  }
  if (input.right) {
    p.vx += accel;
    p.facing = 1;
  }
  if (input.up && p.jumps > 0 && p.stun <= 0) {
    p.vy = -11.8;
    p.jumps -= 1;
  }
  p.vy += GRAVITY;
  p.vx *= FRICTION;
  p.x += p.vx;
  p.y += p.vy;
  if (p.y >= GROUND_Y) {
    p.y = GROUND_Y;
    p.vy = 0;
    p.jumps = 2;
  }
  if (p.x < LEFT_EDGE) p.x = LEFT_EDGE;
  if (p.x > RIGHT_EDGE) p.x = RIGHT_EDGE;
}

function applyCombat(attacker, defender, input) {
  if (!attacker?.alive || !defender?.alive) return;
  if (!input.atk || attacker.atkCd > 0 || attacker.stun > 0) return;
  const rangeX = 72;
  const inFront = attacker.facing > 0 ? defender.x >= attacker.x : defender.x <= attacker.x;
  const dx = Math.abs(defender.x - attacker.x);
  const dy = Math.abs(defender.y - attacker.y);
  if (inFront && dx < rangeX && dy < 42) {
    const force = 5 + attacker.hp * 0.05;
    defender.vx += attacker.facing * force;
    defender.vy = -6 - attacker.hp * 0.02;
    defender.hp += 9;
    defender.stun = 8;
  }
  attacker.atkCd = 14;
}

function respawn(player, side) {
  player.x = side === "left" ? 220 : 560;
  player.y = 260;
  player.vx = 0;
  player.vy = 0;
  player.hp = 0;
  player.jumps = 2;
  player.stun = 0;
}

function simulateTick(match) {
  const players = match.players || {};
  const p1 = players.p1;
  const p2 = players.p2;
  if (!p1 || !p2) return;
  const in1 = match.inputs?.p1 || makeInput();
  const in2 = match.inputs?.p2 || makeInput();

  stepPlayer(p1, in1);
  stepPlayer(p2, in2);
  applyCombat(p1, p2, in1);
  applyCombat(p2, p1, in2);

  if (p1.y > 520 || p1.x < -100 || p1.x > 900) {
    match.score.p2 += 1;
    respawn(p1, "left");
  }
  if (p2.y > 520 || p2.x < -100 || p2.x > 900) {
    match.score.p1 += 1;
    respawn(p2, "right");
  }

  if (match.score.p1 >= 3 || match.score.p2 >= 3) {
    match.status = "finished";
    match.winner = match.score.p1 > match.score.p2 ? p1.name : p2.name;
  }
}

function render(stateData) {
  const canvas = document.getElementById("saCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const p1 = stateData.players?.p1;
  const p2 = stateData.players?.p2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#170b2f");
  sky.addColorStop(1, "#06070f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 26; i += 1) {
    ctx.fillStyle = `rgba(120,180,255,${0.04 + (i % 5) * 0.02})`;
    ctx.fillRect((i * 57 + (Date.now() * 0.02) % 120) % canvas.width, (i * 19) % 220, 4, 4);
  }

  ctx.strokeStyle = "#71f8ff";
  ctx.lineWidth = 4;
  ctx.shadowBlur = 16;
  ctx.shadowColor = "#35d7ff";
  ctx.beginPath();
  ctx.moveTo(120, GROUND_Y + 22);
  ctx.lineTo(660, GROUND_Y + 22);
  ctx.stroke();
  ctx.shadowBlur = 0;

  [p1, p2].forEach((p) => {
    if (!p) return;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.font = "12px monospace";
    ctx.fillText(`${Math.floor(p.hp)}%`, p.x - 14, p.y - 28);
  });

  setText("saKO", `${stateData.score?.p1 || 0} - ${stateData.score?.p2 || 0}`);
  if (stateData.status === "finished") {
    setText("saHudStatus", `${stateData.winner} WINS THE SET`);
  }
}

function subscribeRoom() {
  if (unsub) unsub();
  unsub = onSnapshot(roomRef(roomCode), (snap) => {
    if (!snap.exists()) {
      showToast("ROOM CLOSED", "⚠️");
      initSmashArena();
      return;
    }
    localState = snap.data();
    render(localState);
    if (isHost && localState.status === "playing" && !hostLoop) startHostLoop();
    if (localState.status !== "playing" && hostLoop) {
      clearInterval(hostLoop);
      hostLoop = null;
    }
    document.getElementById("saStartBtn").style.display = isHost && localState.status === "lobby" ? "inline-flex" : "none";
    setText("saLobbyStatus", localState.status === "lobby" ? "WAITING FOR PLAYERS" : "MATCH LIVE");
    const roster = Object.entries(localState.players || {}).map(([id, p]) => `<div>${id.toUpperCase()}: ${p.name}</div>`).join("");
    document.getElementById("saPlayers").innerHTML = roster;
  });
}

function startHostLoop() {
  hostLoop = setInterval(async () => {
    if (!localState || localState.status !== "playing") return;
    const next = structuredClone(localState);
    simulateTick(next);
    next.updatedAt = Date.now();
    localState = next;
    try {
      await updateDoc(roomRef(roomCode), next);
    } catch (_e) {}
  }, TICK_MS);
}

async function createRoom() {
  if (!state.myUid) return showToast("CONNECT TO PLAY ONLINE", "⚠️");
  const code = randomCode();
  await setDoc(roomRef(code), {
    code,
    hostUid: state.myUid,
    status: "lobby",
    winner: "",
    score: { p1: 0, p2: 0 },
    players: { p1: makeFighter(state.myUid, state.myName || "P1", "left") },
    inputs: { p1: makeInput() },
    updatedAt: Date.now(),
  });
  joinRoom(code, "p1", true);
}

async function joinRoomByCode() {
  if (!state.myUid) return showToast("CONNECT TO PLAY ONLINE", "⚠️");
  const code = String(document.getElementById("joinSACode").value || "").trim();
  if (!code) return;
  await runTransaction(firebase.db, async (tx) => {
    const ref = roomRef(code);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("ROOM_NOT_FOUND");
    const data = snap.data();
    if (data.status !== "lobby") throw new Error("MATCH_RUNNING");
    if (data.players?.p2) throw new Error("ROOM_FULL");
    data.players.p2 = makeFighter(state.myUid, state.myName || "P2", "right");
    data.inputs.p2 = makeInput();
    tx.update(ref, { players: data.players, inputs: data.inputs });
  }).then(() => joinRoom(code, "p2", false)).catch((err) => showToast(err.message, "⚠️"));
}

function joinRoom(code, pid, host) {
  roomCode = code;
  myPlayerId = pid;
  isHost = host;
  state.currentGame = "smasharena";
  document.getElementById("saMenu").style.display = "none";
  document.getElementById("saLobby").style.display = "flex";
  document.getElementById("saGame").style.display = "flex";
  setText("saRoomId", code);
  subscribeRoom();
}

function startAIMode() {
  stopSession();
  aiMode = true;
  state.currentGame = "smasharena";
  document.getElementById("saMenu").style.display = "none";
  document.getElementById("saLobby").style.display = "none";
  document.getElementById("saGame").style.display = "flex";
  localState = {
    status: "playing",
    winner: "",
    score: { p1: 0, p2: 0 },
    players: {
      p1: makeFighter(state.myUid || "local", state.myName || "YOU", "left"),
      p2: makeFighter("bot", "BOT", "right"),
    },
    inputs: { p1: makeInput(), p2: makeInput() },
  };
  localLoop = setInterval(() => {
    if (!localState || localState.status !== "playing") return;
    localState.inputs.p1 = { ...keys, ts: Date.now() };
    localState.inputs.p2 = aiInput(localState.players.p2, localState.players.p1);
    simulateTick(localState);
    render(localState);
  }, TICK_MS);
}

async function sendInput() {
  if (aiMode || !roomCode || !myPlayerId || !localState || localState.status !== "playing") return;
  try {
    await updateDoc(roomRef(roomCode), { [`inputs.${myPlayerId}`]: { ...keys, ts: Date.now() } });
  } catch (_e) {}
}

function bindControls() {
  window.addEventListener("keydown", (e) => {
    if (state.currentGame !== "smasharena") return;
    if (e.key === "a" || e.key === "ArrowLeft") keys.left = true;
    if (e.key === "d" || e.key === "ArrowRight") keys.right = true;
    if (e.key === "w" || e.key === "ArrowUp") keys.up = true;
    if (e.key === " ") keys.atk = true;
    sendInput();
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "a" || e.key === "ArrowLeft") keys.left = false;
    if (e.key === "d" || e.key === "ArrowRight") keys.right = false;
    if (e.key === "w" || e.key === "ArrowUp") keys.up = false;
    if (e.key === " ") keys.atk = false;
    sendInput();
  });
}

document.getElementById("btnCreateSA")?.addEventListener("click", createRoom);
document.getElementById("btnJoinSA")?.addEventListener("click", joinRoomByCode);
document.getElementById("btnSAAI")?.addEventListener("click", startAIMode);
document.getElementById("saStartBtn")?.addEventListener("click", async () => {
  if (!roomCode || !isHost) return;
  await updateDoc(roomRef(roomCode), { status: "playing", score: { p1: 0, p2: 0 }, winner: "" });
});
bindControls();
registerGameStop(stopSession);
