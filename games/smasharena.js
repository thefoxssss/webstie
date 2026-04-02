// Smash-style platform fighter with local bot mode and Colyseus online duels.
import { registerGameStop, setText, showToast, state, firebase } from "../core.js";

const { doc, setDoc, onSnapshot, runTransaction, updateDoc } = firebase;
// Colyseus client setup
let colyseusClient = null;
if (typeof Colyseus !== 'undefined') {
  const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
  const wsHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "localhost:2567"
    : "thefoxsss.com";
  colyseusClient = new Colyseus.Client(`${wsProtocol}://${wsHost}`);
}
const GRAVITY = 0.72;
const FRICTION = 0.86;
const GROUND_Y = 380;
const LEFT_EDGE = 28;
const RIGHT_EDGE = 752;
const BLAST_BOTTOM = 545;
const BLAST_LEFT = -140;
const BLAST_RIGHT = 920;
const TICK_MS = 1000 / 40;
const PLATFORM = { x: 390, y: 286, w: 210, h: 14 };

let roomCode = null;
let myPlayerId = null;
let isHost = false;
let colyseusRoom = null; // Used for online play
let localLoop = null;
let localState = null;
let aiMode = false;
let soloMode = false;
const keys = { left: false, right: false, up: false, atk: false };
const keyLatch = { up: false, atk: false };

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
  setText("saHint", "A/D MOVE • W JUMP • SPACE SMASH • FIRST TO 4 KOs");
}

export function initSmashArena() {
  stopSession();
  resetOverlay();
  if (!colyseusClient && typeof Colyseus !== 'undefined') {
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "localhost:2567"
      : "thefoxsss.com";
    colyseusClient = new Colyseus.Client(`${wsProtocol}://${wsHost}`);
  }
}

function stopSession() {
  if (colyseusRoom) {
    colyseusRoom.leave();
    colyseusRoom = null;
  }
  if (localLoop) clearInterval(localLoop);
  localLoop = null;
  roomCode = null;
  myPlayerId = null;
  isHost = false;
  aiMode = false;
  soloMode = false;
  keyLatch.up = false;
  keyLatch.atk = false;
  localState = null;
}

