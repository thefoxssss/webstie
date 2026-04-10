import { state, isInputFocused, saveStats, builderHotbar, builderInventory, builderArmor, updateBuilderInventoryState, isGodUser } from "../core.js";

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
    let inventoryOpen = false;
    let isCraftingTableOpen = false;
    let isChestOpen = false;
    let currentChestId = null;
    let isFurnaceOpen = false;
    let currentFurnaceId = null;

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
        11: "#808080", // Sword
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
        29: "#4ca64c", // Sapling
        30: "#ff3333", // Apple
        31: "#654321", // Chest
        32: "#555555", // Furnace
        33: "#ff0000", // TNT
        34: "#ff00ff", // Nuke
        35: "#c4a484", // Ladder
        36: "#444444", // Hammer
        37: "#009900", // Cactus
        38: "#eedd82", // Sand
        39: "#ffffff", // Snow
        40: "#d2b48c", // Sandstone
        41: "#3d2314", // Pine Log
        42: "#1f4d25", // Pine Leaves
        43: "#B87333", // Copper Ingot
        44: "#D0D0D0", // Iron Ingot
        45: "#FFD700", // Gold Ingot
        46: "#00FFFF", // Diamond (Refined)
        47: "#39FF14", // Uranium (Refined)
    };

    const CRAFTING_RECIPES = [
        { pattern: [[7]], output: { type: 9, count: 4 } }, // 1 Log -> 4 Planks
        { pattern: [[9, 9], [9, 9]], output: { type: 10, count: 1 } }, // 4 Planks -> Crafting Table
        { pattern: [[9], [9]], output: { type: 50, count: 4 } }, // 2 Planks -> 4 Sticks (Let's use 50 for stick, wait stick isn't defined... actually stick isn't in original either, let's just use planks for tools for now)
        // Ladder
        { pattern: [[9, 0, 9], [9, 9, 9], [9, 0, 9]], output: { type: 35, count: 3 } }, // 7 Planks -> 3 Ladders
        // Hammer
        { pattern: [[14, 14, 14], [0, 9, 0], [0, 9, 0]], output: { type: 36, count: 1 } }, // Iron Hammer
        // Chest
        { pattern: [[9, 9, 9], [9, 0, 9], [9, 9, 9]], output: { type: 31, count: 1 } }, // Chest
        // Furnace
        { pattern: [[3, 3, 3], [3, 0, 3], [3, 3, 3]], output: { type: 32, count: 1 } }, // Furnace
        // TNT
        { pattern: [[38, 12, 38], [12, 38, 12], [38, 12, 38]], output: { type: 33, count: 1 } }, // Sand & Coal -> TNT
        // Nuke
        { pattern: [[47, 47, 47], [47, 33, 47], [47, 47, 47]], output: { type: 34, count: 1 } }, // Uranium Ingots & TNT -> Nuke

        // Original recipes
        { pattern: [[9, 0, 0], [9, 0, 0], [9, 0, 0]], output: { type: 11, count: 1 } }, // Planks -> Sword (Original)
        { pattern: [[13, 13, 13], [13, 0, 13], [0, 0, 0]], output: { type: 18, count: 1 } }, // Copper Armor
        { pattern: [[14, 14, 14], [14, 0, 14], [0, 0, 0]], output: { type: 19, count: 1 } }, // Iron Armor
        { pattern: [[15, 15, 15], [15, 0, 15], [0, 0, 0]], output: { type: 20, count: 1 } }, // Gold Armor
        { pattern: [[16, 16, 16], [16, 0, 16], [0, 0, 0]], output: { type: 21, count: 1 } }, // Diamond Armor
        { pattern: [[17, 17, 17], [17, 0, 17], [0, 0, 0]], output: { type: 22, count: 1 } }, // Uranium Armor
        { pattern: [[13, 13, 13], [0, 13, 0], [0, 13, 0]], output: { type: 23, count: 1 } }, // Copper Gun
        { pattern: [[14, 14, 14], [0, 14, 0], [0, 14, 0]], output: { type: 24, count: 1 } }, // Iron Gun
        { pattern: [[15, 15, 15], [0, 15, 0], [0, 15, 0]], output: { type: 25, count: 1 } }, // Gold Gun
        { pattern: [[16, 16, 16], [0, 16, 0], [0, 16, 0]], output: { type: 26, count: 1 } }, // Diamond Rifle
        { pattern: [[17, 17, 17], [0, 17, 0], [0, 17, 0]], output: { type: 27, count: 1 } }, // Uranium Laser
        { pattern: [[13, 0, 0], [12, 0, 0], [0, 0, 0]], output: { type: 28, count: 16 } }, // Ammo
    ];

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
        29: "SAPLING",
        30: "APPLE",
        31: "CHEST",
        32: "FURNACE",
        33: "TNT",
        34: "NUKE",
        35: "LADDER",
        36: "HAMMER",
        37: "CACTUS",
        38: "SAND",
        39: "SNOW",
        40: "SANDSTONE",
        41: "PINE LOG",
        42: "PINE LEAVES",
        43: "COPPER INGOT",
        44: "IRON INGOT",
        45: "GOLD INGOT",
        46: "DIAMOND (REFINED)",
        47: "URANIUM (REFINED)",
    };
    const getMergedInventoryType = (type) => type;
    const getMaxStack = (type) => loadedBlockData[type] ? loadedBlockData[type].maxStack : ([11, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27].includes(type) ? 1 : 99);

    const blockDataUrls = [
        "data/blocks/1.json", "data/blocks/2.json", "data/blocks/3.json", "data/blocks/4.json",
        "data/blocks/5.json", "data/blocks/6.json", "data/blocks/7.json", "data/blocks/8.json",
        "data/blocks/9.json", "data/blocks/10.json", "data/items/11.json", "data/blocks/12.json",
        "data/blocks/13.json", "data/blocks/14.json", "data/blocks/15.json", "data/blocks/16.json",
        "data/blocks/17.json", "data/items/18.json", "data/items/19.json", "data/items/20.json",
        "data/items/21.json", "data/items/22.json", "data/items/23.json", "data/items/24.json",
        "data/items/25.json", "data/items/26.json", "data/items/27.json", "data/items/28.json"
    ];
    let loadedBlockData = {};
    let blockImages = {};
    let assetsLoaded = false;

    Promise.all(blockDataUrls.map(url => fetch(url).then(res => res.json()))).then(results => {
        let loadedImgs = 0;
        results.forEach(data => {
            loadedBlockData[data.id] = data;
            const img = new Image();
            img.onload = () => {
                loadedImgs++;
                if (loadedImgs === results.length) assetsLoaded = true;
            };
            img.src = data.sprite;
            blockImages[data.id] = img;
        });
    });

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
        if (item === null) return undefined;
        const normalized = normalizeItem(item);
        return normalized ? { ...normalized } : undefined;
    };
    const itemType = (item) => normalizeItem(item)?.type;
    const itemCount = (item) => normalizeItem(item)?.count || 0;

    let selectedHotbarIndex = 0;

    // Map initial available blocks, empty for the rest
    let hotbarSlots;
    if (builderHotbar) {
        hotbarSlots = builderHotbar.map(cloneItem);
    } else {
        hotbarSlots = [1, 2, 3, 4, 7, 8, 5, 6, undefined].map(cloneItem);
    }

    let selectedBlockType = hotbarSlots[0] || 1;
    let localPlayerId = null;

    let inventorySlots;
    if (builderInventory) {
        inventorySlots = builderInventory.map(cloneItem);
    } else {
        inventorySlots = new Array(27).fill(undefined).map(cloneItem);
    }

    let armorSlot = builderArmor ? cloneItem(builderArmor) : undefined;

    const saveInventoryState = () => {
        updateBuilderInventoryState(hotbarSlots, inventorySlots, armorSlot);
        saveStats();
    };

    // Crafting state
    let craftingGrid2x2 = new Array(4).fill(undefined).map(cloneItem);
    let craftingGrid3x3 = new Array(9).fill(undefined).map(cloneItem);
    let craftingOutputSlot = undefined;

    // Drag-and-drop state
    let draggedItemType = null; // now stores { type, count }
    let dragSourceHotbarIndex = null;
    let dragSourceInventoryIndex = null;
    let dragSourceCraftingIndex = null;
    let dragSourceOutputSlot = false;
    let dragSourceArmorSlot = false;
    let showRecipes = false;
    let recipeScroll = 0;

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
                row.push(item ? itemType(item) : 0);
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
        for (const recipe of CRAFTING_RECIPES) {
            const reqW = recipe.pattern[0].length;
            const reqH = recipe.pattern.length;

            // If recipe needs 3x3 but we are not in crafting table, skip
            if ((reqW > 2 || reqH > 2) && !isCraftingTableOpen) {
                continue;
            }

            if (matchPattern(recipe.pattern)) {
                craftingOutputSlot = { type: recipe.output.type, count: recipe.output.count };
                return;
            }
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
                row.push(item ? itemType(item) : 0);
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
                                if (gr >= r && gr < r + targetH && gc >= c && gc < c + targetW) continue;
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
        for (const recipe of CRAFTING_RECIPES) {
            const reqW = recipe.pattern[0].length;
            const reqH = recipe.pattern.length;

            // If recipe needs 3x3 but we are not in crafting table, skip
            if ((reqW > 2 || reqH > 2) && !isCraftingTableOpen) {
                continue;
            }

            const matchIndices = matchPattern(recipe.pattern);
            if (matchIndices !== null) {
                indicesToConsume = matchIndices;
                break;
            }
        }

        if (!indicesToConsume) {
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
        if (isInputFocused(e)) return;
        if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") keys.a = true;
        if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") keys.d = true;
        if (e.key === "w" || e.key === "W" || e.key === "ArrowUp" || e.key === " ") {
            if (!keys.w) keys.upPress = true;
            keys.w = true;
        }
        if (e.key === "q" || e.key === "Q") {
            const selectedSlotItem = hotbarSlots[selectedHotbarIndex];
            if (selectedSlotItem) {
                room.send("spawn_drops", { items: [{ type: selectedSlotItem.type, count: 1 }] });
                selectedSlotItem.count -= 1;
                if (selectedSlotItem.count <= 0) {
                    hotbarSlots[selectedHotbarIndex] = undefined;
                }
                saveInventoryState();
            }
        }
        if (e.key === "r" || e.key === "R") {
            room.send("recall");
        }
        if (e.key === "i" || e.key === "I") {
            inventoryOpen = !inventoryOpen;

            // If opening inventory, make sure we show 2x2 grid not 3x3 table
            if (inventoryOpen) {
                isCraftingTableOpen = false;
                showRecipes = false;
            } else {
                returnCraftingItems();
                showRecipes = false;
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
            showRecipes = false;
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
        if (!room || !localPlayerId) return;
        const localPlayer = room.state.players.get(localPlayerId);
        if (!localPlayer) return;

        const worldX = mouse.x + camera.x;
        const worldY = mouse.y + camera.y;
        const selectedSlotItem = hotbarSlots[selectedHotbarIndex];
        selectedBlockType = selectedSlotItem;

        // If holding hammer, send hammer command on left click instead of break
        if (selectedBlockType && itemType(selectedBlockType) === 36 && e.button === 0) {
            room.send("hammer", { x: worldX, y: worldY });
            return;
        }

        const type = itemType(selectedSlotItem);

        // Handle eating apple
        if (type === 30 && e.button === 0 && e.type !== "interval") {
            room.send("consume", { type: 30 });
            selectedSlotItem.count--;
            if (selectedSlotItem.count <= 0) {
                hotbarSlots[selectedHotbarIndex] = undefined;
                saveInventoryState();
                selectedBlockType = undefined;
            } else {
                saveInventoryState();
            }
            return;
        }

        // Handle shooting guns
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
                    if (hotbarSlots[ammoSlotIndex].count <= 0) { hotbarSlots[ammoSlotIndex] = undefined; saveInventoryState(); }
                } else {
                    inventorySlots[ammoSlotIndex].count--;
                    if (inventorySlots[ammoSlotIndex].count <= 0) { inventorySlots[ammoSlotIndex] = undefined; saveInventoryState(); }
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
                hotbarSlots[selectedHotbarIndex] = undefined; saveInventoryState();
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

    window.adminGiveBuilderItem = (type, count) => {
        if (!isGodUser()) return;
        addInventoryItem(type, count);
        saveInventoryState();
    };

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
            const panel = getInventoryBounds();

            if (showRecipes) {
                // Check close button
                if (mouse.x >= panel.x + panel.width - 80 && mouse.x <= panel.x + panel.width - 20 &&
                    mouse.y >= panel.y - 10 && mouse.y <= panel.y + 10) {
                    showRecipes = false;
                }
                return; // Prevent other interactions while recipes are open
            }

            // Check Recipe Button toggle
            const craftStartX = panel.x + panel.width - 190;
            const craftStartY = panel.y + 40;
            const recipeBtnX = craftStartX + 120;
            const recipeBtnY = craftStartY - 20;
            if (mouse.x >= recipeBtnX && mouse.x <= recipeBtnX + 60 &&
                mouse.y >= recipeBtnY && mouse.y <= recipeBtnY + 16) {
                showRecipes = true;
                return;
            }

            const isRightClick = e.button === 2;

            // Helper function to handle pickup/drop logic for slots
            const handleSlotInteraction = (slotArray, index, isArmor = false) => {
                const getSlot = () => isArmor ? armorSlot : slotArray[index];
                const setSlot = (val) => {
                    if (isArmor) {
                        armorSlot = val;
                        room.send("equip_armor", { type: armorSlot ? armorSlot.type : 0 });
                    } else {
                        slotArray[index] = val;
                    }
                };

                const currentItem = getSlot();

                if (draggedItemType === null) {
                    if (currentItem !== undefined) {
                        if (isRightClick) {
                            // Split stack
                            if (currentItem.count > 1) {
                                const splitCount = Math.floor(currentItem.count / 2);
                                draggedItemType = { type: currentItem.type, count: splitCount };
                                currentItem.count -= splitCount;
                                if (isArmor) room.send("equip_armor", { type: currentItem.type });
                                dragSourceHotbarIndex = null;
                                dragSourceInventoryIndex = null;
                                dragSourceCraftingIndex = null;
                                dragSourceOutputSlot = false;
                                dragSourceArmorSlot = false;
                                saveInventoryState();
                            } else {
                                // Just pick it up if it's 1
                                draggedItemType = cloneItem(currentItem);
                                dragSourceHotbarIndex = slotArray === hotbarSlots ? index : null;
                                dragSourceInventoryIndex = slotArray === inventorySlots ? index : null;
                                dragSourceArmorSlot = isArmor;
                                setSlot(undefined);
                                saveInventoryState();
                            }
                        } else {
                            // Left click pickup
                            draggedItemType = cloneItem(currentItem);
                            dragSourceHotbarIndex = slotArray === hotbarSlots ? index : null;
                            dragSourceInventoryIndex = slotArray === inventorySlots ? index : null;
                            dragSourceArmorSlot = isArmor;
                            setSlot(undefined);
                            saveInventoryState();
                        }
                    }
                } else {
                    // We are holding an item

                    // Armor slot restriction: only armor (18-22)
                    if (isArmor && ![18, 19, 20, 21, 22].includes(draggedItemType.type)) {
                        return true;
                    }

                    if (isRightClick) {
                        // Place 1 item
                        if (currentItem === undefined) {
                            setSlot({ type: draggedItemType.type, count: 1 });
                            draggedItemType.count -= 1;
                            if (draggedItemType.count <= 0) draggedItemType = null;
                            saveInventoryState();
                        } else if (currentItem.type === draggedItemType.type && currentItem.count < getMaxStack(currentItem.type)) {
                            currentItem.count += 1;
                            if (isArmor) room.send("equip_armor", { type: currentItem.type });
                            draggedItemType.count -= 1;
                            if (draggedItemType.count <= 0) draggedItemType = null;
                            saveInventoryState();
                        }
                    } else {
                        // Left click place
                        if (currentItem === undefined) {
                            setSlot(cloneItem(draggedItemType));
                            draggedItemType = null;
                            saveInventoryState();
                        } else if (currentItem.type === draggedItemType.type) {
                            // Merge
                            const space = getMaxStack(currentItem.type) - currentItem.count;
                            if (space > 0) {
                                const addCount = Math.min(space, draggedItemType.count);
                                currentItem.count += addCount;
                                if (isArmor) room.send("equip_armor", { type: currentItem.type });
                                draggedItemType.count -= addCount;
                                if (draggedItemType.count <= 0) draggedItemType = null;
                                saveInventoryState();
                            }
                        } else {
                            // Swap
                            const temp = cloneItem(currentItem);
                            setSlot(cloneItem(draggedItemType));
                            draggedItemType = temp;
                            saveInventoryState();
                        }
                    }
                }
                return true;
            };
            const hotbarPanel = getHotbarBounds();
            const hotbarIndex = getHotbarIndexAt(mouse.x, mouse.y, hotbarPanel);

            if (hotbarIndex !== null) {
                if (handleSlotInteraction(hotbarSlots, hotbarIndex)) return;
            }

            const inventoryIndex = getInventorySlotAt(mouse.x, mouse.y, panel);
            if (inventoryIndex !== null) {
                if (handleSlotInteraction(inventorySlots, inventoryIndex)) return;
            }

            // Armor Slot Check
            const armorSlotX = panel.x + inventoryLayout.padding;
            const armorSlotY = panel.y + 40;
            if (mouse.x >= armorSlotX && mouse.x <= armorSlotX + inventoryLayout.slotSize &&
                mouse.y >= armorSlotY && mouse.y <= armorSlotY + inventoryLayout.slotSize) {
                if (handleSlotInteraction(null, null, true)) return;
            }

            // Check if crafting grids or output slot clicked
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
} else if (block && block.type === 31) { // Chest
                    room.send("interact", { x: worldX, y: worldY }); // register it
                    inventoryOpen = true;
                    isChestOpen = true;
                    currentChestId = `${tileX},${tileY}`;
                    return;
                } else if (block && block.type === 32) { // Furnace
                    room.send("interact", { x: worldX, y: worldY });
                    inventoryOpen = true;
                    isFurnaceOpen = true;
                    currentFurnaceId = `${tileX},${tileY}`;
                    return;
                } else if (block && (block.type === 33 || block.type === 34)) { // TNT/Nuke
                    room.send("interact", { x: worldX, y: worldY });
                    return;
                }
            }
        }

        mouse.isDown = true;
        sendBuildOrBreak(e);

        // Hold left/right click to repeatedly place/break blocks after a short delay.
        if (e.shiftKey || e.button === 2) {
            clearBuildHoldTimers();
            buildHoldTimeout = setTimeout(() => {
                buildHoldInterval = setInterval(() => {
                    if (!mouse.isDown || !room) {
                        clearBuildHoldTimers();
                        return;
                    }
                    sendBuildOrBreak({ button: 2, shiftKey: true, type: "interval" });
                }, BUILD_HOLD_REPEAT_MS);
            }, BUILD_HOLD_DELAY_MS);
        } else if (!e.shiftKey && e.button === 0) {
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
        if (inventoryOpen && draggedItemType !== null) {
            setTimeout(() => saveInventoryState(), 10);
            const hotbarPanel = getHotbarBounds();
            const hotbarIndex = getHotbarIndexAt(mouse.x, mouse.y, hotbarPanel);

            const inventoryPanel = getInventoryBounds();
            const inventoryIndex = getInventorySlotAt(mouse.x, mouse.y, inventoryPanel);

            // If we are dropping the item outside all panels
            if (hotbarIndex === null && inventoryIndex === null &&
                !(mouse.x >= inventoryPanel.x && mouse.x <= inventoryPanel.x + inventoryPanel.width &&
                  mouse.y >= inventoryPanel.y && mouse.y <= inventoryPanel.y + inventoryPanel.height) &&
                !(mouse.x >= hotbarPanel.x && mouse.x <= hotbarPanel.x + hotbarPanel.width &&
                  mouse.y >= hotbarPanel.y && mouse.y <= hotbarPanel.y + hotbarPanel.height)) {

                // Drop on ground
                room.send("spawn_drops", { items: [{ type: draggedItemType.type, count: draggedItemType.count }] });
                draggedItemType = null;
                saveInventoryState();
                return;
            }


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

        } else if (hotbarIndex !== null && e.button === 2) {
            const item = hotbarSlots[hotbarIndex];
            if (item && item.type === 30) { // Apple
                room.send("consume", { type: 30 });
                item.count--;
                if (item.count <= 0) hotbarSlots[hotbarIndex] = undefined;
                return;
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

        } else if (inventoryIndex !== null && e.button === 2) {
            // Check for right-click consume in inventory
            const item = inventorySlots[inventoryIndex];
            if (item && item.type === 30) { // Apple
                room.send("consume", { type: 30 });
                item.count--;
                if (item.count <= 0) inventorySlots[inventoryIndex] = undefined;
                return;
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
                        if (dragSourceHotbarIndex !== null) { hotbarSlots[dragSourceHotbarIndex] = undefined; saveInventoryState(); }
                        else if (dragSourceInventoryIndex !== null) { inventorySlots[dragSourceInventoryIndex] = undefined; saveInventoryState(); }
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
    canvas.addEventListener("wheel", (e) => {
        if (!room) return;
        if (inventoryOpen && showRecipes) {
            recipeScroll += Math.sign(e.deltaY);
            if (recipeScroll < 0) recipeScroll = 0;
            return;
        }
    });

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
            // Snap camera to whole pixels so tile edges don't anti-alias into a faint moving grid.
            camera.x = Math.round(localPlayer.x - canvas.width / 2 + TILE_SIZE / 2);
            camera.y = Math.round(localPlayer.y - canvas.height / 2 + TILE_SIZE / 2);

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
            if (assetsLoaded && blockImages[block.type]) {
                ctx.drawImage(blockImages[block.type], block.x * TILE_SIZE, block.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            } else {
                ctx.fillStyle = blockColors[block.type] || "#ffffff";
// Block rendering based on meta
            if (block.meta === 1) { // Bottom slab
                ctx.fillRect(block.x * TILE_SIZE, block.y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE, TILE_SIZE/2);
            } else if (block.meta === 2) { // Top slab
                ctx.fillRect(block.x * TILE_SIZE, block.y * TILE_SIZE, TILE_SIZE, TILE_SIZE/2);
            } else if (block.meta === 3) { // Left slope
                ctx.beginPath();
                ctx.moveTo(block.x * TILE_SIZE, block.y * TILE_SIZE + TILE_SIZE);
                ctx.lineTo(block.x * TILE_SIZE + TILE_SIZE, block.y * TILE_SIZE + TILE_SIZE);
                ctx.lineTo(block.x * TILE_SIZE + TILE_SIZE, block.y * TILE_SIZE);
                ctx.fill();
            } else if (block.meta === 4) { // Right slope
                ctx.beginPath();
                ctx.moveTo(block.x * TILE_SIZE, block.y * TILE_SIZE + TILE_SIZE);
                ctx.lineTo(block.x * TILE_SIZE + TILE_SIZE, block.y * TILE_SIZE);
                ctx.lineTo(block.x * TILE_SIZE, block.y * TILE_SIZE);
                ctx.fill();
            } else { // Full block
                ctx.fillRect(block.x * TILE_SIZE, block.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
            }
          });
        });

// Draw explosives
        room.state.explosives.forEach((exp) => {
            ctx.save();
            ctx.translate(exp.x, exp.y);
            // Flicker white/red based on timer
            if (exp.timer % 10 < 5) {
                ctx.fillStyle = "#ffffff";
            } else {
                ctx.fillStyle = exp.type === 34 ? "#ff00ff" : "#ff0000"; // Nuke is purple, TNT is red
            }

            // Pulse size
            const scale = 1 + Math.sin(exp.timer * 0.5) * 0.1;
            ctx.scale(scale, scale);

            ctx.fillRect(-TILE_SIZE/2, -TILE_SIZE/2, TILE_SIZE, TILE_SIZE);

            ctx.fillStyle = "#000";
            ctx.font = "10px monospace";
            ctx.textAlign = "center";
            ctx.fillText(exp.type === 34 ? "NUKE" : "TNT", 0, 4);

            ctx.restore();
        });

        // Draw players

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
            if (p.selectedItemType === 11 || [23, 24, 25, 26, 27].includes(p.selectedItemType)) {
                ctx.save();
                ctx.translate(p.x + TILE_SIZE / 2, p.y + TILE_SIZE / 2);

                // Calculate angle. For local player, use mouse position. For others, assume aiming forward
                let angle = 0;
                if (p === localPlayer) {
                    const worldX = mouse.x + camera.x;
                    const worldY = mouse.y + camera.y;
                    angle = Math.atan2(worldY - (p.y + TILE_SIZE / 2), worldX - (p.x + TILE_SIZE / 2));
                } else {
                    angle = p.vx < 0 ? Math.PI : 0;
                }

                ctx.rotate(angle);

                if (assetsLoaded && blockImages[p.selectedItemType]) {
                    // Draw sprite at offset
                    ctx.translate(15, 0);
                    ctx.rotate(Math.PI / 4); // The sprites are likely diagonal, so we rotate them to point right
                    ctx.drawImage(blockImages[p.selectedItemType], -10, -10, 20, 20);
                } else {
                    if (p.selectedItemType === 11) {
                        ctx.translate(15, 0);
                        ctx.rotate(Math.PI / 4); // point it outwards
                        ctx.fillStyle = "#808080"; // Sword color
                        ctx.fillRect(-2, -15, 4, 20); // Blade
                        ctx.fillStyle = "#8b5a2b"; // Handle
                        ctx.fillRect(-2, 5, 4, 10);
                        ctx.fillStyle = "#000"; // Crossguard
                        ctx.fillRect(-6, 5, 12, 4);
                    } else {
                        // Offset gun outward
                        ctx.translate(15, 0);

                        // Draw a simple gun shape
                        ctx.fillStyle = blockColors[p.selectedItemType] || "#444";
                        // Gun barrel
                        ctx.fillRect(0, -2, 12, 4);
                        // Gun handle
                        ctx.fillRect(0, 0, 4, 8);
                    }
                }

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

            // Chest or Furnace rendering logic
            if (isChestOpen && currentChestId && room.state.chests && room.state.chests.has(currentChestId)) {
                // Render Chest UI
                const chest = room.state.chests.get(currentChestId);
                const chestY = startY - 140;

                ctx.fillStyle = "#c6c6c6"; // Panel color
                ctx.fillRect(panel.x, chestY - 10, panel.width, 130);

                ctx.fillStyle = "#3f3f3f";
                ctx.font = "8px 'Press Start 2P', monospace";
                ctx.textAlign = "left";
                ctx.fillText("Chest", panel.x + 10, chestY + 5);

                for (let i = 0; i < 27; i++) {
                    const col = i % 9;
                    const row = Math.floor(i / 9);
                    const slotX = startX + col * (32 + 4);
                    const slotY = chestY + 15 + row * (32 + 4);

                    ctx.fillStyle = "#8b8b8b";
                    ctx.fillRect(slotX, slotY, 32, 32);
                    ctx.strokeStyle = "#373737"; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(slotX, slotY + 32); ctx.lineTo(slotX, slotY); ctx.lineTo(slotX + 32, slotY); ctx.stroke();
                    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(slotX, slotY + 32); ctx.lineTo(slotX + 32, slotY + 32); ctx.lineTo(slotX + 32, slotY); ctx.stroke();

                    const item = chest.items.get(i.toString());
                    if (item) {
                        drawItemIcon(ctx, item.type, slotX + 6, slotY + 6, 20);
                        ctx.fillStyle = "#ffffff";
                        ctx.font = "8px 'Press Start 2P', monospace";
                        ctx.textAlign = "right";
                        ctx.fillText(`${item.count}`, slotX + 30, slotY + 28);
                    }
                }
            } else if (isFurnaceOpen && currentFurnaceId && room.state.furnaces && room.state.furnaces.has(currentFurnaceId)) {
                // Render Furnace UI
                const furnace = room.state.furnaces.get(currentFurnaceId);
                const furY = startY - 120;
                const furX = canvas.width / 2;

                ctx.fillStyle = "#c6c6c6"; // Panel color
                ctx.fillRect(furX - 100, furY - 10, 200, 100);

                ctx.fillStyle = "#3f3f3f";
                ctx.font = "8px 'Press Start 2P', monospace";
                ctx.textAlign = "center";
                ctx.fillText("Furnace", furX, furY + 5);

                const drawSlot = (x, y, itemType, itemCount) => {
                    ctx.fillStyle = "#8b8b8b";
                    ctx.fillRect(x, y, 32, 32);
                    ctx.strokeStyle = "#373737"; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(x, y + 32); ctx.lineTo(x, y); ctx.lineTo(x + 32, y); ctx.stroke();
                    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(x, y + 32); ctx.lineTo(x + 32, y + 32); ctx.lineTo(x + 32, y); ctx.stroke();
                    if (itemCount > 0) {
                        drawItemIcon(ctx, itemType, x + 6, y + 6, 20);
                        ctx.fillStyle = "#ffffff";
                        ctx.font = "8px 'Press Start 2P', monospace";
                        ctx.textAlign = "right";
                        ctx.fillText(`${itemCount}`, x + 30, y + 28);
                    }
                };

                drawSlot(furX - 60, furY + 15, furnace.inputItem, furnace.inputCount);
                drawSlot(furX - 60, furY + 55, furnace.fuelItem, furnace.fuelCount);
                drawSlot(furX + 30, furY + 35, furnace.outputItem, furnace.outputCount);

                // Progress
                ctx.fillStyle = "#333";
                ctx.fillRect(furX - 15, furY + 42, 30, 10);
                ctx.fillStyle = "#ff6600";
                ctx.fillRect(furX - 15, furY + 42, (furnace.progress / 100) * 30, 10);
            }

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

            // Draw Recipe Book Toggle Button
            const recipeBtnX = craftStartX + 120;
            const recipeBtnY = craftStartY - 20;
            ctx.fillStyle = showRecipes ? "#4CAF50" : "#8b8b8b";
            ctx.fillRect(recipeBtnX, recipeBtnY, 60, 16);
            ctx.fillStyle = "#fff";
            ctx.font = "8px 'Press Start 2P', monospace";
            ctx.textAlign = "center";
            ctx.fillText("RECIPES", recipeBtnX + 30, recipeBtnY + 12);
            ctx.textAlign = "left";

            if (showRecipes) {
                // Draw Recipe Book Overlay
                ctx.fillStyle = "rgba(0, 0, 0, 0.95)";
                ctx.fillRect(panel.x - 20, panel.y - 20, panel.width + 40, panel.height + 40);

                // Need a scroll offset or just a large panel
                ctx.fillStyle = "#fff";
                ctx.font = "10px 'Press Start 2P', monospace";
                ctx.fillText("Recipe Book (Scroll to view all)", panel.x, panel.y + 10);

                // Add scrolling logic later if needed. For now we just draw them.
                // Or let's make the recipes smaller


                // 12 recipes per page
                const itemsPerRow = 2;
                const rowsPerPage = 6;
                const recipesPerPage = itemsPerRow * rowsPerPage;
                const maxScroll = Math.max(0, Math.ceil(CRAFTING_RECIPES.length / itemsPerRow) - rowsPerPage);
                if (recipeScroll > maxScroll) recipeScroll = maxScroll;

                const startIdx = recipeScroll * itemsPerRow;
                const endIdx = Math.min(CRAFTING_RECIPES.length, startIdx + recipesPerPage);

                for (let i = startIdx; i < endIdx; i++) {
                    const displayIdx = i - startIdx;
                    const col = displayIdx % itemsPerRow;
                    const row = Math.floor(displayIdx / itemsPerRow);

                    const cellWidth = 240;
                    const cellHeight = 70;

                    const rx = panel.x + 20 + col * cellWidth;
                    const ry = panel.y + 50 + row * cellHeight;

                    // Draw the pattern grid (miniature)
                    const pat = CRAFTING_RECIPES[i].pattern;
                    const patRows = pat.length;
                    const patCols = pat[0].length;
                    const iconSize = 12;
                    const gap = 2;

                    // Draw grid background
                    ctx.fillStyle = "#555";
                    ctx.fillRect(rx - 2, ry - 2, (iconSize + gap) * 3 + 2, (iconSize + gap) * 3 + 2);

                    // Center the pattern in the 3x3 box
                    const startR = patRows === 1 ? 1 : 0;
                    const startC = patCols === 1 ? 1 : 0;

                    for (let r = 0; r < patRows; r++) {
                        for (let c = 0; c < patCols; c++) {
                            const item = pat[r][c];
                            const cx = rx + (c + startC) * (iconSize + gap);
                            const cy = ry + (r + startR) * (iconSize + gap);
                            ctx.fillStyle = "#8b8b8b";
                            ctx.fillRect(cx, cy, iconSize, iconSize);
                            if (item !== 0) {
                                drawItemIcon(ctx, item, cx, cy, iconSize);
                            }
                        }
                    }

                    // Arrow
                    ctx.fillStyle = "#fff";
                    ctx.fillText("->", rx + 50, ry + 20);

                    // Output
                    drawItemIcon(ctx, CRAFTING_RECIPES[i].output.type, rx + 75, ry + 8, 24);
                    if (CRAFTING_RECIPES[i].output.count > 1) {
                        ctx.font = "8px 'Press Start 2P', monospace";
                        ctx.fillText("x" + CRAFTING_RECIPES[i].output.count, rx + 105, ry + 24);
                    }
                }

                // Draw close button
                ctx.fillStyle = "#f44336";
                ctx.fillRect(panel.x + panel.width - 80, panel.y - 10, 60, 20);
                ctx.fillStyle = "#fff";
                ctx.fillText("CLOSE", panel.x + panel.width - 70, panel.y + 4);
            } else {

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
        if (assetsLoaded && blockImages[type]) {
            ctx.drawImage(blockImages[type], x, y, size, size);
        } else {
            // Fallback to simple colored square if image isn't loaded
            ctx.fillStyle = blockColors[type] || "#fff";
            ctx.fillRect(x, y, size, size);
        }
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
