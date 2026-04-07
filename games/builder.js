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

    let selectedHotbarIndex = 0;
    // Map initial available blocks, empty for the rest
    let hotbarSlots = [1, 2, 3, 4, 5, 6, undefined, undefined, undefined];
    let selectedBlockType = hotbarSlots[0] || 1;
    let localPlayerId = null;
    let inventoryOpen = false;

    // Drag-and-drop state
    let draggedItemType = null;
    let dragSourceHotbarIndex = null;

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
        slotSize: 40,
        gap: 4,
        padding: 6,
        bottom: 8,
    };
    const inventoryLayout = {
        widthRatio: 0.70,
        heightRatio: 0.60,
        padding: 16,
        slotSize: 40,
        gap: 4,
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
        const itemCount = 9;
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
        const blockTypes = getBlockTypes();
        const itemCount = blockTypes.length;
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
        return blockTypes[index];
    }

    function getHotbarIndexAt(x, y, panel) {
        const relativeX = x - (panel.x + hotbarLayout.padding);
        const relativeY = y - (panel.y + hotbarLayout.padding);
        if (relativeX < 0 || relativeY < 0 || relativeY > hotbarLayout.slotSize) return null;

        const stride = hotbarLayout.slotSize + hotbarLayout.gap;
        const index = Math.floor(relativeX / stride);
        if (index < 0 || index >= 9) return null; // 9 hotbar slots
        if ((relativeX % stride) > hotbarLayout.slotSize) return null;
        return index;
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

            // Cancel drag if we close inventory while dragging
            if (!inventoryOpen && draggedItemType !== null) {
                if (dragSourceHotbarIndex !== null) {
                    hotbarSlots[dragSourceHotbarIndex] = draggedItemType;
                }
                draggedItemType = null;
                dragSourceHotbarIndex = null;
                selectedBlockType = hotbarSlots[selectedHotbarIndex] || 1;
            }
            return;
        }

        // Hotbar selection (1-9)
        if (!isNaN(e.key)) {
            const keyNum = parseInt(e.key);
            if (keyNum >= 1 && keyNum <= 9) {
                selectedHotbarIndex = keyNum - 1;
                selectedBlockType = hotbarSlots[selectedHotbarIndex] || 1;
            }
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

        // Handle inventory and dragging mechanics first
        if (inventoryOpen) {
            const hotbarPanel = getHotbarBounds();
            const hotbarIndex = getHotbarIndexAt(mouse.x, mouse.y, hotbarPanel);

            if (hotbarIndex !== null) {
                if (hotbarSlots[hotbarIndex] !== undefined) {
                    // Pick up from hotbar
                    draggedItemType = hotbarSlots[hotbarIndex];
                    dragSourceHotbarIndex = hotbarIndex;
                    hotbarSlots[hotbarIndex] = undefined;
                }
                return;
            }

            const panel = getInventoryBounds();
            const inventorySelection = getInventorySlotAt(mouse.x, mouse.y, panel);
            if (inventorySelection) {
                // Pick up from inventory (copy)
                draggedItemType = inventorySelection;
                dragSourceHotbarIndex = null;
            }
            return;
        }

        // Normal gameplay mode: hotbar selection
        const hotbarPanel = getHotbarBounds();
        const hotbarIndex = getHotbarIndexAt(mouse.x, mouse.y, hotbarPanel);
        if (hotbarIndex !== null) {
            selectedHotbarIndex = hotbarIndex;
            selectedBlockType = hotbarSlots[selectedHotbarIndex] || 1;
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

        // Handle dropping a dragged item
        if (inventoryOpen && draggedItemType !== null) {
            const hotbarPanel = getHotbarBounds();
            const hotbarIndex = getHotbarIndexAt(mouse.x, mouse.y, hotbarPanel);

            if (hotbarIndex !== null) {
                // Dropped on a hotbar slot
                const existingItem = hotbarSlots[hotbarIndex];
                hotbarSlots[hotbarIndex] = draggedItemType;

                // Swap logic if we brought it from another hotbar slot
                if (existingItem !== undefined && dragSourceHotbarIndex !== null && dragSourceHotbarIndex !== hotbarIndex) {
                    hotbarSlots[dragSourceHotbarIndex] = existingItem;
                }
            } else {
                // Dropped outside a hotbar slot. We just clear the dragged item (throw it back in inventory).
                // If you want it to bounce back to its original hotbar slot instead of disappearing when dropped
                // on the background, you'd restore it here. The prompt said "put in the inventory" which means clearing it.
            }

            // Re-sync selectedBlockType in case we modified the currently selected hotbar slot
            selectedBlockType = hotbarSlots[selectedHotbarIndex] || 1;

            draggedItemType = null;
            dragSourceHotbarIndex = null;
        } else if (draggedItemType !== null) {
            // Failsafe: drop outside inventory mode cancels drag
            draggedItemType = null;
            dragSourceHotbarIndex = null;
        }
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
        // Minecraft hotbar style background
        ctx.fillStyle = "#c6c6c6"; // Light gray
        ctx.fillRect(hotbarPanel.x, hotbarPanel.y, hotbarPanel.width, hotbarPanel.height);

        // Minecraft panel borders (bevel)
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hotbarPanel.x, hotbarPanel.y + hotbarPanel.height);
        ctx.lineTo(hotbarPanel.x, hotbarPanel.y);
        ctx.lineTo(hotbarPanel.x + hotbarPanel.width, hotbarPanel.y);
        ctx.stroke();

        ctx.strokeStyle = "#555555";
        ctx.beginPath();
        ctx.moveTo(hotbarPanel.x + hotbarPanel.width, hotbarPanel.y);
        ctx.lineTo(hotbarPanel.x + hotbarPanel.width, hotbarPanel.y + hotbarPanel.height);
        ctx.lineTo(hotbarPanel.x, hotbarPanel.y + hotbarPanel.height);
        ctx.stroke();

        hotbarSlots.forEach((blockType, index) => {
            const slotX = hotbarPanel.x + hotbarLayout.padding + (index * (hotbarLayout.slotSize + hotbarLayout.gap));
            const slotY = hotbarPanel.y + hotbarLayout.padding;
            const isActive = selectedHotbarIndex === index;

            // Slot background
            ctx.fillStyle = "#8b8b8b";
            ctx.fillRect(slotX, slotY, hotbarLayout.slotSize, hotbarLayout.slotSize);

            // Slot inner shadow/bevel
            ctx.strokeStyle = "#373737";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(slotX, slotY + hotbarLayout.slotSize);
            ctx.lineTo(slotX, slotY);
            ctx.lineTo(slotX + hotbarLayout.slotSize, slotY);
            ctx.stroke();

            ctx.strokeStyle = "#ffffff";
            ctx.beginPath();
            ctx.moveTo(slotX + hotbarLayout.slotSize, slotY);
            ctx.lineTo(slotX + hotbarLayout.slotSize, slotY + hotbarLayout.slotSize);
            ctx.lineTo(slotX, slotY + hotbarLayout.slotSize);
            ctx.stroke();

            // Block drawing
            if (blockType) {
                ctx.fillStyle = blockColors[blockType];
                const inset = 6;
                ctx.fillRect(slotX + inset, slotY + inset, hotbarLayout.slotSize - (inset * 2), hotbarLayout.slotSize - (inset * 2));
            }

            // Selection indicator
            if (isActive) {
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 3;
                ctx.strokeRect(slotX - 1, slotY - 1, hotbarLayout.slotSize + 2, hotbarLayout.slotSize + 2);
            }

            ctx.fillStyle = "#ffffff";
            ctx.font = "8px 'Press Start 2P', monospace";
            ctx.textAlign = "left";
            // Shadow text
            ctx.fillStyle = "#3f3f3f";
            ctx.fillText(`${index + 1}`, slotX + 4, slotY + 12);
            // Normal text
            ctx.fillStyle = "#ffffff";
            ctx.fillText(`${index + 1}`, slotX + 3, slotY + 11);
        });

        if (inventoryOpen) {
            const panel = getInventoryBounds();
            const blockTypes = getBlockTypes();
            const { rows, startX, startY } = getInventoryMetrics(panel);

            ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Minecraft inventory panel style
            ctx.fillStyle = "#c6c6c6"; // Light gray
            ctx.fillRect(panel.x, panel.y, panel.width, panel.height);

            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(panel.x, panel.y + panel.height);
            ctx.lineTo(panel.x, panel.y);
            ctx.lineTo(panel.x + panel.width, panel.y);
            ctx.stroke();

            ctx.strokeStyle = "#555555";
            ctx.beginPath();
            ctx.moveTo(panel.x + panel.width, panel.y);
            ctx.lineTo(panel.x + panel.width, panel.y + panel.height);
            ctx.lineTo(panel.x, panel.y + panel.height);
            ctx.stroke();

            ctx.fillStyle = "#3f3f3f";
            ctx.font = "12px 'Press Start 2P', monospace";
            ctx.textAlign = "left";
            ctx.fillText("Inventory", panel.x + inventoryLayout.padding, panel.y + inventoryLayout.padding);
            ctx.font = "8px 'Press Start 2P', monospace";
            ctx.fillText("Press I to close", panel.x + inventoryLayout.padding, panel.y + inventoryLayout.padding + 16);

            const totalSlots = inventoryLayout.cols * rows;
            for (let index = 0; index < totalSlots; index += 1) {
                const blockType = blockTypes[index];
                const col = index % inventoryLayout.cols;
                const row = Math.floor(index / inventoryLayout.cols);
                const slotX = startX + (col * (inventoryLayout.slotSize + inventoryLayout.gap));
                const slotY = startY + (row * (inventoryLayout.slotSize + inventoryLayout.gap));
                const isEmpty = typeof blockType === "undefined";
                const isActive = !isEmpty && selectedBlockType === blockType;

                // Slot background
                ctx.fillStyle = "#8b8b8b";
                ctx.fillRect(slotX, slotY, inventoryLayout.slotSize, inventoryLayout.slotSize);

                // Slot inner shadow/bevel
                ctx.strokeStyle = "#373737";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(slotX, slotY + inventoryLayout.slotSize);
                ctx.lineTo(slotX, slotY);
                ctx.lineTo(slotX + inventoryLayout.slotSize, slotY);
                ctx.stroke();

                ctx.strokeStyle = "#ffffff";
                ctx.beginPath();
                ctx.moveTo(slotX + inventoryLayout.slotSize, slotY);
                ctx.lineTo(slotX + inventoryLayout.slotSize, slotY + inventoryLayout.slotSize);
                ctx.lineTo(slotX, slotY + inventoryLayout.slotSize);
                ctx.stroke();

                if (!isEmpty) {
                    ctx.fillStyle = blockColors[blockType];
                    const inset = 6;
                    ctx.fillRect(slotX + inset, slotY + inset, inventoryLayout.slotSize - (inset * 2), inventoryLayout.slotSize - (inset * 2));
                }

                if (isActive) {
                    ctx.strokeStyle = "#ffffff";
                    ctx.lineWidth = 3;
                    ctx.strokeRect(slotX - 1, slotY - 1, inventoryLayout.slotSize + 2, inventoryLayout.slotSize + 2);
                }

                /* Block name is usually shown in tooltip in MC, let's keep it clean
                if (!isEmpty) {
                    ctx.fillStyle = "#3f3f3f";
                    ctx.font = "7px 'Press Start 2P', monospace";
                    ctx.textAlign = "center";
                    ctx.fillText(blockNames[blockType], slotX + (inventoryLayout.slotSize / 2), slotY + inventoryLayout.slotSize + 10);
                }
                */
            }

            // Draw currently dragged item attached to cursor
            if (draggedItemType !== null) {
                const drawSize = inventoryLayout.slotSize - 12; // 12 is inset*2 from earlier
                ctx.fillStyle = blockColors[draggedItemType] || "#ffffff";
                // Center the block on the mouse cursor
                ctx.fillRect(mouse.x - drawSize / 2, mouse.y - drawSize / 2, drawSize, drawSize);
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
