// GitHub-hosted multiplayer game using WebRTC
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const roomCodeDisplay = document.getElementById('roomCode');

let peer = null;
let gameState = {
    players: {},
    bullets: []
};
let myId = Math.random().toString(36).substr(2, 9);
let roomCode = null;
let isHost = false;

// Free signaling server (replace with your own if needed)
const SIGNALING_SERVER = 'wss://y-webrtc-signaling-eu.herokuapp.com';

class Player {
    constructor(id, x, y, color) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.health = 100;
        this.color = color;
        this.score = 0;
        this.size = 20;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.x = Math.max(this.size, Math.min(canvas.width - this.size, this.x));
        this.y = Math.max(this.size, Math.min(canvas.height - this.size, this.y));
    }
}

// Connect to signaling server for WebRTC
function connectToSignaling() {
    const ws = new WebSocket(SIGNALING_SERVER);
    
    ws.onopen = () => {
        status.textContent = 'Connected to signaling server';
        status.className = 'connected';
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleSignalingMessage(data);
    };
    
    ws.onclose = () => {
        status.textContent = 'Disconnected from signaling server';
        status.className = 'disconnected';
    };
    
    return ws;
}

// Create a new game room
function createRoom() {
    roomCode = Math.random().toString(36).substr(2, 6).toUpperCase();
    isHost = true;
    roomCodeDisplay.textContent = `Room Code: ${roomCode}`;
    
    // Initialize as host
    gameState.players[myId] = new Player(myId, 400, 300, '#FF6B6B');
    
    // Set up WebRTC connection listener
    setupHostConnection();
}

// Join existing room
function joinRoom() {
    roomCode = document.getElementById('roomInput').value.toUpperCase();
    if (!roomCode) {
        alert('Please enter a room code');
        return;
    }
    
    isHost = false;
    roomCodeDisplay.textContent = `Joined Room: ${roomCode}`;
    
    // Connect to host
    setupClientConnection();
}

// WebRTC connection setup
function setupHostConnection() {
    peer = new SimplePeer({ initiator: true, trickle: false });
    
    peer.on('signal', (data) => {
        // Send offer through signaling server
        broadcastSignal(data);
    });
    
    peer.on('connect', () => {
        status.textContent = 'Player connected!';
        gameLoop();
    });
    
    peer.on('data', (data) => {
        const message = JSON.parse(data.toString());
        handleGameMessage(message);
    });
}

function setupClientConnection() {
    peer = new SimplePeer({ initiator: false, trickle: false });
    
    peer.on('signal', (data) => {
        // Send answer through signaling server
        broadcastSignal(data);
    });
    
    peer.on('connect', () => {
        status.textContent = 'Connected to host!';
        gameLoop();
    });
    
    peer.on('data', (data) => {
        const message = JSON.parse(data.toString());
        handleGameMessage(message);
    });
}

// Handle incoming game messages
function handleGameMessage(message) {
    switch(message.type) {
        case 'gameState':
            gameState = message.gameState;
            break;
        case 'playerInput':
            if (message.playerId !== myId) {
                updateRemotePlayer(message.playerId, message.input);
            }
            break;
    }
}

// Send game state to other player (host only)
function broadcastGameState() {
    if (peer && peer.connected && isHost) {
        peer.send(JSON.stringify({
            type: 'gameState',
            gameState: gameState
        }));
    }
}

// Send input to host (client only)
function sendInput(input) {
    if (peer && peer.connected && !isHost) {
        peer.send(JSON.stringify({
            type: 'playerInput',
            playerId: myId,
            input: input
        }));
    }
}

// Game controls and logic
let keys = {};
let mouseX = 0, mouseY = 0;

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

canvas.addEventListener('click', (e) => {
    if (gameState.players[myId]) {
        shoot();
    }
});

