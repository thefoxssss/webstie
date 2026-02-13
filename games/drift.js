import { registerGameStop, setText, showToast, state, firebase } from "../core.js";

const { doc, setDoc, updateDoc, onSnapshot, runTransaction } = firebase;

const ROOM_PREFIX = "dr_";
const MAX_PLAYERS = 4;
const TRACK_LAPS = 3;
const TICK_MS = 1000 / 30;

const TRACK = {
  cx: 390,
  cy: 230,
  outerA: 310,
  outerB: 185,
  innerA: 190,
  innerB: 95,
};

const CAR = {
  accel: 0.18,
  brake: 0.13,
  maxSpeed: 6.2,
  reverseSpeed: -2.5,
  drag: 0.97,
  steer: 0.055,
  sideGrip: 0.88,
  driftGrip: 0.72,
  boostMax: 100,
};

const keyState = { up: false, down: false, left: false, right: false, drift: false };

let roomCode = null;
let myPlayerId = null;
let isHost = false;
let localState = null;
let roomSub = null;
let hostLoop = null;

function roomRef(code) {
  return doc(firebase.db, "gooner_terminal_rooms", ROOM_PREFIX + code);
}

function randomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function spawnAt(i) {
  const angle = -Math.PI / 2 + i * 0.22;
  const rA = (TRACK.innerA + TRACK.outerA) / 2;
  const rB = (TRACK.innerB + TRACK.outerB) / 2;
  const x = TRACK.cx + Math.cos(angle) * rA;
  const y = TRACK.cy + Math.sin(angle) * rB;
  return { x, y, heading: angle + Math.PI / 2 };
}

function makeCar(uid, name, index) {
  const sp = spawnAt(index);
  return {
    uid,
    name,
    x: sp.x,
    y: sp.y,
    heading: sp.heading,
    vx: 0,
    vy: 0,
    lap: 0,
    progress: 0,
    crossedTop: false,
    driftCharge: 0,
    boost: 0,
    finishedAt: 0,
  };
}

function resetUi() {
  state.currentGame = "drift";
  document.getElementById("driftMenu").style.display = "flex";
  document.getElementById("driftLobby").style.display = "none";
  document.getElementById("driftRace").style.display = "none";
  setText("driftRaceStatus", "LINE UP");
  setText("driftLap", "0/3");
  setText("driftBoost", "0%");
  setText("driftLeader", "LEADER: --");
  setText("driftWinner", "");
  setText("driftLobbyStatus", "WAITING FOR PLAYERS");
  const joinInput = document.getElementById("joinDriftCode");
  if (joinInput) joinInput.value = "";
}

function stopSession() {
  if (roomSub) roomSub();
  if (hostLoop) clearInterval(hostLoop);
  roomSub = null;
  hostLoop = null;
  roomCode = null;
  myPlayerId = null;
  isHost = false;
  localState = null;
}

export function initDrift() {
  stopSession();
  resetUi();
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
    winner: "",
    startedAt: 0,
    players: {
      p1: makeCar(state.myUid, state.myName, 0),
    },
    inputs: {
      p1: { ...keyState, ts: Date.now() },
    },
  });
  joinRoom(code, "p1", true);
}

async function joinRoomByCode() {
  if (!state.myUid) return alert("OFFLINE");
  const code = String(document.getElementById("joinDriftCode").value || "").trim();
  if (!code) return;
  const ref = roomRef(code);
  await runTransaction(firebase.db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) throw new Error("ROOM_404");
    const data = snap.data();
    if (data.status !== "lobby") throw new Error("MATCH_RUNNING");
    const players = data.players || {};
    const ids = Object.keys(players);
    if (ids.length >= MAX_PLAYERS) throw new Error("ROOM_FULL");

    const existing = ids.find((id) => players[id]?.uid === state.myUid);
    const pid = existing || `p${ids.length + 1}`;
    if (!existing) players[pid] = makeCar(state.myUid, state.myName, ids.length);

    const inputs = data.inputs || {};
    inputs[pid] = { ...keyState, ts: Date.now() };
    t.update(ref, { players, inputs });
    return pid;
  })
    .then((pid) => joinRoom(code, pid, false))
    .catch((err) => {
      const msg = String(err?.message || "JOIN_FAILED");
      if (msg.includes("ROOM_404")) return alert("ROOM NOT FOUND");
      if (msg.includes("MATCH_RUNNING")) return alert("RACE IN PROGRESS");
      if (msg.includes("ROOM_FULL")) return alert("ROOM FULL");
      alert("FAILED TO JOIN ROOM");
    });
}

