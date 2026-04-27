import { state, isInputFocused, escapeHtml } from "../core.js";

let room = null;
let scene, camera, renderer, controls;
let raycaster;
let floorMesh;
let localPlayer = { id: "", x: 0, y: 1.5, z: 0, health: 100, kills: 0, weapon: 0, team: 0 };
let otherPlayers = {}; // id -> { mesh, data, targetPos, targetRotY, lastNetUpdate }
let gunMesh;
let muzzleFlash, muzzleLight;
let muzzleFlashTime = 0;
let nextFireTime = 0;
let isReloading = false;
let reloadEndTime = 0;
let ammo = [12, 6, 5, 120]; // Current ammo for each weapon
let recoilTime = 0;
let recoilIntensity = 0;
let bobTime = 0;
let grenades = 2;
let nextGrenadeTime = 0;
let grenadeEffects = [];
let gatlingMovementLockUntil = 0;
let isPrimaryFireHeld = false;
let gameLoopId;
let initialized = false;
let handleFpsResize = null;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let isSprinting = false;
let isCrouching = false;
let canJump = false;
let isSniperZoomed = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
const speed = 40.0;
const sprintSpeed = 70.0;
const crouchSpeed = 20.0;
const jumpVelocity = 15.0;
const gravity = 40.0;
let redFlagMesh, blueFlagMesh;
let smokeParticles = [];
let prevTime = performance.now();

// Bullet tracers
let tracers = [];

let obstaclesGroup;
let obstacleBoxes = [];
let smokeParticles = [];
let redFlagMesh = null;
let blueFlagMesh = null;
let currentGrenadeType = 0;

const networkSelect = document.getElementById("fpsNetwork");
const btnRefresh = document.getElementById("btnRefreshFpsServers");
const serverNameInput = document.getElementById("fpsServerName");
const btnCreate = document.getElementById("btnCreateFpsServer");
const btnJoin = document.getElementById("btnJoinFps");
const serverList = document.getElementById("fpsServerList");

const fpsGame = document.getElementById("fpsGame");
const fpsMenu = document.getElementById("fpsMenu");
const fpsCanvas = document.getElementById("fpsCanvas");
const fpsHealth = document.getElementById("fpsHealth");
const fpsKills = document.getElementById("fpsKills");
const fpsLeaderboardList = document.getElementById("fpsLeaderboardList");
const fpsDeathScreen = document.getElementById("fpsDeathScreen");
const fpsDeathMessage = document.getElementById("fpsDeathMessage");
const fpsHint = document.getElementById("fpsHint");
const fpsGrenades = document.getElementById("fpsGrenades");
const fpsTeam = document.getElementById("fpsTeam");
const fpsObjective = document.getElementById("fpsObjective");
const fpsCtfScore = document.getElementById("fpsCtfScore");
const fpsTeamSelect = document.getElementById("fpsTeamSelect");

function getColyseusEndpoint() {
  const mode = networkSelect.value;
  if (mode === "local") return "ws://localhost:2567";
  if (mode === "prod") return "wss://seahorse-app-mv4sg.ondigitalocean.app";
  // Auto
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "ws://localhost:2567";
  }
  return "wss://seahorse-app-mv4sg.ondigitalocean.app";
}

async function fetchServers() {
  serverList.innerHTML = "<div>SCANNING...</div>";
  try {
    const endpoint = getColyseusEndpoint().replace("ws", "http");
    const res = await fetch(`${endpoint}/fps-servers`);
    const payload = await res.json();
    const fpsRooms = payload.servers || [];

    serverList.innerHTML = "";
    if (fpsRooms.length === 0) {
      serverList.innerHTML = "<div>NO ACTIVE SERVERS. CREATE ONE.</div>";
      return;
    }

    fpsRooms.forEach(r => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.flexDirection = "column";
      row.style.padding = "5px";
      row.style.borderBottom = "1px solid #333";

      const topRow = document.createElement("div");
      topRow.style.display = "flex";
      topRow.style.justifyContent = "space-between";

      const info = document.createElement("span");
      info.textContent = `${r.serverName || r.roomId} (${r.clients}/${r.maxClients})`;

      const btn = document.createElement("button");
      btn.className = "term-btn";
      btn.textContent = "JOIN";
      btn.style.padding = "2px 8px";
      btn.onclick = () => joinRoom(r.roomId);

      topRow.appendChild(info);
      topRow.appendChild(btn);
      row.appendChild(topRow);

      if (r.players && r.players.length > 0) {
          const playersDiv = document.createElement("div");
          playersDiv.style.fontSize = "12px";
          playersDiv.style.color = "#aaa";
          playersDiv.style.marginTop = "4px";
          playersDiv.textContent = "Players: " + r.players.map(p => p.name).join(", ");
          row.appendChild(playersDiv);
      }

      serverList.appendChild(row);
    });
  } catch (err) {
    serverList.innerHTML = "<div>ERROR FETCHING SERVERS.</div>";
    console.error(err);
  }
}

async function createRoom() {
  const serverName = serverNameInput.value.trim() || `${state.myName}'s Server`;
  const mapSelect = document.getElementById("fpsMapSelect");
  const mapId = mapSelect ? Number(mapSelect.value) : 0;

  try {
    const client = new Colyseus.Client(getColyseusEndpoint());
    room = await client.create("fps_room", { serverName, playerName: state.myName, mapId });
    setupRoom();
  } catch (err) {
    console.error("Create room failed:", err);
    alert("Failed to create server.");
  }
}

async function joinRoom(roomId) {
  try {
    const client = new Colyseus.Client(getColyseusEndpoint());
    if (roomId) {
      room = await client.joinById(roomId, { playerName: state.myName });
    } else {
      room = await client.joinOrCreate("fps_room", { playerName: state.myName });
    }
    setupRoom();
  } catch (err) {
    console.error("Join room failed:", err);
    alert("Failed to join server.");
  }
}

