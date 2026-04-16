// fnaf.js - 3D Multiplayer Horror Survival Game (Raycaster)
import { state } from "../core.js";

let canvas, ctx;
let animationId;
let isFnafRunning = false;

// Map & Player state
let mapWidth = 10, mapHeight = 10;
let map = [
  [1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,1,1,0,0,0,1],
  [1,0,1,0,1,1,0,1,0,1],
  [1,0,1,0,0,0,0,1,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,1,2,1,0,0,1,3,1,1],
  [1,1,0,1,1,1,1,0,1,1],
  [1,1,0,1,1,1,1,0,1,1],
  [1,1,0,0,0,0,0,0,1,1],
  [1,1,1,1,1,1,1,1,1,1]
];

let pX = 5.5, pY = 5.5; // Player position (Office)
let pDirX = 0, pDirY = -1; // Player direction vector
let planeX = 0.66, planeY = 0; // 2D raycaster camera plane

let cameraMode = false;
let currentCameraIndex = 0;
let cameraLocations = [
    { x: 1.5, y: 1.5, dirX: 1, dirY: 0, pX: 0, pY: 0.66 }, // Show stage
    { x: 8.5, y: 1.5, dirX: -1, dirY: 0, pX: 0, pY: -0.66 }, // Dining area
    { x: 2.5, y: 4.5, dirX: 0, dirY: -1, pX: 0.66, pY: 0 }, // West Hall
    { x: 7.5, y: 4.5, dirX: 0, dirY: -1, pX: 0.66, pY: 0 }, // East Hall
];

// Global Fnaf state synced from server
let fnafGameState = {
    power: 100,
    time: 0,
    doorLeft: false,
    doorRight: false,
    lightLeft: false,
    lightRight: false,
    animatronics: {}
}; // 2D raycaster camera plane

// Multiplayer state
let fnafRoom = null;
let networkPlayers = {};

window.initFnaf = () => {
  canvas = document.getElementById("fnafCanvas");
  if (!canvas) return;
  ctx = canvas.getContext("2d", { alpha: false }); // alpha false for perf

  isFnafRunning = true;

  // Show Menu, hide game initially
  document.getElementById("fnafMenu").style.display = "block";
  document.getElementById("fnafGame").style.display = "none";

  setupFnafMenu();
};

function setupFnafMenu() {
  const btnRefresh = document.getElementById("btnRefreshFnafServers");
  const btnCreate = document.getElementById("btnCreateFnafServer");
  const btnJoin = document.getElementById("btnJoinFnaf");

  btnRefresh.onclick = refreshFnafServers;
  btnCreate.onclick = () => {
    const name = document.getElementById("fnafServerName").value.trim() || "New FNAF World";
    startFnafGame({ create: true, serverName: name });
  };
  btnJoin.onclick = () => {
    startFnafGame({});
  };

  refreshFnafServers();
}

