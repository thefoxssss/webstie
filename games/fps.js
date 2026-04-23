import { state, isInputFocused, escapeHtml } from "../core.js";

let room = null;
let scene, camera, renderer, controls;
let raycaster;
let localPlayer = { id: "", x: 0, y: 1.5, z: 0, health: 100, kills: 0, weapon: 0 };
let otherPlayers = {}; // id -> { mesh, data }
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
let gameLoopId;
let initialized = false;

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
let prevTime = performance.now();

// Bullet tracers
let tracers = [];

let obstaclesGroup;
let obstacleBoxes = [];

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
  });

  room.onMessage("mapVotes", (votes) => {
    document.getElementById("mapVote0").textContent = `(${votes[0]})`;
    document.getElementById("mapVote1").textContent = `(${votes[1]})`;
    document.getElementById("mapVote2").textContent = `(${votes[2]})`;
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
  });

  room.state.players.onAdd((player, sessionId) => {
    if (sessionId === room.sessionId) {
      localPlayer.id = sessionId;
      localPlayer.health = player.health;
      localPlayer.kills = player.kills;
      grenades = 2;
      updateGrenadeUI();

      player.listen("health", (val) => {
        localPlayer.health = val;
        fpsHealth.textContent = val;
      });
      player.listen("kills", (val) => {
        localPlayer.kills = val;
        fpsKills.textContent = val;
        if (!isGatlingUnlocked() && localPlayer.weapon === 3) {
          switchWeapon(0);
        }
      });

    } else {
      // Create mesh for other player
      const playerGroup = new THREE.Group();

      const geometry = new THREE.BoxGeometry(1, 2, 1);
      const material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
      const mesh = new THREE.Mesh(geometry, material);
      playerGroup.add(mesh);

      const gunGeo = new THREE.BoxGeometry(0.2, 0.2, 0.8);
      const gunMat = new THREE.MeshPhongMaterial({ color: 0x555555 });
      const otherGunMesh = new THREE.Mesh(gunGeo, gunMat);
      otherGunMesh.position.set(0.6, 0.2, -0.4);
      playerGroup.add(otherGunMesh);

      playerGroup.position.set(player.x, player.y, player.z);
      scene.add(playerGroup);

      otherPlayers[sessionId] = { mesh: playerGroup, data: player };

      player.listen("x", (val) => playerGroup.position.x = val);
      player.listen("y", (val) => playerGroup.position.y = val);
      player.listen("z", (val) => playerGroup.position.z = val);
      player.listen("rotY", (val) => playerGroup.rotation.y = val);
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
      delete otherPlayers[sessionId];
    }
    updateLeaderboard();
  });
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