function joinRoom(code, pid, host) {
  roomCode = code;
  myPlayerId = pid;
  isHost = host;
  document.getElementById("driftMenu").style.display = "none";
  document.getElementById("driftLobby").style.display = "flex";
  setText("driftRoomId", code);
  subscribeRoom();
}

function subscribeRoom() {
  if (roomSub) roomSub();
  roomSub = onSnapshot(roomRef(roomCode), (snap) => {
    if (!snap.exists()) {
      showToast("DRIFT ROOM CLOSED", "⚠️");
      initDrift();
      return;
    }
    localState = snap.data();
    render(localState);
    if (localState.status === "playing" && isHost && !hostLoop) startHostLoop();
    if (localState.status !== "playing" && hostLoop) {
      clearInterval(hostLoop);
      hostLoop = null;
    }
  });
}

function render(data) {
  const players = data.players || {};
  const rows = Object.entries(players)
    .sort((a, b) => rankCar(b[1]) - rankCar(a[1]))
    .map(([id, p]) => `<div>${id.toUpperCase()}: ${p.name} • LAP ${Math.min(TRACK_LAPS, p.lap || 0)}/${TRACK_LAPS}</div>`)
    .join("");
  document.getElementById("driftPlayers").innerHTML = rows || "<div>NO PLAYERS</div>";

  if (data.status === "lobby") {
    document.getElementById("driftLobby").style.display = "flex";
    document.getElementById("driftRace").style.display = "none";
    const canStart = isHost && Object.keys(players).length >= 2;
    document.getElementById("driftStartBtn").style.display = canStart ? "inline-block" : "none";
    setText("driftLobbyStatus", canStart ? "HOST READY TO START" : "WAITING FOR RIVAL");
    return;
  }

  document.getElementById("driftLobby").style.display = "none";
  document.getElementById("driftRace").style.display = "block";
  renderHud(data);
  drawTrack(data);
}

function renderHud(data) {
  const me = data.players?.[myPlayerId];
  const sorted = Object.values(data.players || {}).sort((a, b) => rankCar(b) - rankCar(a));
  const leader = sorted[0];
  setText("driftLeader", `LEADER: ${leader ? leader.name : "--"}`);
  if (me) {
    setText("driftLap", `${Math.min(TRACK_LAPS, me.lap || 0)}/${TRACK_LAPS}`);
    setText("driftBoost", `${Math.floor(me.boost || 0)}%`);
    const drifting = keyState.drift ? "DRIFTING" : "RACING";
    setText("driftRaceStatus", data.status === "finished" ? "FINISHED" : drifting);
  }
  setText("driftWinner", data.winner ? `WINNER: ${data.winner}` : "");
}

function drawTrack(data) {
  const cv = document.getElementById("driftCanvas");
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, cv.width, cv.height);

  const bg = ctx.createLinearGradient(0, 0, cv.width, cv.height);
  bg.addColorStop(0, "#111a2f");
  bg.addColorStop(1, "#06070e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cv.width, cv.height);

  drawEllipse(ctx, TRACK.cx, TRACK.cy, TRACK.outerA, TRACK.outerB, "#1a243d");
  drawEllipse(ctx, TRACK.cx, TRACK.cy, TRACK.innerA, TRACK.innerB, "#05070f");

  ctx.strokeStyle = "#43f0ff";
  ctx.lineWidth = 3;
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#43f0ff";
  drawEllipseStroke(ctx, TRACK.cx, TRACK.cy, TRACK.outerA, TRACK.outerB);
  drawEllipseStroke(ctx, TRACK.cx, TRACK.cy, TRACK.innerA, TRACK.innerB);
  ctx.shadowBlur = 0;

  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.setLineDash([10, 12]);
  drawEllipseStroke(ctx, TRACK.cx, TRACK.cy, (TRACK.innerA + TRACK.outerA) / 2, (TRACK.innerB + TRACK.outerB) / 2);
  ctx.setLineDash([]);

  ctx.fillStyle = "#ff4bd1";
  ctx.fillRect(TRACK.cx - 3, 20, 6, 70);

  Object.entries(data.players || {}).forEach(([id, car], idx) => drawCar(ctx, car, id === myPlayerId, idx));
}