async function refreshFnafServers() {
  const listEl = document.getElementById("fnafServerList");
  listEl.innerHTML = "LOADING SERVERS...";

  let networkSelect = document.getElementById("fnafNetwork");
  let selected = networkSelect ? networkSelect.value : "auto";
  const isLocalEnv = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.search.includes("local=1");
  let defaultServer = isLocalEnv ? "local" : "prod";

  let endpoint = selected === "local" ? "http://localhost:2567" : "https://seahorse-app-mv4sg.ondigitalocean.app";
  if (selected === "auto") {
      endpoint = defaultServer === "local" ? "http://localhost:2567" : "https://seahorse-app-mv4sg.ondigitalocean.app";
  }


  try {
    const res = await fetch(`${endpoint}/fnaf_servers`);
    if (!res.ok) throw new Error("Failed to fetch fnaf servers");
    const servers = await res.json();

    listEl.innerHTML = "";
    if (servers.length === 0) {
      listEl.innerHTML = "<div style='color:#ccc;'>NO ACTIVE SERVERS. BE THE FIRST!</div>";
      return;
    }

    servers.forEach(srv => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.padding = "4px 0";
      row.style.borderBottom = "1px solid #444";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = srv.serverName;

      const countSpan = document.createElement("span");
      countSpan.textContent = `${srv.clients} / ${srv.maxClients}`;

      const joinBtn = document.createElement("button");
      joinBtn.className = "term-btn";
      joinBtn.style.padding = "2px 6px";
      joinBtn.textContent = "JOIN";
      joinBtn.onclick = () => startFnafGame({ roomId: srv.roomId });

      row.appendChild(nameSpan);
      row.appendChild(countSpan);
      row.appendChild(joinBtn);
      listEl.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    listEl.innerHTML = "<div style='color:red;'>ERROR LOADING SERVERS</div>";
  }
}

async function startFnafGame(options) {
  document.getElementById("fnafMenu").style.display = "none";
  document.getElementById("fnafGame").style.display = "block";

  // Stop previous loop if any
  if (animationId) cancelAnimationFrame(animationId);

  // Reset player pos
  pX = 1.5; pY = 1.5;
  pDirX = -1; pDirY = 0;
  planeX = 0; planeY = 0.66;

  // Colyseus Connect
  try {
      let networkSelect = document.getElementById("fnafNetwork");
      let selected = networkSelect ? networkSelect.value : "auto";
      const isLocalEnv = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.search.includes("local=1");
      let defaultServer = isLocalEnv ? "local" : "prod";

      let endpoint = selected === "local" ? "ws://localhost:2567" : "wss://seahorse-app-mv4sg.ondigitalocean.app";
      if (selected === "auto") {
          endpoint = defaultServer === "local" ? "ws://localhost:2567" : "wss://seahorse-app-mv4sg.ondigitalocean.app";
      }
      const client = new Colyseus.Client(endpoint);

      if (options.create) {
         fnafRoom = await client.create("fnaf_room", { serverName: options.serverName });
      } else if (options.roomId) {
         fnafRoom = await client.joinById(options.roomId);
      } else {
         fnafRoom = await client.joinOrCreate("fnaf_room");
      }

      fnafRoom.state.players.onAdd((player, sessionId) => {
          if (sessionId === fnafRoom.sessionId) return; // Skip self
          networkPlayers[sessionId] = player;
          player.onChange(() => {
              networkPlayers[sessionId] = player;
          });
      });

      fnafRoom.state.players.onRemove((player, sessionId) => {
          delete networkPlayers[sessionId];
      });

      fnafRoom.state.animatronics.onAdd((anim, id) => {
          fnafGameState.animatronics[id] = anim;
          anim.onChange(() => {
              fnafGameState.animatronics[id] = anim;
          });
      });
      fnafRoom.state.animatronics.onRemove((anim, id) => {
          delete fnafGameState.animatronics[id];
      });

      fnafRoom.state.onChange(() => {
          fnafGameState.power = fnafRoom.state.power;
          fnafGameState.time = fnafRoom.state.time;
          fnafGameState.doorLeft = fnafRoom.state.doorLeft;
          fnafGameState.doorRight = fnafRoom.state.doorRight;
          fnafGameState.lightLeft = fnafRoom.state.lightLeft;
          fnafGameState.lightRight = fnafRoom.state.lightRight;

          let powerEl = document.getElementById("fnafPower");
          if(powerEl) powerEl.innerText = Math.floor(fnafGameState.power) + "%";
          let timeEl = document.getElementById("fnafTime");
          if(timeEl) timeEl.innerText = (fnafGameState.time === 0 ? "12" : fnafGameState.time) + " AM";
      });

  } catch (e) {
      console.error("FNAF MP Error:", e);
      document.getElementById("fnafMenu").style.display = "block";
      document.getElementById("fnafGame").style.display = "none";
      return;
  }

  canvas.addEventListener("click", onCanvasClick);
  document.addEventListener("pointerlockchange", onPointerLockChange);

  lastTime = performance.now();
  fnafLoop();
}

function onCanvasClick() {
    canvas.requestPointerLock();
}

function onPointerLockChange() {
    if (document.pointerLockElement === canvas) {
        document.addEventListener("mousemove", onMouseMove);
    } else {
        document.removeEventListener("mousemove", onMouseMove);
    }
}

function onMouseMove(e) {
    const rotSpeed = -e.movementX * 0.003; // Rotate based on mouse
    let oldDirX = pDirX;
    pDirX = pDirX * Math.cos(rotSpeed) - pDirY * Math.sin(rotSpeed);
    pDirY = oldDirX * Math.sin(rotSpeed) + pDirY * Math.cos(rotSpeed);
    let oldPlaneX = planeX;
    planeX = planeX * Math.cos(rotSpeed) - planeY * Math.sin(rotSpeed);
    planeY = oldPlaneX * Math.sin(rotSpeed) + planeY * Math.cos(rotSpeed);
}

window.stopFnaf = () => {
  isFnafRunning = false;
  if (animationId) cancelAnimationFrame(animationId);
  canvas.removeEventListener("click", onCanvasClick);
  document.removeEventListener("pointerlockchange", onPointerLockChange);
  document.removeEventListener("mousemove", onMouseMove);
  if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
  }
  if (fnafRoom) {
      fnafRoom.leave();
      fnafRoom = null;
  }
  networkPlayers = {};
};