function updateLocalPlayer() {
    const player = gameState.players[myId];
    if (!player) return;

    // Movement
    let vx = 0, vy = 0;
    if (keys['w'] || keys['arrowup']) vy = -1;
    if (keys['s'] || keys['arrowdown']) vy = 1;
    if (keys['a'] || keys['arrowleft']) vx = -1;
    if (keys['d'] || keys['arrowright']) vx = 1;

    // Normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
        vx *= 0.707;
        vy *= 0.707;
    }

    player.vx = vx * 5;
    player.vy = vy * 5;
    player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);

    player.update();

    // Send input to host if client
    if (!isHost) {
        sendInput({
            vx: player.vx,
            vy: player.vy,
            angle: player.angle
        });
    }
}

function shoot() {
    const player = gameState.players[myId];
    if (!player) return;

    // Create bullet
    const bullet = {
        x: player.x + Math.cos(player.angle) * player.size,
        y: player.y + Math.sin(player.angle) * player.size,
        vx: Math.cos(player.angle) * 10,
        vy: Math.sin(player.angle) * 10,
        ownerId: myId,
        size: 5
    };

    gameState.bullets.push(bullet);
}

function updateBullets() {
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
        const bullet = gameState.bullets[i];
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        // Remove bullets that go off screen
        if (bullet.x < 0 || bullet.x > canvas.width || 
            bullet.y < 0 || bullet.y > canvas.height) {
            gameState.bullets.splice(i, 1);
            continue;
        }

        // Simple collision with players (host only)
        if (isHost) {
            for (let id in gameState.players) {
                const player = gameState.players[id];
                if (id !== bullet.ownerId) {
                    const dx = bullet.x - player.x;
                    const dy = bullet.y - player.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < bullet.size + player.size) {
                        player.health -= 25;
                        if (player.health <= 0) {
                            player.health = 100;
                            player.x = Math.random() * 760 + 20;
                            player.y = Math.random() * 560 + 20;
                        }
                        gameState.bullets.splice(i, 1);
                        break;
                    }
                }
            }
        }
    }
}

function render() {
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Draw players
    for (let id in gameState.players) {
        const player = gameState.players[id];
        
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle);
        
        // Player body
        ctx.fillStyle = player.color;
        ctx.fillRect(-player.size, -player.size, player.size * 2, player.size * 2);
        
        // Direction indicator
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(player.size - 5, -3, 10, 6);
        
        ctx.restore();

        // Health bar
        const healthBarWidth = 30;
        const healthPercentage = player.health / player.maxHealth;
        
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(player.x - healthBarWidth/2, player.y - player.size - 10, healthBarWidth, 4);
        
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(player.x - healthBarWidth/2, player.y - player.size - 10, healthBarWidth * healthPercentage, 4);
    }

    // Draw bullets
    ctx.fillStyle = '#FFD700';
    gameState.bullets.forEach(bullet => {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function gameLoop() {
    if (gameState.players[myId]) {
        updateLocalPlayer();
        updateBullets();
        
        if (isHost) {
            broadcastGameState();
        }
    }
    
    render();
    requestAnimationFrame(gameLoop);
}

// Start game loop when connected
function startGame() {
    // Add remote player if joining
    if (!isHost && !gameState.players['remote']) {
        gameState.players['remote'] = new Player('remote', 200, 300, '#4ECDC4');
    }
    
    gameLoop();
}

// Override signaling (simplified version using public server)
function broadcastSignal(data) {
    // In a real implementation, you'd send this through your signaling server
    console.log('Signal data:', data);
    
    // For demo purposes, we'll simulate connection
    setTimeout(() => {
        if (isHost) {
            status.textContent = 'Waiting for player...';
        } else {
            status.textContent = 'Connecting to host...';
            // Simulate successful connection
            setTimeout(() => {
                status.textContent = 'Connected!';
                status.className = 'connected';
                startGame();
            }, 1000);
        }
    }, 500);
}

// Start signaling connection
connectToSignaling();
