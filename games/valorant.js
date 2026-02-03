import { registerGameStop, setText, showToast, state, firebase } from "../core.js";

const { doc, setDoc, updateDoc, onSnapshot, runTransaction } = firebase;

let valRoomCode = null;
let valRoomUnsub = null;
let valIsHost = false;
let valPlayers = [];
let valStatus = "menu";
let valAnim = null;
let valLastSent = 0;
let valOverlayOpen = false;
let valCredits = 2400;
let valAgent = "SCOUT";
let valWeapon = "CLASSIC";
let valSpike = { plantedSite: null, plantedBy: null, plantedAt: null };

const MAX_PLAYERS = 4;
const AGENTS = ["SCOUT", "PHANTOM", "EMBER", "VIPER", "NEON", "SAGE"];
const WEAPONS = [
  { id: "CLASSIC", cost: 0 },
  { id: "GHOST", cost: 500 },
  { id: "SPECTRE", cost: 1600 },
  { id: "VANDAL", cost: 2900 },
  { id: "OPERATOR", cost: 4700 },
  { id: "SHIELD", cost: 1000 }
];
const TEAMS = ["TERRORIST", "COUNTER"];
const SITES = [
  { id: "A", x: 700, y: 240 },
  { id: "B", x: 900, y: -220 }
];
const SITE_RADIUS = 180;

function getValRef(code) {
  return doc(firebase.db, "gooner_valorant_rooms", "val_" + code);
}

function defaultPlayer(uid, name, team) {
  const isTerrorist = team === "TERRORIST";
  return {
    uid,
    name,
    team,
    x: isTerrorist ? -240 : 240,
    y: isTerrorist ? 80 : -80,
    rot: isTerrorist ? 0 : Math.PI
  };
}

function pickTeam(players) {
  const counts = TEAMS.reduce((acc, team) => {
    acc[team] = players.filter((p) => p.team === team).length;
    return acc;
  }, {});
  return counts.TERRORIST <= counts.COUNTER ? "TERRORIST" : "COUNTER";
}

function getMyPlayer() {
  return valPlayers.find((p) => p.uid === state.myUid);
}

function getNearbySite(me) {
  if (!me) return null;
  return SITES.find((site) => {
    const dx = me.x - site.x;
    const dy = me.y - site.y;
    return Math.hypot(dx, dy) <= SITE_RADIUS;
  });
}

function updateValorantHud() {
  const me = getMyPlayer();
  const teamLabel = me?.team || "--";
  const spikeLabel = valSpike.plantedSite ? `PLANTED` : "READY";
  const siteLabel = valSpike.plantedSite || "--";
  setText("valorantTeam", teamLabel);
  setText("valorantSpike", spikeLabel);
  setText("valorantSiteStatus", siteLabel);

  const actionBtn = document.getElementById("valorantSpikeAction");
  if (!actionBtn || !me) return;
  const nearbySite = getNearbySite(me);
  const canPlant =
    me.team === "TERRORIST" && !valSpike.plantedSite && Boolean(nearbySite);
  const canDefuse =
    me.team === "COUNTER" && valSpike.plantedSite && nearbySite?.id === valSpike.plantedSite;
  if (canPlant) {
    actionBtn.style.display = "inline-block";
    actionBtn.textContent = `PLANT SPIKE (${nearbySite.id})`;
  } else if (canDefuse) {
    actionBtn.style.display = "inline-block";
    actionBtn.textContent = `DEFUSE SPIKE (${valSpike.plantedSite})`;
  } else {
    actionBtn.style.display = "none";
    actionBtn.textContent = "PLANT SPIKE";
  }
}

export function initValorant() {
  state.currentGame = "valorant";
  valOverlayOpen = true;
  document.getElementById("valorantMenu").style.display = "flex";
  document.getElementById("valorantLobby").style.display = "none";
  document.getElementById("valorantGame").style.display = "none";
  setText("valorantStatus", "LOADING ARENA...");
  renderBuyMenu();
}

document.getElementById("btnCreateValorant").onclick = async () => {
  if (!state.myUid) return alert("Offline");
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const team = "TERRORIST";
  const room = {
    hostUid: state.myUid,
    status: "lobby",
    spike: { plantedSite: null, plantedBy: null, plantedAt: null },
    players: [defaultPlayer(state.myUid, state.myName, team)]
  };
  await setDoc(getValRef(code), room);
  joinValorant(code, true);
};

document.getElementById("btnJoinValorant").onclick = async () => {
  const code = document.getElementById("joinValorantCode").value;
  if (!code) return;
  const ref = getValRef(code);
  await runTransaction(firebase.db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) throw "404";
    const data = snap.data();
    const players = data.players || [];
    if (players.length >= MAX_PLAYERS) throw "ROOM FULL";
    if (!players.find((p) => p.uid === state.myUid)) {
      const team = pickTeam(players);
      players.push(defaultPlayer(state.myUid, state.myName, team));
      t.update(ref, { players });
    }
    joinValorant(code, data.hostUid === state.myUid);
  }).catch((e) => alert(e));
};

