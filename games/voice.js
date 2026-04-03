let voiceRoom = null;
let localStream = null;
let peers = {}; // mapping from sessionId to RTCPeerConnection
const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
];

export function initVoice() {
    console.log("Voice Lounge initialized");

    // Bind buttons
    document.getElementById("btnCreateVoice").onclick = () => createOrJoinVoiceRoom(true);
    document.getElementById("btnRefreshVoiceRooms").onclick = refreshVoiceRooms;
    document.getElementById("btnVoiceLeave").onclick = leaveVoiceRoom;
    document.getElementById("btnVoiceMute").onclick = toggleMute;

    // Add cleanup on game stop
    if (!window.gameStops) window.gameStops = [];
    window.gameStops.push(() => {
        leaveVoiceRoom();
    });

    // Auto refresh when opened
    refreshVoiceRooms();
}

async function refreshVoiceRooms() {
    const listEl = document.getElementById("voiceRoomList");
    if (!listEl) return;

    if (typeof window.Colyseus === 'undefined') {
        listEl.innerHTML = '<div style="font-size: 10px; color: #f66;">ERROR: COLYSEUS NOT LOADED</div>';
        return;
    }

    listEl.innerHTML = '<div style="font-size: 10px; color: #aaa;">SCANNING...</div>';

    const wsProtocol = window.location.protocol === "https:" ? "https" : "http"; // getAvailableRooms uses HTTP REST API
    const wsHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "localhost:2567"
      : "seahorse-app-mv4sg.ondigitalocean.app";
    const client = new window.Colyseus.Client(`${wsProtocol}://${wsHost}`);

    try {
        const rooms = await client.getAvailableRooms("voice_room");

        listEl.innerHTML = "";
        if (rooms.length === 0) {
            listEl.innerHTML = '<div style="font-size: 10px; color: #aaa;">NO ACTIVE ROOMS FOUND.</div>';
            return;
        }

        rooms.forEach(room => {
            const btn = document.createElement("button");
            btn.className = "menu-btn";
            btn.style.width = "100%";
            btn.style.display = "flex";
            btn.style.justifyContent = "space-between";
            btn.style.alignItems = "center";
            btn.style.padding = "10px";

            // Format room name/metadata (since we don't pass room name upon creation, we just use the ID)
            const count = `${room.clients} / ${room.maxClients}`;
            btn.innerHTML = `<span>ROOM ${room.roomId}</span> <span>${count}</span>`;

            btn.onclick = () => createOrJoinVoiceRoom(false, room.roomId);

            listEl.appendChild(btn);
        });

    } catch (e) {
        console.error("Error fetching voice rooms:", e);
        listEl.innerHTML = '<div style="font-size: 10px; color: #f66;">FAILED TO SCAN ROOMS.</div>';
    }
}

async function createOrJoinVoiceRoom(isCreate, roomIdToJoin = null) {
    try {
        if (typeof window.Colyseus === 'undefined') {
            alert("Colyseus library not loaded.");
            return;
        }

        const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
        const wsHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
          ? "localhost:2567"
          : "seahorse-app-mv4sg.ondigitalocean.app";
        const client = new window.Colyseus.Client(`${wsProtocol}://${wsHost}`);

        // Get microphone access FIRST
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (e) {
            console.error("Microphone access denied or error:", e);
            alert("Microphone access is required for Voice Lounge.");
            return;
        }

        const username = window.myName || "Anon";

        if (isCreate) {
            voiceRoom = await client.create("voice_room", { name: username });
        } else if (roomIdToJoin) {
            voiceRoom = await client.joinById(roomIdToJoin, { name: username });
        } else {
            return;
        }

        // UI Updates
        document.getElementById("voiceMenu").style.display = "none";
        document.getElementById("voiceLobby").style.display = "block";
        document.getElementById("voiceRoomId").textContent = voiceRoom.roomId;
        setupRoomEventHandlers();

    } catch (e) {
        console.error("Error joining voice room:", e);
        alert("Failed to join room: " + e.message);
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
            localStream = null;
        }
    }
}

