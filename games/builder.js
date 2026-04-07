import { state } from "../core.js";

export function initBuilder() {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || !window.location.hostname || window.location.search.includes("local=1");
    const serverSelect = document.getElementById("builderServer");
    const defaultServer = isLocal ? "local" : "prod";
    if (serverSelect && !serverSelect.value) {
        serverSelect.value = "auto";
    }

    const getServerUrl = () => {
        const selected = serverSelect?.value || "auto";
        if (selected === "local") return "ws://localhost:2567";
        if (selected === "prod") return "wss://seahorse-app-mv4sg.ondigitalocean.app";
        return defaultServer === "local" ? "ws://localhost:2567" : "wss://seahorse-app-mv4sg.ondigitalocean.app";
    };

    let room;
    let animationFrameId;

    const canvas = document.getElementById("builderCanvas");
    const ctx = canvas.getContext("2d");
    const menu = document.getElementById("builderMenu");
    const gameArea = document.getElementById("builderGame");
    const btnJoin = document.getElementById("btnJoinBuilder");

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

    let camera = { x: 0, y: 0 };

    // Inputs
    const keys = { w: false, a: false, d: false, upPress: false };
    const mouse = { x: 0, y: 0 };

    btnJoin.onclick = async () => {
        try {
            btnJoin.textContent = "CONNECTING...";
            const client = new window.Colyseus.Client(getServerUrl());
            room = await client.joinOrCreate("builder_room", {
                name: state.myName || "Player"
            });
            localPlayerId = room.sessionId;

            menu.style.display = "none";
            gameArea.style.display = "block";

            startGameLoop();
        } catch (e) {
            console.error("Join error", e);
            btnJoin.textContent = "JOIN WORLD";
        }
    };

    function handleKeyDown(e) {
        if (!room) return;
        if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") keys.a = true;
        if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") keys.d = true;
        if (e.key === "w" || e.key === "W" || e.key === "ArrowUp" || e.key === " ") {
            if (!keys.w) keys.upPress = true;
            keys.w = true;
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

    function handleMouseClick(e) {
        if (!room) return;

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

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseClick);

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

            // Constrain camera (optional, based on world size)
            camera.x = Math.max(0, camera.x);
            camera.y = Math.max(0, camera.y);

            // Update UI
            uiX.textContent = Math.floor(localPlayer.x / TILE_SIZE);
            uiY.textContent = Math.floor(localPlayer.y / TILE_SIZE);
            uiBlockType.textContent = blockNames[selectedBlockType];
        }

        ctx.save();
        ctx.translate(-camera.x, -camera.y);

        // Draw blocks
        room.state.blocks.forEach((block, key) => {
            ctx.fillStyle = blockColors[block.type] || "#ffffff";
            ctx.fillRect(block.x * TILE_SIZE, block.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = "rgba(0,0,0,0.1)";
            ctx.strokeRect(block.x * TILE_SIZE, block.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
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
        canvas.removeEventListener("mousedown", handleMouseClick);
        menu.style.display = "block";
        gameArea.style.display = "none";
        btnJoin.textContent = "JOIN WORLD";
    };

    if (window.gameStops) {
        window.gameStops.push(stopBuilder);
    } else {
        window.gameStops = [stopBuilder];
    }
}
