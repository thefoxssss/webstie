import { state } from "../core.js";

export function initBuilder() {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || !window.location.hostname || window.location.search.includes("local=1");
    const networkSelect = document.getElementById("builderNetwork");
    const defaultServer = isLocal ? "local" : "prod";
    if (networkSelect && !networkSelect.value) {
        networkSelect.value = "auto";
    }

    const getServerUrl = () => {
        const selected = networkSelect?.value || "auto";
        if (selected === "local") return "ws://localhost:2567";
        if (selected === "prod") return "wss://seahorse-app-mv4sg.ondigitalocean.app";
        return defaultServer === "local" ? "ws://localhost:2567" : "wss://seahorse-app-mv4sg.ondigitalocean.app";
    };
    const getServerHttpBase = () => {
        const wsUrl = getServerUrl();
        if (wsUrl.startsWith("wss://")) return `https://${wsUrl.slice(6)}`;
        if (wsUrl.startsWith("ws://")) return `http://${wsUrl.slice(5)}`;
        return wsUrl;
    };

    let room;
    let client;
    let animationFrameId;
    let selectedRoomId = null;

    const canvas = document.getElementById("builderCanvas");
    const ctx = canvas.getContext("2d");
    const menu = document.getElementById("builderMenu");
    const gameArea = document.getElementById("builderGame");
    const btnJoin = document.getElementById("btnJoinBuilder");
    const btnRefreshServers = document.getElementById("btnRefreshBuilderServers");
    const btnCreateServer = document.getElementById("btnCreateBuilderServer");
    const serverNameInput = document.getElementById("builderServerName");
    const serverListEl = document.getElementById("builderServerList");

    const uiX = document.getElementById("builderX");
    const uiY = document.getElementById("builderY");
    const uiBlockType = document.getElementById("builderBlockType");

    const TILE_SIZE = 32;

    const blockColors = {
        1: "#3c9e3c", // Grass
        2: "#6b4226", // Dirt
        3: "#808080", // Stone
        4: "#e1c699", // Wood
        5: "#ffffff", // Glass
        6: "#b22222", // Brick
    };

    const blockNames = {
        1: "GRASS",
        2: "DIRT",
        3: "STONE",
        4: "WOOD",
        5: "GLASS",
        6: "BRICK",
    };

    let selectedBlockType = 3; // Default to stone
    let localPlayerId = null;
    let inventoryOpen = false;

    let camera = { x: 0, y: 0 };

    // Cached UI values to prevent DOM thrashing
    let lastUiX = null;
    let lastUiY = null;
    let lastUiBlockType = null;

    // Inputs
    const keys = { w: false, a: false, d: false, upPress: false };
    const mouse = { x: 0, y: 0, isDown: false };
    const BUILD_HOLD_DELAY_MS = 180;
    const BUILD_HOLD_REPEAT_MS = 120;
    let buildHoldTimeout = null;
    let buildHoldInterval = null;
    const playerName = () => state.myName || "Player";
    const hotbarLayout = {
        slotSize: 42,
        gap: 8,
        padding: 10,
        bottom: 14,
    };
    const inventoryLayout = {
        widthRatio: 0.66,
        heightRatio: 0.66,
        padding: 24,
        slotSize: 62,
        gap: 12,
        cols: 9,
        rows: 3,
    };
    const getBlockTypes = () => Object.keys(blockNames).map(Number);

    function getInventoryMetrics(panel) {
        const rows = inventoryLayout.rows;
        const gridWidth = (inventoryLayout.cols * inventoryLayout.slotSize) + ((inventoryLayout.cols - 1) * inventoryLayout.gap);
        const gridHeight = (rows * inventoryLayout.slotSize) + ((rows - 1) * inventoryLayout.gap);
        const startX = panel.x + Math.floor((panel.width - gridWidth) / 2);
        const startY = panel.y + Math.floor((panel.height - gridHeight) / 2) + 10;
        return { rows, gridWidth, gridHeight, startX, startY };
    }

    function getHotbarBounds() {
        const itemCount = getBlockTypes().length;
        const panelWidth = (itemCount * hotbarLayout.slotSize) + ((itemCount - 1) * hotbarLayout.gap) + (hotbarLayout.padding * 2);
        const panelHeight = hotbarLayout.slotSize + (hotbarLayout.padding * 2);
        const x = Math.floor((canvas.width - panelWidth) / 2);
        const y = canvas.height - panelHeight - hotbarLayout.bottom;
        return { x, y, width: panelWidth, height: panelHeight };
    }

    function getInventoryBounds() {
        const width = Math.floor(canvas.width * inventoryLayout.widthRatio);
        const height = Math.floor(canvas.height * inventoryLayout.heightRatio);
        const x = Math.floor((canvas.width - width) / 2);
        const y = Math.floor((canvas.height - height) / 2);
        return { x, y, width, height };
    }

    function getInventorySlotAt(x, y, panel) {
        const itemCount = getBlockTypes().length;
        const { rows, startX, startY } = getInventoryMetrics(panel);

        const relativeX = x - startX;
        const relativeY = y - startY;
        if (relativeX < 0 || relativeY < 0) return null;

        const stride = inventoryLayout.slotSize + inventoryLayout.gap;
        const col = Math.floor(relativeX / stride);
        const row = Math.floor(relativeY / stride);
        if (col < 0 || col >= inventoryLayout.cols || row < 0 || row >= rows) return null;
        if ((relativeX % stride) > inventoryLayout.slotSize || (relativeY % stride) > inventoryLayout.slotSize) return null;

        const index = (row * inventoryLayout.cols) + col;
        if (index >= itemCount) return null;
        return getBlockTypes()[index];
    }

    function getHotbarSlotAt(x, y, panel) {
        const relativeX = x - (panel.x + hotbarLayout.padding);
        const relativeY = y - (panel.y + hotbarLayout.padding);
        if (relativeX < 0 || relativeY < 0 || relativeY > hotbarLayout.slotSize) return null;

        const stride = hotbarLayout.slotSize + hotbarLayout.gap;
        const index = Math.floor(relativeX / stride);
        const maxIndex = getBlockTypes().length - 1;
        if (index < 0 || index > maxIndex) return null;
        if ((relativeX % stride) > hotbarLayout.slotSize) return null;
        return getBlockTypes()[index];
    }

    const renderServerList = (servers) => {
        if (!serverListEl) return;
        serverListEl.innerHTML = "";
        if (!servers.length) {
            serverListEl.textContent = "NO SERVERS ONLINE YET. CREATE ONE!";
            return;
        }

        servers.forEach((server) => {
            const row = document.createElement("div");
            row.style.border = "1px solid #0f0";
            row.style.padding = "8px";
            row.style.marginBottom = "8px";
            row.style.cursor = "pointer";
            row.style.background = selectedRoomId === server.roomId ? "rgba(0, 255, 0, 0.15)" : "transparent";

            const names = (server.players || []).length ? server.players.join(", ") : "No players";
            row.innerHTML = `
                <div style="font-size: 11px; color: #0f0;">${server.serverName || "Public World"}</div>
                <div style="font-size: 9px; opacity: 0.9; margin-top: 4px;">PLAYERS (${server.clients}/${server.maxClients}): ${names}</div>
            `;
            row.onclick = async () => {
                selectedRoomId = server.roomId;
                renderServerList(servers);
                await joinRoomById(server.roomId);
            };
            serverListEl.appendChild(row);
        });
    };

    const refreshServerList = async () => {
        if (!btnRefreshServers) return;
        btnRefreshServers.textContent = "LOADING...";
        try {
            const response = await fetch(`${getServerHttpBase()}/builder-servers`);
            const payload = await response.json();
            renderServerList(payload.servers || []);
        } catch (error) {
            console.error("Failed to load server list", error);
            if (serverListEl) serverListEl.textContent = "FAILED TO LOAD SERVER LIST";
        } finally {
            btnRefreshServers.textContent = "REFRESH SERVER LIST";
        }
    };

    const joinRoomById = async (roomId) => {
        try {
            btnJoin.textContent = "CONNECTING...";
            client = new window.Colyseus.Client(getServerUrl());
            room = await client.joinById(roomId, { name: playerName() });
            localPlayerId = room.sessionId;
            menu.style.display = "none";
            gameArea.style.display = "block";
            startGameLoop();
        } catch (e) {
            console.error("Join by id error", e);
            btnJoin.textContent = "QUICK JOIN ANY SERVER";
        }
    };

    btnJoin.onclick = async () => {
        try {
            btnJoin.textContent = "CONNECTING...";
            client = new window.Colyseus.Client(getServerUrl());
            room = await client.joinOrCreate("builder_room", { name: playerName() });
            localPlayerId = room.sessionId;
            menu.style.display = "none";
            gameArea.style.display = "block";
            startGameLoop();
        } catch (e) {
            console.error("Quick join error", e);
            btnJoin.textContent = "QUICK JOIN ANY SERVER";
        }
    };

    if (btnCreateServer) {
        btnCreateServer.onclick = async () => {
            try {
                btnCreateServer.textContent = "CREATING...";
                const serverName = (serverNameInput?.value || "").trim() || "Public World";
                client = new window.Colyseus.Client(getServerUrl());
                room = await client.create("builder_room", { name: playerName(), serverName });
                localPlayerId = room.sessionId;
                menu.style.display = "none";
                gameArea.style.display = "block";
                startGameLoop();
            } catch (e) {
                console.error("Create server error", e);
                btnCreateServer.textContent = "CREATE SERVER";
            }
        };
    }
    if (btnRefreshServers) btnRefreshServers.onclick = refreshServerList;
    if (networkSelect) {
        networkSelect.onchange = () => {
            selectedRoomId = null;
            refreshServerList();
        };
    }
    refreshServerList();

    function handleKeyDown(e) {
        if (!room) return;
        if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") keys.a = true;
        if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") keys.d = true;
        if (e.key === "w" || e.key === "W" || e.key === "ArrowUp" || e.key === " ") {
            if (!keys.w) keys.upPress = true;
            keys.w = true;
        }
        if (e.key === "i" || e.key === "I") {
            inventoryOpen = !inventoryOpen;
            return;
        }

        // Block selection (1-6)
        if (e.key >= "1" && e.key <= "6") {
            selectedBlockType = parseInt(e.key);
        }
    }

    function handleKeyUp(e) {
        if (!room) return;
        if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") keys.a = false;
        if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") keys.d = false;
        if (e.key === "w" || e.key === "W" || e.key === "ArrowUp" || e.key === " ") keys.w = false;
    }

    function handleMouseMove(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        mouse.x = (e.clientX - rect.left) * scaleX;
        mouse.y = (e.clientY - rect.top) * scaleY;
    }

    function sendBuildOrBreak(e) {
        const worldX = mouse.x + camera.x;
        const worldY = mouse.y + camera.y;

        if (e.shiftKey || e.button === 2) {
            // Break
            room.send("break", { x: worldX, y: worldY });
        } else {
            // Build
            room.send("build", { x: worldX, y: worldY, type: selectedBlockType });
        }
    }

    function clearBuildHoldTimers() {
        if (buildHoldTimeout) {
            clearTimeout(buildHoldTimeout);
            buildHoldTimeout = null;
        }
        if (buildHoldInterval) {
            clearInterval(buildHoldInterval);
            buildHoldInterval = null;
        }
    }

    function handleMouseDown(e) {
        if (!room) return;
        const hotbarPanel = getHotbarBounds();
        const hotbarSelection = getHotbarSlotAt(mouse.x, mouse.y, hotbarPanel);
        if (hotbarSelection) {
            selectedBlockType = hotbarSelection;
            return;
        }

        if (inventoryOpen) {
            const panel = getInventoryBounds();
            const inventorySelection = getInventorySlotAt(mouse.x, mouse.y, panel);
            if (inventorySelection) {
                selectedBlockType = inventorySelection;
            }
            return;
        }

        mouse.isDown = true;
        sendBuildOrBreak(e);

        // Hold left click to repeatedly place blocks after a short delay.
        if (!e.shiftKey && e.button === 0) {
            clearBuildHoldTimers();
            buildHoldTimeout = setTimeout(() => {
                buildHoldInterval = setInterval(() => {
                    if (!mouse.isDown || !room) {
                        clearBuildHoldTimers();
                        return;
                    }
                    sendBuildOrBreak(e);
                }, BUILD_HOLD_REPEAT_MS);
            }, BUILD_HOLD_DELAY_MS);
        }
    }

    function handleMouseUp() {
        mouse.isDown = false;
        clearBuildHoldTimers();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp);

    // Prevent context menu on canvas for right click breaking
    canvas.addEventListener("contextmenu", e => e.preventDefault());

    // Send input loop
    setInterval(() => {
        if (room && localPlayerId && room.state.players.has(localPlayerId)) {
            room.send("input", {
                left: keys.a,
                right: keys.d,
                upPress: keys.upPress
            });
            keys.upPress = false;
        }
    }, 1000 / 30); // 30Hz input rate

    function render() {
        if (!room || !room.state) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Get local player for camera centering
        const localPlayer = room.state.players.get(localPlayerId);
        if (localPlayer) {
            camera.x = localPlayer.x - canvas.width / 2 + TILE_SIZE / 2;
            camera.y = localPlayer.y - canvas.height / 2 + TILE_SIZE / 2;

            // Update UI only if changed
            const currentX = Math.floor(localPlayer.x / TILE_SIZE);
            const currentY = Math.floor(localPlayer.y / TILE_SIZE);
            const currentBlockName = blockNames[selectedBlockType];

            if (lastUiX !== currentX) {
                uiX.textContent = currentX;
                lastUiX = currentX;
            }
            if (lastUiY !== currentY) {
                uiY.textContent = currentY;
                lastUiY = currentY;
            }
            if (lastUiBlockType !== currentBlockName) {
                uiBlockType.textContent = currentBlockName;
                lastUiBlockType = currentBlockName;
            }
        }

        ctx.save();
        ctx.translate(-camera.x, -camera.y);

        // Draw blocks (chunked)
        room.state.chunks.forEach((chunk) => {
          chunk.blocks.forEach((block) => {
            ctx.fillStyle = blockColors[block.type] || "#ffffff";
            ctx.fillRect(block.x * TILE_SIZE, block.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = "rgba(0,0,0,0.1)";
            ctx.strokeRect(block.x * TILE_SIZE, block.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          });
        });

        // Draw players (sorted by Y so lower players render in front)
        const sortedPlayers = [];
        room.state.players.forEach((p, sessionId) => {
            sortedPlayers.push({ p, sessionId });
        });
        sortedPlayers.sort((a, b) => {
            if (a.p.y === b.p.y) return a.sessionId.localeCompare(b.sessionId);
            return a.p.y - b.p.y;
        });

        sortedPlayers.forEach(({ p }) => {
            // Draw player body
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, TILE_SIZE, TILE_SIZE);

            // Draw player border
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 2;
            ctx.strokeRect(p.x, p.y, TILE_SIZE, TILE_SIZE);

            // Draw player name
            ctx.fillStyle = "#000";
            ctx.font = "10px 'Press Start 2P', monospace";
            ctx.textAlign = "center";
            ctx.fillText(p.name, p.x + TILE_SIZE / 2, p.y - 5);
        });

        // Draw crosshair/preview
        const worldX = mouse.x + camera.x;
        const worldY = mouse.y + camera.y;
        const gridX = Math.floor(worldX / TILE_SIZE) * TILE_SIZE;
        const gridY = Math.floor(worldY / TILE_SIZE) * TILE_SIZE;

        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 2;
        ctx.strokeRect(gridX, gridY, TILE_SIZE, TILE_SIZE);

        // Preview block color slightly transparent
        ctx.fillStyle = blockColors[selectedBlockType];
        ctx.globalAlpha = 0.5;
        ctx.fillRect(gridX, gridY, TILE_SIZE, TILE_SIZE);
        ctx.globalAlpha = 1.0;

        ctx.restore();
        const hotbarPanel = getHotbarBounds();
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(hotbarPanel.x, hotbarPanel.y, hotbarPanel.width, hotbarPanel.height);
        ctx.strokeStyle = "#0f0";
        ctx.lineWidth = 2;
        ctx.strokeRect(hotbarPanel.x, hotbarPanel.y, hotbarPanel.width, hotbarPanel.height);

        getBlockTypes().forEach((blockType, index) => {
            const slotX = hotbarPanel.x + hotbarLayout.padding + (index * (hotbarLayout.slotSize + hotbarLayout.gap));
            const slotY = hotbarPanel.y + hotbarLayout.padding;
            const isActive = selectedBlockType === blockType;

            ctx.fillStyle = blockColors[blockType];
            ctx.fillRect(slotX, slotY, hotbarLayout.slotSize, hotbarLayout.slotSize);
            ctx.strokeStyle = isActive ? "#fff" : "rgba(255,255,255,0.45)";
            ctx.lineWidth = isActive ? 3 : 1;
            ctx.strokeRect(slotX, slotY, hotbarLayout.slotSize, hotbarLayout.slotSize);

            ctx.fillStyle = "#000";
            ctx.font = "9px 'Press Start 2P', monospace";
            ctx.textAlign = "center";
            ctx.fillText(`${index + 1}`, slotX + (hotbarLayout.slotSize / 2), slotY + hotbarLayout.slotSize - 7);
        });

        if (inventoryOpen) {
            const panel = getInventoryBounds();
            const blockTypes = getBlockTypes();
            const { rows, startX, startY } = getInventoryMetrics(panel);

            ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = "rgba(15, 15, 15, 0.92)";
            ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
            ctx.strokeStyle = "#0f0";
            ctx.lineWidth = 3;
            ctx.strokeRect(panel.x, panel.y, panel.width, panel.height);

            ctx.fillStyle = "#8cff8c";
            ctx.font = "12px 'Press Start 2P', monospace";
            ctx.textAlign = "left";
            ctx.fillText("INVENTORY", panel.x + inventoryLayout.padding, panel.y + inventoryLayout.padding);
            ctx.font = "8px 'Press Start 2P', monospace";
            ctx.fillStyle = "rgba(220,255,220,0.9)";
            ctx.fillText("Press I to close", panel.x + inventoryLayout.padding, panel.y + inventoryLayout.padding + 20);

            const totalSlots = inventoryLayout.cols * rows;
            for (let index = 0; index < totalSlots; index += 1) {
                const blockType = blockTypes[index];
                const col = index % inventoryLayout.cols;
                const row = Math.floor(index / inventoryLayout.cols);
                const slotX = startX + (col * (inventoryLayout.slotSize + inventoryLayout.gap));
                const slotY = startY + (row * (inventoryLayout.slotSize + inventoryLayout.gap));
                const isEmpty = typeof blockType === "undefined";
                const isActive = !isEmpty && selectedBlockType === blockType;

                ctx.fillStyle = "rgba(255,255,255,0.08)";
                ctx.fillRect(slotX, slotY, inventoryLayout.slotSize, inventoryLayout.slotSize);
                if (!isEmpty) {
                    ctx.fillStyle = blockColors[blockType];
                    ctx.fillRect(slotX + 6, slotY + 6, inventoryLayout.slotSize - 12, inventoryLayout.slotSize - 12);
                }
                ctx.strokeStyle = isActive ? "#fff" : "rgba(170,255,170,0.6)";
                ctx.lineWidth = isActive ? 3 : 1;
                ctx.strokeRect(slotX, slotY, inventoryLayout.slotSize, inventoryLayout.slotSize);

                if (!isEmpty) {
                    ctx.fillStyle = "#d6ffd6";
                    ctx.font = "7px 'Press Start 2P', monospace";
                    ctx.textAlign = "center";
                    ctx.fillText(blockNames[blockType], slotX + (inventoryLayout.slotSize / 2), slotY + inventoryLayout.slotSize + 10);
                }
            }
        }

        animationFrameId = requestAnimationFrame(render);
    }

    function startGameLoop() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        render();
    }

    // Cleanup hook
    const stopBuilder = () => {
        if (room) {
            room.leave();
            room = null;
        }
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        document.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("keyup", handleKeyUp);
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("mousedown", handleMouseDown);
        canvas.removeEventListener("mouseup", handleMouseUp);
        canvas.removeEventListener("mouseleave", handleMouseUp);
        clearBuildHoldTimers();
        menu.style.display = "block";
        gameArea.style.display = "none";
        btnJoin.textContent = "QUICK JOIN ANY SERVER";
        if (btnCreateServer) btnCreateServer.textContent = "CREATE SERVER";
        selectedRoomId = null;
        refreshServerList();
    };

    if (window.gameStops) {
        window.gameStops.push(stopBuilder);
    } else {
        window.gameStops = [stopBuilder];
    }
}