function joinValorant(code, isHost) {
  valRoomCode = code;
  valIsHost = isHost;
  document.getElementById("valorantMenu").style.display = "none";
  document.getElementById("valorantLobby").style.display = "flex";
  setText("valorantRoomId", code);
  if (valRoomUnsub) valRoomUnsub();
  valRoomUnsub = onSnapshot(getValRef(code), (snap) => {
    if (snap.exists()) handleValorantUpdate(snap.data());
  });
}

function handleValorantUpdate(data) {
  valPlayers = data.players || [];
  valStatus = data.status || "lobby";
  valSpike = data.spike || { plantedSite: null, plantedBy: null, plantedAt: null };
  if (valStatus === "lobby") {
    document.getElementById("valorantLobby").style.display = "flex";
    document.getElementById("valorantGame").style.display = "none";
    document.getElementById("valorantPList").innerHTML = valPlayers
      .map((p) => `<div>${p.name} • ${p.team || "UNASSIGNED"}${p.uid === data.hostUid ? " (HOST)" : ""}</div>`)
      .join("");
    if (valIsHost) {
      document.getElementById("valorantStartBtn").style.display = "block";
      setText("valorantWait", "START MATCH WHEN READY");
    } else {
      document.getElementById("valorantStartBtn").style.display = "none";
      setText("valorantWait", "WAITING FOR HOST...");
    }
    return;
  }
  document.getElementById("valorantLobby").style.display = "none";
  document.getElementById("valorantGame").style.display = "block";
  setText("valorantStatus", "ARENA LIVE");
  renderBuyMenu();
  updateValorantHud();
  if (!valAnim) startValorantLoop();
}

document.getElementById("valorantStartBtn").onclick = async () => {
  if (!valIsHost || !valRoomCode) return;
  await updateDoc(getValRef(valRoomCode), {
    status: "playing",
    spike: { plantedSite: null, plantedBy: null, plantedAt: null }
  });
};

document.getElementById("valorantSpikeAction").onclick = async () => {
  if (!valRoomCode) return;
  const me = getMyPlayer();
  if (!me) return;
  const nearbySite = getNearbySite(me);
  if (me.team === "TERRORIST" && !valSpike.plantedSite && nearbySite) {
    await updateDoc(getValRef(valRoomCode), {
      spike: { plantedSite: nearbySite.id, plantedBy: state.myUid, plantedAt: Date.now() }
    });
    showToast("SPIKE PLANTED", "📍", `SITE ${nearbySite.id}`);
    return;
  }
  if (me.team === "COUNTER" && valSpike.plantedSite && nearbySite?.id === valSpike.plantedSite) {
    await updateDoc(getValRef(valRoomCode), {
      spike: { plantedSite: null, plantedBy: null, plantedAt: null }
    });
    showToast("SPIKE DEFUSED", "🛡️", "SITE CLEARED");
  }
};

function renderBuyMenu() {
  setText("valorantCredits", valCredits);
  setText("valorantAgent", valAgent);
  setText("valorantWeapon", valWeapon);
  updateValorantHud();
  const agentList = document.getElementById("valorantAgentList");
  const weaponList = document.getElementById("valorantWeaponList");
  if (!agentList || !weaponList) return;
  agentList.innerHTML = "";
  AGENTS.forEach((agent) => {
    const card = document.createElement("div");
    card.className = "valorant-card" + (agent === valAgent ? " selected" : "");
    card.innerText = agent;
    card.onclick = () => {
      valAgent = agent;
      renderBuyMenu();
      showToast("AGENT READY", "🧩", agent);
    };
    agentList.appendChild(card);
  });
  weaponList.innerHTML = "";
  WEAPONS.forEach((weapon) => {
    const card = document.createElement("div");
    const affordable = valCredits >= weapon.cost || weapon.id === valWeapon;
    card.className = `valorant-card${weapon.id === valWeapon ? " selected" : ""}${!affordable ? " disabled" : ""}`;
    card.innerHTML = `<div>${weapon.id}</div><div>$${weapon.cost}</div>`;
    card.onclick = () => {
      if (!affordable) return;
      if (weapon.id !== valWeapon) {
        valCredits -= weapon.cost;
        valWeapon = weapon.id;
        renderBuyMenu();
        showToast("WEAPON LOCKED", "🔫", weapon.id);
      }
    };
    weaponList.appendChild(card);
  });
}

function updateMyPosition(delta) {
  const me = valPlayers.find((p) => p.uid === state.myUid);
  if (!me) return;
  const speed = 0.12 * delta;
  const turnSpeed = 0.0025 * delta;
  if (state.keysPressed["a"] || state.keysPressed["ArrowLeft"]) me.rot -= turnSpeed * 40;
  if (state.keysPressed["d"] || state.keysPressed["ArrowRight"]) me.rot += turnSpeed * 40;
  const cos = Math.cos(me.rot);
  const sin = Math.sin(me.rot);
  if (state.keysPressed["w"] || state.keysPressed["ArrowUp"]) {
    me.x += cos * speed * 40;
    me.y += sin * speed * 40;
  }
  if (state.keysPressed["s"] || state.keysPressed["ArrowDown"]) {
    me.x -= cos * speed * 40;
    me.y -= sin * speed * 40;
  }
}