function setupRoom() {
  fpsMenu.style.display = "none";
  fpsGame.style.display = "block";

  if (!initialized) {
    initThreeJs();
  }

  room.onMessage("respawn", (data) => {
    localPlayer.health = 100;
    grenades = 2;
    currentGrenadeType = 0;
    updateGrenadeUI();
    localPlayer.x = data.x;
    localPlayer.y = data.y;
    localPlayer.z = data.z;
    controls.getObject().position.set(data.x, data.y, data.z);
    fpsHealth.textContent = localPlayer.health;
    fpsDeathScreen.style.display = "none";
    velocity.set(0,0,0);
  });

  room.onMessage("killed", (data) => {
    unzoomSniper();
    fpsDeathMessage.textContent = `FRAGGED BY ${data.killer}`;
    fpsDeathScreen.style.display = "flex";
  });

  room.onMessage("shoot", (data) => {
    createTracer(
      new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z),
      new THREE.Vector3(data.dir.x, data.dir.y, data.dir.z)
    );
  });

  room.onMessage("grenadeExplode", (data) => {
    createGrenadeEffect(new THREE.Vector3(data.x, data.y, data.z));

    // Also destroy nearby barrels locally
    if (obstaclesGroup) {
      for (let i = obstaclesGroup.children.length - 1; i >= 0; i--) {
        const mesh = obstaclesGroup.children[i];
        if (mesh.userData && mesh.userData.isBarrel) {
          const dist = mesh.position.distanceTo(new THREE.Vector3(data.x, data.y, data.z));
          if (dist < 15) { // Grenade radius
            obstaclesGroup.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
            obstacleBoxes = obstacleBoxes.filter(b => b.userData !== mesh.userData);
          }
        }
      }
    }
  });

  room.onMessage("mapVotes", (votes) => {
    document.getElementById("mapVote0").textContent = `(${votes[0]})`;
    document.getElementById("mapVote1").textContent = `(${votes[1]})`;
    document.getElementById("mapVote2").textContent = `(${votes[2]})`;
    if (document.getElementById("mapVote3")) document.getElementById("mapVote3").textContent = `(${votes[3] || 0})`;
    if (document.getElementById("mapVote4")) document.getElementById("mapVote4").textContent = `(${votes[4] || 0})`;
    if (document.getElementById("mapVote5")) document.getElementById("mapVote5").textContent = `(${votes[5] || 0})`;
  });

  room.state.listen("roundOver", (isOver) => {
    if (isOver) {
      document.getElementById("fpsRoundScreen").style.display = "flex";
      document.getElementById("fpsRoundWinner").textContent = `Winner: ${room.state.winnerName}`;
      controls.unlock();
    } else {
      document.getElementById("fpsRoundScreen").style.display = "none";
    }
  });

  room.state.listen("mapId", (mapId) => {
    loadMap(mapId);
    updateCtfHud();
    updateTeamSelectUI();
  });

  room.state.listen("redScore", updateCtfHud);
  room.state.listen("blueScore", updateCtfHud);

  room.state.players.onAdd((player, sessionId) => {
    if (sessionId === room.sessionId) {
      localPlayer.id = sessionId;
      localPlayer.health = player.health;
      localPlayer.kills = player.kills;
      localPlayer.team = player.team;
      grenades = 2;
      updateGrenadeUI();
      updateCtfHud();
      updateTeamSelectUI();

      player.listen("health", (val) => {
        localPlayer.health = val;
        fpsHealth.textContent = val;
      });
      player.listen("kills", (val) => {
        localPlayer.kills = val;
        fpsKills.textContent = val;
        if (!isWeaponUnlocked(3) && localPlayer.weapon === 3) {
          switchWeapon(0);
        }
      });
      player.listen("team", (val) => {
        localPlayer.team = val;
        updateCtfHud();
        updateTeamSelectUI();
      });

    } else {
      // Create mesh for other player
      const playerGroup = new THREE.Group();

      const geometry = new THREE.BoxGeometry(1, 2, 1);
      const material = new THREE.MeshLambertMaterial({ color: player.team === 1 ? 0xff3333 : (player.team === 2 ? 0x3333ff : 0xaaaaaa) });
      const mesh = new THREE.Mesh(geometry, material);
      playerGroup.add(mesh);

      const gunGeo = new THREE.BoxGeometry(0.2, 0.2, 0.8);
      const gunMat = new THREE.MeshPhongMaterial({ color: 0x555555 });
      const otherGunMesh = new THREE.Mesh(gunGeo, gunMat);
      otherGunMesh.position.set(0.6, 0.2, -0.4);
      playerGroup.add(otherGunMesh);

      let nameSprite = createNameSprite(player.name);
      playerGroup.add(nameSprite);

      playerGroup.position.set(player.x, player.y, player.z);
      scene.add(playerGroup);

      otherPlayers[sessionId] = {
        mesh: playerGroup,
        data: player,
        targetPos: new THREE.Vector3(player.x, player.y, player.z),
        targetRotY: player.rotY || 0,
        lastNetUpdate: performance.now()
      };

      player.listen("x", (val) => {
        const remote = otherPlayers[sessionId];
        if (!remote) return;
        remote.targetPos.x = val;
        remote.lastNetUpdate = performance.now();
      });
      player.listen("y", (val) => {
        const remote = otherPlayers[sessionId];
        if (!remote) return;
        remote.targetPos.y = val;
        remote.lastNetUpdate = performance.now();
      });
      player.listen("z", (val) => {
        const remote = otherPlayers[sessionId];
        if (!remote) return;
        remote.targetPos.z = val;
        remote.lastNetUpdate = performance.now();
      });
      player.listen("rotY", (val) => {
        const remote = otherPlayers[sessionId];
        if (!remote) return;
        remote.targetRotY = val;
        remote.lastNetUpdate = performance.now();
      });
      player.listen("name", (val) => {
        playerGroup.remove(nameSprite);
        if (nameSprite.material.map) nameSprite.material.map.dispose();
        nameSprite.material.dispose();
        nameSprite = createNameSprite(val);
        playerGroup.add(nameSprite);
      });
      player.listen("team", (val) => {
        material.color.setHex(val === 1 ? 0xff3333 : (val === 2 ? 0x3333ff : 0xaaaaaa));
      });
      // Hide if dead
      player.listen("health", (val) => playerGroup.visible = val > 0);
    }
    player.listen("kills", () => {
      updateLeaderboard();
    });
    updateLeaderboard();
  });

  room.state.players.onRemove((player, sessionId) => {
    if (otherPlayers[sessionId]) {
      scene.remove(otherPlayers[sessionId].mesh);
      otherPlayers[sessionId].mesh.children.forEach(child => {
        if (child.isSprite && child.material) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
      delete otherPlayers[sessionId];
    }
    updateLeaderboard();
  });

  updateCtfHud();
  updateTeamSelectUI();
}

function updateLeaderboard() {
  if (!room) return;
  const players = [];
  room.state.players.forEach(p => players.push(p));
  players.sort((a,b) => b.kills - a.kills);

  fpsLeaderboardList.innerHTML = players.map(p =>
    `<div>${escapeHtml(p.name)}: ${p.kills}</div>`
  ).join("");
}

function teamLabel(teamId) {
  if (teamId === 1) return "RED";
  if (teamId === 2) return "BLUE";
  return "FFA";
}

function updateCtfHud() {
  if (!fpsTeam || !fpsObjective || !fpsCtfScore) return;
  const mapId = room?.state?.mapId ?? 0;
  fpsTeam.textContent = teamLabel(localPlayer.team);
  fpsTeam.style.color = localPlayer.team === 1 ? "#ff6666" : (localPlayer.team === 2 ? "#6666ff" : "#bbbbbb");

  if (mapId === 5) {
    fpsObjective.textContent = "CAPTURE THE FLAG";
    fpsObjective.style.color = "#ffff66";
    fpsCtfScore.style.display = "inline";
    fpsCtfScore.textContent = `RED ${room.state.redScore} - ${room.state.blueScore} BLUE`;
    fpsCtfScore.style.color = "#ffffff";
  } else {
    fpsObjective.textContent = "DEATHMATCH";
    fpsObjective.style.color = "#bbbbbb";
    fpsCtfScore.style.display = "none";
  }
}

function updateTeamSelectUI() {
  if (!fpsTeamSelect) return;
  const shouldShow = !!room && room.state.mapId === 5 && localPlayer.team === 0;
  fpsTeamSelect.style.display = shouldShow ? "flex" : "none";
  if (shouldShow && controls?.isLocked) {
    controls.unlock();
  }
}

window.fpsChooseTeam = (teamId) => {
  if (!room || room.state.mapId !== 5) return;
  if (teamId !== 1 && teamId !== 2) return;
  room.send("joinTeam", teamId);
};

// Procedural textures

function createNameSprite(name) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 256;
  canvas.height = 64;
  ctx.font = "bold 32px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "white";
  ctx.strokeStyle = "black";
  ctx.lineWidth = 4;
  ctx.strokeText(name || "Unknown", 128, 32);
  ctx.fillText(name || "Unknown", 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.5, 0.625, 1); // Maintain aspect ratio: 256/64 = 4. 2.5 / 4 = 0.625
  sprite.position.y = 1.6; // Above player head
  return sprite;
}