function aiInput(me, enemy, pressure = 1) {
  if (!me?.alive || !enemy?.alive) return makeInput();
  const shouldChase = Math.random() < 0.85 + Math.min(0.1, pressure * 0.03);
  const close = Math.abs(enemy.x - me.x) < 80 && Math.abs(enemy.y - me.y) < 45;
  return {
    left: shouldChase && enemy.x < me.x - 12,
    right: shouldChase && enemy.x > me.x + 12,
    up: (Math.random() < 0.06 + pressure * 0.01 || enemy.y + 20 < me.y) && me.jumps > 0,
    atk: close && Math.random() < 0.22 + pressure * 0.015,
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
  if (input.upPress && p.jumps > 0 && p.stun <= 0) {
    p.vy = -11.8;
    p.jumps -= 1;
  }
  p.vy += GRAVITY;
  p.vx *= FRICTION;
  p.x += p.vx;
  p.y += p.vy;

  const insidePlatform = p.x > PLATFORM.x - PLATFORM.w / 2 && p.x < PLATFORM.x + PLATFORM.w / 2;
  const wasAbovePlatform = p.y - p.vy <= PLATFORM.y - 20;
  const isLandingOnPlatform = p.vy >= 0 && insidePlatform && p.y >= PLATFORM.y - 20 && wasAbovePlatform;
  if (isLandingOnPlatform) {
    p.y = PLATFORM.y - 20;
    p.vy = 0;
    p.jumps = Math.max(p.jumps, 1);
  }

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
  if (!input.atkPress || attacker.atkCd > 0 || attacker.stun > 0) return;
  const rangeX = 72;
  const inFront = attacker.facing > 0 ? defender.x >= attacker.x : defender.x <= attacker.x;
  const dx = Math.abs(defender.x - attacker.x);
  const dy = Math.abs(defender.y - attacker.y);
  if (inFront && dx < rangeX && dy < 44) {
    const force = 5 + attacker.hp * 0.05;
    defender.vx += attacker.facing * force;
    defender.vy = -6 - attacker.hp * 0.02;
    defender.hp += 10;
    defender.stun = 9;
  }
  attacker.atkCd = 11;
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

  if (p1.y > BLAST_BOTTOM || p1.x < BLAST_LEFT || p1.x > BLAST_RIGHT) {
    match.score.p2 += 1;
    respawn(p1, "left");
    setText("saHudStatus", `${p1.name} WAS LAUNCHED`);
  }
  if (p2.y > BLAST_BOTTOM || p2.x < BLAST_LEFT || p2.x > BLAST_RIGHT) {
    match.score.p1 += 1;
    respawn(p2, "right");
    setText("saHudStatus", `${p2.name} WAS LAUNCHED`);
  }

  const koTarget = match.koTarget || 4;
  if (match.score.p1 >= koTarget || match.score.p2 >= koTarget) {
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
  ctx.fillStyle = "rgba(127,245,255,0.22)";
  ctx.fillRect(PLATFORM.x - PLATFORM.w / 2, PLATFORM.y, PLATFORM.w, PLATFORM.h);
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

  const target = stateData.koTarget || (soloMode ? 6 : 4);
  setText("saKO", `${stateData.score?.p1 || 0} - ${stateData.score?.p2 || 0} / ${target}`);
  if (stateData.status === "finished") {
    const suffix = stateData.mode === "solo" ? "CLEARS SOLO MODE" : "WINS THE SET";
    setText("saHudStatus", `${stateData.winner} ${suffix}`);
  }
}

function handleColyseusStateChange(stateData) {
  localState = stateData.toJSON(); // Convert MapSchema and other Schema types to plain objects
  render(localState);
  document.getElementById("saStartBtn").style.display = isHost && localState.status === "lobby" ? "inline-flex" : "none";
  setText("saLobbyStatus", localState.status === "lobby" ? "WAITING FOR PLAYERS" : "MATCH LIVE");
  const roster = Object.entries(localState.players || {}).map(([id, p]) => `<div>${id.toUpperCase()}: ${p.name}</div>`).join("");
  document.getElementById("saPlayers").innerHTML = roster;
}

async function createRoom() {
  if (!state.myUid) return showToast("CONNECT TO PLAY ONLINE", "⚠️");
  if (!colyseusClient) return showToast("COLYSEUS OFFLINE", "⚠️");
  try {
    colyseusRoom = await colyseusClient.create("smash_arena", {
      uid: state.myUid,
      name: state.myName || "P1"
    });
    isHost = true;
    joinColyseusRoom(colyseusRoom);
  } catch (e) {
    showToast("Failed to create room.", "⚠️");
  }
}

async function joinRoomByCode() {
  if (!state.myUid) return showToast("CONNECT TO PLAY ONLINE", "⚠️");
  if (!colyseusClient) return showToast("COLYSEUS OFFLINE", "⚠️");
  const code = String(document.getElementById("joinSACode").value || "").trim();
  if (!code) return;
  try {
    colyseusRoom = await colyseusClient.joinById(code, {
      uid: state.myUid,
      name: state.myName || "P2"
    });
    isHost = false;
    joinColyseusRoom(colyseusRoom);
  } catch (e) {
    showToast("ROOM NOT FOUND OR FULL", "⚠️");
  }
}

function joinColyseusRoom(room) {
  roomCode = room.id;
  myPlayerId = isHost ? "p1" : "p2";
  state.currentGame = "smasharena";

  document.getElementById("saMenu").style.display = "none";
  document.getElementById("saLobby").style.display = "flex";
  document.getElementById("saGame").style.display = "flex";
  setText("saRoomId", roomCode);

  room.onStateChange((newState) => {
    handleColyseusStateChange(newState);
  });

  room.onMessage("hudMessage", (message) => {
    setText("saHudStatus", message);
  });

  room.onLeave((code) => {
    showToast("ROOM CLOSED", "⚠️");
    initSmashArena();
  });
}

function startAIMode() {
  stopSession();
  aiMode = true;
  soloMode = false;
  state.currentGame = "smasharena";
  document.getElementById("saMenu").style.display = "none";
  document.getElementById("saLobby").style.display = "none";
  document.getElementById("saGame").style.display = "flex";
  localState = {
    status: "playing",
    winner: "",
    mode: "ai",
    koTarget: 4,
    score: { p1: 0, p2: 0 },
    players: {
      p1: makeFighter(state.myUid || "local", state.myName || "YOU", "left"),
      p2: makeFighter("bot", "BOT", "right"),
    },
    inputs: { p1: makeInput(), p2: makeInput() },
  };
  localLoop = setInterval(() => {
    if (!localState || localState.status !== "playing") return;
    localState.inputs.p1 = { ...keys, upPress: keyLatch.up, atkPress: keyLatch.atk, ts: Date.now() };
    keyLatch.up = false;
    keyLatch.atk = false;
    localState.inputs.p2 = aiInput(localState.players.p2, localState.players.p1);
    simulateTick(localState);
    render(localState);
  }, TICK_MS);
}

function startSoloMode() {
  stopSession();
  aiMode = true;
  soloMode = true;
  state.currentGame = "smasharena";
  document.getElementById("saMenu").style.display = "none";
  document.getElementById("saLobby").style.display = "none";
  document.getElementById("saGame").style.display = "flex";
  setText("saHudStatus", "SOLO MODE: SURVIVE 6 KOs");
  localState = {
    status: "playing",
    winner: "",
    mode: "solo",
    koTarget: 6,
    score: { p1: 0, p2: 0 },
    players: {
      p1: makeFighter(state.myUid || "local", state.myName || "YOU", "left"),
      p2: makeFighter("bot", "ARENA BOT", "right"),
    },
    inputs: { p1: makeInput(), p2: makeInput() },
  };
  localLoop = setInterval(() => {
    if (!localState || localState.status !== "playing") return;
    localState.inputs.p1 = { ...keys, upPress: keyLatch.up, atkPress: keyLatch.atk, ts: Date.now() };
    keyLatch.up = false;
    keyLatch.atk = false;
    const pressure = 1 + Math.floor((localState.score.p1 || 0) / 2);
    localState.inputs.p2 = aiInput(localState.players.p2, localState.players.p1, pressure);
    simulateTick(localState);
    if (localState.score.p2 > 0 && localState.status === "playing") {
      localState.status = "finished";
      localState.winner = localState.players.p2.name;
    }
    if (localState.status === "finished" && localState.winner !== localState.players.p1.name) {
      setText("saHudStatus", `SOLO FAIL • REACHED ${localState.score.p1} KOs`);
    }
    render(localState);
  }, TICK_MS);
}

async function sendInput() {
  if (aiMode || !colyseusRoom || !myPlayerId || !localState || localState.status !== "playing") return;
  try {
    colyseusRoom.send("input", { ...keys, upPress: keyLatch.up, atkPress: keyLatch.atk, ts: Date.now() });
    keyLatch.up = false;
    keyLatch.atk = false;
  } catch (_e) {}
}

function bindControls() {
  window.addEventListener("keydown", (e) => {
    if (state.currentGame !== "smasharena") return;
    if (e.key === "a" || e.key === "ArrowLeft") keys.left = true;
    if (e.key === "d" || e.key === "ArrowRight") keys.right = true;
    if (e.key === "w" || e.key === "ArrowUp") {
      if (!keys.up) keyLatch.up = true;
      keys.up = true;
    }
    if (e.key === " ") {
      if (!keys.atk) keyLatch.atk = true;
      keys.atk = true;
    }
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
document.getElementById("btnSASolo")?.addEventListener("click", startSoloMode);
document.getElementById("saStartBtn")?.addEventListener("click", async () => {
  if (!colyseusRoom || !isHost) return;
  colyseusRoom.send("start");
});
bindControls();
registerGameStop(stopSession);
