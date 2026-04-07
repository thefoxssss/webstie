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
        7: "#5d4037", // Log
        8: "#2e7d32", // Leaves
    };

    const blockNames = {
        1: "GRASS",
        2: "DIRT",
        3: "STONE",
        4: "WOOD",
        5: "GLASS",
        6: "BRICK",
        7: "LOG",
        8: "LEAVES",
    };

    const normalizeItem = (item) => {
        if (item === undefined || item === null) return undefined;
        if (typeof item === "number") return { type: item, count: 1 };
        if (typeof item === "object" && typeof item.type === "number") {
            const count = Number.isFinite(item.count) ? Math.max(0, Math.floor(item.count)) : 1;
            if (count <= 0) return undefined;
            return { type: item.type, count };
        }
        return undefined;
    };
    const cloneItem = (item) => {
        const normalized = normalizeItem(item);
        return normalized ? { ...normalized } : undefined;
    };
    const itemType = (item) => normalizeItem(item)?.type;
    const itemCount = (item) => normalizeItem(item)?.count || 0;

    let selectedHotbarIndex = 0;
    // Map initial available blocks, empty for the rest
    let hotbarSlots = [1, 2, 3, 4, 7, 8, 5, 6, undefined].map(cloneItem);
    let selectedBlockType = hotbarSlots[0] || 1;
    let localPlayerId = null;
    let inventoryOpen = false;

    let inventorySlots = new Array(27).fill(undefined).map(cloneItem);

    // Drag-and-drop state
    let draggedItemType = null; // now stores { type, count }
    let dragSourceHotbarIndex = null;
    let dragSourceInventoryIndex = null;

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
        if (index >= 27) return null;
        return index;
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

    const setupRoomListeners = () => {
        room.onMessage("picked_up", (message) => {
            addInventoryItem(message.type, message.count);
        });

        room.onMessage("died", (message) => {
            console.log(`Died to ${message.killer}`);

            // Drop all items
            const dropItems = [];
            hotbarSlots.forEach(s => { const item = normalizeItem(s); if (item) dropItems.push(item); });
            inventorySlots.forEach(s => { const item = normalizeItem(s); if (item) dropItems.push(item); });

            room.send("spawn_drops", { items: dropItems });
            room.send("respawn");

            // Clear inventory
            hotbarSlots = new Array(9).fill(undefined).map(cloneItem);
            inventorySlots = new Array(27).fill(undefined).map(cloneItem);
            selectedBlockType = hotbarSlots[selectedHotbarIndex];
        });
    };

    const joinRoomById = async (roomId) => {
        try {
            btnJoin.textContent = "CONNECTING...";
            client = new window.Colyseus.Client(getServerUrl());
            room = await client.joinById(roomId, { name: playerName() });
            localPlayerId = room.sessionId;
            setupRoomListeners();
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
            setupRoomListeners();
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
                setupRoomListeners();
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
                    hotbarSlots[dragSourceHotbarIndex] = cloneItem(draggedItemType);
                } else if (dragSourceInventoryIndex !== null) {
                    inventorySlots[dragSourceInventoryIndex] = cloneItem(draggedItemType);
                }
                draggedItemType = null;
                dragSourceHotbarIndex = null;
                dragSourceInventoryIndex = null;
                selectedBlockType = hotbarSlots[selectedHotbarIndex];
            }
            return;
        }

        // Hotbar selection (1-9)
        if (!isNaN(e.key)) {
            const keyNum = parseInt(e.key);
            if (keyNum >= 1 && keyNum <= 9) {
                selectedHotbarIndex = keyNum - 1;
                selectedBlockType = hotbarSlots[selectedHotbarIndex];
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
        const selectedSlotItem = hotbarSlots[selectedHotbarIndex];
        selectedBlockType = selectedSlotItem;

        // Check if attacking
        let attacked = false;
        room.state.players.forEach((p, sessionId) => {
            if (sessionId === localPlayerId) return;
            const dx = p.x + TILE_SIZE/2 - worldX;
            const dy = p.y + TILE_SIZE/2 - worldY;
            if (dx*dx + dy*dy < (TILE_SIZE * 1.5) ** 2) {
                room.send("attack", { targetId: sessionId, damage: 1 });
                attacked = true;
            }
        });

        if (attacked) return;

        if (e.shiftKey || e.button === 2) {
            // Break
            room.send("break", { x: worldX, y: worldY });
        } else if (selectedSlotItem !== undefined && itemCount(selectedSlotItem) > 0) {
            if (!canPlaceBlockAt(worldX, worldY)) return;
            // Build (only if a valid block is selected)
            room.send("build", { x: worldX, y: worldY, type: itemType(selectedSlotItem) });

            selectedSlotItem.count--;
            if (selectedSlotItem.count <= 0) {
                hotbarSlots[selectedHotbarIndex] = undefined;
                selectedBlockType = undefined;
            }
        }
    }

    function canPlaceBlockAt(worldX, worldY) {
        if (!room || !room.state) return false;

        const localPlayer = room.state.players.get(localPlayerId);
        if (!localPlayer || localPlayer.hp <= 0) return false;

        const playerCenterX = localPlayer.x + TILE_SIZE / 2;
        const playerCenterY = localPlayer.y + TILE_SIZE / 2;
        const distSq = (playerCenterX - worldX) ** 2 + (playerCenterY - worldY) ** 2;
        const maxBuildDistance = TILE_SIZE * 6;
        if (distSq > maxBuildDistance ** 2) return false;

        const tileX = Math.floor(worldX / TILE_SIZE);
        const tileY = Math.floor(worldY / TILE_SIZE);
        const chunkX = Math.floor(tileX / CHUNK_SIZE);
        const chunkY = Math.floor(tileY / CHUNK_SIZE);
        const chunk = room.state.chunks.get(`${chunkX},${chunkY}`);
        const key = `${tileX},${tileY}`;
        if (chunk && chunk.blocks.get(key)) return false;

        let intersectsPlayer = false;
        room.state.players.forEach((player) => {
            if (
                player.x < tileX * TILE_SIZE + TILE_SIZE &&
                player.x + TILE_SIZE > tileX * TILE_SIZE &&
                player.y < tileY * TILE_SIZE + TILE_SIZE &&
                player.y + TILE_SIZE > tileY * TILE_SIZE
            ) {
                intersectsPlayer = true;
            }
        });
        return !intersectsPlayer;
    }

    function addInventoryItem(type, count) {
        let remaining = count;

        // First try to fill existing stacks
        for (let i = 0; i < hotbarSlots.length; i++) {
            if (hotbarSlots[i] && hotbarSlots[i].type === type && hotbarSlots[i].count < 99) {
                const add = Math.min(remaining, 99 - hotbarSlots[i].count);
                hotbarSlots[i].count += add;
                remaining -= add;
                if (remaining <= 0) return;
            }
        }
        for (let i = 0; i < inventorySlots.length; i++) {
            if (inventorySlots[i] && inventorySlots[i].type === type && inventorySlots[i].count < 99) {
                const add = Math.min(remaining, 99 - inventorySlots[i].count);
                inventorySlots[i].count += add;
                remaining -= add;
                if (remaining <= 0) return;
            }
        }

        // Then try empty slots
        for (let i = 0; i < hotbarSlots.length; i++) {
            if (hotbarSlots[i] === undefined) {
                hotbarSlots[i] = { type, count: Math.min(remaining, 99) };
                remaining -= hotbarSlots[i].count;
                if (remaining <= 0) {
                    selectedBlockType = hotbarSlots[selectedHotbarIndex];
                    return;
                }
            }
        }
        for (let i = 0; i < inventorySlots.length; i++) {
            if (inventorySlots[i] === undefined) {
                inventorySlots[i] = { type, count: Math.min(remaining, 99) };
                remaining -= inventorySlots[i].count;
                if (remaining <= 0) return;
            }
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
                    draggedItemType = cloneItem(hotbarSlots[hotbarIndex]);
                    dragSourceHotbarIndex = hotbarIndex;
                    dragSourceInventoryIndex = null;
                    hotbarSlots[hotbarIndex] = undefined;
                }
                return;
            }

            const panel = getInventoryBounds();
            const inventoryIndex = getInventorySlotAt(mouse.x, mouse.y, panel);
            if (inventoryIndex !== null) {
                if (inventorySlots[inventoryIndex] !== undefined) {
                    // Pick up from inventory
                    draggedItemType = cloneItem(inventorySlots[inventoryIndex]);
                    dragSourceHotbarIndex = null;
                    dragSourceInventoryIndex = inventoryIndex;
                    inventorySlots[inventoryIndex] = undefined;
                }
            }

            // Check if crafting button clicked
            const craftStartX = panel.x + panel.width - 150;
            const craftStartY = panel.y + 40;
            if (mouse.x >= craftStartX && mouse.x <= craftStartX + 130 &&
                mouse.y >= craftStartY && mouse.y <= craftStartY + 20) {
                // Attempt to craft 4 Planks (Wood=4) -> 1 Plank = Brick(6) for now, or Wood=4 -> 4 Brick(6)? Let's just do Wood(4) -> 4 Wood Planks(which we can use Wood block for).
                // Actually let's do 1 Wood(4) -> 4 Brick(6) as planks.
                let woodIndex = -1;
                let foundHotbar = false;
                for (let i = 0; i < hotbarSlots.length; i++) {
                    if (hotbarSlots[i] && hotbarSlots[i].type === 4 && hotbarSlots[i].count >= 1) {
                        woodIndex = i;
                        foundHotbar = true;
                        break;
                    }
                }
                if (woodIndex === -1) {
                    for (let i = 0; i < inventorySlots.length; i++) {
                        if (inventorySlots[i] && inventorySlots[i].type === 4 && inventorySlots[i].count >= 1) {
                            woodIndex = i;
                            break;
                        }
                    }
                }

                if (woodIndex !== -1) {
                    if (foundHotbar) {
                        hotbarSlots[woodIndex].count--;
                        if (hotbarSlots[woodIndex].count <= 0) hotbarSlots[woodIndex] = undefined;
                    } else {
                        inventorySlots[woodIndex].count--;
                        if (inventorySlots[woodIndex].count <= 0) inventorySlots[woodIndex] = undefined;
                    }
                    addInventoryItem(6, 4); // Brick acts as planks
                }
            }

            return;
        }

        // Normal gameplay mode: hotbar selection
        const hotbarPanel = getHotbarBounds();
        const hotbarIndex = getHotbarIndexAt(mouse.x, mouse.y, hotbarPanel);
        if (hotbarIndex !== null) {
            selectedHotbarIndex = hotbarIndex;
            selectedBlockType = hotbarSlots[selectedHotbarIndex];
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

            const inventoryPanel = getInventoryBounds();
            const inventoryIndex = getInventorySlotAt(mouse.x, mouse.y, inventoryPanel);

            if (hotbarIndex !== null) {
                // Dropped on a hotbar slot
                const existingItem = cloneItem(hotbarSlots[hotbarIndex]);
                hotbarSlots[hotbarIndex] = cloneItem(draggedItemType);

                // Swap logic
                if (existingItem !== undefined) {
                    if (dragSourceHotbarIndex !== null && dragSourceHotbarIndex !== hotbarIndex) {
                        hotbarSlots[dragSourceHotbarIndex] = cloneItem(existingItem);
                    } else if (dragSourceInventoryIndex !== null) {
                        inventorySlots[dragSourceInventoryIndex] = cloneItem(existingItem);
                    }
                }
            } else if (inventoryIndex !== null) {
                // Dropped on an inventory slot
                const existingItem = cloneItem(inventorySlots[inventoryIndex]);
                inventorySlots[inventoryIndex] = cloneItem(draggedItemType);

                // Swap logic
                if (existingItem !== undefined) {
                    if (dragSourceInventoryIndex !== null && dragSourceInventoryIndex !== inventoryIndex) {
                        inventorySlots[dragSourceInventoryIndex] = cloneItem(existingItem);
                    } else if (dragSourceHotbarIndex !== null) {
                        hotbarSlots[dragSourceHotbarIndex] = cloneItem(existingItem);
                    }
                }
            } else {
                // Dropped outside any slot, return to original slot
                if (dragSourceHotbarIndex !== null) {
                    hotbarSlots[dragSourceHotbarIndex] = cloneItem(draggedItemType);
                } else if (dragSourceInventoryIndex !== null) {
                    inventorySlots[dragSourceInventoryIndex] = cloneItem(draggedItemType);
                }
            }

            // Re-sync selectedBlockType in case we modified the currently selected hotbar slot
            selectedBlockType = hotbarSlots[selectedHotbarIndex];

            draggedItemType = null;
            dragSourceHotbarIndex = null;
            dragSourceInventoryIndex = null;
        } else if (draggedItemType !== null) {
            // Drop outside inventory logic -> drop items in world
            room.send("spawn_drops", { items: [cloneItem(draggedItemType)] });
            draggedItemType = null;
            dragSourceHotbarIndex = null;
            dragSourceInventoryIndex = null;
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
            const currentBlockName = selectedBlockType !== undefined ? blockNames[itemType(selectedBlockType)] : "NONE";

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

        // Draw item drops
        room.state.drops.forEach((drop) => {
            const dropSize = TILE_SIZE * 0.4;
            ctx.fillStyle = blockColors[drop.type] || "#ffffff";
            ctx.fillRect(drop.x - dropSize / 2, drop.y - dropSize / 2, dropSize, dropSize);
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1;
            ctx.strokeRect(drop.x - dropSize / 2, drop.y - dropSize / 2, dropSize, dropSize);

            // Pickup logic on client
            if (localPlayer) {
                const dx = localPlayer.x + TILE_SIZE/2 - drop.x;
                const dy = localPlayer.y + TILE_SIZE/2 - drop.y;
                if (dx*dx + dy*dy < (TILE_SIZE * 1.5) ** 2) {
                    room.send("pickup", { id: drop.id });
                }
            }
        });

        // Draw crosshair/preview
        const worldX = mouse.x + camera.x;
        const worldY = mouse.y + camera.y;
        const gridX = Math.floor(worldX / TILE_SIZE) * TILE_SIZE;
        const gridY = Math.floor(worldY / TILE_SIZE) * TILE_SIZE;

        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 2;
        ctx.strokeRect(gridX, gridY, TILE_SIZE, TILE_SIZE);

        // Preview block color slightly transparent (only if a valid block is selected)
        if (selectedBlockType !== undefined && itemCount(selectedBlockType) > 0) {
            ctx.fillStyle = blockColors[itemType(selectedBlockType)];
            ctx.globalAlpha = 0.5;
            ctx.fillRect(gridX, gridY, TILE_SIZE, TILE_SIZE);
            ctx.globalAlpha = 1.0;
        }

        ctx.restore();

        // Draw HP Hearts
        if (localPlayer) {
            const hearts = Math.ceil(localPlayer.hp / 2) || 0; // Each heart is 2 HP, assuming max 20, or 10 hearts total
            // If hp is 10 max, then let's just do 1 heart per 1 hp. The prompt said "10 hearts". So 10 hearts max.
            ctx.fillStyle = "#ff0000";
            for (let i = 0; i < 10; i++) {
                const hx = 10 + i * 16;
                const hy = 10;
                ctx.strokeStyle = "#000";
                ctx.lineWidth = 2;

                if (i < localPlayer.hp) {
                    // Full heart
                    ctx.fillStyle = "#ff0000";
                    ctx.fillRect(hx, hy, 12, 12);
                } else {
                    // Empty heart
                    ctx.fillStyle = "rgba(0,0,0,0.5)";
                    ctx.fillRect(hx, hy, 12, 12);
                }
                ctx.strokeRect(hx, hy, 12, 12);
            }
        }

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

        hotbarSlots.forEach((item, index) => {
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
            if (item) {
                ctx.fillStyle = blockColors[item.type];
                const inset = 6;
                ctx.fillRect(slotX + inset, slotY + inset, hotbarLayout.slotSize - (inset * 2), hotbarLayout.slotSize - (inset * 2));

                // Stack count
                ctx.fillStyle = "#ffffff";
                ctx.font = "8px 'Press Start 2P', monospace";
                ctx.textAlign = "right";
                // Shadow
                ctx.fillStyle = "#3f3f3f";
                ctx.fillText(`${item.count}`, slotX + hotbarLayout.slotSize - 2, slotY + hotbarLayout.slotSize - 4);
                ctx.fillStyle = "#ffffff";
                ctx.fillText(`${item.count}`, slotX + hotbarLayout.slotSize - 3, slotY + hotbarLayout.slotSize - 5);
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
            // Draw Crafting Area (2x2 grid + output)
            const craftStartX = panel.x + panel.width - 150;
            const craftStartY = panel.y + 40;

            ctx.fillStyle = "#3f3f3f";
            ctx.font = "10px 'Press Start 2P', monospace";
            ctx.fillText("Crafting", craftStartX, craftStartY - 10);

            // Draw basic 2x2 grid slots (visual only for now to keep scope bounded, or we can just make it a single "Crafting Table" button)
            // The prompt says "basic crafting and tools". Let's add a simple "Craft Planks" and "Craft Tool" button.

            // Draw buttons
            const drawCraftBtn = (label, btnY, callback) => {
                ctx.fillStyle = "#8b8b8b";
                ctx.fillRect(craftStartX, btnY, 130, 20);
                ctx.strokeStyle = "#373737";
                ctx.strokeRect(craftStartX, btnY, 130, 20);
                ctx.fillStyle = "#ffffff";
                ctx.font = "8px 'Press Start 2P', monospace";
                ctx.fillText(label, craftStartX + 5, btnY + 14);
            };

            drawCraftBtn("WOOD -> 4 PLANKS", craftStartY, () => {});
            // Crafting logic handles via clicks if we want to expand it, but for now we render it.

            for (let index = 0; index < totalSlots; index += 1) {
                const item = inventorySlots[index];
                const col = index % inventoryLayout.cols;
                const row = Math.floor(index / inventoryLayout.cols);
                const slotX = startX + (col * (inventoryLayout.slotSize + inventoryLayout.gap));
                const slotY = startY + (row * (inventoryLayout.slotSize + inventoryLayout.gap));
                const isEmpty = typeof item === "undefined";
                const isActive = false; // We don't need active state in the main inventory anymore, just hotbar

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
                    ctx.fillStyle = blockColors[item.type];
                    const inset = 6;
                    ctx.fillRect(slotX + inset, slotY + inset, inventoryLayout.slotSize - (inset * 2), inventoryLayout.slotSize - (inset * 2));

                    // Stack count
                    ctx.fillStyle = "#ffffff";
                    ctx.font = "8px 'Press Start 2P', monospace";
                    ctx.textAlign = "right";
                    ctx.fillStyle = "#3f3f3f";
                    ctx.fillText(`${item.count}`, slotX + inventoryLayout.slotSize - 2, slotY + inventoryLayout.slotSize - 4);
                    ctx.fillStyle = "#ffffff";
                    ctx.fillText(`${item.count}`, slotX + inventoryLayout.slotSize - 3, slotY + inventoryLayout.slotSize - 5);
                }

                if (isActive) {
                    ctx.strokeStyle = "#ffffff";
                    ctx.lineWidth = 3;
                    ctx.strokeRect(slotX - 1, slotY - 1, inventoryLayout.slotSize + 2, inventoryLayout.slotSize + 2);
                }
            }

            // Draw currently dragged item attached to cursor
            if (draggedItemType !== null) {
                const drawSize = inventoryLayout.slotSize - 12; // 12 is inset*2 from earlier
                ctx.fillStyle = blockColors[draggedItemType.type] || "#ffffff";
                // Center the block on the mouse cursor
                ctx.fillRect(mouse.x - drawSize / 2, mouse.y - drawSize / 2, drawSize, drawSize);

                // Draw count
                ctx.fillStyle = "#ffffff";
                ctx.font = "8px 'Press Start 2P', monospace";
                ctx.textAlign = "right";
                ctx.fillText(`${draggedItemType.count}`, mouse.x + drawSize / 2, mouse.y + drawSize / 2);
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