function createProceduralTexture(type) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (type === "brick") {
    ctx.fillStyle = "#a52a2a";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#eeeeee";
    for (let y = 0; y < 256; y += 32) {
      ctx.fillRect(0, y, 256, 2);
      const offset = (y / 32) % 2 === 0 ? 0 : 32;
      for (let x = 0; x < 256; x += 64) {
        ctx.fillRect(x + offset, y, 2, 32);
      }
    }
  } else if (type === "grass") {
    ctx.fillStyle = "#3b5e2b";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#4a7c36";
    for (let i = 0; i < 1000; i++) {
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 8);
    }
  } else if (type === "asphalt") {
    ctx.fillStyle = "#333333";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#444444";
    for (let i = 0; i < 5000; i++) {
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
    }
  } else if (type === "metal") {
    ctx.fillStyle = "#777777";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#999999";
    for (let i = 0; i < 20; i++) {
      ctx.fillRect(Math.random() * 256, 0, 2, 256);
      ctx.fillRect(0, Math.random() * 256, 256, 2);
    }
    // Bolts
    ctx.fillStyle = "#444444";
    ctx.beginPath(); ctx.arc(16, 16, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(240, 16, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(16, 240, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(240, 240, 4, 0, Math.PI*2); ctx.fill();
  } else if (type === "space") {
    ctx.fillStyle = "#111122";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 100; i++) {
      const r = Math.random() * 1.5;
      ctx.beginPath(); ctx.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI*2); ctx.fill();
    }
  } else if (type === "concrete") {
    ctx.fillStyle = "#666666";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#555555";
    for (let i = 0; i < 5000; i++) {
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // We'll adjust repeat per-mesh if needed, but default 1
  return texture;
}

const textures = {};

function getTexture(type) {
  if (!textures[type]) {
    textures[type] = createProceduralTexture(type);
  }
  return textures[type];
}

function loadMap(mapId) {
  if (!obstaclesGroup) return;

  // Set Fog and Sky Color based on map
  if (mapId === 3) { // Space Station
    scene.background = new THREE.Color(0x050510);
    scene.fog = new THREE.Fog(0x050510, 20, 150);
    if (floorMesh) {
      floorMesh.material = new THREE.MeshPhongMaterial({ map: getTexture("metal").clone(), color: 0x888888 });
      floorMesh.material.map.needsUpdate = true;
      floorMesh.material.map.repeat.set(10, 10);
    }
  } else if (mapId === 4) { // Sniper Tower
    scene.background = new THREE.Color(0xddeeff);
    scene.fog = new THREE.Fog(0xddeeff, 20, 250);
    if (floorMesh) {
      floorMesh.material = new THREE.MeshPhongMaterial({ map: getTexture("grass").clone(), color: 0x888888 });
      floorMesh.material.map.needsUpdate = true;
      floorMesh.material.map.repeat.set(20, 20);
    }
  } else if (mapId === 1) { // City
    scene.background = new THREE.Color(0x8899aa);
    scene.fog = new THREE.FogExp2(0x8899aa, 0.015);
    if (floorMesh) {
      floorMesh.material = new THREE.MeshPhongMaterial({ map: getTexture("asphalt").clone(), color: 0x888888 });
      floorMesh.material.map.needsUpdate = true;
      floorMesh.material.map.repeat.set(20, 20);
    }
  } else if (mapId === 2) { // Maze
    scene.background = new THREE.Color(0x222222);
    scene.fog = new THREE.Fog(0x222222, 5, 80);
    if (floorMesh) {
      floorMesh.material = new THREE.MeshPhongMaterial({ map: getTexture("concrete").clone(), color: 0x555555 });
      floorMesh.material.map.needsUpdate = true;
      floorMesh.material.map.repeat.set(20, 20);
    }
  } else { // Classic
    scene.background = new THREE.Color(0x55aaee);
    scene.fog = new THREE.Fog(0x55aaee, 20, 150);
    if (floorMesh) {
      floorMesh.material = new THREE.MeshPhongMaterial({ map: getTexture("grass").clone(), color: 0x888888 });
      floorMesh.material.map.needsUpdate = true;
      floorMesh.material.map.repeat.set(20, 20);
    }
  }

  // Clear existing obstacles
  while (obstaclesGroup.children.length > 0) {
    const mesh = obstaclesGroup.children[0];
    obstaclesGroup.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) mesh.material.dispose();
  }
  obstacleBoxes = [];
  if (redFlagMesh) {
    scene.remove(redFlagMesh);
    if (redFlagMesh.geometry) redFlagMesh.geometry.dispose();
    if (redFlagMesh.material) redFlagMesh.material.dispose();
    redFlagMesh = null;
  }
  if (blueFlagMesh) {
    scene.remove(blueFlagMesh);
    if (blueFlagMesh.geometry) blueFlagMesh.geometry.dispose();
    if (blueFlagMesh.material) blueFlagMesh.material.dispose();
    blueFlagMesh = null;
  }

  const addBox = (w, h, d, x, y, z, mat, userData = {}) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = userData;
    obstaclesGroup.add(mesh);

    // Create bounding box for collision
    const box3 = new THREE.Box3().setFromObject(mesh);
    box3.userData = userData; // Attach userData to the box
    obstacleBoxes.push(box3);
    return mesh;
  };

  const barrelMat = new THREE.MeshPhongMaterial({ color: 0xdd2222 });
  const addBarrel = (x, y, z) => {
    // Unique ID for filtering later
    addBox(2, 3, 2, x, y, z, barrelMat, { isBarrel: true, id: Math.random() });
  };

  if (mapId === 0) { // Classic Arena
    const mat = new THREE.MeshPhongMaterial({ map: getTexture("brick").clone(), color: 0x999999 });
    mat.map.needsUpdate = true;
    mat.map.repeat.set(2, 1);

    // Outer walls
    addBox(100, 10, 2, 0, 5, -50, mat);
    addBox(100, 10, 2, 0, 5, 50, mat);
    addBox(2, 10, 100, -50, 5, 0, mat);
    addBox(2, 10, 100, 50, 5, 0, mat);

    // Center structure
    addBox(10, 8, 10, 0, 4, 0, mat);

    // Cover blocks
    const coverMat = new THREE.MeshPhongMaterial({ map: getTexture("concrete"), color: 0x777777 });
    addBox(6, 4, 2, -20, 2, -20, coverMat);
    addBox(6, 4, 2, 20, 2, 20, coverMat);
    addBox(2, 4, 6, -20, 2, 20, coverMat);
    addBox(2, 4, 6, 20, 2, -20, coverMat);

    // Ramps to center structure
    const rampMat = new THREE.MeshPhongMaterial({ color: 0x444444 });
    // Left ramp
    for(let i=0; i<5; i++) {
      addBox(2, i, 4, -6 - (4-i)*2, i/2, 0, rampMat);
    }
    // Right ramp
    for(let i=0; i<5; i++) {
      addBox(2, i, 4, 6 + (4-i)*2, i/2, 0, rampMat);
    }

    addBarrel(0, 1.5, -20);
    addBarrel(0, 1.5, 20);

  } else if (mapId === 1) { // City Streets
    const mat = new THREE.MeshPhongMaterial({ map: getTexture("brick"), color: 0x777777 });
    const windowMat = new THREE.MeshPhongMaterial({ color: 0x88ccff, transparent: true, opacity: 0.8 });

    // helper to create hollow buildings with doors and windows
    const createBuilding = (x, z, sizeX, sizeZ, floors) => {
      const floorHeight = 4;
      const wallThickness = 1;
      const doorWidth = 2;
      const doorHeight = 3;
      const windowWidth = 2;
      const windowHeight = 2;

      for (let f = 0; f < floors; f++) {
        const baseY = f * floorHeight;

        // Front wall (has door on ground floor, windows on upper floors)
        if (f === 0) {
          // Left of door
          addBox((sizeX - doorWidth) / 2, floorHeight, wallThickness, x - sizeX / 2 + (sizeX - doorWidth) / 4, baseY + floorHeight / 2, z + sizeZ / 2 - wallThickness / 2, mat);
          // Right of door
          addBox((sizeX - doorWidth) / 2, floorHeight, wallThickness, x + sizeX / 2 - (sizeX - doorWidth) / 4, baseY + floorHeight / 2, z + sizeZ / 2 - wallThickness / 2, mat);
          // Above door
          addBox(doorWidth, floorHeight - doorHeight, wallThickness, x, baseY + doorHeight + (floorHeight - doorHeight) / 2, z + sizeZ / 2 - wallThickness / 2, mat);
        } else {
          // Window
          addBox((sizeX - windowWidth) / 2, floorHeight, wallThickness, x - sizeX / 2 + (sizeX - windowWidth) / 4, baseY + floorHeight / 2, z + sizeZ / 2 - wallThickness / 2, mat);
          addBox((sizeX - windowWidth) / 2, floorHeight, wallThickness, x + sizeX / 2 - (sizeX - windowWidth) / 4, baseY + floorHeight / 2, z + sizeZ / 2 - wallThickness / 2, mat);
          // Below window
          addBox(windowWidth, 1, wallThickness, x, baseY + 0.5, z + sizeZ / 2 - wallThickness / 2, mat);
          // Above window
          addBox(windowWidth, floorHeight - windowHeight - 1, wallThickness, x, baseY + 1 + windowHeight + (floorHeight - windowHeight - 1) / 2, z + sizeZ / 2 - wallThickness / 2, mat);
          // The window itself
          addBox(windowWidth, windowHeight, wallThickness / 2, x, baseY + 1 + windowHeight / 2, z + sizeZ / 2 - wallThickness / 2, windowMat);
        }

        // Back wall (solid)
        addBox(sizeX, floorHeight, wallThickness, x, baseY + floorHeight / 2, z - sizeZ / 2 + wallThickness / 2, mat);

        // Left wall
        addBox(wallThickness, floorHeight, sizeZ - wallThickness * 2, x - sizeX / 2 + wallThickness / 2, baseY + floorHeight / 2, z, mat);

        // Right wall
        addBox(wallThickness, floorHeight, sizeZ - wallThickness * 2, x + sizeX / 2 - wallThickness / 2, baseY + floorHeight / 2, z, mat);

        // Floor / ceiling
        if (f > 0) {
          // Add a floor, but leave a gap for stairs
          const stairGap = 4;
          // Floor part 1 (main area)
          addBox(sizeX - wallThickness * 2 - stairGap, 0.5, sizeZ - wallThickness * 2, x - stairGap / 2, baseY, z, mat);
          // Floor part 2 (strip next to stairs)
          addBox(stairGap, 0.5, sizeZ - wallThickness * 2 - stairGap, x + sizeX / 2 - wallThickness - stairGap / 2, baseY, z + stairGap / 2, mat);

          // Stairs
          const numSteps = 8;
          const stepHeight = floorHeight / numSteps;
          const stepDepth = stairGap / numSteps;
          for (let s = 0; s < numSteps; s++) {
            addBox(stairGap, stepHeight, stepDepth, x + sizeX / 2 - wallThickness - stairGap / 2, baseY - floorHeight + stepHeight / 2 + s * stepHeight, z - sizeZ / 2 + wallThickness + stepDepth / 2 + s * stepDepth, mat);
          }
        } else {
           // Ground floor (fully solid just in case, but usually rests on map ground)
           addBox(sizeX - wallThickness * 2, 0.5, sizeZ - wallThickness * 2, x, baseY, z, mat);
        }
      }

      // Roof
      addBox(sizeX, 0.5, sizeZ, x, floors * floorHeight, z, mat);
    };

    // Hand-crafted building layout for better chokepoints
    createBuilding(-20, -20, 16, 16, 3);
    createBuilding(20, -20, 16, 16, 4);
    createBuilding(-20, 20, 16, 16, 2);
    createBuilding(20, 20, 16, 16, 3);

    // Some long alleyway walls
    addBox(40, 8, 2, 0, 4, -30, mat);
    addBox(40, 8, 2, 0, 4, 30, mat);

    // Add central monument/fountain
    const monumentMat = new THREE.MeshPhongMaterial({ map: getTexture("concrete"), color: 0xaa8866 });
    addBox(6, 1, 6, 0, 0.5, 0, monumentMat);
    addBox(4, 2, 4, 0, 2, 0, monumentMat);
    addBox(2, 6, 2, 0, 6, 0, monumentMat);

    // Add some parked cars (simple blocky cars)
    const carMat1 = new THREE.MeshPhongMaterial({ color: 0xcc2222 }); // Red car
    const carMat2 = new THREE.MeshPhongMaterial({ color: 0x2222cc }); // Blue car
    const carMat3 = new THREE.MeshPhongMaterial({ color: 0x22cc22 }); // Green car
    const carWindowMat = new THREE.MeshPhongMaterial({ color: 0x222222 }); // Dark tinted windows

    const createCar = (cx, cz, mat, rotAngle) => {
      addBox(2.5, 1, 5, cx, 0.5, cz, mat);
      addBox(2, 1, 2.5, cx, 1.5, cz, carWindowMat);
    };

    createCar(15, 5, carMat1, 0);
    createCar(-15, -8, carMat2, 0);
    createCar(5, 15, carMat1, 0);
    createCar(-5, -15, carMat2, 0);
    createCar(0, 10, carMat3, 0);

    // Dumpsters / Cover
    const dumpsterMat = new THREE.MeshPhongMaterial({ color: 0x114411 });
    addBox(4, 3, 2, 10, 1.5, -10, dumpsterMat);
    addBox(4, 3, 2, -10, 1.5, 10, dumpsterMat);
    addBox(2, 3, 4, -25, 1.5, 0, dumpsterMat);
    addBox(2, 3, 4, 25, 1.5, 0, dumpsterMat);

    addBarrel(2, 1.5, -10);
    addBarrel(-2, 1.5, 10);
    addBarrel(-25, 1.5, -6);
    addBarrel(25, 1.5, 6);

  } else if (mapId === 2) { // Maze
    const wallMat = new THREE.MeshPhongMaterial({ map: getTexture("metal"), color: 0x7a2233 });
    const coverMat = new THREE.MeshPhongMaterial({ map: getTexture("concrete"), color: 0x4f1a24 });
    const wallHeight = 6;

    // Outer boundaries
    addBox(100, wallHeight, 2, 0, wallHeight / 2, -50, wallMat);
    addBox(100, wallHeight, 2, 0, wallHeight / 2, 50, wallMat);
    addBox(2, wallHeight, 100, -50, wallHeight / 2, 0, wallMat);
    addBox(2, wallHeight, 100, 50, wallHeight / 2, 0, wallMat);

    // Maze walls laid out to create multiple loops and flank routes
    addBox(48, wallHeight, 2, -18, wallHeight / 2, -32, wallMat);
    addBox(2, wallHeight, 36, -42, wallHeight / 2, -12, wallMat);
    addBox(2, wallHeight, 30, -20, wallHeight / 2, -3, wallMat);
    addBox(26, wallHeight, 2, -6, wallHeight / 2, 14, wallMat);
    addBox(2, wallHeight, 26, 6, wallHeight / 2, -4, wallMat);
    addBox(28, wallHeight, 2, 22, wallHeight / 2, -22, wallMat);
    addBox(2, wallHeight, 42, 34, wallHeight / 2, -2, wallMat);
    addBox(34, wallHeight, 2, 16, wallHeight / 2, 26, wallMat);
    addBox(2, wallHeight, 24, -4, wallHeight / 2, 34, wallMat);
    addBox(22, wallHeight, 2, -30, wallHeight / 2, 30, wallMat);
    addBox(2, wallHeight, 20, -30, wallHeight / 2, 10, wallMat);
    addBox(14, wallHeight, 2, -34, wallHeight / 2, -2, wallMat);

    // Mid-lane cover so firefights are less binary in corridors
    addBox(4, 3, 4, -10, 1.5, -18, coverMat);
    addBox(4, 3, 4, 12, 1.5, -6, coverMat);
    addBox(4, 3, 4, 20, 1.5, 16, coverMat);
    addBox(4, 3, 4, -18, 1.5, 20, coverMat);
    addBox(4, 3, 4, 0, 1.5, 30, coverMat);

    addBarrel(-6, 1.5, -18);
    addBarrel(16, 1.5, -6);
    addBarrel(16, 1.5, 16);
    addBarrel(-14, 1.5, 20);
    addBarrel(0, 1.5, 25);

  } else if (mapId === 3) { // Space Station
    const wallMat = new THREE.MeshPhongMaterial({ map: getTexture("metal"), color: 0x777788 });
    const accentMat = new THREE.MeshPhongMaterial({ color: 0xee5500 });

    // Outer glass-like barrier
    const glassMat = new THREE.MeshPhongMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 });
    addBox(100, 20, 2, 0, 10, -50, glassMat);
    addBox(100, 20, 2, 0, 10, 50, glassMat);
    addBox(2, 20, 100, -50, 10, 0, glassMat);
    addBox(2, 20, 100, 50, 10, 0, glassMat);

    // Main central hub
    addBox(20, 10, 20, 0, 5, 0, wallMat);
    // Hub roof access
    addBox(10, 1, 10, 0, 10.5, 0, accentMat);

    // Corridors
    addBox(10, 6, 30, 0, 3, 25, wallMat);
    addBox(10, 6, 30, 0, 3, -25, wallMat);
    addBox(30, 6, 10, 25, 3, 0, wallMat);
    addBox(30, 6, 10, -25, 3, 0, wallMat);

    // Outer platforms
    addBox(20, 4, 20, 30, 2, 30, wallMat);
    addBox(20, 4, 20, -30, 2, -30, wallMat);
    addBox(20, 4, 20, 30, 2, -30, wallMat);
    addBox(20, 4, 20, -30, 2, 30, wallMat);

    // Jump pads to roof
    const jumpPadMat = new THREE.MeshPhongMaterial({ color: 0x00ffaa, emissive: 0x00ffaa, emissiveIntensity: 0.5 });
    addBox(4, 0.5, 4, 25, 4.25, 25, jumpPadMat, { isJumpPad: true, boostX: -280, boostZ: -280 });
    addBox(4, 0.5, 4, -25, 4.25, -25, jumpPadMat, { isJumpPad: true, boostX: 280, boostZ: 280 });
    addBox(4, 0.5, 4, 25, 4.25, -25, jumpPadMat, { isJumpPad: true, boostX: -280, boostZ: 280 });
    addBox(4, 0.5, 4, -25, 4.25, 25, jumpPadMat, { isJumpPad: true, boostX: 280, boostZ: -280 });

    // Ramps to platforms
    const rampMat = new THREE.MeshPhongMaterial({ map: getTexture("metal"), color: 0x555555 });
    // This is approximate stair stepping
    for(let i=0; i<8; i++) {
      addBox(4, i*0.5, 4, 15 + i*2, (i*0.5)/2, 30, rampMat);
      addBox(4, i*0.5, 4, -15 - i*2, (i*0.5)/2, -30, rampMat);
      addBox(4, i*0.5, 4, 15 + i*2, (i*0.5)/2, -30, rampMat);
      addBox(4, i*0.5, 4, -15 - i*2, (i*0.5)/2, 30, rampMat);
    }
  } else if (mapId === 4) { // Sniper Tower
    const wallMat = new THREE.MeshPhongMaterial({ map: getTexture("brick"), color: 0x999999 });
    const coverMat = new THREE.MeshPhongMaterial({ map: getTexture("concrete"), color: 0x555555 });

    // Tower A
    addBox(10, 20, 10, 0, 10, -40, wallMat);
    // Tower A stairs
    for(let i=0; i<20; i++) {
      addBox(2, i, 2, 6, i/2, -40 + (i%5)*2, coverMat);
    }
    // Tower B
    addBox(10, 20, 10, 0, 10, 40, wallMat);
    // Tower B stairs
    for(let i=0; i<20; i++) {
      addBox(2, i, 2, 6, i/2, 40 - (i%5)*2, coverMat);
    }

    // Quick access jump pads to top of towers
    const jumpPadMat = new THREE.MeshPhongMaterial({ color: 0x00ffaa, emissive: 0x00ffaa, emissiveIntensity: 0.5 });
    addBox(4, 0.5, 4, 0, 0.25, -30, jumpPadMat, { isJumpPad: true, boostX: 0, boostZ: 280 });
    addBox(4, 0.5, 4, 0, 0.25, 30, jumpPadMat, { isJumpPad: true, boostX: 0, boostZ: -280 });

    // Sparse mid cover
    for(let i=0; i<15; i++) {
      let cx = (Math.random() - 0.5) * 60;
      let cz = (Math.random() - 0.5) * 60;
      let ch = 2 + Math.random() * 4;
      addBox(3, ch, 3, cx, ch/2, cz, coverMat);
    }

    addBarrel(0, 1.5, 0);
    addBarrel(10, 1.5, 10);
    addBarrel(-10, 1.5, -10);

    // Side walls
    addBox(2, 8, 100, -30, 4, 0, wallMat);
    addBox(2, 8, 100, 30, 4, 0, wallMat);
  } else if (mapId === 5) { // CTF Two Forts Strategic Map
    const redBaseMat = new THREE.MeshPhongMaterial({ color: 0xcc3333 });
    const blueBaseMat = new THREE.MeshPhongMaterial({ color: 0x3333cc });
    const wallMat = new THREE.MeshPhongMaterial({ map: getTexture("brick"), color: 0x888888 });
    const bridgeMat = new THREE.MeshPhongMaterial({ map: getTexture("metal"), color: 0x555555 });
    const coverMat = new THREE.MeshPhongMaterial({ map: getTexture("concrete"), color: 0x666666 });

    // Larger arena bounds
    addBox(2, 12, 220, -110, 6, 0, wallMat);
    addBox(2, 12, 220, 110, 6, 0, wallMat);
    addBox(220, 12, 2, 0, 6, -110, wallMat);
    addBox(220, 12, 2, 0, 6, 110, wallMat);

    // Red fort
    addBox(22, 8, 2, -38, 4, 18, redBaseMat);
    addBox(22, 8, 2, -38, 4, -18, redBaseMat);
    addBox(2, 8, 38, -49, 4, 0, redBaseMat);
    // Inner wall split with doorway so enemies can breach and steal flag
    addBox(2, 8, 14, -27, 4, 12, redBaseMat);
    addBox(2, 8, 14, -27, 4, -12, redBaseMat);
    addBox(22, 1, 12, -38, 8.5, 0, redBaseMat);
    addBox(6, 2, 8, -33, 2, 0, coverMat);
    addBox(6, 2, 8, -43, 2, 0, coverMat);

    // Blue fort
    addBox(22, 8, 2, 38, 4, 18, blueBaseMat);
    addBox(22, 8, 2, 38, 4, -18, blueBaseMat);
    addBox(2, 8, 38, 49, 4, 0, blueBaseMat);
    // Inner wall split with doorway so enemies can breach and steal flag
    addBox(2, 8, 14, 27, 4, 12, blueBaseMat);
    addBox(2, 8, 14, 27, 4, -12, blueBaseMat);
    addBox(22, 1, 12, 38, 8.5, 0, blueBaseMat);
    addBox(6, 2, 8, 33, 2, 0, coverMat);
    addBox(6, 2, 8, 43, 2, 0, coverMat);

    // Mid bridge and lower lane
    addBox(74, 1, 12, 0, 8.5, 0, bridgeMat);
    addBox(12, 3, 4, -14, 2, 0, wallMat);
    addBox(12, 3, 4, 14, 2, 0, wallMat);
    addBox(12, 3, 4, 0, 2, 18, wallMat);
    addBox(12, 3, 4, 0, 2, -18, wallMat);

    // Side flank routes and jump pads (extended for larger map)
    addBox(2, 3, 60, -14, 1.5, 54, coverMat);
    addBox(2, 3, 60, 14, 1.5, -54, coverMat);
    const jumpPadMat = new THREE.MeshPhongMaterial({ color: 0x00ffaa, emissive: 0x00ffaa, emissiveIntensity: 0.4 });
    addBox(4, 0.5, 4, -14, 0.25, 54, jumpPadMat, { isJumpPad: true, boostX: 220, boostZ: -260 });
    addBox(4, 0.5, 4, 14, 0.25, -54, jumpPadMat, { isJumpPad: true, boostX: -220, boostZ: 260 });

    // Symmetric cover fields
    const coverSpots = [
      [-22, 18], [-22, -18], [22, 18], [22, -18],
      [-8, 28], [-8, -28], [8, 28], [8, -28],
      [-30, 34], [-30, -34], [30, 34], [30, -34],
      [-52, 60], [-52, -60], [52, 60], [52, -60],
      [-70, 44], [-70, -44], [70, 44], [70, -44]
    ];
    coverSpots.forEach(([x, z]) => addBox(6, 3, 3, x, 1.5, z, coverMat));

    // Create physical flag models so they can be seen holding or dropped
    const flagGeo = new THREE.CylinderGeometry(0.1, 0.1, 3);
    const flagMatRed = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const flagMatBlue = new THREE.MeshBasicMaterial({ color: 0x0000ff });

    redFlagMesh = new THREE.Mesh(flagGeo, flagMatRed);
    redFlagMesh.position.set(-40, 1.5, 0); // Inner Red Base
    scene.add(redFlagMesh);

    blueFlagMesh = new THREE.Mesh(flagGeo, flagMatBlue);
    blueFlagMesh.position.set(40, 1.5, 0); // Inner Blue Base
    scene.add(blueFlagMesh);
  }
}