function drawEllipse(ctx, x, y, a, b, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, a, b, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawEllipseStroke(ctx, x, y, a, b) {
  ctx.beginPath();
  ctx.ellipse(x, y, a, b, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCar(ctx, car, mine, idx) {
  const colors = ["#ffe066", "#ff6b6b", "#4dabf7", "#63e6be"];
  const body = mine ? "#00ff99" : colors[idx % colors.length];

  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.heading || 0);
  ctx.fillStyle = body;
  ctx.shadowBlur = mine ? 16 : 6;
  ctx.shadowColor = body;
  ctx.fillRect(-11, -7, 22, 14);
  ctx.fillStyle = "#101520";
  ctx.fillRect(5, -5, 6, 10);
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.fillStyle = "#fff";
  ctx.font = "11px 'Roboto Mono'";
  ctx.fillText(car.name || "P", car.x - 18, car.y - 12);
}

function carProgress(car) {
  const angle = Math.atan2((car.y - TRACK.cy) / TRACK.outerB, (car.x - TRACK.cx) / TRACK.outerA);
  return ((angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
}

function rankCar(car) {
  return (car.lap || 0) + (car.progress || 0);
}

async function startRace() {
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
      const sp = spawnAt(i);
      players[id] = {
        ...players[id],
        x: sp.x,
        y: sp.y,
        heading: sp.heading,
        vx: 0,
        vy: 0,
        lap: 0,
        progress: 0,
        crossedTop: false,
        driftCharge: 0,
        boost: 0,
        finishedAt: 0,
      };
    });
    t.update(ref, { players, winner: "", status: "playing", startedAt: Date.now() });
  });
}

function startHostLoop() {
  if (!isHost || hostLoop || !roomCode) return;
  hostLoop = setInterval(async () => {
    if (!localState || localState.status !== "playing") return;
    const next = simTick(localState);
    try {
      await updateDoc(roomRef(roomCode), {
        players: next.players,
        winner: next.winner,
        status: next.status,
      });
    } catch {
      // Ignore races; next snapshot resolves state.
    }
  }, TICK_MS);
}

function simTick(data) {
  const players = structuredClone(data.players || {});
  const ids = Object.keys(players);
  const inputs = data.inputs || {};

  ids.forEach((id) => {
    const car = players[id];
    const input = inputs[id] || {};
    stepCar(car, input);
    resolveBounds(car);
    updateProgress(car);
  });

  let winner = "";
  let status = "playing";
  const finished = Object.values(players)
    .filter((c) => c.lap >= TRACK_LAPS)
    .sort((a, b) => (a.finishedAt || Infinity) - (b.finishedAt || Infinity));
  if (finished.length) {
    winner = finished[0].name;
    status = "finished";
  }

  return { players, winner, status };
}

