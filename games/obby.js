import { registerGameStop, state, dispatch, showToast } from "../core.js";
import { getColyseusHttpUrl, getColyseusWsUrl, hasColyseusClient } from "./network.js";

let room;
let scene, camera, renderer, controls;
let playerMeshes = {};
let localPlayerId = null;
let isDead = false;
let moveInterval;
let velocity;
let direction;
let raycaster;
let animationId;
let prevTime = performance.now();
let lastSyncTime = 0;
const moveState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false
};
let keyDownHandler = null;
let keyUpHandler = null;

let platforms = [];
let killParts = [];
let checkpoints = [];
let currentCheckpointIndex = 0;

function getNetworkSelect() {
  return document.getElementById("obbyNetwork");
}

function getNetworkUrl() {
  return getColyseusWsUrl(getNetworkSelect());
}

function getApiUrl() {
  return getColyseusHttpUrl(getNetworkSelect());
}

function ensureDependencies() {
  if (!window.THREE || !window.THREE.PointerLockControls) {
    showToast("3D ENGINE MISSING", "⚠️", "Refresh or check static assets.");
    return false;
  }
  if (!hasColyseusClient()) {
    showToast("NETWORK MISSING", "⚠️", "Refresh or check network.");
    return false;
  }
  return true;
}

export function initObby() {
  if (!ensureDependencies()) return;

  const overlay = document.getElementById("overlayObby");
  if (!overlay) return;

  overlay.classList.add("active");

  const btnJoin = document.getElementById("btnJoinObby");
  const btnRefresh = document.getElementById("btnRefreshObbyServers");
  const btnCreate = document.getElementById("btnCreateObbyServer");
  const listEl = document.getElementById("obbyServerList");
  const nameInput = document.getElementById("obbyServerName");
  const selectNet = getNetworkSelect();

  if (selectNet && !selectNet.value) selectNet.value = "auto";

  let selectedRoomId = null;

  const renderServerList = (servers) => {
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!servers || servers.length === 0) {
      listEl.textContent = "NO SERVERS. CREATE ONE!";
      return;
    }
    servers.forEach((srv) => {
      const row = document.createElement("div");
      row.style.border = "1px solid #0f0";
      row.style.padding = "8px";
      row.style.marginBottom = "8px";
      row.style.cursor = "pointer";
      row.style.background = selectedRoomId === srv.roomId ? "rgba(0, 255, 0, 0.15)" : "transparent";

      const pNames = Array.isArray(srv.players) ? srv.players : [];
      const names = pNames.length ? pNames.join(", ") : "No players";

      row.innerHTML = `
        <div style="font-size: 11px; color: #0f0;">\${srv.serverName || "Obby Server"}</div>
        <div style="font-size: 9px; opacity: 0.9; margin-top: 4px;">PLAYERS (\${srv.clients}/\${srv.maxClients}): \${names}</div>
      `;
      row.onclick = () => {
        selectedRoomId = srv.roomId;
        renderServerList(servers);
        joinRoom(srv.roomId);
      };
      listEl.appendChild(row);
    });
  };

  const refreshServers = async () => {
    if (!btnRefresh) return;
    btnRefresh.textContent = "LOADING...";
    try {
      const res = await fetch(`\${getApiUrl()}/obby-servers`);
      const data = await res.json();
      renderServerList(data.servers);
    } catch (e) {
      console.error(e);
      if (listEl) listEl.textContent = "FAILED TO LOAD SERVERS";
    } finally {
      btnRefresh.textContent = "REFRESH SERVERS";
    }
  };

  if (btnRefresh) btnRefresh.onclick = refreshServers;
  if (selectNet) selectNet.onchange = () => { selectedRoomId = null; refreshServers(); };

  refreshServers();

  const joinRoom = async (roomId = null) => {
    if (btnJoin && !roomId) btnJoin.textContent = "CONNECTING...";
    try {
      const client = new window.Colyseus.Client(getNetworkUrl());
      const pName = state.myName || "Player";
      if (roomId) {
        room = await client.joinById(roomId, { name: pName });
      } else {
        room = await client.joinOrCreate("obby_room", { name: pName });
      }
      localPlayerId = room.sessionId;
      document.getElementById("obbyMenu").style.display = "none";
      document.getElementById("obbyGameContainer").style.display = "block";
      startGame();
    } catch (e) {
      console.error("Join Obby error:", e);
      if (btnJoin) btnJoin.textContent = "QUICK JOIN ANY SERVER";
      showToast("CONNECTION FAILED", "⚠️", "Could not join server.");
    }
  };

  if (btnJoin) btnJoin.onclick = () => joinRoom();
  if (btnCreate) {
    btnCreate.onclick = async () => {
      btnCreate.textContent = "CREATING...";
      try {
        const client = new window.Colyseus.Client(getNetworkUrl());
        const sName = (nameInput && nameInput.value) ? nameInput.value : "Public Obby";
        room = await client.create("obby_room", { name: state.myName || "Player", serverName: sName });
        localPlayerId = room.sessionId;
        document.getElementById("obbyMenu").style.display = "none";
        document.getElementById("obbyGameContainer").style.display = "block";
        startGame();
      } catch (e) {
        console.error("Create Obby error:", e);
        btnCreate.textContent = "CREATE SERVER";
        showToast("CREATION FAILED", "⚠️", "Could not create server.");
      }
    };
  }

  let isStopping = false;
  const stopObby = () => {
    if (isStopping) return;
    isStopping = true;
    if (room) room.leave();
    room = null;

    if (animationId) cancelAnimationFrame(animationId);
    if (moveInterval) clearInterval(moveInterval);

    if (keyDownHandler) document.removeEventListener("keydown", keyDownHandler);
    if (keyUpHandler) document.removeEventListener("keyup", keyUpHandler);

    if (controls) {
      controls.disconnect();
      document.removeEventListener("click", lockControlsObby);
    }

    const container = document.getElementById("obbyCanvasContainer");
    if (container && renderer) {
      container.removeChild(renderer.domElement);
    }

    scene = null;
    camera = null;
    renderer = null;
    controls = null;
    playerMeshes = {};
    platforms = [];
    killParts = [];
    checkpoints = [];

    const mnu = document.getElementById("obbyMenu");
    const gmc = document.getElementById("obbyGameContainer");
    if (mnu) mnu.style.display = "block";
    if (gmc) gmc.style.display = "none";
    if (btnJoin) btnJoin.textContent = "QUICK JOIN ANY SERVER";
    if (btnCreate) btnCreate.textContent = "CREATE SERVER";

    isStopping = false;
  };

  registerGameStop(stopObby);
  window.stopObby = stopObby;

  function lockControlsObby() {
      if (controls && !controls.isLocked) {
          controls.lock();
      }
  }

  function startGame() {
    initThreeJs();
    setupNetworkListeners();
    document.addEventListener("click", lockControlsObby);
  }

  function initThreeJs() {
    scene = new window.THREE.Scene();
    scene.background = new window.THREE.Color(0x87ceeb); // Sky blue
    scene.fog = new window.THREE.FogExp2(0x87ceeb, 0.015);

    const light = new window.THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    light.position.set(0, 200, 0);
    scene.add(light);

    const dirLight = new window.THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(0, 100, -50);
    dirLight.castShadow = true;
    scene.add(dirLight);

    camera = new window.THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new window.THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById("obbyCanvasContainer").appendChild(renderer.domElement);

    controls = new window.THREE.PointerLockControls(camera, renderer.domElement);
    scene.add(controls.getObject());

    const initialSpawn = getCheckpointSpawn(0);
    camera.position.set(initialSpawn.x, initialSpawn.y, initialSpawn.z);

    velocity = new window.THREE.Vector3();
    direction = new window.THREE.Vector3();
    raycaster = new window.THREE.Raycaster(new window.THREE.Vector3(), new window.THREE.Vector3(0, -1, 0), 0, 10);

    buildMap();

    keyDownHandler = (e) => {
      switch (e.code) {
        case "ArrowUp":
        case "KeyW":
          moveState.forward = true;
          break;
        case "ArrowLeft":
        case "KeyA":
          moveState.left = true;
          break;
        case "ArrowDown":
        case "KeyS":
          moveState.backward = true;
          break;
        case "ArrowRight":
        case "KeyD":
          moveState.right = true;
          break;
        case "Space":
          moveState.jump = true;
          break;
      }
    };

    keyUpHandler = (e) => {
      switch (e.code) {
        case "ArrowUp":
        case "KeyW":
          moveState.forward = false;
          break;
        case "ArrowLeft":
        case "KeyA":
          moveState.left = false;
          break;
        case "ArrowDown":
        case "KeyS":
          moveState.backward = false;
          break;
        case "ArrowRight":
        case "KeyD":
          moveState.right = false;
          break;
        case "Space":
          moveState.jump = false;
          break;
      }
    };

    document.addEventListener("keydown", keyDownHandler);
    document.addEventListener("keyup", keyUpHandler);

    window.addEventListener("resize", onWindowResize);

    prevTime = performance.now();
    animate();

    moveInterval = setInterval(() => {
      if (room && controls && controls.isLocked && !isDead) {
        const obj = controls.getObject();
        room.send("move", {
          x: obj.position.x,
          y: obj.position.y,
          z: obj.position.z,
          rotY: camera.rotation.y
        });
      }
    }, 50);
  }

  function onWindowResize() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  function getCheckpointSpawn(index) {
      if (index >= checkpoints.length) index = checkpoints.length - 1;
      const cp = checkpoints[index];
      if (cp) {
          return { x: cp.position.x, y: cp.position.y + 2, z: cp.position.z };
      }
      return { x: 0, y: 5, z: 0 };
  }

  function buildMap() {
    // Stage 1: Basic Jumps
    createCheckpoint(0, 0, 0); // Checkpoint 0
    createPlatform(0, 0, -10, 5, 1, 5);
    createPlatform(0, 0, -20, 5, 1, 5);
    createPlatform(0, 0, -30, 5, 1, 5);

    // Stage 2: Lava Jump
    createCheckpoint(0, 0, -40); // Checkpoint 1
    createKillPart(0, -0.4, -50, 10, 1, 10);
    createPlatform(-3, 0, -50, 2, 1, 2);
    createPlatform(3, 0, -50, 2, 1, 2);

    // Stage 3: Stairs
    createCheckpoint(0, 0, -60); // Checkpoint 2
    for(let i=0; i<10; i++) {
        createPlatform(0, i * 1.5, -70 - (i * 3), 4, 1, 4);
    }

    // Stage 4: Thin path over lava
    createCheckpoint(0, 15, -105); // Checkpoint 3
    createKillPart(0, 10, -125, 20, 1, 30);
    createPlatform(0, 15, -125, 1, 1, 30);

    // End
    createCheckpoint(0, 15, -145); // Finish line / Checkpoint 4
  }

  function createPlatform(x, y, z, w, h, d, color = 0x66cc66) {
      const geo = new window.THREE.BoxGeometry(w, h, d);
      const mat = new window.THREE.MeshStandardMaterial({ color });
      const mesh = new window.THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.receiveShadow = true;
      scene.add(mesh);
      platforms.push(mesh);
  }

  function createKillPart(x, y, z, w, h, d) {
      const geo = new window.THREE.BoxGeometry(w, h, d);
      const mat = new window.THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x550000 });
      const mesh = new window.THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      scene.add(mesh);
      killParts.push(mesh);
  }

  function createCheckpoint(x, y, z) {
      const idx = checkpoints.length;
      const geo = new window.THREE.BoxGeometry(6, 0.5, 6);
      const mat = new window.THREE.MeshStandardMaterial({ color: 0xffff00 }); // Yellow for checkpoints
      const mesh = new window.THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.receiveShadow = true;
      scene.add(mesh);
      mesh.userData = { isCheckpoint: true, index: idx };
      checkpoints.push(mesh);
      platforms.push(mesh); // Can stand on checkpoints
  }

  function setupNetworkListeners() {
    room.state.players.onAdd((player, sessionId) => {
      if (sessionId === localPlayerId) {
          player.listen("isAlive", (isAlive) => {
              if (isAlive && isDead) {
                  // respawn locally
                  isDead = false;
                  currentCheckpointIndex = player.currentCheckpoint;
                  const spawn = getCheckpointSpawn(currentCheckpointIndex);
                  controls.getObject().position.set(spawn.x, spawn.y, spawn.z);
                  velocity.set(0, 0, 0);

                  // show respawn message
                  const msg = document.createElement("div");
                  msg.textContent = "Respawned at Checkpoint " + currentCheckpointIndex;
                  msg.style.position = "absolute";
                  msg.style.top = "50%";
                  msg.style.left = "50%";
                  msg.style.transform = "translate(-50%, -50%)";
                  msg.style.color = "yellow";
                  msg.style.fontSize = "24px";
                  msg.style.fontFamily = "'Press Start 2P', monospace";
                  msg.style.pointerEvents = "none";
                  document.getElementById("obbyGameContainer").appendChild(msg);
                  setTimeout(() => msg.remove(), 1500);
              } else if (!isAlive && !isDead) {
                  isDead = true;
              }
          });
          return;
      }

      const geo = new window.THREE.BoxGeometry(2, 3, 2);
      const mat = new window.THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
      const mesh = new window.THREE.Mesh(geo, mat);
      scene.add(mesh);
      playerMeshes[sessionId] = mesh;

      player.listen("x", (val) => { mesh.position.x = val; });
      player.listen("y", (val) => { mesh.position.y = val - 1.5; }); // offset so box stands on ground
      player.listen("z", (val) => { mesh.position.z = val; });
      player.listen("rotY", (val) => { mesh.rotation.y = val; });
      player.listen("isAlive", (val) => { mesh.visible = val; });
    });

    room.state.players.onRemove((player, sessionId) => {
      if (playerMeshes[sessionId]) {
        scene.remove(playerMeshes[sessionId]);
        playerMeshes[sessionId].geometry.dispose();
        playerMeshes[sessionId].material.dispose();
        delete playerMeshes[sessionId];
      }
    });
  }

  function animate() {
    animationId = requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls.isLocked && !isDead) {
      velocity.x -= velocity.x * 10.0 * delta;
      velocity.z -= velocity.z * 10.0 * delta;
      velocity.y -= 9.8 * 4.0 * delta; // Gravity

      direction.z = Number(moveState.forward) - Number(moveState.backward);
      direction.x = Number(moveState.right) - Number(moveState.left);
      direction.normalize();

      const speed = 40.0;
      if (moveState.forward || moveState.backward) velocity.z -= direction.z * speed * delta;
      if (moveState.left || moveState.right) velocity.x -= direction.x * speed * delta;

      const obj = controls.getObject();
      const oldPos = obj.position.clone();

      // Vertical collision
      raycaster.ray.origin.copy(obj.position);
      raycaster.ray.origin.y -= 1.5; // Offset to player feet roughly
      raycaster.ray.direction.set(0, -1, 0);
      const platformHits = raycaster.intersectObjects(platforms);
      let onObject = false;

      if (platformHits.length > 0) {
          const hit = platformHits[0];
          // Check if distance is small and we are falling
          if (hit.distance < 0.5 && velocity.y <= 0) {
              velocity.y = 0;
              obj.position.y = hit.point.y + 2; // player height is around 2
              onObject = true;

              if (hit.object.userData.isCheckpoint) {
                  if (hit.object.userData.index > currentCheckpointIndex) {
                      currentCheckpointIndex = hit.object.userData.index;
                      room.send("checkpoint", { index: currentCheckpointIndex });
                      showToast("CHECKPOINT!", "🏁", "Progress saved.");
                  }
              }
          }
      }

      if (moveState.jump && onObject) {
        velocity.y = 20; // Jump force
        moveState.jump = false;
      }

      controls.moveRight(-velocity.x * delta);
      controls.moveForward(-velocity.z * delta);
      obj.position.y += velocity.y * delta;

      // Check kill parts (lava)
      let touchedLava = false;
      const playerBox = new window.THREE.Box3().setFromCenterAndSize(obj.position, new window.THREE.Vector3(1, 3, 1));

      for(const kp of killParts) {
          const kpBox = new window.THREE.Box3().setFromObject(kp);
          if (playerBox.intersectsBox(kpBox)) {
              touchedLava = true;
              break;
          }
      }

      // Fall death
      if (obj.position.y < -20) {
          touchedLava = true;
      }

      if (touchedLava) {
          isDead = true;
          room.send("die");
      }
    }

    prevTime = time;
    renderer.render(scene, camera);
  }
}