window.voteMap = (mapId) => {
  if (room) {
    room.send("voteMap", mapId);
  }
};

const WEAPONS = [
  { name: "PISTOL", color: 0x555555, cooldown: 400, damage: 25, spread: 0, magSize: 12, reloadTime: 1200 },
  { name: "SHOTGUN", color: 0x882222, cooldown: 1000, damage: 20, spread: 0.1, bullets: 5, magSize: 6, reloadTime: 2000 },
  { name: "SNIPER", color: 0x228822, cooldown: 1500, damage: 100, spread: 0, magSize: 5, reloadTime: 2500 },
  { name: "GATLING", color: 0xccaa22, cooldown: 80, damage: 10, spread: 0.06, magSize: 120, reloadTime: 3000, immobilizesOnFire: true, unlockKills: 25 }
];

function initThreeJs() {
  initialized = true;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);
  scene.fog = new THREE.Fog(0x111111, 0, 100);

  camera = new THREE.PerspectiveCamera(75, 800 / 450, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ canvas: fpsCanvas, antialias: true });
  const updateRendererSize = () => {
    const width = Math.max(1, Math.floor(fpsGame.clientWidth || 800));
    const height = Math.max(1, Math.floor(fpsGame.clientHeight || 450));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  handleFpsResize = updateRendererSize;
  updateRendererSize();
  window.addEventListener("resize", updateRendererSize);
  document.addEventListener("fullscreenchange", updateRendererSize);
  renderer.shadowMap.enabled = true;

  // Lights
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  hemiLight.position.set(0, 200, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(20, 50, 20);
  dirLight.castShadow = true;
  dirLight.shadow.camera.top = 50;
  dirLight.shadow.camera.bottom = -50;
  dirLight.shadow.camera.left = -50;
  dirLight.shadow.camera.right = 50;
  scene.add(dirLight);

  // Floor
  const floorGeo = new THREE.PlaneGeometry(200, 200);
  const floorMat = new THREE.MeshPhongMaterial({ color: 0x333333, depthWrite: false });
  floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // Grid
  const grid = new THREE.GridHelper(200, 40, 0x000000, 0x000000);
  grid.material.opacity = 0.2;
  grid.material.transparent = true;
  scene.add(grid);

  obstaclesGroup = new THREE.Group();
  scene.add(obstaclesGroup);

  controls = new THREE.PointerLockControls(camera, document.body);

  fpsGame.addEventListener("click", () => {
    if (localPlayer.health > 0) {
      controls.lock();
    }
  });

  controls.addEventListener('lock', function () {
    fpsHint.style.display = 'none';
  });

  controls.addEventListener('unlock', function () {
    fpsHint.style.display = 'block';
  });

  gunMesh = new THREE.Group();
  gunMesh.position.set(0.3, -0.3, -0.5);
  camera.add(gunMesh);

  createGunModel(0);
  updateAmmoUI();

  // Muzzle flash
  const flashGeo = new THREE.PlaneGeometry(0.5, 0.5);
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
  muzzleFlash.position.set(0, 0, -0.5);
  muzzleFlash.rotation.y = Math.PI / 2;
  muzzleFlash.visible = false;
  gunMesh.add(muzzleFlash);

  muzzleLight = new THREE.PointLight(0xffff00, 0, 5);
  muzzleLight.position.set(0, 0, -0.5);
  gunMesh.add(muzzleLight);

  scene.add(controls.getObject());

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);

  fpsCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

  raycaster = new THREE.Raycaster();

  prevTime = performance.now();
  animate();
}