function stepCar(car, input) {
  const forwardX = Math.cos(car.heading);
  const forwardY = Math.sin(car.heading);

  const speedForward = car.vx * forwardX + car.vy * forwardY;
  const steerPower = Math.min(1, Math.abs(speedForward) / 2.4);
  if (input.left) car.heading -= CAR.steer * steerPower;
  if (input.right) car.heading += CAR.steer * steerPower;

  if (input.up) {
    car.vx += forwardX * CAR.accel;
    car.vy += forwardY * CAR.accel;
  }
  if (input.down) {
    car.vx -= forwardX * CAR.brake;
    car.vy -= forwardY * CAR.brake;
  }

  const speed = Math.hypot(car.vx, car.vy);
  if (speed > CAR.maxSpeed) {
    const scale = CAR.maxSpeed / speed;
    car.vx *= scale;
    car.vy *= scale;
  }
  if (speedForward < CAR.reverseSpeed) {
    car.vx *= 0.92;
    car.vy *= 0.92;
  }

  const rightX = Math.cos(car.heading + Math.PI / 2);
  const rightY = Math.sin(car.heading + Math.PI / 2);
  const lateral = car.vx * rightX + car.vy * rightY;
  const grip = input.drift ? CAR.driftGrip : CAR.sideGrip;
  car.vx -= rightX * lateral * (1 - grip);
  car.vy -= rightY * lateral * (1 - grip);

  if (input.drift && Math.abs(lateral) > 0.3 && speed > 1.3) {
    car.driftCharge = Math.min(CAR.boostMax, (car.driftCharge || 0) + 1.3);
  } else {
    car.driftCharge = Math.max(0, (car.driftCharge || 0) - 0.9);
  }

  if (!input.drift && (car.driftCharge || 0) >= 30 && (car.boost || 0) < 5) {
    car.boost = Math.min(CAR.boostMax, (car.boost || 0) + car.driftCharge * 0.5);
    car.driftCharge = 0;
  }

  if ((car.boost || 0) > 0) {
    car.vx += forwardX * 0.12;
    car.vy += forwardY * 0.12;
    car.boost = Math.max(0, car.boost - 1.4);
  }

  car.vx *= CAR.drag;
  car.vy *= CAR.drag;
  car.x += car.vx;
  car.y += car.vy;
}

function resolveBounds(car) {
  const nx = (car.x - TRACK.cx) / TRACK.outerA;
  const ny = (car.y - TRACK.cy) / TRACK.outerB;
  const outer = nx * nx + ny * ny;

  const inx = (car.x - TRACK.cx) / TRACK.innerA;
  const iny = (car.y - TRACK.cy) / TRACK.innerB;
  const inner = inx * inx + iny * iny;

  if (outer > 1.02) {
    car.vx *= -0.35;
    car.vy *= -0.35;
    const scale = 1 / Math.sqrt(outer);
    car.x = TRACK.cx + nx * scale * TRACK.outerA;
    car.y = TRACK.cy + ny * scale * TRACK.outerB;
  }
  if (inner < 0.98) {
    const push = 1 / Math.sqrt(Math.max(inner, 0.0001));
    car.x = TRACK.cx + inx * push * TRACK.innerA;
    car.y = TRACK.cy + iny * push * TRACK.innerB;
    car.vx *= -0.22;
    car.vy *= -0.22;
  }
}

function updateProgress(car) {
  const prog = carProgress(car);
  if (car.progress > 0.84 && prog < 0.16) {
    car.lap += 1;
    if (!car.finishedAt && car.lap >= TRACK_LAPS) car.finishedAt = Date.now();
  }
  car.progress = prog;
}

async function publishInput() {
  if (!roomCode || !myPlayerId || !localState || localState.status !== "playing") return;
  try {
    await updateDoc(roomRef(roomCode), {
      [`inputs.${myPlayerId}`]: { ...keyState, ts: Date.now() },
    });
  } catch {
    // Ignore connection jitter.
  }
}

function onKeyChange(down, key) {
  if (state.currentGame !== "drift") return;
  const k = key.toLowerCase();
  let changed = false;

  if (["w", "arrowup"].includes(k)) {
    changed = keyState.up !== down;
    keyState.up = down;
  }
  if (["s", "arrowdown"].includes(k)) {
    changed = keyState.down !== down;
    keyState.down = down;
  }
  if (["a", "arrowleft"].includes(k)) {
    changed = keyState.left !== down;
    keyState.left = down;
  }
  if (["d", "arrowright"].includes(k)) {
    changed = keyState.right !== down;
    keyState.right = down;
  }
  if ([" ", "shift"].includes(k)) {
    changed = keyState.drift !== down;
    keyState.drift = down;
  }

  if (changed) publishInput();
}

document.addEventListener("keydown", (e) => onKeyChange(true, e.key));
document.addEventListener("keyup", (e) => onKeyChange(false, e.key));

document.getElementById("btnCreateDrift").onclick = createRoom;
document.getElementById("btnJoinDrift").onclick = joinRoomByCode;
document.getElementById("driftStartBtn").onclick = startRace;

registerGameStop(() => {
  keyState.up = false;
  keyState.down = false;
  keyState.left = false;
  keyState.right = false;
  keyState.drift = false;
  stopSession();
});
