import {
  registerGameStop,
  state,
  dispatch,
  showToast
} from "../core.js";

let room;
let scene, camera, renderer, controls;
let hexMeshes = {};
let playerMeshes = {};
let localPlayerId = null;
let isDead = false;
let moveInterval;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let raycaster = new THREE.Raycaster();
let animationId;
let prevTime = performance.now();
let lastSyncTime = 0;

const HEX_RADIUS = 2.5;

function getNetworkUrl() {
  const select = document.getElementById("hexfallNetwork");
  const net = select ? select.value : "auto";
  if (net === "local") return "ws://localhost:2567";
  if (net === "prod") return "wss://seahorse-app-mv4sg.ondigitalocean.app";
  // auto
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "ws://localhost:2567";
  }
  return "wss://seahorse-app-mv4sg.ondigitalocean.app";
}

function getApiUrl() {
  const wsUrl = getNetworkUrl();
  if (wsUrl.startsWith("wss://")) return `https://${wsUrl.slice(6)}`;
  if (wsUrl.startsWith("ws://")) return `http://${wsUrl.slice(5)}`;
  return wsUrl;
}

export function initHexfall() {
  dispatch({ type: "SET_CURRENT_GAME", payload: "hexfall" });
  document.getElementById("hexfallMenu").style.display = "block";
  document.getElementById("hexfallGame").style.display = "none";
  document.getElementById("hexfallDeathScreen").style.display = "none";
  document.getElementById("hexfallRoundScreen").style.display = "none";

  refreshServerList();

  document.getElementById("btnRefreshHexfallServers").onclick = refreshServerList;
  document.getElementById("btnCreateHexfallServer").onclick = () => {
    joinServer({ create: true, serverName: document.getElementById("hexfallServerName").value });
  };
  document.getElementById("btnJoinHexfall").onclick = () => {
    joinServer({});
  };
}

function refreshServerList() {
  const url = getApiUrl() + "/hexfall-servers";
  fetch(url).then(r => r.json()).then(data => {
    const list = document.getElementById("hexfallServerList");
    list.innerHTML = "";
    if (!data.servers || data.servers.length === 0) {
      list.innerHTML = "<div style='font-size:10px'>NO SERVERS FOUND</div>";
      return;
    }
    data.servers.forEach(s => {
      const div = document.createElement("div");
      div.style.marginBottom = "5px";
      div.style.borderBottom = "1px dashed var(--accent-dim)";
      div.style.paddingBottom = "5px";
      div.style.display = "flex";
      div.style.justifyContent = "space-between";
      div.style.alignItems = "center";

      const info = document.createElement("div");
      info.innerHTML = `<strong style="color:var(--accent)">${s.serverName}</strong><br/><span style="font-size:10px">${s.clients}/${s.maxClients} PLAYERS</span>`;

      const btn = document.createElement("button");
      btn.className = "term-btn";
      btn.style.fontSize = "10px";
      btn.style.padding = "4px";
      btn.innerText = "JOIN";
      btn.onclick = () => joinServer({ roomId: s.roomId });

      div.appendChild(info);
      div.appendChild(btn);
      list.appendChild(div);
    });
  }).catch(e => {
    document.getElementById("hexfallServerList").innerHTML = "<div style='font-size:10px;color:#f66;'>ERROR LOADING SERVERS</div>";
  });
}

function joinServer(options) {
  document.getElementById("hexfallMenu").style.display = "none";
  document.getElementById("hexfallGame").style.display = "block";
  document.getElementById("hexfallStatus").innerText = "CONNECTING...";

  const client = new Colyseus.Client(getNetworkUrl());

  const joinOpts = { playerName: state.bio?.name || state.username || "Guest" };
  if (options.create) {
    joinOpts.serverName = options.serverName;
    client.create("hexfall_room", joinOpts).then(r => onJoined(r)).catch(e => showToast("JOIN ERROR", "❌"));
  } else if (options.roomId) {
    client.joinById(options.roomId, joinOpts).then(r => onJoined(r)).catch(e => showToast("JOIN ERROR", "❌"));
  } else {
    client.joinOrCreate("hexfall_room", joinOpts).then(r => onJoined(r)).catch(e => showToast("JOIN ERROR", "❌"));
  }
}