function unzoomSniper() {
  if (!isSniperZoomed) return;
  isSniperZoomed = false;
  camera.fov = 75;
  camera.updateProjectionMatrix();
  if (gunMesh) gunMesh.visible = true;
  document.getElementById("fpsScopeOverlay").style.display = "none";
}

function onKeyDown(event) {
  if (isInputFocused(event)) return;
  if (!controls.isLocked) return;
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW': moveForward = true; break;
    case 'ArrowLeft':
    case 'KeyA': moveLeft = true; break;
    case 'ArrowDown':
    case 'KeyS': moveBackward = true; break;
    case 'ArrowRight':
    case 'KeyD': moveRight = true; break;
    case 'Space':
      if (canJump === true) velocity.y += jumpVelocity;
      canJump = false;
      break;
    case 'ShiftLeft':
    case 'ShiftRight': isSprinting = true; break;
    case 'ControlLeft':
    case 'ControlRight':
    case 'KeyC': isCrouching = true; break;
    case 'Digit1': switchWeapon(0); break;
    case 'Digit2': switchWeapon(1); break;
    case 'Digit3': switchWeapon(2); break;
    case 'Digit4': switchWeapon(3); break;
    case 'KeyR': startReload(); break;
    case 'KeyG': throwGrenade(); break;
  }
}

