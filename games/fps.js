import { state, isInputFocused, escapeHtml } from "../core.js";

let room = null;
let scene, camera, renderer, controls;
let raycaster;
let localPlayer = { id: "", x: 0, y: 1.5, z: 0, health: 100, kills: 0 };
let otherPlayers = {}; // id -> { mesh, data }
let gameLoopId;
let initialized = false;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
const speed = 40.0;
const jumpVelocity = 15.0;
const gravity = 40.0;
let prevTime = performance.now();

// Bullet tracers
let tracers = [];

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
    const res = await fetch(`${endpoint}/colyseus/api`);
    const rooms = await res.json();
    const fpsRooms = rooms.filter(r => r.name === "fps_room");

    serverList.innerHTML = "";
    if (fpsRooms.length === 0) {
      serverList.innerHTML = "<div>NO ACTIVE SERVERS. CREATE ONE.</div>";
      return;
    }

    fpsRooms.forEach(r => {
      const metadata = r.metadata || {};
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.padding = "5px";
      row.style.borderBottom = "1px solid #333";

      const info = document.createElement("span");
      info.textContent = `${metadata.serverName || r.roomId} (${r.clients}/${r.maxClients})`;

      const btn = document.createElement("button");
      btn.className = "term-btn";
      btn.textContent = "JOIN";
      btn.style.padding = "2px 8px";
      btn.onclick = () => joinRoom(r.roomId);

      row.appendChild(info);
      row.appendChild(btn);
      serverList.appendChild(row);
    });
  } catch (err) {
    serverList.innerHTML = "<div>ERROR FETCHING SERVERS.</div>";
    console.error(err);
  }
}

async function createRoom() {
  const serverName = serverNameInput.value.trim() || `${state.myName}'s Server`;
  try {
    const client = new Colyseus.Client(getColyseusEndpoint());
    room = await client.create("fps_room", { serverName, playerName: state.myName });
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
    localPlayer.x = data.x;
    localPlayer.y = data.y;
    localPlayer.z = data.z;
    controls.getObject().position.set(data.x, data.y, data.z);
    fpsHealth.textContent = localPlayer.health;
    fpsDeathScreen.style.display = "none";
    velocity.set(0,0,0);
  });

  room.onMessage("killed", (data) => {
    fpsDeathMessage.textContent = `FRAGGED BY ${data.killer}`;
    fpsDeathScreen.style.display = "flex";
  });

  room.onMessage("shoot", (data) => {
    createTracer(
      new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z),
      new THREE.Vector3(data.dir.x, data.dir.y, data.dir.z)
    );
  });

  room.state.players.onAdd((player, sessionId) => {
    if (sessionId === room.sessionId) {
      localPlayer.id = sessionId;
      localPlayer.health = player.health;
      localPlayer.kills = player.kills;

      player.listen("health", (val) => {
        localPlayer.health = val;
        fpsHealth.textContent = val;
      });
      player.listen("kills", (val) => {
        localPlayer.kills = val;
        fpsKills.textContent = val;
      });

    } else {
      // Create mesh for other player
      const geometry = new THREE.BoxGeometry(1, 2, 1);
      const material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(player.x, player.y, player.z);
      scene.add(mesh);

      otherPlayers[sessionId] = { mesh, data: player };

      player.listen("x", (val) => mesh.position.x = val);
      player.listen("y", (val) => mesh.position.y = val);
      player.listen("z", (val) => mesh.position.z = val);
      player.listen("rotY", (val) => mesh.rotation.y = val);
      // Hide if dead
      player.listen("health", (val) => mesh.visible = val > 0);
    }
    updateLeaderboard();
  });

  room.state.players.onRemove((player, sessionId) => {
    if (otherPlayers[sessionId]) {
      scene.remove(otherPlayers[sessionId].mesh);
      delete otherPlayers[sessionId];
    }
    updateLeaderboard();
  });

  // Call updateLeaderboard whenever kills change
  room.state.players.onChange(() => {
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

  // Obstacles
  const boxGeo = new THREE.BoxGeometry(4, 4, 4);
  const boxMat = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
  for (let i = 0; i < 30; i++) {
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.x = Math.floor(Math.random() * 40 - 20) * 4;
    box.position.y = 2;
    box.position.z = Math.floor(Math.random() * 40 - 20) * 4;
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);
  }

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

  scene.add(controls.getObject());

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousedown', onMouseDown);

  raycaster = new THREE.Raycaster();

  prevTime = performance.now();
  animate();
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
  }
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
  }
}

function onMouseDown(event) {
  if (!controls.isLocked) return;
  if (localPlayer.health <= 0) return;
  if (event.button !== 0) return; // Left click only

  // Fire
  const origin = controls.getObject().position.clone();

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  createTracer(origin, dir);

  room.send("shoot", {
    origin: { x: origin.x, y: origin.y, z: origin.z },
    dir: { x: dir.x, y: dir.y, z: dir.z }
  });
}

function createTracer(origin, dir) {
  const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
  const points = [];
  points.push(origin);
  const end = origin.clone().add(dir.clone().multiplyScalar(50));
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

function animate() {
  gameLoopId = requestAnimationFrame(animate);

  const time = performance.now();
  const delta = (time - prevTime) / 1000;

  updateTracers(time);

  if (controls.isLocked && localPlayer.health > 0) {
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    velocity.y -= gravity * delta; // 100.0 = mass

    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);

    controls.getObject().position.y += (velocity.y * delta);

    // Floor collision
    if (controls.getObject().position.y < 1.5) {
      velocity.y = 0;
      controls.getObject().position.y = 1.5;
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

  renderer.render(scene, camera);
  prevTime = time;
}

export function initFps() {
  fpsMenu.style.display = "block";
  fpsGame.style.display = "none";
  fpsDeathScreen.style.display = "none";

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

  if (scene) {
     while(scene.children.length > 0){
        scene.remove(scene.children[0]);
    }
  }

  fpsMenu.style.display = "block";
  fpsGame.style.display = "none";
};