function sendMyPosition() {
  if (!valRoomCode) return;
  const now = Date.now();
  if (now - valLastSent < 150) return;
  valLastSent = now;
  const ref = getValRef(valRoomCode);
  const players = valPlayers.map((p) => {
    if (p.uid !== state.myUid) return p;
    return { ...p };
  });
  updateDoc(ref, { players }).catch(() => {});
}

function drawArena(ctx, me) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const horizon = h * 0.35;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, horizon, w, h - horizon);

  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  for (let i = 1; i < 20; i++) {
    const z = i * 80;
    const y = horizon + (14000 / z);
    const x1 = w / 2 - (16000 / z);
    const x2 = w / 2 + (16000 / z);
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
  }
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    const z1 = 80;
    const z2 = 1400;
    const xOffset = i * 120;
    const x1 = w / 2 + (xOffset / z1) * 140;
    const x2 = w / 2 + (xOffset / z2) * 140;
    ctx.moveTo(x1, horizon + (14000 / z1));
    ctx.lineTo(x2, horizon + (14000 / z2));
    ctx.stroke();
  }

  SITES.forEach((site) => {
    const dx = site.x - me.x;
    const dy = site.y - me.y;
    const relX = dx * Math.cos(-me.rot) - dy * Math.sin(-me.rot);
    const relZ = dx * Math.sin(-me.rot) + dy * Math.cos(-me.rot);
    if (relZ <= 5) return;
    const size = Math.min(60, 900 / relZ);
    const screenX = w / 2 + (relX / relZ) * 220;
    const screenY = horizon + (14000 / relZ) - size;
    const isPlanted = valSpike.plantedSite === site.id;
    ctx.fillStyle = isPlanted ? "rgba(255,0,0,0.75)" : "rgba(0,255,0,0.6)";
    ctx.fillRect(screenX - size / 2, screenY - size / 2, size, size);
    ctx.fillStyle = "#000";
    ctx.font = "bold 10px monospace";
    ctx.fillText(`SITE ${site.id}`, screenX - size / 2 + 2, screenY);
  });

  valPlayers.forEach((p) => {
    if (p.uid === state.myUid) return;
    const dx = p.x - me.x;
    const dy = p.y - me.y;
    const relX = dx * Math.cos(-me.rot) - dy * Math.sin(-me.rot);
    const relZ = dx * Math.sin(-me.rot) + dy * Math.cos(-me.rot);
    if (relZ <= 5) return;
    const size = Math.min(80, 1200 / relZ);
    const screenX = w / 2 + (relX / relZ) * 220;
    const screenY = horizon + (14000 / relZ) - size;
    const tint = p.team === "TERRORIST" ? "rgba(255,80,80,0.8)" : "rgba(80,160,255,0.8)";
    ctx.fillStyle = tint;
    ctx.fillRect(screenX - size / 2, screenY - size, size, size * 1.6);
    ctx.fillStyle = "#fff";
    ctx.font = "8px monospace";
    ctx.fillText(p.name, screenX - size / 2, screenY - size - 6);
  });
}

function startValorantLoop() {
  const cv = document.getElementById("valorantCanvas");
  const ctx = cv.getContext("2d");
  let last = performance.now();
  const loop = (time) => {
    if (!valOverlayOpen || valStatus !== "playing") {
      valAnim = null;
      return;
    }
    const delta = time - last;
    last = time;
    updateMyPosition(delta);
    const me = valPlayers.find((p) => p.uid === state.myUid) || defaultPlayer(state.myUid, state.myName, "TERRORIST");
    drawArena(ctx, me);
    sendMyPosition();
    updateValorantHud();
    valAnim = requestAnimationFrame(loop);
  };
  valAnim = requestAnimationFrame(loop);
}

async function leaveValorantRoom() {
  if (!valRoomCode) return;
  const ref = getValRef(valRoomCode);
  await runTransaction(firebase.db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const players = (data.players || []).filter((p) => p.uid !== state.myUid);
    t.update(ref, { players });
  }).catch(() => {});
  valRoomCode = null;
}

registerGameStop(() => {
  valOverlayOpen = false;
  if (valRoomUnsub) valRoomUnsub();
  valRoomUnsub = null;
  valIsHost = false;
  valStatus = "menu";
  if (valAnim) cancelAnimationFrame(valAnim);
  valAnim = null;
  valCredits = 2400;
  valAgent = "SCOUT";
  valWeapon = "CLASSIC";
  valSpike = { plantedSite: null, plantedBy: null, plantedAt: null };
  leaveValorantRoom();
});