function createGunModel(id) {
  if (!gunMesh) return;

  // Clear existing parts (except muzzle flash and light)
  for (let i = gunMesh.children.length - 1; i >= 0; i--) {
    const child = gunMesh.children[i];
    if (child !== muzzleFlash && child !== muzzleLight) {
      gunMesh.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
  }

  const matDark = new THREE.MeshPhongMaterial({ color: 0x222222 });
  const matMain = new THREE.MeshPhongMaterial({ color: WEAPONS[id].color });

  if (id === 0) { // Pistol
    const barrelGeo = new THREE.BoxGeometry(0.15, 0.15, 0.6);
    const barrel = new THREE.Mesh(barrelGeo, matMain);
    barrel.position.set(0, 0, 0);
    gunMesh.add(barrel);

    const gripGeo = new THREE.BoxGeometry(0.12, 0.3, 0.15);
    const grip = new THREE.Mesh(gripGeo, matDark);
    grip.position.set(0, -0.2, 0.15);
    grip.rotation.x = -Math.PI / 8;
    gunMesh.add(grip);
  } else if (id === 1) { // Shotgun
    const barrelGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 16);
    const barrel = new THREE.Mesh(barrelGeo, matMain);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.05, -0.2);
    gunMesh.add(barrel);

    const underBarrelGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.0, 16);
    const underBarrel = new THREE.Mesh(underBarrelGeo, matDark);
    underBarrel.rotation.x = Math.PI / 2;
    underBarrel.position.set(0, -0.05, -0.1);
    gunMesh.add(underBarrel);

    const stockGeo = new THREE.BoxGeometry(0.12, 0.2, 0.5);
    const stock = new THREE.Mesh(stockGeo, matDark);
    stock.position.set(0, -0.1, 0.5);
    stock.rotation.x = -Math.PI / 16;
    gunMesh.add(stock);
  } else if (id === 2) { // Sniper
    const barrelGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.8, 16);
    const barrel = new THREE.Mesh(barrelGeo, matMain);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -0.4);
    gunMesh.add(barrel);

    const bodyGeo = new THREE.BoxGeometry(0.12, 0.18, 0.8);
    const body = new THREE.Mesh(bodyGeo, matDark);
    body.position.set(0, -0.05, 0.3);
    gunMesh.add(body);

    const scopeBaseGeo = new THREE.BoxGeometry(0.06, 0.1, 0.2);
    const scopeBase = new THREE.Mesh(scopeBaseGeo, matDark);
    scopeBase.position.set(0, 0.1, 0.2);
    gunMesh.add(scopeBase);

    const scopeGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 16);
    const scope = new THREE.Mesh(scopeGeo, matMain);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.15, 0.2);
    gunMesh.add(scope);

    const stockGeo = new THREE.BoxGeometry(0.1, 0.25, 0.6);
    const stock = new THREE.Mesh(stockGeo, matDark);
    stock.position.set(0, -0.1, 0.9);
    stock.rotation.x = -Math.PI / 32;
    gunMesh.add(stock);
  } else if (id === 3) { // Gatling
    const bodyGeo = new THREE.BoxGeometry(0.2, 0.22, 0.9);
    const body = new THREE.Mesh(bodyGeo, matDark);
    body.position.set(0, -0.02, 0.2);
    gunMesh.add(body);

    const handleGeo = new THREE.BoxGeometry(0.1, 0.28, 0.14);
    const handle = new THREE.Mesh(handleGeo, matDark);
    handle.position.set(0, -0.22, 0.45);
    handle.rotation.x = -Math.PI / 12;
    gunMesh.add(handle);

    const barrelOffsets = [-0.06, 0, 0.06];
    barrelOffsets.forEach((yOffset) => {
      const barrelGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 16);
      const barrel = new THREE.Mesh(barrelGeo, matMain);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, yOffset, -0.35);
      gunMesh.add(barrel);
    });
  } else if (id === 4) { // Rocket Launcher
    const barrelGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 12);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, matMain);
    barrel.position.set(0, 0, 0);
    gunMesh.add(barrel);

    const scopeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.3);
    const scope = new THREE.Mesh(scopeGeo, matDark);
    scope.position.set(0, 0.25, 0);
    gunMesh.add(scope);
  } else if (id === 5) { // Assault Rifle
    const barrelGeo = new THREE.BoxGeometry(0.15, 0.2, 0.8);
    const barrel = new THREE.Mesh(barrelGeo, matMain);
    barrel.position.set(0, 0, 0);
    gunMesh.add(barrel);

    const stockGeo = new THREE.BoxGeometry(0.1, 0.3, 0.4);
    const stock = new THREE.Mesh(stockGeo, matDark);
    stock.position.set(0, -0.1, 0.5);
    gunMesh.add(stock);

    const magGeo = new THREE.BoxGeometry(0.1, 0.4, 0.15);
    const mag = new THREE.Mesh(magGeo, matDark);
    mag.position.set(0, -0.2, -0.1);
    mag.rotation.x = 0.2;
    gunMesh.add(mag);
  } else if (id === 6) { // Melee
    const handleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8);
    handleGeo.rotateX(Math.PI / 2);
    const handle = new THREE.Mesh(handleGeo, matDark);
    handle.position.set(0, 0, 0.2);
    gunMesh.add(handle);

    const bladeGeo = new THREE.BoxGeometry(0.02, 0.1, 0.6);
    const blade = new THREE.Mesh(bladeGeo, matMain);
    blade.position.set(0, 0, -0.3);
    gunMesh.add(blade);
  }
}

function isWeaponUnlocked(id) {
  const w = WEAPONS[id];
  if (w && w.unlockKills) {
    return localPlayer.kills >= w.unlockKills;
  }
  return true;
}

function switchWeapon(id) {
  if (id >= WEAPONS.length) return;
  if (!isWeaponUnlocked(id)) return;
  unzoomSniper();
  isReloading = false;
  if (gunMesh) {
    gunMesh.rotation.x = 0;
    gunMesh.rotation.y = 0;
    gunMesh.rotation.z = 0;
  }
  localPlayer.weapon = id;
  const w = WEAPONS[id];
  document.getElementById("fpsWeapon").textContent = w.name;
  updateAmmoUI();
  createGunModel(id);
}

function updateAmmoUI() {
  const w = WEAPONS[localPlayer.weapon];
  const currentAmmo = ammo[localPlayer.weapon];
  const ammoSpan = document.getElementById("fpsAmmo");
  if (isReloading) {
    ammoSpan.textContent = "RELOADING...";
    ammoSpan.style.color = "red";
  } else {
    ammoSpan.textContent = currentAmmo + "/" + w.magSize;
    ammoSpan.style.color = currentAmmo === 0 ? "red" : "orange";
  }
}

function startReload() {
  if (isReloading || ammo[localPlayer.weapon] === WEAPONS[localPlayer.weapon].magSize) return;

  const w = WEAPONS[localPlayer.weapon];
  isReloading = true;
  reloadEndTime = performance.now() + w.reloadTime;
  updateAmmoUI();
  unzoomSniper();
}

function onKeyUp(event) {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW': moveForward = false; break;
    case 'ArrowLeft':
    case 'KeyA': moveLeft = false; break;
    case 'ArrowDown':
    case 'KeyS': moveBackward = false; break;
    case 'ArrowRight':
    case 'KeyD': moveRight = false; break;
    case 'ShiftLeft':
    case 'ShiftRight': isSprinting = false; break;
    case 'ControlLeft':
    case 'ControlRight':
    case 'KeyC': isCrouching = false; break;
  }
}

function onMouseUp(event) {
  if (event.button === 0) {
    isPrimaryFireHeld = false;
  }
  if (event.button === 2) {
    if (WEAPONS[localPlayer.weapon].name === "SNIPER") {
      unzoomSniper();
    }
  }
}

function tryFireWeapon() {
  if (!controls.isLocked) return;
  if (localPlayer.health <= 0) return;
  if (isReloading) return; // Cannot fire while reloading

  const weapon = WEAPONS[localPlayer.weapon];
  const now = performance.now();
  if (now < nextFireTime) return;

  // Check Ammo
  if (ammo[localPlayer.weapon] <= 0) {
    startReload();
    return;
  }

  ammo[localPlayer.weapon]--;
  updateAmmoUI();

  nextFireTime = now + weapon.cooldown;
  if (weapon.immobilizesOnFire) {
    gatlingMovementLockUntil = now + weapon.cooldown;
  }

  // Show Muzzle Flash
  if (muzzleFlash && muzzleLight && !isSniperZoomed) {
    muzzleFlash.visible = true;
    muzzleFlash.rotation.z = Math.random() * Math.PI;
    muzzleLight.intensity = 2;
    muzzleFlashTime = now;
  }

  // Trigger Recoil
  recoilTime = now;
  if (localPlayer.weapon === 0) recoilIntensity = 0.2;
  else if (localPlayer.weapon === 1) recoilIntensity = 0.4;
  else if (localPlayer.weapon === 2) recoilIntensity = 0.6;
  else if (localPlayer.weapon === 4) recoilIntensity = 0.8;
  else if (localPlayer.weapon === 5) recoilIntensity = 0.15;
  else if (localPlayer.weapon === 6) recoilIntensity = 0; // Melee

  // Fire
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const origin = raycaster.ray.origin.clone();
  const dir = raycaster.ray.direction.clone();

  const bullets = weapon.bullets || 1;
  const spread = weapon.spread || 0;

  for (let i = 0; i < bullets; i++) {
    const bDir = dir.clone();
    if (spread > 0) {
      bDir.x += (Math.random() - 0.5) * spread;
      bDir.y += (Math.random() - 0.5) * spread;
      bDir.z += (Math.random() - 0.5) * spread;
      bDir.normalize();
    }
    createTracer(origin, bDir, weapon.color);

    // Client-side barrel check
    const rc = new THREE.Raycaster(origin, bDir, 0, 100);
    if (obstaclesGroup) {
      const intersects = rc.intersectObjects(obstaclesGroup.children);
      for (const hit of intersects) {
        if (hit.object.userData && hit.object.userData.isBarrel) {
          // Tell server barrel hit
          room.send("barrelHit", { x: hit.object.position.x, y: hit.object.position.y, z: hit.object.position.z });

          // Remove from local immediately so we don't shoot it again
          obstaclesGroup.remove(hit.object);
          hit.object.geometry.dispose();
          hit.object.material.dispose();

          // Remove its collision box
          obstacleBoxes = obstacleBoxes.filter(b => b.userData !== hit.object.userData);
          break; // Stop ray
        } else {
          break; // Hit a wall
        }
      }
    }

    room.send("shoot", {
      origin: { x: origin.x, y: origin.y, z: origin.z },
      dir: { x: bDir.x, y: bDir.y, z: bDir.z },
      weaponId: localPlayer.weapon
    });
  }
}