let lastTime = 0;

function fnafLoop() {
  if (!isFnafRunning) return;

  let now = performance.now();
  let dt = (now - lastTime) / 1000;
  lastTime = now;

  update(dt);
  render();

  animationId = requestAnimationFrame(fnafLoop);
}

let lastKeyQ = false;
let lastKeyE = false;
let lastKeySpace = false;
let lastKey1 = false;
let lastKey2 = false;

function update(dt) {
  const moveSpeed = 3.0 * dt;

  let currentQ = state.keysPressed['q'] || state.keysPressed['Q'];
  if (currentQ && !lastKeyQ && fnafRoom) {
      fnafRoom.send("toggleAction", { action: "doorLeft" });
  }
  lastKeyQ = currentQ;

  let currentE = state.keysPressed['e'] || state.keysPressed['E'];
  if (currentE && !lastKeyE && fnafRoom) {
      fnafRoom.send("toggleAction", { action: "doorRight" });
  }
  lastKeyE = currentE;

  let current1 = state.keysPressed['1'];
  if (current1 && !lastKey1 && fnafRoom) {
      fnafRoom.send("toggleAction", { action: "lightLeft" });
  }
  lastKey1 = current1;

  let current2 = state.keysPressed['2'];
  if (current2 && !lastKey2 && fnafRoom) {
      fnafRoom.send("toggleAction", { action: "lightRight" });
  }
  lastKey2 = current2;

  let currentSpace = state.keysPressed[' '];
  if (currentSpace && !lastKeySpace) {
      cameraMode = !cameraMode;
      let camsEl = document.getElementById("fnafCams");
      if(camsEl) camsEl.style.display = cameraMode ? "block" : "none";
  }
  lastKeySpace = currentSpace;

  if (cameraMode) {
      // In camera mode, we don't move the player
      return;
  }

  if (state.keysPressed['w'] || state.keysPressed['W']) {
    if (map[Math.floor(pX + pDirX * moveSpeed)][Math.floor(pY)] == 0) pX += pDirX * moveSpeed;
    if (map[Math.floor(pX)][Math.floor(pY + pDirY * moveSpeed)] == 0) pY += pDirY * moveSpeed;
  }
  if (state.keysPressed['s'] || state.keysPressed['S']) {
    if (map[Math.floor(pX - pDirX * moveSpeed)][Math.floor(pY)] == 0) pX -= pDirX * moveSpeed;
    if (map[Math.floor(pX)][Math.floor(pY - pDirY * moveSpeed)] == 0) pY -= pDirY * moveSpeed;
  }
  if (state.keysPressed['a'] || state.keysPressed['A']) {
    // Strafe left (-plane vector)
    if (map[Math.floor(pX - planeX * moveSpeed)][Math.floor(pY)] == 0) pX -= planeX * moveSpeed;
    if (map[Math.floor(pX)][Math.floor(pY - planeY * moveSpeed)] == 0) pY -= planeY * moveSpeed;
  }
  if (state.keysPressed['d'] || state.keysPressed['D']) {
    // Strafe right (+plane vector)
    if (map[Math.floor(pX + planeX * moveSpeed)][Math.floor(pY)] == 0) pX += planeX * moveSpeed;
    if (map[Math.floor(pX)][Math.floor(pY + planeY * moveSpeed)] == 0) pY += planeY * moveSpeed;
  }

  // Network Sync
  if (fnafRoom) {
      let rot = Math.atan2(pDirY, pDirX);
      fnafRoom.send("move", { x: pX, y: pY, rot: rot });
  }
}

