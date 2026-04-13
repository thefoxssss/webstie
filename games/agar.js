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
            cameraX += (localPlayer.x - cameraX) * 0.1;
            cameraY += (localPlayer.y - cameraY) * 0.1;
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

        // Draw players
        const pList = Array.from(players.values()).sort((a, b) => a.radius - b.radius);
        pList.forEach(p => {
            if (!p.isAlive) return;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(0,0,0,0.2)";
            ctx.stroke();

            ctx.fillStyle = "white";
            ctx.font = `${Math.max(10, p.radius / 2)}px 'Space Mono', monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(p.name, p.x, p.y);

            ctx.font = `${Math.max(8, p.radius / 3)}px 'Space Mono', monospace`;
            ctx.fillText(Math.floor(p.score), p.x, p.y + p.radius / 2);
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

            if (timestamp - lastSend > 50) {
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
        menu.style.display = "block";
        gameArea.style.display = "none";
        deathScreen.style.display = "none";
        btnJoin.textContent = "QUICK JOIN ANY SERVER";
        if (btnCreateServer) btnCreateServer.textContent = "CREATE SERVER";
        selectedRoomId = null;
        refreshServerList();
    };

    if (window.gameStops) {
        window.gameStops.push(stopAgar);
    } else {
        window.gameStops = [stopAgar];
    }
}