function onMouseDown(event) {
  if (!controls.isLocked) return;
  if (localPlayer.health <= 0) return;

  if (event.button === 2) {
    if (WEAPONS[localPlayer.weapon].name === "SNIPER") {
      isSniperZoomed = true;
      camera.fov = 20;
      camera.updateProjectionMatrix();
      if (gunMesh) gunMesh.visible = false;
      document.getElementById("fpsScopeOverlay").style.display = "block";
    }
    return;
  }

  if (event.button !== 0) return; // Left click only

  isPrimaryFireHeld = true;
  tryFireWeapon();
}

function cycleGrenade() {
  if (typeof currentGrenadeType !== 'undefined') {
    currentGrenadeType = (currentGrenadeType + 1) % 3;
  }
  updateGrenadeUI();
}

function updateGrenadeUI() {
  if (fpsGrenades) {
    let typeName = "FRAG";
    if (typeof currentGrenadeType !== 'undefined') {
        if (currentGrenadeType === 1) typeName = "SMOKE";
        if (currentGrenadeType === 2) typeName = "FLASH";
    }
    fpsGrenades.textContent = `${grenades} (${typeName})`;
  }
}

function throwGrenade() {
  if (!room || localPlayer.health <= 0) return;
  const now = performance.now();
  if (now < nextGrenadeTime) return;
  if (grenades <= 0) return;

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const origin = raycaster.ray.origin.clone();
  const dir = raycaster.ray.direction.clone();

  grenades -= 1;
  updateGrenadeUI();
  nextGrenadeTime = now + 2500;
  room.send("throwGrenade", {
    origin: { x: origin.x, y: origin.y, z: origin.z },
    dir: { x: dir.x, y: dir.y, z: dir.z },
    type: currentGrenadeType
  });
}

function createGrenadeEffect(position) {
  const geometry = new THREE.SphereGeometry(0.3, 10, 10);
  const material = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.8 });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.copy(position);
  scene.add(sphere);
  grenadeEffects.push({ mesh: sphere, born: performance.now() });
}

function createSmokeEffect(position) {
  const geometry = new THREE.SphereGeometry(1, 8, 8);
  const material = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.9, fog: false });
  playProceduralSound("explosion");

  for (let i = 0; i < 20; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.position.x += (Math.random() - 0.5) * 5;
    mesh.position.y += Math.random() * 5;
    mesh.position.z += (Math.random() - 0.5) * 5;

    // Random scale for smoke clouds
    const s = 2 + Math.random() * 3;
    mesh.scale.set(s, s, s);

    scene.add(mesh);
    smokeParticles.push({ mesh: mesh, born: performance.now() });
  }
}

function updateFlagPositions() {
  if (!room || room.state.mapId !== 5) return;
  if (!redFlagMesh || !blueFlagMesh) return;

  const RED_FLAG_BASE = new THREE.Vector3(-40, 1.5, 0);
  const BLUE_FLAG_BASE = new THREE.Vector3(40, 1.5, 0);

  if (room.state.redFlagStatus === 0 || room.state.redFlagStatus === 2) {
    redFlagMesh.position.copy(RED_FLAG_BASE);
    redFlagMesh.visible = true;
  } else if (room.state.redFlagStatus === 1) {
    const carrierId = room.state.redFlagCarrier;
    if (carrierId === localPlayer.id) {
       redFlagMesh.visible = false;
    } else if (otherPlayers[carrierId]) {
       redFlagMesh.position.copy(otherPlayers[carrierId].mesh.position);
       redFlagMesh.position.y += 2.5;
       redFlagMesh.visible = true;
    }
  }

  if (room.state.blueFlagStatus === 0 || room.state.blueFlagStatus === 2) {
    blueFlagMesh.position.copy(BLUE_FLAG_BASE);
    blueFlagMesh.visible = true;
  } else if (room.state.blueFlagStatus === 1) {
    const carrierId = room.state.blueFlagCarrier;
    if (carrierId === localPlayer.id) {
       blueFlagMesh.visible = false;
    } else if (otherPlayers[carrierId]) {
       blueFlagMesh.position.copy(otherPlayers[carrierId].mesh.position);
       blueFlagMesh.position.y += 2.5;
       blueFlagMesh.visible = true;
    }
  }
}

function createTracer(origin, dir, color = 0xffff00) {
  const material = new THREE.LineBasicMaterial({ color: color });
  const points = [];
  points.push(origin);
  const end = origin.clone().add(dir.clone().multiplyScalar(1000));
  points.push(end);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  tracers.push({ mesh: line, time: performance.now() });
}

function updateTracers(time) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    if (time - t.time > 100) { // Tracer lives for 100ms
      scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
      tracers.splice(i, 1);
    }
  }
}

function updateGrenadeEffects(time) {
  for (let i = grenadeEffects.length - 1; i >= 0; i--) {
    const fx = grenadeEffects[i];
    const age = time - fx.born;
    if (age > 400) {
      scene.remove(fx.mesh);
      fx.mesh.geometry.dispose();
      fx.mesh.material.dispose();
      grenadeEffects.splice(i, 1);
      continue;
    }
    const p = age / 400;
    const scale = 1 + p * 8;
    fx.mesh.scale.set(scale, scale, scale);
    fx.mesh.material.opacity = 0.8 * (1 - p);
  }

  for (let i = smokeParticles.length - 1; i >= 0; i--) {
    const fx = smokeParticles[i];
    const age = time - fx.born;
    const maxAge = 10000; // 10 seconds of smoke
    if (age > maxAge) {
      scene.remove(fx.mesh);
      fx.mesh.geometry.dispose();
      smokeParticles.splice(i, 1);
      continue;
    }
    const p = age / maxAge;
    // Fade out at end
    if (p > 0.8) {
      fx.mesh.material.opacity = 0.9 * (1 - ((p - 0.8) * 5));
    }
  }
}

function normalizeAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function updateRemotePlayers(delta) {
  const follow = Math.min(1, delta * 24); // fast follow for live feel
  const snapThresholdSq = 64;

  Object.values(otherPlayers).forEach((entry) => {
    if (!entry?.mesh || !entry.targetPos) return;

    const mesh = entry.mesh;
    const target = entry.targetPos;
    const dx = target.x - mesh.position.x;
    const dy = target.y - mesh.position.y;
    const dz = target.z - mesh.position.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    if (distSq > snapThresholdSq) {
      mesh.position.set(target.x, target.y, target.z);
    } else {
      mesh.position.x += dx * follow;
      mesh.position.y += dy * follow;
      mesh.position.z += dz * follow;
    }

    const targetRot = entry.targetRotY ?? mesh.rotation.y;
    const rotDelta = normalizeAngle(targetRot - mesh.rotation.y);
    mesh.rotation.y += rotDelta * follow;
  });
}

