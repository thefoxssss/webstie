// fnaf.js - 3D Multiplayer Horror Survival Game (Raycaster)
import { state } from "../core.js";

let canvas, ctx;
let animationId;
let isFnafRunning = false;

// Map & Player state
let mapWidth = 10, mapHeight = 10;
let map = [
  [1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,0,1,1,0,1],
  [1,0,1,0,0,0,0,1,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,1,1,0,0,0,1],
  [1,0,1,0,0,0,0,1,0,1],
  [1,0,1,1,0,0,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1]
];

let pX = 1.5, pY = 1.5; // Player position
let pDirX = -1, pDirY = 0; // Player direction vector
let planeX = 0, planeY = 0.66; // 2D raycaster camera plane

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

function update(dt) {
  const moveSpeed = 3.0 * dt;

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

  // Draw floor and ceiling
  ctx.fillStyle = "#111"; // ceiling
  ctx.fillRect(0, 0, width, height / 2);
  ctx.fillStyle = "#222"; // floor
  ctx.fillRect(0, height / 2, width, height / 2);

  // Raycasting loop
  for (let x = 0; x < width; x++) {
    // calculate ray position and direction
    let cameraX = 2 * x / width - 1; // x-coordinate in camera space
    let rayDirX = pDirX + planeX * cameraX;
    let rayDirY = pDirY + planeY * cameraX;

    // which box of the map we're in
    let mapX = Math.floor(pX);
    let mapY = Math.floor(pY);

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
      sideDistX = (pX - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1.0 - pX) * deltaDistX;
    }
    if (rayDirY < 0) {
      stepY = -1;
      sideDistY = (pY - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1.0 - pY) * deltaDistY;
    }

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
      if (map[mapX][mapY] > 0) hit = 1;
    }

    // Calculate distance projected on camera direction
    if (side === 0) perpWallDist = (sideDistX - deltaDistX);
    else          perpWallDist = (sideDistY - deltaDistY);

    // Calculate height of line to draw on screen
    let lineHeight = Math.floor(height / perpWallDist);

    // calculate lowest and highest pixel to fill in current stripe
    let drawStart = -lineHeight / 2 + height / 2;
    if (drawStart < 0) drawStart = 0;
    let drawEnd = lineHeight / 2 + height / 2;
    if (drawEnd >= height) drawEnd = height - 1;

    // choose wall color based on distance
    let colorIntensity = Math.max(0, 255 - perpWallDist * 20); // Darker further away
    if (side === 1) colorIntensity = colorIntensity / 2; // give x and y sides different brightness

    ctx.fillStyle = `rgb(${colorIntensity}, ${0}, ${0})`; // Reddish horror walls
    ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
  }

  // Draw Other Players (Sprites)
  for (let sessionId in networkPlayers) {
      const p = networkPlayers[sessionId];

      let spriteX = p.x - pX;
      let spriteY = p.y - pY;

      // Transform sprite with the inverse camera matrix
      let invDet = 1.0 / (planeX * pDirY - pDirX * planeY);

      let transformX = invDet * (pDirY * spriteX - pDirX * spriteY);
      let transformY = invDet * (-planeY * spriteX + planeX * spriteY); // Z depth

      if (transformY > 0) { // Only draw if in front of player
          let spriteScreenX = Math.floor((width / 2) * (1 + transformX / transformY));

          let spriteHeight = Math.abs(Math.floor(height / (transformY)));
          let drawStartY = -spriteHeight / 2 + height / 2;
          let drawEndY = spriteHeight / 2 + height / 2;

          let spriteWidth = Math.abs(Math.floor(height / (transformY)));
          let drawStartX = -spriteWidth / 2 + spriteScreenX;
          let drawEndX = spriteWidth / 2 + spriteScreenX;

          // Simple white square as placeholder for horror player sprite
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.fillRect(drawStartX, drawStartY, spriteWidth, spriteHeight);

          // Draw little red eyes
          ctx.fillStyle = "red";
          ctx.fillRect(drawStartX + spriteWidth * 0.2, drawStartY + spriteHeight * 0.2, spriteWidth * 0.2, spriteHeight * 0.2);
          ctx.fillRect(drawStartX + spriteWidth * 0.6, drawStartY + spriteHeight * 0.2, spriteWidth * 0.2, spriteHeight * 0.2);
      }
  }

  // Horror overlay (flickering vignette)
  const isFlicker = Math.random() < 0.05;
  const alpha = isFlicker ? 0.6 : 0.8;
  const gradient = ctx.createRadialGradient(width/2, height/2, height/4, width/2, height/2, width/2);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${alpha})`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Static overlay
  if (Math.random() < 0.2) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      for(let i=0; i<100; i++) {
          ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
      }
  }
}
