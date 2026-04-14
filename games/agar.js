import { escapeHtml, state } from "../core.js";

export function initAgar() {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || !window.location.hostname || window.location.search.includes("local=1");
    const networkSelect = document.getElementById("agarNetwork");
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

    const canvas = document.getElementById("agarCanvas");
    const ctx = canvas.getContext("2d");

    const menu = document.getElementById("agarMenu");
    const gameArea = document.getElementById("agarGame");
    const btnJoin = document.getElementById("btnJoinAgar");
    const btnRefreshServers = document.getElementById("btnRefreshAgarServers");
    const btnCreateServer = document.getElementById("btnCreateAgarServer");
    const serverNameInput = document.getElementById("agarServerName");
    const serverListEl = document.getElementById("agarServerList");

    const leaderboardList = document.getElementById("agarLeaderboardList");
    const scoreDisplay = document.getElementById("agarScore");

    const deathScreen = document.getElementById("agarDeathScreen");
    const deathMessage = document.getElementById("agarDeathMessage");
    const respawnBtn = document.getElementById("agarRespawnBtn");

    const AGAR_MAP_WIDTH = 4000;
    const AGAR_MAP_HEIGHT = 4000;
    const CANVAS_WIDTH = 800;
    const CANVAS_HEIGHT = 450;

    let cameraX = 0;
    let cameraY = 0;
    let targetX = 0;
    let targetY = 0;

    let players = new Map();
    let foods = new Map();
    let cells = new Map();
    let renderCells = new Map();
    let localPlayerId = null;

    const renderServerList = (servers) => {
        if (!serverListEl) return;
        serverListEl.innerHTML = "";
        if (servers.length === 0) {
            serverListEl.innerHTML = "<div style='color:#aaa;'>NO SERVERS FOUND</div>";
            return;
        }
        servers.forEach(server => {
            const row = document.createElement("div");
            row.style.cssText = `padding: 8px; margin-bottom: 4px; background: ${selectedRoomId === server.roomId ? '#333' : '#111'}; border: 1px solid var(--accent-dim); cursor: pointer;`;
            row.innerHTML = `
                <div style="font-size: 11px; color: #0f0;">${escapeHtml(server.serverName || "Public World")}</div>
                <div style="font-size: 9px; opacity: 0.9; margin-top: 4px;">PLAYERS (${server.clients}/${server.maxClients})</div>
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
            const response = await fetch(`${getServerHttpBase()}/agar-servers`);
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
        players = new Map();
        foods = new Map();
        cells = new Map();
        renderCells = new Map();
        room.state.players.onAdd((player, sessionId) => {
            players.set(sessionId, player);
            player.onChange(() => {
                if (sessionId === localPlayerId) {
                    if (!player.isAlive && deathScreen.style.display === "none") {
                        deathScreen.style.display = "flex";
                    } else if (player.isAlive && deathScreen.style.display !== "none") {
                        deathScreen.style.display = "none";
                    }
                }
            });
        });
        room.state.players.onRemove((player, sessionId) => {
            players.delete(sessionId);
        });

        room.state.foods.onAdd((food, id) => {
            foods.set(id, food);
        });
        room.state.foods.onRemove((food, id) => {
            foods.delete(id);
        });
        if (room.state.cells) {
            room.state.cells.onAdd((cell, id) => {
                cells.set(id, cell);
                renderCells.set(id, { x: cell.x, y: cell.y, radius: cell.radius, ownerId: cell.ownerId });
            });
            room.state.cells.onRemove((cell, id) => {
                cells.delete(id);
                renderCells.delete(id);
            });
        }

        room.onMessage("died", (message) => {
            if (deathMessage) deathMessage.textContent = `Eaten by ${escapeHtml(message.killer)}`;
        });
    };

    const joinRoomById = async (roomId) => {
        try {
            btnJoin.textContent = "CONNECTING...";
            client = new window.Colyseus.Client(getServerUrl());
            room = await client.joinById(roomId, { name: state.myName });
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
            room = await client.joinOrCreate("agar_room", { name: state.myName });
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
                const serverName = (serverNameInput?.value || "").trim() || "Public Agar World";
                client = new window.Colyseus.Client(getServerUrl());
                room = await client.create("agar_room", { name: state.myName, serverName });
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

    if (respawnBtn) {
        respawnBtn.onclick = () => {
            if (room) room.send("respawn");
        };
    }

    refreshServerList();

    canvas.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        targetX = mx + cameraX - CANVAS_WIDTH / 2;
        targetY = my + cameraY - CANVAS_HEIGHT / 2;
    });
    const onKeyDown = (e) => {
        if (e.code === "Space" && room && players.get(localPlayerId)?.isAlive) {
            e.preventDefault();
            room.send("split");
        }
    };
    window.addEventListener("keydown", onKeyDown);

    function updateLeaderboard() {
        if (!leaderboardList) return;
        const pArray = Array.from(players.values()).filter(p => p.isAlive).sort((a, b) => b.score - a.score);
        leaderboardList.innerHTML = "";
        for (let i = 0; i < Math.min(10, pArray.length); i++) {
            const p = pArray[i];
            const li = document.createElement("li");
            li.style.marginBottom = "3px";
            li.textContent = `${i+1}. ${p.name} - ${Math.floor(p.score)}`;
            leaderboardList.appendChild(li);
        }
    }

    function render() {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const localPlayer = players.get(localPlayerId);
        if (localPlayer && localPlayer.isAlive) {
            // Smooth camera follow
            cameraX += (localPlayer.x - cameraX) * 0.18;
            cameraY += (localPlayer.y - cameraY) * 0.18;
        }

        ctx.save();
        ctx.translate(-cameraX + CANVAS_WIDTH / 2, -cameraY + CANVAS_HEIGHT / 2);

        // Draw grid
        ctx.strokeStyle = "#ccc";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= AGAR_MAP_WIDTH; x += 50) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, AGAR_MAP_HEIGHT);
        }
        for (let y = 0; y <= AGAR_MAP_HEIGHT; y += 50) {
            ctx.moveTo(0, y);
            ctx.lineTo(AGAR_MAP_WIDTH, y);
        }
        ctx.stroke();

        // Map borders
        ctx.strokeStyle = "red";
        ctx.lineWidth = 5;
        ctx.strokeRect(0, 0, AGAR_MAP_WIDTH, AGAR_MAP_HEIGHT);

        // Draw food
        foods.forEach(food => {
            ctx.fillStyle = food.color;
            ctx.beginPath();
            ctx.arc(food.x, food.y, 5, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw cells with interpolation to reduce network jitter
        const drawCells = [];
        if (cells.size > 0) {
            cells.forEach((cell, id) => {
                const current = renderCells.get(id) || { x: cell.x, y: cell.y, radius: cell.radius, ownerId: cell.ownerId };
                current.x += (cell.x - current.x) * 0.35;
                current.y += (cell.y - current.y) * 0.35;
                current.radius += (cell.radius - current.radius) * 0.3;
                current.ownerId = cell.ownerId;
                renderCells.set(id, current);
                drawCells.push({ id, ...current });
            });
        } else {
            Array.from(players.entries()).forEach(([id, p]) => {
                if (!p.isAlive) return;
                drawCells.push({ id: `legacy_${id}`, x: p.x, y: p.y, radius: p.radius, ownerId: id });
            });
        }

        drawCells.sort((a, b) => a.radius - b.radius).forEach(c => {
            const owner = players.get(c.ownerId);
            if (!owner || !owner.isAlive) return;
            ctx.fillStyle = owner.color;
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(0,0,0,0.2)";
            ctx.stroke();

            if (c.radius > 18) {
                ctx.fillStyle = "white";
                ctx.font = `${Math.max(10, c.radius / 2.6)}px 'Space Mono', monospace`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(owner.name, c.x, c.y);
            }
        });

        ctx.restore();

        if (localPlayer) {
            scoreDisplay.textContent = Math.floor(localPlayer.score);
        }
    }

    let lastSend = 0;
    function startGameLoop() {
        function loop(timestamp) {
            if (!room) return;

            if (timestamp - lastSend > 33) {
                if (localPlayerId && players.get(localPlayerId)?.isAlive) {
                    room.send("input", { targetX, targetY });
                }
                lastSend = timestamp;
            }

            render();
            updateLeaderboard();

            animationFrameId = requestAnimationFrame(loop);
        }
        animationFrameId = requestAnimationFrame(loop);
    }

    const stopAgar = () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (room) {
            room.leave();
            room = null;
        }
        window.removeEventListener("keydown", onKeyDown);
        menu.style.display = "block";
        gameArea.style.display = "none";
        deathScreen.style.display = "none";
        btnJoin.textContent = "QUICK JOIN ANY SERVER";
        if (btnCreateServer) btnCreateServer.textContent = "CREATE SERVER";
        selectedRoomId = null;
        players.clear();
        foods.clear();
        cells.clear();
        renderCells.clear();
        refreshServerList();
    };

    if (window.gameStops) {
        window.gameStops.push(stopAgar);
    } else {
        window.gameStops = [stopAgar];
    }
}