function animate() {
  gameLoopId = requestAnimationFrame(animate);

  const time = performance.now();
  const delta = (time - prevTime) / 1000;

  if (isReloading && time >= reloadEndTime) {
    isReloading = false;
    ammo[localPlayer.weapon] = WEAPONS[localPlayer.weapon].magSize;
    updateAmmoUI();
  }

  updateTracers(time);
  updateGrenadeEffects(time);
  updateRemotePlayers(delta);
  updateFlagPositions();
  updateCtfHud();
  updateTeamSelectUI();

  if (muzzleFlash && muzzleFlash.visible && time - muzzleFlashTime > 50) {
    muzzleFlash.visible = false;
    muzzleLight.intensity = 0;
  }

  if (controls.isLocked && localPlayer.health > 0) {
    const movementLockedByWeapon = time < gatlingMovementLockUntil;
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    velocity.y -= gravity * delta; // 100.0 = mass

    direction.z = movementLockedByWeapon ? 0 : Number(moveForward) - Number(moveBackward);
    direction.x = movementLockedByWeapon ? 0 : Number(moveRight) - Number(moveLeft);
    direction.normalize();

    let currentSpeed = speed;
    if (isSprinting) currentSpeed = sprintSpeed;
    if (isCrouching) currentSpeed = crouchSpeed;

    if (!movementLockedByWeapon && (moveForward || moveBackward)) velocity.z -= direction.z * currentSpeed * delta;
    if (!movementLockedByWeapon && (moveLeft || moveRight)) velocity.x -= direction.x * currentSpeed * delta;

    const playerRadius = 0.5;
    const dx = -velocity.x * delta;
    const dz = -velocity.z * delta;

    // Apply X movement
    controls.moveRight(dx);
    let playerBox = new THREE.Box3().setFromCenterAndSize(
        controls.getObject().position,
        new THREE.Vector3(playerRadius * 2, 2, playerRadius * 2) // Approximate player bounds
    );
    let collidedX = false;
    let stepUpAmountX = 0;
    for (const box of obstacleBoxes) {
        if (box.intersectsBox(playerBox)) {
            // Check if we can step up
            const playerBaseY = controls.getObject().position.y - 1; // since center is at y=1.5 and height is ~2
            const obstacleTopY = box.max.y;
            if (obstacleTopY - playerBaseY <= 0.6 && obstacleTopY > playerBaseY) {
                stepUpAmountX = Math.max(stepUpAmountX, obstacleTopY - playerBaseY);
            } else {
                collidedX = true;
                break;
            }
        }
    }
    if (collidedX) {
        controls.moveRight(-dx); // Revert X
        velocity.x = 0;
    } else if (stepUpAmountX > 0) {
        controls.getObject().position.y += stepUpAmountX;
    }

    // Apply Z movement
    controls.moveForward(dz);
    playerBox.setFromCenterAndSize(
        controls.getObject().position,
        new THREE.Vector3(playerRadius * 2, 2, playerRadius * 2)
    );
    let collidedZ = false;
    let stepUpAmountZ = 0;
    for (const box of obstacleBoxes) {
        if (box.intersectsBox(playerBox)) {
            // Check if we can step up
            const playerBaseY = controls.getObject().position.y - 1;
            const obstacleTopY = box.max.y;
            if (obstacleTopY - playerBaseY <= 0.6 && obstacleTopY > playerBaseY) {
                stepUpAmountZ = Math.max(stepUpAmountZ, obstacleTopY - playerBaseY);
            } else {
                collidedZ = true;
                break;
            }
        }
    }
    if (collidedZ) {
        controls.moveForward(-dz); // Revert Z
        velocity.z = 0;
    } else if (stepUpAmountZ > 0) {
        controls.getObject().position.y += stepUpAmountZ;
    }

    let prevY = controls.getObject().position.y;
    controls.getObject().position.y += (velocity.y * delta);

    let targetY = isCrouching ? 0.8 : 1.5;

    // Find highest floor below player
    let highestFloorY = 0; // Default ground is 0
    let prevFeetY = prevY - targetY;
    const px = controls.getObject().position.x;
    const pz = controls.getObject().position.z;

    for (const box of obstacleBoxes) {
        if (px + playerRadius > box.min.x && px - playerRadius < box.max.x &&
            pz + playerRadius > box.min.z && pz - playerRadius < box.max.z) {
            if (prevFeetY + 0.5 >= box.max.y) {
                if (box.max.y > highestFloorY) {
                    highestFloorY = box.max.y;
                }
            }
        }
    }

    let onJumpPad = false;
    let jumpPadBoostX = 0;
    let jumpPadBoostZ = 0;
    for (const box of obstacleBoxes) {
        if (px + playerRadius > box.min.x && px - playerRadius < box.max.x &&
            pz + playerRadius > box.min.z && pz - playerRadius < box.max.z) {
            if (controls.getObject().position.y - targetY <= box.max.y + 0.5 && controls.getObject().position.y - targetY >= box.max.y - 0.5) {
                if (box.userData && box.userData.isJumpPad) {
                    onJumpPad = true;
                    if (box.userData.boostX !== undefined) jumpPadBoostX = box.userData.boostX;
                    if (box.userData.boostZ !== undefined) jumpPadBoostZ = box.userData.boostZ;
                }
            }
        }
    }

    // Floor collision
    if (controls.getObject().position.y < highestFloorY + targetY) {
      velocity.y = 0;
      controls.getObject().position.y = highestFloorY + targetY;
      canJump = true;
    }

    if (onJumpPad) {
      velocity.y = 45; // Jump pad boost
      canJump = false;
      if (jumpPadBoostX !== 0 || jumpPadBoostZ !== 0) {
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.x = controls.getObject().rotation.x;
        euler.y = controls.getObject().rotation.y;
        const worldBoost = new THREE.Vector3(jumpPadBoostX, 0, jumpPadBoostZ);
        const invEuler = new THREE.Euler(0, -euler.y, 0, 'YXZ');
        worldBoost.applyEuler(invEuler);
        velocity.x = -worldBoost.x;
        velocity.z = worldBoost.z;
      }
    }

    // Sync to server
    if (room) {
      const pos = controls.getObject().position;
      // Extract Y rotation from camera
      const euler = new THREE.Euler(0, 0, 0, 'YXZ');
      euler.setFromQuaternion(camera.quaternion);

      room.send("move", { x: pos.x, y: pos.y, z: pos.z, rotY: euler.y });
    }
  }

  if (gunMesh) {
    const isMoving = controls.isLocked && localPlayer.health > 0 && (moveForward || moveBackward || moveLeft || moveRight);
    const speedMult = isSprinting ? 1.5 : 1.0;

    if (isMoving && !canJump && velocity.y === 0) {
      bobTime += delta * 10 * speedMult;
    } else {
      // Return to center when not moving
      bobTime += (0 - bobTime) * 10 * delta;
    }

    // Base gun positioning
    let targetX = 0.3;
    let targetY = -0.3;
    let targetZ = -0.5;
    let targetRotX = 0;

    // Weapon bobbing animation
    if (!isSniperZoomed) {
      targetX += Math.cos(bobTime) * 0.01;
      targetY += Math.abs(Math.sin(bobTime)) * 0.01;
    }

    // Recoil animation
    const timeSinceFire = time - recoilTime;
    if (timeSinceFire < 150) {
      const p = timeSinceFire / 150;
      targetZ += Math.sin(p * Math.PI) * recoilIntensity * 0.5;
      targetRotX += Math.sin(p * Math.PI) * recoilIntensity * 0.2;
    }

    // Reloading animation
    if (isReloading) {
      const reloadProgress = 1 - (reloadEndTime - time) / WEAPONS[localPlayer.weapon].reloadTime;
      targetY -= Math.sin(reloadProgress * Math.PI) * 0.3;
      targetRotX -= Math.sin(reloadProgress * Math.PI) * 0.5;
    }

    // Smooth dampening to target positions (clamped to prevent high-delta glitches)
    const dampFactor = Math.min(20 * delta, 1.0);
    gunMesh.position.x += (targetX - gunMesh.position.x) * dampFactor;
    gunMesh.position.y += (targetY - gunMesh.position.y) * dampFactor;
    gunMesh.position.z += (targetZ - gunMesh.position.z) * dampFactor;
    gunMesh.rotation.x += (targetRotX - gunMesh.rotation.x) * dampFactor;
  }

  if (isPrimaryFireHeld && localPlayer.weapon === 3) {
    tryFireWeapon();
  }

  renderer.render(scene, camera);
  prevTime = time;
}

export function initFps() {
  fpsMenu.style.display = "block";
  fpsGame.style.display = "none";
  fpsDeathScreen.style.display = "none";
  grenades = 2;
  nextGrenadeTime = 0;
  gatlingMovementLockUntil = 0;
  isPrimaryFireHeld = false;
  localPlayer.team = 0;
  updateGrenadeUI();
  updateCtfHud();
  updateTeamSelectUI();

  if (room) {
    room.leave();
    room = null;
  }

  btnRefresh.onclick = fetchServers;
  btnCreate.onclick = createRoom;
  btnJoin.onclick = () => joinRoom();

  fetchServers();
}

window.stopFps = () => {
  if (room) {
    room.leave();
    room = null;
  }
  if (controls && controls.isLocked) {
    controls.unlock();
  }
  if (gameLoopId) {
    cancelAnimationFrame(gameLoopId);
    gameLoopId = null;
  }
  initialized = false;

  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup', onKeyUp);
  document.removeEventListener('mousedown', onMouseDown);
  document.removeEventListener('mouseup', onMouseUp);
  if (handleFpsResize) {
    window.removeEventListener("resize", handleFpsResize);
    document.removeEventListener("fullscreenchange", handleFpsResize);
    handleFpsResize = null;
  }
  isPrimaryFireHeld = false;

  if (scene) {
     while(scene.children.length > 0){
        scene.remove(scene.children[0]);
    }
  }
  grenadeEffects = [];

  fpsMenu.style.display = "block";
  fpsGame.style.display = "none";
};