function onJoined(r) {
  room = r;
  localPlayerId = room.sessionId;

  document.getElementById("hexfallStatus").innerText = "CONNECTED";
  initThreeJS();

  room.state.hexes.onAdd((hex, key) => {
    const geo = new THREE.CylinderGeometry(HEX_RADIUS * 0.95, HEX_RADIUS * 0.95, 1, 6);
    const mat = new THREE.MeshLambertMaterial({ color: 0x00ff00 }); // Green floors
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(hex.x, hex.y, hex.z);

    // Create an outline edge
    const edges = new THREE.EdgesGeometry(geo);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x005500 }));
    mesh.add(line);

    scene.add(mesh);
    hexMeshes[key] = { mesh, hexObj: hex };

    hex.listen("stepped", (isStepped) => {
      if (isStepped) {
        mesh.material.color.setHex(0xff0000); // Turn red
      }
    });
  });

  room.state.hexes.onRemove((hex, key) => {
    if (hexMeshes[key]) {
      scene.remove(hexMeshes[key].mesh);
      hexMeshes[key].mesh.geometry.dispose();
      hexMeshes[key].mesh.material.dispose();
      delete hexMeshes[key];
    }
  });

  room.state.players.onAdd((player, key) => {
    if (key === localPlayerId) return; // Don't draw ourselves as a mesh

    const geo = new THREE.SphereGeometry(1, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: player.color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(player.x, player.y, player.z);
    scene.add(mesh);
    playerMeshes[key] = { mesh, playerObj: player };

    player.onChange(() => {
      mesh.position.set(player.x, player.y, player.z);
      mesh.visible = player.isAlive;
    });
  });

  room.state.players.onRemove((player, key) => {
    if (playerMeshes[key]) {
      scene.remove(playerMeshes[key].mesh);
      playerMeshes[key].mesh.geometry.dispose();
      playerMeshes[key].mesh.material.dispose();
      delete playerMeshes[key];
    }
  });

  room.state.listen("status", (s) => {
    document.getElementById("hexfallStatus").innerText = s.toUpperCase();
    if (s === "lobby") {
       // Auto-start if we are the first ones
       if (room.state.players.size >= 1) {
           room.send("start");
       }
    }
  });

  room.onMessage("matchStart", () => {
    document.getElementById("hexfallRoundScreen").style.display = "none";
    document.getElementById("hexfallDeathScreen").style.display = "none";
    isDead = false;

    // Reset our position visually instantly based on server state
    setTimeout(() => {
      const lp = room.state.players.get(localPlayerId);
      if (lp) {
        controls.getObject().position.set(lp.x, lp.y, lp.z);
      }
    }, 50);
  });

  room.onMessage("matchOver", (data) => {
    document.getElementById("hexfallRoundScreen").style.display = "flex";
    document.getElementById("hexfallRoundWinner").innerText = "Winner: " + data.winner;
  });

  moveInterval = setInterval(() => {
    if (!room || !controls) return;
    if (Date.now() - lastSyncTime > 50) {
      const pos = controls.getObject().position;
      room.send("move", { x: pos.x, y: pos.y, z: pos.z, rotY: camera.rotation.y });
      lastSyncTime = Date.now();
    }
  }, 50);
}

function initThreeJS() {
  const canvas = document.getElementById("hexfallCanvas");

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a1a);
  scene.fog = new THREE.Fog(0x0a0a1a, 20, 100);

  camera = new THREE.PerspectiveCamera(75, 800 / 450, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(800, 450);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  controls = new THREE.PointerLockControls(camera, canvas);
  canvas.addEventListener("click", () => {
    if (!isDead) controls.lock();
  });

  controls.getObject().position.set(0, 35, 0);
  scene.add(controls.getObject());

  prevTime = performance.now();
  animate();
}

function animate() {
  animationId = requestAnimationFrame(animate);

  const time = performance.now();
  const delta = (time - prevTime) / 1000;
  prevTime = time;

  if (room) {
    let aliveCount = 0;
    room.state.players.forEach(p => { if (p.isAlive) aliveCount++; });
    document.getElementById("hexfallAlive").innerText = aliveCount;
  }

  if (controls && controls.isLocked && !isDead) {
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    velocity.y -= 30.0 * delta; // Gravity

    direction.z = Number(state.keysPressed.ArrowUp || state.keysPressed.w) - Number(state.keysPressed.ArrowDown || state.keysPressed.s);
    direction.x = Number(state.keysPressed.ArrowRight || state.keysPressed.d) - Number(state.keysPressed.ArrowLeft || state.keysPressed.a);
    direction.normalize();

    const speed = 60.0;
    if (state.keysPressed.ArrowUp || state.keysPressed.w || state.keysPressed.ArrowDown || state.keysPressed.s) velocity.z -= direction.z * speed * delta;
    if (state.keysPressed.ArrowLeft || state.keysPressed.a || state.keysPressed.ArrowRight || state.keysPressed.d) velocity.x -= direction.x * speed * delta;

    const pos = controls.getObject().position;

    // Cast from above the camera position so we can still detect floors
    // even if a low frame rate lets us dip slightly into a platform.
    const rayOrigin = new THREE.Vector3(pos.x, pos.y + 3, pos.z);
    raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
    const floorMeshes = Object.values(hexMeshes).map(h => h.mesh);
    const intersects = raycaster.intersectObjects(floorMeshes, false);

    let onFloor = false;
    if (intersects.length > 0) {
      const floorY = intersects[0].point.y + 1.5; // floor + eye height
      const grounded = velocity.y <= 0 && pos.y <= floorY + 1.2;
      if (grounded) {
        velocity.y = Math.max(0, velocity.y);
        pos.y = floorY;
        onFloor = true;
      }

      // We are standing on this hex. Find its ID and tell server.
      if (onFloor) {
        const hitMesh = intersects[0].object;
        for (const [key, data] of Object.entries(hexMeshes)) {
          if (data.mesh === hitMesh && !data.hexObj.stepped) {
             room.send("stepHex", { id: key });
             break;
          }
        }
      }
    }

    if (onFloor && state.keysPressed[" "]) {
      velocity.y = 12; // Jump
      state.keysPressed[" "] = false; // consume
    }

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);
    controls.getObject().position.y += velocity.y * delta;

    // Death check
    if (pos.y < -10) {
       isDead = true;
       controls.unlock();
       document.getElementById("hexfallDeathScreen").style.display = "flex";
       room.send("die");
    }
  } else if (isDead && controls) {
     // Spectator float slowly down
     const pos = controls.getObject().position;
     if (pos.y > 0) pos.y -= 5 * delta;
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

registerGameStop(() => {
  if (room) {
    room.leave();
    room = null;
  }
  if (moveInterval) clearInterval(moveInterval);
  if (animationId) cancelAnimationFrame(animationId);
  if (controls) controls.unlock();
});