function setupRoomEventHandlers() {
    voiceRoom.state.players.onAdd((player, sessionId) => {
        console.log("Player joined:", player.name, sessionId);
        renderLobby();

        player.onChange(() => {
            renderLobby();
        });

        // If a NEW player joins and I am already in the room, I should initiate the WebRTC connection to them
        // To prevent both sides initiating, we can say the user who is already in the room initiates to the new joiner
        if (sessionId !== voiceRoom.sessionId) {
            // Initiate connection
            initiatePeerConnection(sessionId);
        }
    });

    voiceRoom.state.players.onRemove((player, sessionId) => {
        console.log("Player left:", player.name, sessionId);
        renderLobby();

        // Clean up WebRTC peer
        if (peers[sessionId]) {
            peers[sessionId].close();
            delete peers[sessionId];
        }

        // Remove audio element
        const audioEl = document.getElementById(`audio_${sessionId}`);
        if (audioEl) audioEl.remove();
    });

    // Handle incoming WebRTC signals
    voiceRoom.onMessage("signal", async (message) => {
        const fromId = message.from;
        const signal = message.data;

        let pc = peers[fromId];

        if (!pc) {
            // If we receive a signal from someone we don't have a peer connection for, create one
            pc = createPeerConnection(fromId);
        }

        try {
            if (signal.type === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                voiceRoom.send("signal", { to: fromId, data: pc.localDescription });
            } else if (signal.type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
            } else if (signal.candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(signal));
            }
        } catch (e) {
            console.error("Error handling signal from", fromId, e);
        }
    });
}

function createPeerConnection(targetSessionId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peers[targetSessionId] = pc;

    // Add local stream tracks to the connection
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }

    // Send ICE candidates to the other peer
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            voiceRoom.send("signal", {
                to: targetSessionId,
                data: event.candidate
            });
        }
    };

    // When we receive remote audio
    pc.ontrack = (event) => {
        console.log("Received remote track from", targetSessionId);

        // Create audio element if it doesn't exist
        let audioEl = document.getElementById(`audio_${targetSessionId}`);
        if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.id = `audio_${targetSessionId}`;
            audioEl.autoplay = true;
            // audioEl.controls = true; // useful for debugging
            document.getElementById('voiceAudioContainer').appendChild(audioEl);
        }

        audioEl.srcObject = event.streams[0];
    };

    return pc;
}

async function initiatePeerConnection(targetSessionId) {
    const pc = createPeerConnection(targetSessionId);

    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Send offer to the target peer
        voiceRoom.send("signal", {
            to: targetSessionId,
            data: pc.localDescription
        });
    } catch (e) {
        console.error("Error initiating peer connection to", targetSessionId, e);
    }
}

function renderLobby() {
    if (!voiceRoom) return;

    const pList = document.getElementById("voicePList");
    pList.innerHTML = "";

    voiceRoom.state.players.forEach((p, sessionId) => {
        const isMe = sessionId === voiceRoom.sessionId;
        const row = document.createElement("div");
        row.style.marginBottom = "5px";
        row.style.padding = "5px";
        row.style.border = "1px solid var(--accent-dim)";

        let statusStr = "";
        if (isMe) statusStr += " [YOU]";
        if (p.talking) statusStr += " 🔊";

        row.textContent = `${p.name} ${statusStr}`;
        if (p.talking) {
            row.style.borderColor = "#0f0";
            row.style.color = "#0f0";
        }

        pList.appendChild(row);
    });
}

function toggleMute() {
    if (!localStream) return;

    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) return;

    const track = audioTracks[0];
    track.enabled = !track.enabled; // Toggle mute

    const btn = document.getElementById("btnVoiceMute");
    if (track.enabled) {
        btn.textContent = "MUTE MIC";
        btn.style.color = "";
        btn.style.borderColor = "";
    } else {
        btn.textContent = "UNMUTE MIC";
        btn.style.color = "#f66";
        btn.style.borderColor = "#f66";
    }

    // Optional: send talking state to room
    // voiceRoom.send("talking", track.enabled);
}

function leaveVoiceRoom() {
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }

    for (let id in peers) {
        peers[id].close();
    }
    peers = {};

    const audioContainer = document.getElementById('voiceAudioContainer');
    if (audioContainer) audioContainer.innerHTML = '';

    if (voiceRoom) {
        voiceRoom.leave();
        voiceRoom = null;
    }

    const menu = document.getElementById("voiceMenu");
    const lobby = document.getElementById("voiceLobby");
    if (menu) menu.style.display = "block";
    if (lobby) lobby.style.display = "none";
}