function render() {
  const width = canvas.width;
  const height = canvas.height;

  // Render variables
  let rPX = cameraMode ? cameraLocations[currentCameraIndex].x : pX;
  let rPY = cameraMode ? cameraLocations[currentCameraIndex].y : pY;
  let rDirX = cameraMode ? cameraLocations[currentCameraIndex].dirX : pDirX;
  let rDirY = cameraMode ? cameraLocations[currentCameraIndex].dirY : pDirY;
  let rPlaneX = cameraMode ? cameraLocations[currentCameraIndex].pX : planeX;
  let rPlaneY = cameraMode ? cameraLocations[currentCameraIndex].pY : planeY;

  // Draw floor and ceiling
  ctx.fillStyle = "#111"; // ceiling
  ctx.fillRect(0, 0, width, height / 2);
  ctx.fillStyle = "#222"; // floor
  ctx.fillRect(0, height / 2, width, height / 2);

  let zBuffer = new Array(width).fill(0);

  // Raycasting loop
  for (let x = 0; x < width; x++) {
    // calculate ray position and direction
    let cameraX = 2 * x / width - 1; // x-coordinate in camera space
    let rayDirX = rDirX + rPlaneX * cameraX;
    let rayDirY = rDirY + rPlaneY * cameraX;

    // which box of the map we're in
    let mapX = Math.floor(rPX);
    let mapY = Math.floor(rPY);

    // length of ray from current position to next x or y-side
    let sideDistX, sideDistY;

    // length of ray from one x or y-side to next x or y-side
    let deltaDistX = (rayDirX === 0) ? 1e30 : Math.abs(1 / rayDirX);
    let deltaDistY = (rayDirY === 0) ? 1e30 : Math.abs(1 / rayDirY);
    let perpWallDist;

    // what direction to step in x or y-direction (either +1 or -1)
    let stepX, stepY;
    let hit = 0; // was there a wall hit?
    let side; // was a NS or a EW wall hit?

    // calculate step and initial sideDist
    if (rayDirX < 0) {
      stepX = -1;
      sideDistX = (rPX - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1.0 - rPX) * deltaDistX;
    }
    if (rayDirY < 0) {
      stepY = -1;
      sideDistY = (rPY - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1.0 - rPY) * deltaDistY;
    }

    let mapVal = 0;
    // perform DDA
    while (hit === 0) {
      // jump to next map square, either in x-direction, or in y-direction
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }

      // Safety check to prevent out of bounds
      if (mapX < 0 || mapY < 0 || mapX >= mapWidth || mapY >= mapHeight) {
          hit = 1;
          perpWallDist = 100;
          break;
      }

      // Check if ray has hit a wall
      mapVal = map[mapX][mapY];
      if (mapVal === 2 && !fnafGameState.doorLeft) {
          // Open left door
          hit = 0;
      } else if (mapVal === 3 && !fnafGameState.doorRight) {
          // Open right door
          hit = 0;
      } else if (mapVal > 0) {
          hit = 1;
      }
    }

    // Calculate distance projected on camera direction
    if (side === 0) perpWallDist = (sideDistX - deltaDistX);
    else          perpWallDist = (sideDistY - deltaDistY);

    zBuffer[x] = perpWallDist;

    // Calculate height of line to draw on screen
    let lineHeight = Math.floor(height / perpWallDist);

    // calculate lowest and highest pixel to fill in current stripe
    let drawStart = -lineHeight / 2 + height / 2;
    if (drawStart < 0) drawStart = 0;
    let drawEnd = lineHeight / 2 + height / 2;
    if (drawEnd >= height) drawEnd = height - 1;

    // choose wall color
    let r = 150, g = 150, b = 150; // default wall
    if (mapVal === 2) { r = 100; g = 50; b = 50; } // Left door (reddish)
    if (mapVal === 3) { r = 50; g = 50; b = 100; } // Right door (blueish)

    // Flashlight logic: brightness depends on distance
    let colorIntensity = Math.max(0, 1.0 - (perpWallDist / 10)); // max range ~10

    // Add light logic
    if (fnafGameState.lightLeft && mapX < 5) colorIntensity = Math.max(colorIntensity, 0.8);
    if (fnafGameState.lightRight && mapX > 5) colorIntensity = Math.max(colorIntensity, 0.8);

    if (side === 1) colorIntensity = colorIntensity * 0.7; // give x and y sides different brightness

    ctx.fillStyle = `rgb(${Math.floor(r * colorIntensity)}, ${Math.floor(g * colorIntensity)}, ${Math.floor(b * colorIntensity)})`;
    ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
  }

  // Draw Animatronics (Sprites)
  for (let animId in fnafGameState.animatronics) {
      const p = fnafGameState.animatronics[animId];

      let spriteX = p.x - rPX;
      let spriteY = p.y - rPY;

      // Transform sprite with the inverse camera matrix
      let invDet = 1.0 / (rPlaneX * rDirY - rDirX * rPlaneY);

      let transformX = invDet * (rDirY * spriteX - rDirX * spriteY);
      let transformY = invDet * (-rPlaneY * spriteX + rPlaneX * spriteY); // Z depth

      if (transformY > 0) { // Only draw if in front of player
          let spriteScreenX = Math.floor((width / 2) * (1 + transformX / transformY));

          let spriteHeight = Math.abs(Math.floor(height / (transformY)));
          let drawStartY = -spriteHeight / 2 + height / 2;
          let drawEndY = spriteHeight / 2 + height / 2;

          let spriteWidth = Math.abs(Math.floor(height / (transformY)));
          let drawStartX = -spriteWidth / 2 + spriteScreenX;
          let drawEndX = spriteWidth / 2 + spriteScreenX;

          // Simple white square as placeholder for horror player sprite
          let animColor = p.type === "freddy" ? "rgba(139, 69, 19, 0.8)" : "rgba(128, 0, 128, 0.8)";

          ctx.fillStyle = animColor;
          ctx.fillRect(drawStartX, drawStartY, spriteWidth, spriteHeight);

          // Draw little red eyes
          ctx.fillStyle = "red";
          ctx.fillRect(drawStartX + spriteWidth * 0.2, drawStartY + spriteHeight * 0.2, spriteWidth * 0.2, spriteHeight * 0.2);
          ctx.fillRect(drawStartX + spriteWidth * 0.6, drawStartY + spriteHeight * 0.2, spriteWidth * 0.2, spriteHeight * 0.2);
      }
  }

  // Draw Other Players
  for (let sessionId in networkPlayers) {
      const p = networkPlayers[sessionId];

      let spriteX = p.x - rPX;
      let spriteY = p.y - rPY;

      let invDet = 1.0 / (rPlaneX * rDirY - rDirX * rPlaneY);
      let transformX = invDet * (rDirY * spriteX - rDirX * spriteY);
      let transformY = invDet * (-rPlaneY * spriteX + rPlaneX * spriteY);

      if (transformY > 0) {
          let spriteScreenX = Math.floor((width / 2) * (1 + transformX / transformY));
          let spriteHeight = Math.abs(Math.floor(height / (transformY)));
          let drawStartY = -spriteHeight / 2 + height / 2;
          let spriteWidth = Math.abs(Math.floor(height / (transformY)));
          let drawStartX = -spriteWidth / 2 + spriteScreenX;

          ctx.fillStyle = "rgba(100, 255, 100, 0.8)";
          ctx.fillRect(drawStartX, drawStartY, spriteWidth, spriteHeight);
      }
  }

  // Horror overlay (flickering vignette)
  if (!cameraMode) {
      const isFlicker = Math.random() < 0.05;
      const alpha = isFlicker ? 0.6 : 0.8;
      const gradient = ctx.createRadialGradient(width/2, height/2, height/4, width/2, height/2, width/2);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, `rgba(0,0,0,${alpha})`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
  } else {
      // Static overlay for camera
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      for(let i=0; i<300; i++) {
          ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
      }
      ctx.fillStyle = "white";
      ctx.font = "20px monospace";
      ctx.fillText("CAM " + (currentCameraIndex+1), 20, 30);
  }
}

window.setFnafCam = (idx) => {
    currentCameraIndex = idx;
};