function loadMap(mapId) {
  if (!obstaclesGroup) return;

  // Clear existing obstacles
  while (obstaclesGroup.children.length > 0) {
    const mesh = obstaclesGroup.children[0];
    obstaclesGroup.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) mesh.material.dispose();
  }
  obstacleBoxes = [];

  const addBox = (w, h, d, x, y, z, mat) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    obstaclesGroup.add(mesh);

    // Create bounding box for collision
    const box3 = new THREE.Box3().setFromObject(mesh);
    obstacleBoxes.push(box3);
  };

  if (mapId === 0) { // Classic Arena
    const mat = new THREE.MeshPhongMaterial({ color: 0x228822 });
    // Outer walls
    addBox(100, 10, 2, 0, 5, -50, mat);
    addBox(100, 10, 2, 0, 5, 50, mat);
    addBox(2, 10, 100, -50, 5, 0, mat);
    addBox(2, 10, 100, 50, 5, 0, mat);

    // Center structure
    addBox(10, 8, 10, 0, 4, 0, mat);

    // Cover blocks
    addBox(6, 4, 2, -20, 2, -20, mat);
    addBox(6, 4, 2, 20, 2, 20, mat);
    addBox(2, 4, 6, -20, 2, 20, mat);
    addBox(2, 4, 6, 20, 2, -20, mat);

  } else if (mapId === 1) { // City Streets
    const mat = new THREE.MeshPhongMaterial({ color: 0x444455 });
    const windowMat = new THREE.MeshPhongMaterial({ color: 0x88ccff });

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

    // Generate deterministic buildings around the map
    for(let i=0; i<6; i++) {
      let x = Math.sin(i * 1.5) * 35;
      let z = Math.cos(i * 2.1) * 35;
      let sizeX = 12 + Math.abs(Math.sin(i)) * 6;
      let sizeZ = 12 + Math.abs(Math.cos(i)) * 6;
      let floors = 3 + Math.floor(Math.abs(Math.sin(i * 3.3)) * 4);

      createBuilding(x, z, sizeX, sizeZ, floors);
    }

    // Add central monument/fountain
    const monumentMat = new THREE.MeshPhongMaterial({ color: 0xaa8866 });
    addBox(6, 1, 6, 0, 0.5, 0, monumentMat);
    addBox(4, 2, 4, 0, 2, 0, monumentMat);
    addBox(2, 6, 2, 0, 6, 0, monumentMat);

    // Add some parked cars (simple blocky cars)
    const carMat1 = new THREE.MeshPhongMaterial({ color: 0xcc2222 }); // Red car
    const carMat2 = new THREE.MeshPhongMaterial({ color: 0x2222cc }); // Blue car
    const carWindowMat = new THREE.MeshPhongMaterial({ color: 0x222222 }); // Dark tinted windows

    const createCar = (cx, cz, mat, rotAngle) => {
      // Very basic blocky car. Because our addBox takes x/y/z directly, we can just approximate it
      // if it's axis-aligned. For arbitrary rotation, we'd need more logic, but we'll keep them axis aligned.
      // Chassis
      addBox(2.5, 1, 5, cx, 0.5, cz, mat);
      // Cabin
      addBox(2, 1, 2.5, cx, 1.5, cz, carWindowMat);
    };

    createCar(15, 5, carMat1, 0);
    createCar(-15, -8, carMat2, 0);
    createCar(5, 15, carMat1, 0);
    createCar(-5, -15, carMat2, 0);

  } else if (mapId === 2) { // Maze
    const wallMat = new THREE.MeshPhongMaterial({ color: 0x7a2233 });
    const coverMat = new THREE.MeshPhongMaterial({ color: 0x4f1a24 });
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

  renderer = new THREE.WebGLRenderer({ canvas: fpsCanvas, antialias: false });
  renderer.setSize(800, 450);
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
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

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
  }
}

function isGatlingUnlocked() {
  return localPlayer.kills >= WEAPONS[3].unlockKills;
}

function switchWeapon(id) {
  if (id >= WEAPONS.length) return;
  if (id === 3 && !isGatlingUnlocked()) return;
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
  if (event.button === 2) {
    if (WEAPONS[localPlayer.weapon].name === "SNIPER") {
      unzoomSniper();
    }
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

  if (isReloading) return; // Cannot fire while reloading

  const now = performance.now();
  if (now < nextFireTime) return;

  const weapon = WEAPONS[localPlayer.weapon];

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

    room.send("shoot", {
      origin: { x: origin.x, y: origin.y, z: origin.z },
      dir: { x: bDir.x, y: bDir.y, z: bDir.z },
      weaponId: localPlayer.weapon
    });
  }
}

function updateGrenadeUI() {
  if (fpsGrenades) fpsGrenades.textContent = String(grenades);
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
    dir: { x: dir.x, y: dir.y, z: dir.z }
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

    // Floor collision
    if (controls.getObject().position.y < highestFloorY + targetY) {
      velocity.y = 0;
      controls.getObject().position.y = highestFloorY + targetY;
      canJump = true;
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
  updateGrenadeUI();

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

  if (scene) {
     while(scene.children.length > 0){
        scene.remove(scene.children[0]);
    }
  }
  grenadeEffects = [];

  fpsMenu.style.display = "block";
  fpsGame.style.display = "none";
};
