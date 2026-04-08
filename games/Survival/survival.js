import { state, isInputFocused } from "../core.js";

export function initSurvival() {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || !window.location.hostname || window.location.search.includes("local=1");
    const networkSelect = document.getElementById("survivalNetwork");
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

    const canvas = document.getElementById("survivalCanvas");
    const ctx = canvas.getContext("2d");
    const menu = document.getElementById("survivalMenu");
    const gameArea = document.getElementById("survivalGame");
    const btnJoin = document.getElementById("btnJoinSurvival");
    const btnRefreshServers = document.getElementById("btnRefreshSurvivalServers");
    const btnCreateServer = document.getElementById("btnCreateSurvivalServer");
    const serverNameInput = document.getElementById("survivalServerName");
    const serverListEl = document.getElementById("survivalServerList");

    const uiX = document.getElementById("survivalX");
    const uiY = document.getElementById("survivalY");
    const uiBlockType = document.getElementById("survivalBlockType");

    const TILE_SIZE = 32;
    const CHUNK_SIZE = 16;

    const blockColors = {
        1: "#3c9e3c", // Grass
        2: "#6b4226", // Dirt
        3: "#808080", // Stone
        4: "#e1c699", // Wood
        5: "#ffffff", // Glass
        6: "#b22222", // Brick
        7: "#5d4037", // Log
        8: "#2e7d32", // Leaves
        9: "#d2b48c", // Planks
        10: "#8b5a2b", // Crafting Table
        11: "#808080", // Sword (rendered differently later, color for item drop/slot)
        12: "#1C1C1C", // Coal
        13: "#B87333", // Copper
        14: "#D0D0D0", // Iron
        15: "#FFD700", // Gold
        16: "#00FFFF", // Diamond
        17: "#39FF14", // Uranium
        18: "#A86533", // Copper Armor
        19: "#C0C0C0", // Iron Armor
        20: "#E6C200", // Gold Armor
        21: "#00E6E6", // Diamond Armor
        22: "#32E612", // Uranium Armor
        23: "#B87333", // Copper Gun
        24: "#D0D0D0", // Iron Gun
        25: "#FFD700", // Gold Gun
        26: "#00FFFF", // Diamond Rifle
        27: "#39FF14", // Uranium Laser
        28: "#B87333", // Copper Ammo
        29: "#111111", // Bedrock
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
        9: "PLANKS",
        10: "CRAFTING TABLE",
        11: "SWORD",
        12: "COAL",
        13: "COPPER",
        14: "IRON",
        15: "GOLD",
        16: "DIAMOND",
        17: "URANIUM",
        18: "COPPER ARMOR",
        19: "IRON ARMOR",
        20: "GOLD ARMOR",
        21: "DIAMOND ARMOR",
        22: "URANIUM ARMOR",
        23: "COPPER GUN",
        24: "IRON GUN",
        25: "GOLD GUN",
        26: "DIAMOND RIFLE",
        27: "URANIUM LASER",
        28: "COPPER AMMO",
        29: "BEDROCK",
    };
    const getMergedInventoryType = (type) => type;
    const getMaxStack = (type) => [11, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27].includes(type) ? 1 : 99;

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
    let armorSlot = undefined;

    // Crafting state
    let craftingGrid2x2 = new Array(4).fill(undefined).map(cloneItem);
    let craftingGrid3x3 = new Array(9).fill(undefined).map(cloneItem);
    let craftingOutputSlot = undefined;
    let isCraftingTableOpen = false;

    // Drag-and-drop state
    let draggedItemType = null; // now stores { type, count }
    let dragSourceHotbarIndex = null;
    let dragSourceInventoryIndex = null;
    let dragSourceCraftingIndex = null;
    let dragSourceOutputSlot = false;
    let dragSourceArmorSlot = false;

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
        widthRatio: 0.85, // Increase width to fit inventory and crafting side-by-side
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
        const startX = panel.x + inventoryLayout.padding; // Shift inventory left to make room
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

    function getItemName(item) {
        const type = itemType(item);
        if (!type) return "";
        return blockNames[type] || `ITEM ${type}`;
    }

    function checkRecipes() {
        craftingOutputSlot = undefined;
        const grid = isCraftingTableOpen ? craftingGrid3x3 : craftingGrid2x2;
        const size = isCraftingTableOpen ? 3 : 2;

        // Convert grid to a simpler 2D array of types for pattern matching
        let pattern = [];
        for (let r = 0; r < size; r++) {
            let row = [];
            for (let c = 0; c < size; c++) {
                const item = grid[r * size + c];
                row.push(item ? item.type : 0);
            }
            pattern.push(row);
        }

        // Helper to check if a specific sub-pattern exists anywhere in the grid
        const matchPattern = (targetPattern) => {
            const targetH = targetPattern.length;
            const targetW = targetPattern[0].length;

            for (let r = 0; r <= size - targetH; r++) {
                for (let c = 0; c <= size - targetW; c++) {
                    let match = true;
                    // Check if the target pattern matches at this offset
                    for (let tr = 0; tr < targetH; tr++) {
                        for (let tc = 0; tc < targetW; tc++) {
                            if (pattern[r + tr][c + tc] !== targetPattern[tr][tc]) {
                                match = false;
                                break;
                            }
                        }
                        if (!match) break;
                    }
                    if (match) {
                        // Check if rest of grid is empty
                        let restEmpty = true;
                        for (let gr = 0; gr < size; gr++) {
                            for (let gc = 0; gc < size; gc++) {
                                // If inside the match box, skip
                                if (gr >= r && gr < r + targetH && gc >= c && gc < c + targetW) continue;
                                if (pattern[gr][gc] !== 0) {
                                    restEmpty = false;
                                    break;
                                }
                            }
                        }
                        if (restEmpty) return true;
                    }
                }
            }
            return false;
        };

        // Recipes

        // 1 Log -> 4 Planks
        if (matchPattern([[7]])) {
            craftingOutputSlot = { type: 9, count: 4 };
            return;
        }

        // 4 Planks -> 1 Crafting Table
        if (matchPattern([
            [9, 9],
            [9, 9]
        ])) {
            craftingOutputSlot = { type: 10, count: 1 };
            return;
        }

        // 2 Stone + 1 Plank -> 1 Sword (requires 3x3 grid)
        if (isCraftingTableOpen && matchPattern([
            [3],
            [3],
            [9]
        ])) {
            craftingOutputSlot = { type: 11, count: 1 };
            return;
        }

        // Armors (U-shape)
        if (isCraftingTableOpen) {
            const armorMap = {
                13: 18, // Copper -> Copper Armor
                14: 19, // Iron -> Iron Armor
                15: 20, // Gold -> Gold Armor
                16: 21, // Diamond -> Diamond Armor
                17: 22  // Uranium -> Uranium Armor
            };
            for (const [mat, out] of Object.entries(armorMap)) {
                if (matchPattern([[Number(mat), 0, Number(mat)], [Number(mat), Number(mat), Number(mat)]])) {
                    craftingOutputSlot = { type: out, count: 1 };
                    return;
                }
            }
        }

        // Guns (T-shape)
        if (isCraftingTableOpen) {
            const gunMap = {
                13: 23, // Copper -> Copper Gun
                14: 24, // Iron -> Iron Gun
                15: 25, // Gold -> Gold Gun
                16: 26, // Diamond -> Diamond Rifle
                17: 27  // Uranium -> Uranium Laser
            };
            for (const [mat, out] of Object.entries(gunMap)) {
                if (matchPattern([[Number(mat), Number(mat), Number(mat)], [0, Number(mat), 0], [0, Number(mat), 0]])) {
                    craftingOutputSlot = { type: out, count: 1 };
                    return;
                }
            }
        }

        // Ammo
        if (isCraftingTableOpen && matchPattern([[0, 0, 0], [0, 13, 0], [0, 0, 0]])) {
            craftingOutputSlot = { type: 28, count: 16 };
            return;
        }
    }

    function consumeCraftingMaterials() {
        // Find what recipe matches so we know how to consume
        // The previous implementation blindly consumed 1 from EVERYTHING in the grid!
        const grid = isCraftingTableOpen ? craftingGrid3x3 : craftingGrid2x2;
        const size = isCraftingTableOpen ? 3 : 2;

        let pattern = [];
        for (let r = 0; r < size; r++) {
            let row = [];
            for (let c = 0; c < size; c++) {
                const item = grid[r * size + c];
                row.push(item ? item.type : 0);
            }
            pattern.push(row);
        }

        const matchPattern = (targetPattern) => {
            const targetH = targetPattern.length;
            const targetW = targetPattern[0].length;
            for (let r = 0; r <= size - targetH; r++) {
                for (let c = 0; c <= size - targetW; c++) {
                    let match = true;
                    let matchIndices = [];
                    for (let tr = 0; tr < targetH; tr++) {
                        for (let tc = 0; tc < targetW; tc++) {
                            if (pattern[r + tr][c + tc] !== targetPattern[tr][tc]) {
                                match = false;
                                break;
                            }
                            if (targetPattern[tr][tc] !== 0) {
                                matchIndices.push((r + tr) * size + (c + tc));
                            }
                        }
                        if (!match) break;
                    }
                    if (match) {
                        let restEmpty = true;
                        for (let gr = 0; gr < size; gr++) {
                            for (let gc = 0; gc < size; gc++) {
                                if (r <= gr && gr < r + targetH && c <= gc && gc < c + targetW) continue;
                                if (pattern[gr][gc] !== 0) {
                                    restEmpty = false;
                                    break;
                                }
                            }
                        }
                        if (restEmpty) return matchIndices;
                    }
                }
            }
            return null;
        };

        let indicesToConsume = null;
        if ((indicesToConsume = matchPattern([[7]])) !== null) {} // 1 Log -> 4 Planks
        else if ((indicesToConsume = matchPattern([[9, 9], [9, 9]])) !== null) {} // 4 Planks -> 1 Crafting Table
        else if (isCraftingTableOpen && (indicesToConsume = matchPattern([[3], [3], [9]])) !== null) {} // Sword
        else if (isCraftingTableOpen && (indicesToConsume = matchPattern([[13, 0, 13], [13, 13, 13]])) !== null) {} // Copper Armor
        else if (isCraftingTableOpen && (indicesToConsume = matchPattern([[14, 0, 14], [14, 14, 14]])) !== null) {} // Iron Armor
        else if (isCraftingTableOpen && (indicesToConsume = matchPattern([[15, 0, 15], [15, 15, 15]])) !== null) {} // Gold Armor
        else if (isCraftingTableOpen && (indicesToConsume = matchPattern([[16, 0, 16], [16, 16, 16]])) !== null) {} // Diamond Armor
        else if (isCraftingTableOpen && (indicesToConsume = matchPattern([[17, 0, 17], [17, 17, 17]])) !== null) {} // Uranium Armor
        else if (isCraftingTableOpen && (indicesToConsume = matchPattern([[13, 13, 13], [0, 13, 0], [0, 13, 0]])) !== null) {} // Copper Gun
        else if (isCraftingTableOpen && (indicesToConsume = matchPattern([[14, 14, 14], [0, 14, 0], [0, 14, 0]])) !== null) {} // Iron Gun
        else if (isCraftingTableOpen && (indicesToConsume = matchPattern([[15, 15, 15], [0, 15, 0], [0, 15, 0]])) !== null) {} // Gold Gun
        else if (isCraftingTableOpen && (indicesToConsume = matchPattern([[16, 16, 16], [0, 16, 0], [0, 16, 0]])) !== null) {} // Diamond Rifle
        else if (isCraftingTableOpen && (indicesToConsume = matchPattern([[17, 17, 17], [0, 17, 0], [0, 17, 0]])) !== null) {} // Uranium Laser
        else if (isCraftingTableOpen && (indicesToConsume = matchPattern([[0, 0, 0], [0, 13, 0], [0, 0, 0]])) !== null) {} // Copper Ammo
        else {
             // Fallback if no recipe matched (shouldn't happen)
             for (let i = 0; i < grid.length; i++) {
                 if (grid[i]) indicesToConsume = (indicesToConsume || []).concat([i]);
             }
        }

        if (indicesToConsume) {
            for (let i of indicesToConsume) {
                if (grid[i]) {
                    grid[i].count--;
                    if (grid[i].count <= 0) grid[i] = undefined;
                }
            }
        }

        checkRecipes();
    }

    function returnCraftingItems() {
        const grid = isCraftingTableOpen ? craftingGrid3x3 : craftingGrid2x2;
        for (let i = 0; i < grid.length; i++) {
            if (grid[i]) {
                addInventoryItem(grid[i].type, grid[i].count);
                grid[i] = undefined;
            }
        }
        checkRecipes();
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
            const response = await fetch(`${getServerHttpBase()}/survival-servers`);
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
            room.send("select_item", { type: 0 });
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
            room = await client.joinOrCreate("survival_room", { name: playerName() });
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
                room = await client.create("survival_room", { name: playerName(), serverName });
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
        if (isInputFocused(e)) return;
        if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") keys.a = true;
        if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") keys.d = true;
        if (e.key === "w" || e.key === "W" || e.key === "ArrowUp" || e.key === " ") {
            if (!keys.w) keys.upPress = true;
            keys.w = true;
        }
        if (e.key === "i" || e.key === "I") {
            inventoryOpen = !inventoryOpen;

            // If opening inventory, make sure we show 2x2 grid not 3x3 table
            if (inventoryOpen) {
                isCraftingTableOpen = false;
            } else {
                returnCraftingItems();
            }

            // Cancel drag if we close inventory while dragging
            if (!inventoryOpen && draggedItemType !== null) {
                if (dragSourceHotbarIndex !== null) {
                    hotbarSlots[dragSourceHotbarIndex] = cloneItem(draggedItemType);
                } else if (dragSourceInventoryIndex !== null) {
                    inventorySlots[dragSourceInventoryIndex] = cloneItem(draggedItemType);
                } else if (dragSourceArmorSlot) {
                    armorSlot = cloneItem(draggedItemType);
                    room.send("equip_armor", { type: armorSlot ? armorSlot.type : 0 });
                } else if (dragSourceCraftingIndex !== null) {
                    // return to inventory instead of grid
                    addInventoryItem(draggedItemType.type, draggedItemType.count);
                } else if (dragSourceOutputSlot) {
                    // we were dragging crafted item, shouldn't really happen but return it
                    addInventoryItem(draggedItemType.type, draggedItemType.count);
                }
                draggedItemType = null;
                dragSourceHotbarIndex = null;
                dragSourceInventoryIndex = null;
                dragSourceCraftingIndex = null;
                dragSourceOutputSlot = false;
                dragSourceArmorSlot = false;
                selectedBlockType = hotbarSlots[selectedHotbarIndex];
            }
            return;
        }

        if (e.key === "Escape" && inventoryOpen) {
            inventoryOpen = false;
            returnCraftingItems();
            if (draggedItemType !== null) {
                if (dragSourceHotbarIndex !== null) {
                    hotbarSlots[dragSourceHotbarIndex] = cloneItem(draggedItemType);
                } else if (dragSourceInventoryIndex !== null) {
                    inventorySlots[dragSourceInventoryIndex] = cloneItem(draggedItemType);
                } else if (dragSourceArmorSlot) {
                    armorSlot = cloneItem(draggedItemType);
                    room.send("equip_armor", { type: armorSlot ? armorSlot.type : 0 });
                } else if (dragSourceCraftingIndex !== null) {
                    addInventoryItem(draggedItemType.type, draggedItemType.count);
                } else if (dragSourceOutputSlot) {
                    addInventoryItem(draggedItemType.type, draggedItemType.count);
                }
                draggedItemType = null;
                dragSourceHotbarIndex = null;
                dragSourceInventoryIndex = null;
                dragSourceCraftingIndex = null;
                dragSourceOutputSlot = false;
                dragSourceArmorSlot = false;
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

                // Tell server about new held item
                room.send("select_item", { type: selectedBlockType ? itemType(selectedBlockType) : 0 });
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

        // Handle shooting guns
        const type = itemType(selectedSlotItem);
        if ([23, 24, 25, 26, 27].includes(type) && !e.shiftKey && (e.button === 0 || e.type === "interval")) { // Support interval events
            // Check for ammo
            let hasAmmo = false;
            let ammoSlotIndex = -1;
            let ammoIsHotbar = false;

            for (let i = 0; i < hotbarSlots.length; i++) {
                if (hotbarSlots[i] && hotbarSlots[i].type === 28) {
                    hasAmmo = true; ammoSlotIndex = i; ammoIsHotbar = true; break;
                }
            }
            if (!hasAmmo) {
                for (let i = 0; i < inventorySlots.length; i++) {
                    if (inventorySlots[i] && inventorySlots[i].type === 28) {
                        hasAmmo = true; ammoSlotIndex = i; break;
                    }
                }
            }

            if (hasAmmo) {
                // Consume ammo
                if (ammoIsHotbar) {
                    hotbarSlots[ammoSlotIndex].count--;
                    if (hotbarSlots[ammoSlotIndex].count <= 0) hotbarSlots[ammoSlotIndex] = undefined;
                } else {
                    inventorySlots[ammoSlotIndex].count--;
                    if (inventorySlots[ammoSlotIndex].count <= 0) inventorySlots[ammoSlotIndex] = undefined;
                }
                room.send("shoot", { x: worldX, y: worldY });
            }
            return;
        }

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

        // Cannot place tools/weapons as blocks
        if (selectedBlockType !== undefined && itemType(selectedBlockType) === 11) return false;

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
        const mergedType = getMergedInventoryType(type);
        let remaining = count;

        // First try to fill existing stacks
        for (let i = 0; i < hotbarSlots.length; i++) {
            if (hotbarSlots[i] && getMergedInventoryType(hotbarSlots[i].type) === mergedType && hotbarSlots[i].count < getMaxStack(mergedType)) {
                const add = Math.min(remaining, getMaxStack(mergedType) - hotbarSlots[i].count);
                hotbarSlots[i].count += add;
                remaining -= add;
                if (remaining <= 0) return;
            }
        }
        for (let i = 0; i < inventorySlots.length; i++) {
            if (inventorySlots[i] && getMergedInventoryType(inventorySlots[i].type) === mergedType && inventorySlots[i].count < getMaxStack(mergedType)) {
                const add = Math.min(remaining, getMaxStack(mergedType) - inventorySlots[i].count);
                inventorySlots[i].count += add;
                remaining -= add;
                if (remaining <= 0) return;
            }
        }

        // Then try empty slots
        for (let i = 0; i < hotbarSlots.length; i++) {
            if (hotbarSlots[i] === undefined) {
                hotbarSlots[i] = { type: mergedType, count: Math.min(remaining, getMaxStack(mergedType)) };
                remaining -= hotbarSlots[i].count;
                if (remaining <= 0) {
                    selectedBlockType = hotbarSlots[selectedHotbarIndex];
                    return;
                }
            }
        }
        for (let i = 0; i < inventorySlots.length; i++) {
            if (inventorySlots[i] === undefined) {
                inventorySlots[i] = { type: mergedType, count: Math.min(remaining, getMaxStack(mergedType)) };
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
                    dragSourceCraftingIndex = null;
                    dragSourceOutputSlot = false;
                    dragSourceArmorSlot = false;
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
                    dragSourceCraftingIndex = null;
                    dragSourceOutputSlot = false;
                    dragSourceArmorSlot = false;
                    inventorySlots[inventoryIndex] = undefined;
                }
                return;
            }

            // Armor Slot Check
            const armorSlotX = panel.x + inventoryLayout.padding;
            const armorSlotY = panel.y + 40;
            if (mouse.x >= armorSlotX && mouse.x <= armorSlotX + inventoryLayout.slotSize &&
                mouse.y >= armorSlotY && mouse.y <= armorSlotY + inventoryLayout.slotSize) {
                if (armorSlot !== undefined) {
                    draggedItemType = cloneItem(armorSlot);
                    dragSourceHotbarIndex = null;
                    dragSourceInventoryIndex = null;
                    dragSourceCraftingIndex = null;
                    dragSourceOutputSlot = false;
                    dragSourceArmorSlot = true;
                    armorSlot = undefined;
                    room.send("equip_armor", { type: 0 }); // unequip
                }
                return;
            }

            // Check if crafting grids or output slot clicked
            const craftStartX = panel.x + panel.width - 190;
            const craftStartY = panel.y + 40;
            const size = isCraftingTableOpen ? 3 : 2;
            const stride = inventoryLayout.slotSize + inventoryLayout.gap;
            if (mouse.x >= craftStartX && mouse.x <= craftStartX + 130 &&
                mouse.y >= craftStartY && mouse.y <= craftStartY + 20) {
                // Attempt to craft 4 Planks (Wood=4) -> 1 Plank = Brick(6) for now, or Wood=4 -> 4 Brick(6)? Let's just do Wood(4) -> 4 Wood Planks(which we can use Wood block for).
                // Actually let's do 1 Wood(4) -> 4 Brick(6) as planks.
                let woodIndex = -1;
                let foundHotbar = false;
                for (let i = 0; i < hotbarSlots.length; i++) {
                    if (hotbarSlots[i] && getMergedInventoryType(hotbarSlots[i].type) === 4 && hotbarSlots[i].count >= 1) {
                        woodIndex = i;
                        foundHotbar = true;
                        break;
                    }
                }
                if (woodIndex === -1) {
                    for (let i = 0; i < inventorySlots.length; i++) {
                        if (inventorySlots[i] && getMergedInventoryType(inventorySlots[i].type) === 4 && inventorySlots[i].count >= 1) {
                            woodIndex = i;
                            break;
                        }
                        return;
                    }
                }
            }

            // Pick up from crafting grid
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const slotX = craftStartX + c * stride;
                    const slotY = craftStartY + r * stride;
                    if (mouse.x >= slotX && mouse.x <= slotX + inventoryLayout.slotSize &&
                        mouse.y >= slotY && mouse.y <= slotY + inventoryLayout.slotSize) {
                        const craftingIndex = r * size + c;
                        const grid = isCraftingTableOpen ? craftingGrid3x3 : craftingGrid2x2;
                        if (grid[craftingIndex] !== undefined) {
                            draggedItemType = cloneItem(grid[craftingIndex]);
                            dragSourceHotbarIndex = null;
                            dragSourceInventoryIndex = null;
                            dragSourceCraftingIndex = craftingIndex;
                            dragSourceOutputSlot = false;
                            dragSourceArmorSlot = false;
                            grid[craftingIndex] = undefined;
                            checkRecipes();
                        }
                        return;
                    }
                }
            }

            // Output slot check
            const outX = craftStartX + size * stride + 20;
            const outY = craftStartY + Math.floor((size * stride) / 2) - inventoryLayout.slotSize / 2;
            if (mouse.x >= outX && mouse.x <= outX + inventoryLayout.slotSize &&
                mouse.y >= outY && mouse.y <= outY + inventoryLayout.slotSize) {
                if (craftingOutputSlot !== undefined) {
                    draggedItemType = cloneItem(craftingOutputSlot);
                    dragSourceHotbarIndex = null;
                    dragSourceInventoryIndex = null;
                    dragSourceCraftingIndex = null;
                    dragSourceOutputSlot = true;
                    dragSourceArmorSlot = false;
                    // Dont consume materials until mouse up (if placed successfully)
                    // Or we could consume right here. Let's consume right here, it's easier.
                    consumeCraftingMaterials();
                }
                return;
            }

            return;
        }

        // Normal gameplay mode: hotbar selection
        const hotbarPanel = getHotbarBounds();
        const hotbarIndex = getHotbarIndexAt(mouse.x, mouse.y, hotbarPanel);
        if (hotbarIndex !== null) {
            selectedHotbarIndex = hotbarIndex;
            selectedBlockType = hotbarSlots[selectedHotbarIndex];

            // Tell server about new held item
            room.send("select_item", { type: selectedBlockType ? itemType(selectedBlockType) : 0 });
            return;
        }

        // Interact with crafting table
        if (e.button === 2 && !e.shiftKey) {
            const worldX = mouse.x + camera.x;
            const worldY = mouse.y + camera.y;
            const tileX = Math.floor(worldX / TILE_SIZE);
            const tileY = Math.floor(worldY / TILE_SIZE);
            const chunkX = Math.floor(tileX / CHUNK_SIZE);
            const chunkY = Math.floor(tileY / CHUNK_SIZE);
            const chunk = room.state.chunks.get(`${chunkX},${chunkY}`);
            if (chunk) {
                const block = chunk.blocks.get(`${tileX},${tileY}`);
                if (block && block.type === 10) { // Crafting Table
                    inventoryOpen = true;
                    isCraftingTableOpen = true;
                    return;
                }
            }
        }

        mouse.isDown = true;
        sendBuildOrBreak(e);

        // Hold left click to repeatedly place blocks after a short delay.
        if (!e.shiftKey && e.button === 0) {
            clearBuildHoldTimers();
            const selectedSlotItem = hotbarSlots[selectedHotbarIndex];
            const type = itemType(selectedSlotItem);
            // Auto fire logic for Shotgun(25), Assault Rifle(26), Uranium Gun(27)
            if ([25, 26, 27].includes(type)) {
                let fireRate = 200; // ms between shots
                if (type === 25) fireRate = 400; // Shotgun slower
                if (type === 26) fireRate = 100; // Rifle fast
                if (type === 27) fireRate = 80;  // Uranium fastest

                buildHoldInterval = setInterval(() => {
                    if (!mouse.isDown || !room) {
                        clearBuildHoldTimers();
                        return;
                    }
                    // Pass a mock event object with button 0 and type interval so the shoot logic accepts it
                    sendBuildOrBreak({ button: 0, shiftKey: false, type: "interval" });
                }, fireRate);
            } else {
                buildHoldTimeout = setTimeout(() => {
                    buildHoldInterval = setInterval(() => {
                        if (!mouse.isDown || !room) {
                            clearBuildHoldTimers();
                            return;
                        }
                        sendBuildOrBreak({ button: 0, shiftKey: false, type: "interval" });
                    }, BUILD_HOLD_REPEAT_MS);
                }, BUILD_HOLD_DELAY_MS);
            }
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

            // Crafting grid drop target
            const craftStartX = inventoryPanel.x + inventoryPanel.width - 190;
            const craftStartY = inventoryPanel.y + 40;
            const size = isCraftingTableOpen ? 3 : 2;
            const stride = inventoryLayout.slotSize + inventoryLayout.gap;
            let targetCraftingIndex = null;

            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const slotX = craftStartX + c * stride;
                    const slotY = craftStartY + r * stride;
                    if (mouse.x >= slotX && mouse.x <= slotX + inventoryLayout.slotSize &&
                        mouse.y >= slotY && mouse.y <= slotY + inventoryLayout.slotSize) {
                        targetCraftingIndex = r * size + c;
                        break;
                    }
                }
                if (targetCraftingIndex !== null) break;
            }

            const isArmorSlotDrop = mouse.x >= inventoryPanel.x + inventoryLayout.padding &&
                                  mouse.x <= inventoryPanel.x + inventoryLayout.padding + inventoryLayout.slotSize &&
                                  mouse.y >= inventoryPanel.y + 40 &&
                                  mouse.y <= inventoryPanel.y + 40 + inventoryLayout.slotSize;

            if (isArmorSlotDrop && !dragSourceOutputSlot) {
                // Check if dragging an armor item (18-22)
                if ([18, 19, 20, 21, 22].includes(draggedItemType.type)) {
                    const existingItem = cloneItem(armorSlot);
                    armorSlot = cloneItem(draggedItemType);
                    room.send("equip_armor", { type: armorSlot.type });

                    // Swap logic
                    if (existingItem !== undefined) {
                        if (dragSourceHotbarIndex !== null) hotbarSlots[dragSourceHotbarIndex] = cloneItem(existingItem);
                        else if (dragSourceInventoryIndex !== null) inventorySlots[dragSourceInventoryIndex] = cloneItem(existingItem);
                        else if (dragSourceArmorSlot) {
                            // Swapping armor with itself?
                            armorSlot = cloneItem(existingItem);
                            room.send("equip_armor", { type: armorSlot.type });
                        }
                    }
                } else {
                    // Cannot place non-armor in armor slot, return to original
                    if (dragSourceHotbarIndex !== null) hotbarSlots[dragSourceHotbarIndex] = cloneItem(draggedItemType);
                    else if (dragSourceInventoryIndex !== null) inventorySlots[dragSourceInventoryIndex] = cloneItem(draggedItemType);
                    else if (dragSourceArmorSlot) { armorSlot = cloneItem(draggedItemType); room.send("equip_armor", { type: armorSlot.type }); }
                }
            } else if (hotbarIndex !== null && !dragSourceOutputSlot) {
                // Dropped on a hotbar slot
                const existingItem = cloneItem(hotbarSlots[hotbarIndex]);
                hotbarSlots[hotbarIndex] = cloneItem(draggedItemType);

                // Swap logic
                if (existingItem !== undefined) {
                    if (dragSourceHotbarIndex !== null && dragSourceHotbarIndex !== hotbarIndex) {
                        hotbarSlots[dragSourceHotbarIndex] = cloneItem(existingItem);
                    } else if (dragSourceInventoryIndex !== null) {
                        inventorySlots[dragSourceInventoryIndex] = cloneItem(existingItem);
                    } else if (dragSourceArmorSlot) {
                        if ([18, 19, 20, 21, 22].includes(existingItem.type)) {
                            armorSlot = cloneItem(existingItem);
                            room.send("equip_armor", { type: armorSlot.type });
                        } else {
                            hotbarSlots[hotbarIndex] = cloneItem(existingItem); // revert
                            armorSlot = cloneItem(draggedItemType); // revert
                            room.send("equip_armor", { type: armorSlot.type });
                        }
                    } else if (dragSourceCraftingIndex !== null) {
                        const grid = isCraftingTableOpen ? craftingGrid3x3 : craftingGrid2x2;
                        grid[dragSourceCraftingIndex] = cloneItem(existingItem);
                    }
                }
            } else if (hotbarIndex !== null && dragSourceOutputSlot) {
                // Dropped crafted item on hotbar
                const existingItem = cloneItem(hotbarSlots[hotbarIndex]);
                if (existingItem === undefined || existingItem.type === draggedItemType.type) {
                     if (existingItem) {
                         hotbarSlots[hotbarIndex].count += draggedItemType.count;
                     } else {
                         hotbarSlots[hotbarIndex] = cloneItem(draggedItemType);
                     }
                } else {
                    addInventoryItem(draggedItemType.type, draggedItemType.count); // just put in inventory
                }
            } else if (inventoryIndex !== null && !dragSourceOutputSlot) {
                // Dropped on an inventory slot
                const existingItem = cloneItem(inventorySlots[inventoryIndex]);
                inventorySlots[inventoryIndex] = cloneItem(draggedItemType);

                // Swap logic
                if (existingItem !== undefined) {
                    if (dragSourceInventoryIndex !== null && dragSourceInventoryIndex !== inventoryIndex) {
                        inventorySlots[dragSourceInventoryIndex] = cloneItem(existingItem);
                    } else if (dragSourceHotbarIndex !== null) {
                        hotbarSlots[dragSourceHotbarIndex] = cloneItem(existingItem);
                    } else if (dragSourceArmorSlot) {
                        if ([18, 19, 20, 21, 22].includes(existingItem.type)) {
                            armorSlot = cloneItem(existingItem);
                            room.send("equip_armor", { type: armorSlot.type });
                        } else {
                            inventorySlots[inventoryIndex] = cloneItem(existingItem); // revert
                            armorSlot = cloneItem(draggedItemType); // revert
                            room.send("equip_armor", { type: armorSlot.type });
                        }
                    } else if (dragSourceCraftingIndex !== null) {
                        const grid = isCraftingTableOpen ? craftingGrid3x3 : craftingGrid2x2;
                        grid[dragSourceCraftingIndex] = cloneItem(existingItem);
                    }
                }
            } else if (inventoryIndex !== null && dragSourceOutputSlot) {
                // Dropped crafted item on inventory
                const existingItem = cloneItem(inventorySlots[inventoryIndex]);
                if (existingItem === undefined || existingItem.type === draggedItemType.type) {
                     if (existingItem) {
                         inventorySlots[inventoryIndex].count += draggedItemType.count;
                     } else {
                         inventorySlots[inventoryIndex] = cloneItem(draggedItemType);
                     }
                } else {
                    addInventoryItem(draggedItemType.type, draggedItemType.count); // fallback
                }
            } else if (targetCraftingIndex !== null && !dragSourceOutputSlot) {
                // Dropped on crafting grid
                const grid = isCraftingTableOpen ? craftingGrid3x3 : craftingGrid2x2;

                // Allow splitting stacks if dropping 1 item into empty slot with right click
                // But for simplicity, just drop 1 item always into crafting, or drop whole stack.
                // Let's drop 1 item from the stack if right clicking, otherwise whole stack.
                // Playwright tests don't easily do drag with right click, so let's just drop 1 item ALWAYS into crafting grid if we have >1, so we can make tools easily.

                let dropCount = 1; // By default drop 1 into crafting
                let remainingCount = draggedItemType.count - dropCount;

                const existingItem = cloneItem(grid[targetCraftingIndex]);

                if (existingItem && existingItem.type !== draggedItemType.type) {
                    // Cannot mix items, swap whole stack
                    grid[targetCraftingIndex] = cloneItem(draggedItemType);

                    if (dragSourceHotbarIndex !== null) hotbarSlots[dragSourceHotbarIndex] = cloneItem(existingItem);
                    else if (dragSourceInventoryIndex !== null) inventorySlots[dragSourceInventoryIndex] = cloneItem(existingItem);
                    else if (dragSourceArmorSlot) {
                        if ([18, 19, 20, 21, 22].includes(existingItem.type)) {
                            armorSlot = cloneItem(existingItem);
                            room.send("equip_armor", { type: armorSlot.type });
                        } else {
                            grid[targetCraftingIndex] = cloneItem(existingItem); // revert
                            armorSlot = cloneItem(draggedItemType); // revert
                            room.send("equip_armor", { type: armorSlot.type });
                        }
                    }
                    else if (dragSourceCraftingIndex !== null) grid[dragSourceCraftingIndex] = cloneItem(existingItem);

                } else {
                    // Place 1 item
                    if (existingItem) {
                        grid[targetCraftingIndex].count += dropCount;
                    } else {
                        grid[targetCraftingIndex] = { type: draggedItemType.type, count: dropCount };
                    }

                    if (remainingCount > 0) {
                        // Return remainder to source
                        const remainder = { type: draggedItemType.type, count: remainingCount };
                        if (dragSourceHotbarIndex !== null) hotbarSlots[dragSourceHotbarIndex] = remainder;
                        else if (dragSourceInventoryIndex !== null) inventorySlots[dragSourceInventoryIndex] = remainder;
                        else if (dragSourceArmorSlot) { armorSlot = remainder; room.send("equip_armor", { type: armorSlot.type }); }
                        else if (dragSourceCraftingIndex !== null) grid[dragSourceCraftingIndex] = remainder;
                    } else {
                        // All gone
                        if (dragSourceHotbarIndex !== null) hotbarSlots[dragSourceHotbarIndex] = undefined;
                        else if (dragSourceInventoryIndex !== null) inventorySlots[dragSourceInventoryIndex] = undefined;
                        else if (dragSourceArmorSlot) { armorSlot = undefined; room.send("equip_armor", { type: 0 }); }
                        else if (dragSourceCraftingIndex !== null && dragSourceCraftingIndex !== targetCraftingIndex) grid[dragSourceCraftingIndex] = undefined;
                    }
                }

                checkRecipes();

            } else {
                // Dropped outside any slot, return to original slot or drop in world
                if (dragSourceOutputSlot) {
                    addInventoryItem(draggedItemType.type, draggedItemType.count);
                } else if (dragSourceHotbarIndex !== null) {
                    hotbarSlots[dragSourceHotbarIndex] = cloneItem(draggedItemType);
                } else if (dragSourceInventoryIndex !== null) {
                    inventorySlots[dragSourceInventoryIndex] = cloneItem(draggedItemType);
                } else if (dragSourceArmorSlot) {
                    armorSlot = cloneItem(draggedItemType);
                    room.send("equip_armor", { type: armorSlot.type });
                } else if (dragSourceCraftingIndex !== null) {
                    const grid = isCraftingTableOpen ? craftingGrid3x3 : craftingGrid2x2;
                    grid[dragSourceCraftingIndex] = cloneItem(draggedItemType);
                    checkRecipes();
                }
            }

            // Re-sync selectedBlockType in case we modified the currently selected hotbar slot
            selectedBlockType = hotbarSlots[selectedHotbarIndex];
            room.send("select_item", { type: selectedBlockType ? itemType(selectedBlockType) : 0 });

            draggedItemType = null;
            dragSourceHotbarIndex = null;
            dragSourceInventoryIndex = null;
            dragSourceCraftingIndex = null;
            dragSourceOutputSlot = false;
            dragSourceArmorSlot = false;

        } else if (draggedItemType !== null) {
            // Drop outside inventory logic -> drop items in world
            room.send("spawn_drops", { items: [cloneItem(draggedItemType)] });
            draggedItemType = null;
            dragSourceHotbarIndex = null;
            dragSourceInventoryIndex = null;
            dragSourceCraftingIndex = null;
            dragSourceOutputSlot = false;
            dragSourceArmorSlot = false;
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

            // Draw armor if equipped
            if (p.armorType && p.armorType >= 18 && p.armorType <= 22) {
                ctx.fillStyle = blockColors[p.armorType];
                // Helmet
                ctx.fillRect(p.x - 2, p.y - 2, TILE_SIZE + 4, 10);
                // Chest
                ctx.fillRect(p.x + 4, p.y + 8, TILE_SIZE - 8, 16);
            }

            // Draw player border
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 2;
            ctx.strokeRect(p.x, p.y, TILE_SIZE, TILE_SIZE);

            // Draw held item (Sword or Gun)
            if (p.selectedItemType === 11) {
                ctx.save();
                ctx.translate(p.x + TILE_SIZE + 5, p.y + TILE_SIZE / 2);
                ctx.rotate(Math.PI / 4); // point it outwards
                ctx.fillStyle = "#808080"; // Sword color
                ctx.fillRect(-2, -15, 4, 20); // Blade
                ctx.fillStyle = "#8b5a2b"; // Handle
                ctx.fillRect(-2, 5, 4, 10);
                ctx.fillStyle = "#000"; // Crossguard
                ctx.fillRect(-6, 5, 12, 4);
                ctx.restore();
            } else if ([23, 24, 25, 26, 27].includes(p.selectedItemType)) {
                ctx.save();
                ctx.translate(p.x + TILE_SIZE / 2, p.y + TILE_SIZE / 2);

                // Calculate angle. For local player, use mouse position. For others, assume aiming forward (or could sync mouse angle in future)
                let angle = 0;
                if (p === localPlayer) {
                    const worldX = mouse.x + camera.x;
                    const worldY = mouse.y + camera.y;
                    angle = Math.atan2(worldY - (p.y + TILE_SIZE / 2), worldX - (p.x + TILE_SIZE / 2));
                } else {
                    angle = p.vx < 0 ? Math.PI : 0;
                }

                ctx.rotate(angle);

                // Offset gun outward
                ctx.translate(15, 0);

                // Draw a simple gun shape
                ctx.fillStyle = blockColors[p.selectedItemType] || "#444";
                // Gun barrel
                ctx.fillRect(0, -2, 12, 4);
                // Gun handle
                ctx.fillRect(0, 0, 4, 8);

                ctx.restore();
            }

            // Draw player name
            ctx.fillStyle = "#000";
            ctx.font = "10px 'Press Start 2P', monospace";
            ctx.textAlign = "center";
            ctx.fillText(p.name, p.x + TILE_SIZE / 2, p.y - 5);
        });

        // Draw bullets
        room.state.bullets.forEach((b) => {
            ctx.fillStyle = "#ffcc00";
            ctx.beginPath();
            ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
            ctx.fill();

            // Trail
            ctx.strokeStyle = "rgba(255, 204, 0, 0.5)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(b.x, b.y);
            ctx.lineTo(b.x - b.vx * 2, b.y - b.vy * 2);
            ctx.stroke();
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

            // Draw Armor Bar below HP
            if (localPlayer.maxArmorHp > 0) {
                const maxArmorHearts = localPlayer.maxArmorHp;
                for (let i = 0; i < maxArmorHearts; i++) {
                    const hx = 10 + i * 16;
                    const hy = 26; // below HP
                    ctx.strokeStyle = "#000";
                    ctx.lineWidth = 2;

                    if (i < localPlayer.armorHp) {
                        // Full Armor heart
                        ctx.fillStyle = "#a8a8a8"; // gray/silverish for armor
                        ctx.fillRect(hx, hy, 12, 12);
                    } else {
                        // Empty Armor heart
                        ctx.fillStyle = "rgba(0,0,0,0.5)";
                        ctx.fillRect(hx, hy, 12, 12);
                    }
                    ctx.strokeRect(hx, hy, 12, 12);
                }
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

        let hoverItemName = "";
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
                const inset = 6;
                drawItemIcon(ctx, item.type, slotX + inset, slotY + inset, hotbarLayout.slotSize - (inset * 2));

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

            if (inventoryOpen && !hoverItemName && item) {
                const isHoveringSlot =
                    mouse.x >= slotX &&
                    mouse.x <= slotX + hotbarLayout.slotSize &&
                    mouse.y >= slotY &&
                    mouse.y <= slotY + hotbarLayout.slotSize;
                if (isHoveringSlot) hoverItemName = getItemName(item);
            }
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

            // Draw Armor Slot
            const armorSlotX = panel.x + inventoryLayout.padding;
            const armorSlotY = panel.y + 40;
            ctx.fillStyle = "#8b8b8b";
            ctx.fillRect(armorSlotX, armorSlotY, inventoryLayout.slotSize, inventoryLayout.slotSize);

            ctx.strokeStyle = "#373737";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(armorSlotX, armorSlotY + inventoryLayout.slotSize);
            ctx.lineTo(armorSlotX, armorSlotY);
            ctx.lineTo(armorSlotX + inventoryLayout.slotSize, armorSlotY);
            ctx.stroke();

            ctx.strokeStyle = "#ffffff";
            ctx.beginPath();
            ctx.moveTo(armorSlotX + inventoryLayout.slotSize, armorSlotY);
            ctx.lineTo(armorSlotX + inventoryLayout.slotSize, armorSlotY + inventoryLayout.slotSize);
            ctx.lineTo(armorSlotX, armorSlotY + inventoryLayout.slotSize);
            ctx.stroke();

            if (armorSlot) {
                const inset = 6;
                drawItemIcon(ctx, armorSlot.type, armorSlotX + inset, armorSlotY + inset, inventoryLayout.slotSize - (inset * 2));
            } else {
                // Placeholder
                ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
                ctx.textAlign = "center";
                ctx.fillText("Armor", armorSlotX + inventoryLayout.slotSize/2, armorSlotY + inventoryLayout.slotSize/2 + 4);
            }

            const totalSlots = inventoryLayout.cols * rows;
            // Draw Crafting Area (2x2 grid + output)
            const craftStartX = panel.x + panel.width - 190;
            const craftStartY = panel.y + 40;

            ctx.fillStyle = "#3f3f3f";
            ctx.font = "10px 'Press Start 2P', monospace";
            ctx.fillText(isCraftingTableOpen ? "Crafting Table" : "Crafting", craftStartX, craftStartY - 10);

            const size = isCraftingTableOpen ? 3 : 2;
            const stride = inventoryLayout.slotSize + inventoryLayout.gap;

            // Draw Crafting Grid
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const slotX = craftStartX + c * stride;
                    const slotY = craftStartY + r * stride;

                    ctx.fillStyle = "#8b8b8b";
                    ctx.fillRect(slotX, slotY, inventoryLayout.slotSize, inventoryLayout.slotSize);

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

                    const grid = isCraftingTableOpen ? craftingGrid3x3 : craftingGrid2x2;
                    const item = grid[r * size + c];
                    if (item) {
                        const inset = 6;
                        drawItemIcon(ctx, item.type, slotX + inset, slotY + inset, inventoryLayout.slotSize - (inset * 2));

                        ctx.fillStyle = "#ffffff";
                        ctx.font = "8px 'Press Start 2P', monospace";
                        ctx.textAlign = "right";
                        ctx.fillStyle = "#3f3f3f";
                        ctx.fillText(`${item.count}`, slotX + inventoryLayout.slotSize - 2, slotY + inventoryLayout.slotSize - 4);
                        ctx.fillStyle = "#ffffff";
                        ctx.fillText(`${item.count}`, slotX + inventoryLayout.slotSize - 3, slotY + inventoryLayout.slotSize - 5);
                    }
                }
            }

            // Draw arrow
            ctx.fillStyle = "#3f3f3f";
            ctx.font = "12px 'Press Start 2P', monospace";
            ctx.textAlign = "center";
            ctx.fillText("->", craftStartX + size * stride + 8, craftStartY + Math.floor((size * stride) / 2) + 4);

            // Draw output slot
            const outX = craftStartX + size * stride + 20;
            const outY = craftStartY + Math.floor((size * stride) / 2) - inventoryLayout.slotSize / 2;

            ctx.fillStyle = "#8b8b8b";
            ctx.fillRect(outX, outY, inventoryLayout.slotSize, inventoryLayout.slotSize);

            ctx.strokeStyle = "#373737";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(outX, outY + inventoryLayout.slotSize);
            ctx.lineTo(outX, outY);
            ctx.lineTo(outX + inventoryLayout.slotSize, outY);
            ctx.stroke();

            ctx.strokeStyle = "#ffffff";
            ctx.beginPath();
            ctx.moveTo(outX + inventoryLayout.slotSize, outY);
            ctx.lineTo(outX + inventoryLayout.slotSize, outY + inventoryLayout.slotSize);
            ctx.lineTo(outX, outY + inventoryLayout.slotSize);
            ctx.stroke();

            if (craftingOutputSlot) {
                const inset = 6;
                drawItemIcon(ctx, craftingOutputSlot.type, outX + inset, outY + inset, inventoryLayout.slotSize - (inset * 2));

                ctx.fillStyle = "#ffffff";
                ctx.font = "8px 'Press Start 2P', monospace";
                ctx.textAlign = "right";
                ctx.fillStyle = "#3f3f3f";
                ctx.fillText(`${craftingOutputSlot.count}`, outX + inventoryLayout.slotSize - 2, outY + inventoryLayout.slotSize - 4);
                ctx.fillStyle = "#ffffff";
                ctx.fillText(`${craftingOutputSlot.count}`, outX + inventoryLayout.slotSize - 3, outY + inventoryLayout.slotSize - 5);
            }


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
                    const inset = 6;
                        drawItemIcon(ctx, item.type, slotX + inset, slotY + inset, inventoryLayout.slotSize - (inset * 2));

                    // Stack count
                    ctx.fillStyle = "#ffffff";
                    ctx.font = "8px 'Press Start 2P', monospace";
                    ctx.textAlign = "right";
                    ctx.fillStyle = "#3f3f3f";
                    ctx.fillText(`${item.count}`, slotX + inventoryLayout.slotSize - 2, slotY + inventoryLayout.slotSize - 4);
                    ctx.fillStyle = "#ffffff";
                    ctx.fillText(`${item.count}`, slotX + inventoryLayout.slotSize - 3, slotY + inventoryLayout.slotSize - 5);
                }

                if (!hoverItemName && !isEmpty) {
                    const isHoveringSlot =
                        mouse.x >= slotX &&
                        mouse.x <= slotX + inventoryLayout.slotSize &&
                        mouse.y >= slotY &&
                        mouse.y <= slotY + inventoryLayout.slotSize;
                    if (isHoveringSlot) hoverItemName = getItemName(item);
                }

                if (isActive) {
                    ctx.strokeStyle = "#ffffff";
                    ctx.lineWidth = 3;
                    ctx.strokeRect(slotX - 1, slotY - 1, inventoryLayout.slotSize + 2, inventoryLayout.slotSize + 2);
                }
            }

            if (hoverItemName) {
                ctx.font = "8px 'Press Start 2P', monospace";
                ctx.textAlign = "left";
                const textWidth = ctx.measureText(hoverItemName).width;
                const tipX = Math.min(canvas.width - textWidth - 14, mouse.x + 12);
                const tipY = Math.max(14, mouse.y - 10);
                ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
                ctx.fillRect(tipX - 4, tipY - 10, textWidth + 8, 14);
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1;
                ctx.strokeRect(tipX - 4, tipY - 10, textWidth + 8, 14);
                ctx.fillStyle = "#ffffff";
                ctx.fillText(hoverItemName, tipX, tipY);
            }

            // Draw currently dragged item attached to cursor
            if (draggedItemType !== null) {
                const drawSize = inventoryLayout.slotSize - 12; // 12 is inset*2 from earlier
                // Center the block on the mouse cursor
                drawItemIcon(ctx, draggedItemType.type, mouse.x - drawSize / 2, mouse.y - drawSize / 2, drawSize);

                // Draw count
                ctx.fillStyle = "#ffffff";
                ctx.font = "8px 'Press Start 2P', monospace";
                ctx.textAlign = "right";
                ctx.fillText(`${draggedItemType.count}`, mouse.x + drawSize / 2, mouse.y + drawSize / 2);
            }
        }

        animationFrameId = requestAnimationFrame(render);
    }


    function drawItemIcon(ctx, type, x, y, size) {
        ctx.save();
        ctx.translate(x, y);

        if (type === 11) { // Sword
            // Draw sword diagonally
            ctx.translate(size/2, size/2);
            ctx.rotate(-Math.PI / 4);

            // Blade
            ctx.fillStyle = "#808080";
            ctx.fillRect(-2, -size/2 + 2, 4, size * 0.6);

            // Handle
            ctx.fillStyle = "#8b5a2b";
            ctx.fillRect(-2, size/2 - size * 0.4 + 2, 4, size * 0.3);

            // Crossguard
            ctx.fillStyle = "#000";
            ctx.fillRect(-6, size/2 - size * 0.4 + 2, 12, 3);

        } else {
            // Standard block base
            ctx.fillStyle = blockColors[type] || "#ffffff";
            ctx.fillRect(0, 0, size, size);

            // Texture details based on type
            ctx.fillStyle = "rgba(0,0,0,0.2)";
            if (type === 1) { // Grass: green top, dirt bottom
                ctx.fillStyle = blockColors[2]; // Dirt color
                ctx.fillRect(0, size * 0.3, size, size * 0.7);
            } else if (type === 3) { // Stone: speckles
                ctx.fillRect(size * 0.2, size * 0.2, size * 0.2, size * 0.2);
                ctx.fillRect(size * 0.6, size * 0.5, size * 0.2, size * 0.2);
                ctx.fillRect(size * 0.3, size * 0.7, size * 0.2, size * 0.2);
            } else if (type === 4 || type === 7 || type === 9) { // Wood variants: lines
                ctx.fillRect(size * 0.2, 0, 2, size);
                ctx.fillRect(size * 0.6, 0, 2, size);
            } else if (type === 5) { // Glass: shine
                ctx.fillStyle = "rgba(255,255,255,0.5)";
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(size * 0.5, 0);
                ctx.lineTo(0, size * 0.5);
                ctx.fill();
            } else if (type === 6) { // Brick: mortar lines
                ctx.fillStyle = "rgba(200,200,200,0.5)";
                ctx.fillRect(0, size * 0.4, size, 2);
                ctx.fillRect(size * 0.5, 0, 2, size * 0.4);
                ctx.fillRect(size * 0.2, size * 0.4, 2, size * 0.6);
            } else if (type === 8) { // Leaves: dots
                ctx.fillRect(size * 0.2, size * 0.2, 2, 2);
                ctx.fillRect(size * 0.7, size * 0.3, 2, 2);
                ctx.fillRect(size * 0.4, size * 0.6, 2, 2);
                ctx.fillRect(size * 0.8, size * 0.8, 2, 2);
            } else if (type === 10) { // Crafting table
                ctx.fillStyle = "#5c3a21";
                ctx.fillRect(0, 0, size, size * 0.2); // Top rim
                ctx.fillStyle = "#000";
                ctx.fillRect(size * 0.2, 0, 2, size * 0.2); // Grid lines on top
                ctx.fillRect(size * 0.6, 0, 2, size * 0.2);
            }

            // Outline
            ctx.strokeStyle = "rgba(0,0,0,0.5)";
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, size, size);
        }

        ctx.restore();
    }

    function startGameLoop() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        render();
    }

    // Cleanup hook
    const stopSurvival = () => {
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
        window.gameStops.push(stopSurvival);
    } else {
        window.gameStops = [stopSurvival];
    }
}
