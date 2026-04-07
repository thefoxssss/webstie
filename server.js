const colyseus = require("colyseus");
const { WebSocketTransport } = require("@colyseus/ws-transport");
const { Schema, type, MapSchema } = require("@colyseus/schema");
const http = require("http");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin"); // <-- Firebase is here!
const fs = require("fs");
const path = require("path");

// Simple Perlin-like noise
const permutation = new Uint8Array(512);
const p = new Uint8Array([151,160,137,91,90,15,
  131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
  190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
  88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
  77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
  102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
  135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
  5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
  223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
  129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
  251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
  49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
  138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180]);
for (let i=0; i<256; i++) permutation[i] = permutation[i+256] = p[i];

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t, a, b) { return a + t * (b - a); }
function grad(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}
function perlin(x, y, z) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);
  const A = permutation[X] + Y, AA = permutation[A] + Z, AB = permutation[A + 1] + Z;
  const B = permutation[X + 1] + Y, BA = permutation[B] + Z, BB = permutation[B + 1] + Z;
  return lerp(w, lerp(v, lerp(u, grad(permutation[AA], x, y, z),
                                 grad(permutation[BA], x - 1, y, z)),
                         lerp(u, grad(permutation[AB], x, y - 1, z),
                                 grad(permutation[BB], x - 1, y - 1, z))),
                 lerp(v, lerp(u, grad(permutation[AA + 1], x, y, z - 1),
                                 grad(permutation[BA + 1], x - 1, y, z - 1)),
                         lerp(u, grad(permutation[AB + 1], x, y - 1, z - 1),
                                 grad(permutation[BB + 1], x - 1, y - 1, z - 1))));
}
function layeredNoise(x, y, octaves, persistence, scale) {
  let total = 0;
  let frequency = scale;
  let amplitude = 1;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    total += perlin(x * frequency, y * frequency, 0) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }
  return total / maxValue;
}

// Initialize Firebase (You will eventually need your Firebase Service Account key here)
// admin.initializeApp({
//   credential: admin.credential.cert(require("./firebase-key.json"))
// });

const app = express();
app.use(cors());
const port = process.env.PORT || 2567;
const builderServerDirectory = new Map();

const gameServer = new colyseus.Server({
  transport: new WebSocketTransport({
    server: http.createServer(app)
  })
});

// --------------------------------------------------------
// SMASH ARENA GAME LOGIC (Moved from client)
// --------------------------------------------------------
class Score extends Schema {}
type("number")(Score.prototype, "p1");
type("number")(Score.prototype, "p2");

class Fighter extends Schema {}
type("string")(Fighter.prototype, "id");
type("string")(Fighter.prototype, "name");
type("number")(Fighter.prototype, "x");
type("number")(Fighter.prototype, "y");
type("number")(Fighter.prototype, "vx");
type("number")(Fighter.prototype, "vy");
type("string")(Fighter.prototype, "color");
type("number")(Fighter.prototype, "hp");
type("number")(Fighter.prototype, "dir");
type("string")(Fighter.prototype, "state");
type("number")(Fighter.prototype, "stateTime");
type("number")(Fighter.prototype, "jumps");
type("number")(Fighter.prototype, "stun");

class SmashArenaState extends Schema {}
type("string")(SmashArenaState.prototype, "status");
type("string")(SmashArenaState.prototype, "winner");
type("string")(SmashArenaState.prototype, "mode");
type("number")(SmashArenaState.prototype, "koTarget");
type(Score)(SmashArenaState.prototype, "score");
type({ map: Fighter })(SmashArenaState.prototype, "players");
type("number")(SmashArenaState.prototype, "updatedAt");

const TICK_RATE = 20; // 50 updates per second
const BLAST_LEFT = -200;
const BLAST_RIGHT = 980;
const BLAST_BOTTOM = 500;
const PLATFORM = { x: 390, y: 350, w: 460, h: 12 };
const GROUND_Y = 400;

function makeFighter(id, name, side) {
  const f = new Fighter();
  f.id = id;
  f.name = name;
  f.x = side === "left" ? 200 : 580;
  f.y = 260;
  f.vx = 0;
  f.vy = 0;
  f.color = side === "left" ? "#ff2a2a" : "#2a7fff";
  f.hp = 0;
  f.dir = side === "left" ? 1 : -1;
  f.state = "idle";
  f.stateTime = 0;
  f.jumps = 2;
  f.stun = 0;
  return f;
}

function makeInput() {
  return { left: false, right: false, up: false, atk: false, upPress: false, atkPress: false, ts: Date.now() };
}

function rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

function stepPlayer(p, inp) {
  if (p.stun > 0) {
    p.stun--;
    p.state = "stun";
  } else {
    if (p.state === "attack") {
      p.stateTime++;
      if (p.stateTime > 15) {
        p.state = "idle";
        p.stateTime = 0;
      }
    } else {
      p.state = "idle";
    }
  }

  if (p.stun <= 0) {
    if (inp.left) {
      p.vx -= 1.2;
      p.dir = -1;
    }
    if (inp.right) {
      p.vx += 1.2;
      p.dir = 1;
    }
    if (inp.upPress && p.jumps > 0 && p.state !== "attack") {
      p.vy = -12;
      p.jumps--;
    }
    if (inp.atkPress && p.state !== "attack") {
      p.state = "attack";
      p.stateTime = 0;
    }
  }

  p.vy += 0.6; // gravity
  p.vx *= 0.85; // friction
  p.vy *= 0.98;

  p.x += p.vx;
  p.y += p.vy;

  let grounded = false;
  if (p.y >= GROUND_Y) {
    p.y = GROUND_Y;
    p.vy = 0;
    grounded = true;
  } else if (
    p.vy >= 0 &&
    p.x > PLATFORM.x - PLATFORM.w / 2 &&
    p.x < PLATFORM.x + PLATFORM.w / 2 &&
    p.y >= PLATFORM.y - 12 &&
    p.y <= PLATFORM.y + PLATFORM.h
  ) {
    p.y = PLATFORM.y - 12;
    p.vy = 0;
    grounded = true;
  }
  if (grounded) p.jumps = 2;
}

function applyCombat(atk, def, inp) {
  if (atk.state === "attack" && atk.stateTime === 2) {
    const r1 = { x: atk.dir === 1 ? atk.x : atk.x - 40, y: atk.y - 10, w: 40, h: 20 };
    const r2 = { x: def.x - 15, y: def.y - 15, w: 30, h: 30 };
    if (rectIntersect(r1.x, r1.y, r1.w, r1.h, r2.x, r2.y, r2.w, r2.h)) {
      const dmg = 8;
      def.hp += dmg;
      const kb = 4 + def.hp * 0.12;
      def.vx = atk.dir * kb;
      def.vy = -kb * 0.6;
      def.stun = Math.floor(10 + kb * 0.5);
    }
  }
}

function respawn(player, side) {
  player.x = side === "left" ? 200 : 580;
  player.y = 260;
  player.vx = 0;
  player.vy = 0;
  player.hp = 0;
  player.jumps = 2;
  player.stun = 0;
}

// --------------------------------------------------------
// SMASH ARENA ROOM DEFINITION
// --------------------------------------------------------
class SmashArenaRoom extends colyseus.Room {
  onCreate(options) {
    this.maxClients = 2;

    const state = new SmashArenaState();
    state.status = "lobby";
    state.winner = "";
    state.mode = "online";
    state.koTarget = 4;
    state.score = new Score();
    state.score.p1 = 0;
    state.score.p2 = 0;
    state.players = new MapSchema();
    state.updatedAt = Date.now();

    this.setState(state);

    // Track inputs separately from state
    this.inputs = {
      p1: makeInput(),
      p2: makeInput()
    };

    this.clientsMap = {}; // mapping sessionId -> 'p1' or 'p2'

    this.onMessage("input", (client, message) => {
      const pId = this.clientsMap[client.sessionId];
      if (pId && this.state.status === "playing") {
        // Merge input, honoring single-press flags
        const curInp = this.inputs[pId];
        curInp.left = message.left;
        curInp.right = message.right;
        curInp.up = message.up;
        curInp.atk = message.atk;
        if (message.upPress) curInp.upPress = true;
        if (message.atkPress) curInp.atkPress = true;
        curInp.ts = message.ts;
      }
    });

    this.onMessage("start", (client) => {
      // Allow p1 (host) to start the match if p2 is present
      if (this.clientsMap[client.sessionId] === "p1" && this.state.players.get("p2")) {
        this.state.status = "playing";
        this.state.score.p1 = 0;
        this.state.score.p2 = 0;
        this.state.winner = "";
      }
    });

    this.setSimulationInterval(() => this.simulateTick(), TICK_RATE);
  }

  onJoin(client, options) {
    if (!this.state.players.get("p1")) {
      this.clientsMap[client.sessionId] = "p1";
      this.state.players.set("p1", makeFighter(options.uid, options.name || "P1", "left"));
    } else if (!this.state.players.get("p2")) {
      this.clientsMap[client.sessionId] = "p2";
      this.state.players.set("p2", makeFighter(options.uid, options.name || "P2", "right"));
    }
  }

  onLeave(client, consented) {
    const pId = this.clientsMap[client.sessionId];
    if (pId) {
      // If someone leaves during a match, end it
      this.state.status = "finished";
      const p1Name = this.state.players.get("p1")?.name || "Player 1";
      const p2Name = this.state.players.get("p2")?.name || "Player 2";
      this.state.winner = pId === "p1" ? p2Name : p1Name;
    }
  }

  simulateTick() {
    if (this.state.status !== "playing") return;

    const p1 = this.state.players.get("p1");
    const p2 = this.state.players.get("p2");
    if (!p1 || !p2) return;

    const in1 = this.inputs.p1;
    const in2 = this.inputs.p2;

    stepPlayer(p1, in1);
    stepPlayer(p2, in2);
    applyCombat(p1, p2, in1);
    applyCombat(p2, p1, in2);

    // Reset latch inputs
    in1.upPress = false;
    in1.atkPress = false;
    in2.upPress = false;
    in2.atkPress = false;

    if (p1.y > BLAST_BOTTOM || p1.x < BLAST_LEFT || p1.x > BLAST_RIGHT) {
      this.state.score.p2 += 1;
      respawn(p1, "left");
      this.broadcast("hudMessage", `${p1.name} WAS LAUNCHED`);
    }
    if (p2.y > BLAST_BOTTOM || p2.x < BLAST_LEFT || p2.x > BLAST_RIGHT) {
      this.state.score.p1 += 1;
      respawn(p2, "right");
      this.broadcast("hudMessage", `${p2.name} WAS LAUNCHED`);
    }

    if (this.state.score.p1 >= this.state.koTarget || this.state.score.p2 >= this.state.koTarget) {
      this.state.status = "finished";
      this.state.winner = this.state.score.p1 > this.state.score.p2 ? p1.name : p2.name;
    }

    this.state.updatedAt = Date.now();
  }
}

// --------------------------------------------------------
// BASE TEST ROOM
// --------------------------------------------------------
class GameRoom extends colyseus.Room {
  
  // 1. FIREBASE CHECK: Make sure they are logged into Firebase before letting them play!
  async onAuth(client, options, request) {
    /* Once you add your Firebase key, you will uncomment this code to verify them:
    try {
      const decodedToken = await admin.auth().verifyIdToken(options.accessToken);
      return decodedToken; 
    } catch (e) {
      throw new colyseus.ServerError(400, "Bad Firebase Token");
    }
    */
    return true; // Letting anyone in for now just so you can test the movement!
  }

  // 2. THE GAME LOOP: Fast movement, no lag!
  onCreate(options) {
    console.log("Game room created!");
    
    this.onMessage("move", (client, message) => {
      // Broadcast movement to everyone else instantly
      this.broadcast("move", message, { except: client });
    });
  }

  onJoin(client, options, auth) {
    // When Firebase is fully linked, you can pull their Firebase UID right here
    // console.log(`Firebase User ${auth.uid} joined the game!`);
    console.log(`Player ${client.sessionId} joined the game!`);
  }

  onLeave(client, consented) {
    console.log(`Player ${client.sessionId} left the game!`);
    // Here is where you could tell Firebase to save their coins or high score!
  }
}

// --------------------------------------------------------
// BUILDER ROOM DEFINITION
// --------------------------------------------------------
class BuilderPlayer extends Schema {}
type("string")(BuilderPlayer.prototype, "id");
type("string")(BuilderPlayer.prototype, "name");
type("number")(BuilderPlayer.prototype, "x");
type("number")(BuilderPlayer.prototype, "y");
type("number")(BuilderPlayer.prototype, "vx");
type("number")(BuilderPlayer.prototype, "vy");
type("string")(BuilderPlayer.prototype, "color");
type("number")(BuilderPlayer.prototype, "hp");
type("number")(BuilderPlayer.prototype, "maxHp");

class Block extends Schema {}
type("number")(Block.prototype, "x");
type("number")(Block.prototype, "y");
type("number")(Block.prototype, "type");

class ItemDrop extends Schema {}
type("string")(ItemDrop.prototype, "id");
type("number")(ItemDrop.prototype, "x");
type("number")(ItemDrop.prototype, "y");
type("number")(ItemDrop.prototype, "vx");
type("number")(ItemDrop.prototype, "vy");
type("number")(ItemDrop.prototype, "type");
type("number")(ItemDrop.prototype, "count");

class Chunk extends Schema {
  constructor() {
    super();
    this.blocks = new MapSchema();
  }
}
type({ map: Block })(Chunk.prototype, "blocks");

class BuilderState extends Schema {
    constructor() {
        super();
        this.players = new MapSchema();
        this.chunks = new MapSchema();
        this.drops = new MapSchema();
    }
}
type({ map: BuilderPlayer })(BuilderState.prototype, "players");
type({ map: Chunk })(BuilderState.prototype, "chunks");
type({ map: ItemDrop })(BuilderState.prototype, "drops");

const BUILDER_TICK_RATE = 20;
const TILE_SIZE = 32;
const CHUNK_SIZE = 16;
const BUILDER_JUMP_BUFFER_TICKS = 6; // ~120ms at 50Hz

class BuilderRoom extends colyseus.Room {
  onCreate(options) {
    this.maxClients = 50;
    this.autoDispose = false;
    this.serverName = (options && typeof options.serverName === "string" && options.serverName.trim())
      ? options.serverName.trim().slice(0, 24)
      : "Public World";
    this.setMetadata({ serverName: this.serverName });

    const state = new BuilderState();
    this.setState(state);

    this.inputs = {};

    this.onMessage("input", (client, message) => {
      const pId = client.sessionId;
      if (this.inputs[pId]) {
        this.inputs[pId].left = message.left;
        this.inputs[pId].right = message.right;
        if (message.upPress) this.inputs[pId].jumpBuffer = BUILDER_JUMP_BUFFER_TICKS;
      }
    });

    this.onMessage("build", (client, message) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0) return;

      const playerCenterX = p.x + TILE_SIZE / 2;
      const playerCenterY = p.y + TILE_SIZE / 2;
      const targetCenterX = message.x;
      const targetCenterY = message.y;

      const distSq = (playerCenterX - targetCenterX) ** 2 + (playerCenterY - targetCenterY) ** 2;
      const maxBuildDistance = TILE_SIZE * 6; // 6 blocks reach

      if (distSq > maxBuildDistance ** 2) return;

      const x = Math.floor(message.x / TILE_SIZE);
      const y = Math.floor(message.y / TILE_SIZE);
      const cx = Math.floor(x / CHUNK_SIZE);
      const cy = Math.floor(y / CHUNK_SIZE);
      const chunk = this.getOrCreateChunk(cx, cy);

      const key = `${x},${y}`;
      // Check if block already exists
      if (!chunk.blocks.get(key)) {
          // Check intersection with players
          let intersect = false;
          this.state.players.forEach(p => {
              if (
                  p.x < x * TILE_SIZE + TILE_SIZE &&
                  p.x + TILE_SIZE > x * TILE_SIZE &&
                  p.y < y * TILE_SIZE + TILE_SIZE &&
                  p.y + TILE_SIZE > y * TILE_SIZE
              ) {
                  intersect = true;
              }
          });
          if (!intersect) {
              const b = new Block();
              b.x = x;
              b.y = y;
              b.type = message.type || 3;
              chunk.blocks.set(key, b);
          }
      }
    });

    this.onMessage("break", (client, message) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0) return;

      const playerCenterX = p.x + TILE_SIZE / 2;
      const playerCenterY = p.y + TILE_SIZE / 2;
      const targetCenterX = message.x;
      const targetCenterY = message.y;

      const distSq = (playerCenterX - targetCenterX) ** 2 + (playerCenterY - targetCenterY) ** 2;
      const maxBuildDistance = TILE_SIZE * 6;

      if (distSq > maxBuildDistance ** 2) return;

      const x = Math.floor(message.x / TILE_SIZE);
      const y = Math.floor(message.y / TILE_SIZE);
      const cx = Math.floor(x / CHUNK_SIZE);
      const cy = Math.floor(y / CHUNK_SIZE);
      const chunk = this.state.chunks.get(`${cx},${cy}`);

      if (chunk) {
          const key = `${x},${y}`;
          const b = chunk.blocks.get(key);
          if (b) {
              const drop = new ItemDrop();
              drop.id = `drop-${Date.now()}-${Math.random()}`;
              drop.x = x * TILE_SIZE + TILE_SIZE / 2;
              drop.y = y * TILE_SIZE + TILE_SIZE / 2;
              drop.vx = (Math.random() - 0.5) * 4;
              drop.vy = -4 - Math.random() * 4;
              drop.type = b.type;
              drop.count = 1;
              this.state.drops.set(drop.id, drop);

              chunk.blocks.delete(key);
          }
      }
    });

    this.onMessage("pickup", (client, message) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0) return;

      const drop = this.state.drops.get(message.id);
      if (!drop) return;

      const dx = p.x + TILE_SIZE/2 - drop.x;
      const dy = p.y + TILE_SIZE/2 - drop.y;
      if (dx*dx + dy*dy < (TILE_SIZE * 2) ** 2) {
          this.state.drops.delete(drop.id);
          client.send("picked_up", { type: drop.type, count: drop.count });
      }
    });

    this.onMessage("attack", (client, message) => {
      const attacker = this.state.players.get(client.sessionId);
      if (!attacker || attacker.hp <= 0) return;

      const target = this.state.players.get(message.targetId);
      if (!target || target.hp <= 0) return;

      const dx = attacker.x - target.x;
      const dy = attacker.y - target.y;
      const distSq = dx*dx + dy*dy;

      // Melee range
      if (distSq < (TILE_SIZE * 3) ** 2) {
          target.hp -= message.damage || 1;
          target.vy = -6;
          target.vx = (target.x - attacker.x > 0 ? 1 : -1) * 8;

          if (target.hp <= 0) {
              target.hp = 0;
              const targetClient = this.clients.find(c => c.sessionId === message.targetId);
              if (targetClient) {
                  targetClient.send("died", { killer: attacker.name });
              }
          }
      }
    });

    this.onMessage("spawn_drops", (client, message) => {
        const p = this.state.players.get(client.sessionId);
        if (!p) return;
        // Client sends their inventory to drop
        const items = message.items || [];
        items.forEach(item => {
            if (!item.type || !item.count) return;
            const drop = new ItemDrop();
            drop.id = `drop-${Date.now()}-${Math.random()}`;
            drop.x = p.x + TILE_SIZE / 2;
            drop.y = p.y + TILE_SIZE / 2;
            drop.vx = (Math.random() - 0.5) * 8;
            drop.vy = -4 - Math.random() * 8;
            drop.type = item.type;
            drop.count = item.count;
            this.state.drops.set(drop.id, drop);
        });
    });

    this.onMessage("respawn", (client) => {
        const p = this.state.players.get(client.sessionId);
        if (!p) return;

        // Respawn player
        const spawnX = Math.floor(Math.random() * 200) - 100;
        const noise = layeredNoise(spawnX, 0, 4, 0.5, 0.05);
        const spawnY = Math.floor(20 + noise * 15) - 2;
        p.x = spawnX * TILE_SIZE;
        p.y = spawnY * TILE_SIZE;
        p.vx = 0;
        p.vy = 0;
        p.hp = p.maxHp;
    });

    this.loadWorld();
    this.setSimulationInterval(() => this.simulateTick(), BUILDER_TICK_RATE);
    this.saveInterval = setInterval(() => this.saveWorld(), 30000); // Save every 30s
    this.syncServerDirectory();
  }

  onJoin(client, options) {
    const p = new BuilderPlayer();
    p.id = client.sessionId;
    p.name = options.name || "Builder";

    const spawnX = Math.floor(Math.random() * 200) - 100;
    const noise = layeredNoise(spawnX, 0, 4, 0.5, 0.05);
    const spawnY = Math.floor(20 + noise * 15) - 2;

    p.x = spawnX * TILE_SIZE;
    p.y = spawnY * TILE_SIZE;
    p.vx = 0;
    p.vy = 0;
    p.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
    p.maxHp = 10;
    p.hp = 10;
    this.state.players.set(client.sessionId, p);

    this.inputs[client.sessionId] = { left: false, right: false, jumpBuffer: 0 };
    this.syncServerDirectory();
  }

  onLeave(client, consented) {
    this.state.players.delete(client.sessionId);
    delete this.inputs[client.sessionId];
    this.syncServerDirectory();
  }

  onDispose() {
    if (this.saveInterval) clearInterval(this.saveInterval);
    this.saveWorld();
    builderServerDirectory.delete(this.roomId);
  }

  saveWorld() {
    try {
      const worldsDir = path.join(__dirname, "worlds");
      if (!fs.existsSync(worldsDir)) fs.mkdirSync(worldsDir);

      const sanitizedName = this.serverName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const filePath = path.join(worldsDir, `${sanitizedName}.json`);

      const data = {};
      this.state.chunks.forEach((chunk, key) => {
        data[key] = [];
        chunk.blocks.forEach((block) => {
          data[key].push({ x: block.x, y: block.y, type: block.type });
        });
      });

      fs.writeFileSync(filePath, JSON.stringify(data));
      console.log(`World saved: ${filePath}`);
    } catch (e) {
      console.error("Failed to save world", e);
    }
  }

  loadWorld() {
    try {
      const sanitizedName = this.serverName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const filePath = path.join(__dirname, "worlds", `${sanitizedName}.json`);

      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath);
        const data = JSON.parse(raw);

        for (const chunkKey in data) {
          const chunk = new Chunk();
          data[chunkKey].forEach(bData => {
            const b = new Block();
            b.x = bData.x;
            b.y = bData.y;
            b.type = bData.type;
            chunk.blocks.set(`${b.x},${b.y}`, b);
          });
          this.state.chunks.set(chunkKey, chunk);
        }
        console.log(`World loaded: ${filePath}`);
      }
    } catch (e) {
      console.error("Failed to load world", e);
    }
  }

  getSurfaceHeight(worldX) {
    const noise = layeredNoise(worldX, 0, 4, 0.5, 0.05);
    return Math.floor(20 + noise * 15);
  }

  generateChunk(cx, cy) {
    const key = `${cx},${cy}`;
    if (this.state.chunks.has(key)) return;

    const chunk = new Chunk();
    this.state.chunks.set(key, chunk); // Set early to avoid re-generation

    const minY = cy * CHUNK_SIZE;
    const maxY = (cy + 1) * CHUNK_SIZE;

    // 1. Generate Ground
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const worldX = cx * CHUNK_SIZE + x;
      const h = this.getSurfaceHeight(worldX);

      const startY = Math.max(minY, h);
      const endY = Math.min(maxY, h + 40);

      for (let y = startY; y < endY; y++) {
        const b = new Block();
        b.x = worldX;
        b.y = y;
        if (y === h) b.type = 1; // Grass
        else if (y < h + 4) b.type = 2; // Dirt
        else b.type = 3; // Stone
        chunk.blocks.set(`${worldX},${y}`, b);
      }
    }

    // 2. Deterministic Tree Generation
    // Scan range: current chunk plus horizontal neighbors to allow canopy overlap.
    for (let tx = cx * CHUNK_SIZE - 2; tx < (cx + 1) * CHUNK_SIZE + 2; tx++) {
      // Deterministic tree check based on worldX
      const spawnChance = Math.abs(Math.sin(tx * 1234.56)) * 100;
      if (spawnChance < 8) { // ~8% chance per block
        const surfaceY = this.getSurfaceHeight(tx);
        const trunkHeight = 4 + Math.floor(Math.abs(Math.cos(tx * 789.01)) * 3);

        // Place trunk
        for (let dy = 1; dy <= trunkHeight; dy++) {
          const ty = surfaceY - dy;
          if (ty >= minY && ty < maxY && tx >= cx * CHUNK_SIZE && tx < (cx + 1) * CHUNK_SIZE) {
            const b = new Block();
            b.x = tx;
            b.y = ty;
            b.type = 7; // LOG
            chunk.blocks.set(`${tx},${ty}`, b);
          }
        }

        // Place leaves canopy
        for (let lx = -2; lx <= 2; lx++) {
          for (let ly = -2; ly <= 2; ly++) {
            // Simple spherical/diamond canopy at top of trunk
            if (Math.abs(lx) + Math.abs(ly) > 3) continue;

            const finalLx = tx + lx;
            const finalLy = surfaceY - trunkHeight - 2 + ly;

            // Only place if within current chunk boundaries
            if (
              finalLx >= cx * CHUNK_SIZE && finalLx < (cx + 1) * CHUNK_SIZE &&
              finalLy >= minY && finalLy < maxY
            ) {
              const key = `${finalLx},${finalLy}`;
              if (!chunk.blocks.has(key)) {
                const b = new Block();
                b.x = finalLx;
                b.y = finalLy;
                b.type = 8; // LEAVES
                chunk.blocks.set(key, b);
              }
            }
          }
        }
      }
    }
  }

  getOrCreateChunk(cx, cy) {
    const key = `${cx},${cy}`;
    let chunk = this.state.chunks.get(key);
    if (!chunk) {
      this.generateChunk(cx, cy);
      chunk = this.state.chunks.get(key);
    }
    return chunk;
  }

  syncServerDirectory() {
    const players = [];
    this.state.players.forEach((player) => {
      players.push(player.name || "Builder");
    });
    builderServerDirectory.set(this.roomId, {
      roomId: this.roomId,
      serverName: this.serverName || "Public World",
      clients: this.clients.length,
      maxClients: this.maxClients,
      players
    });
  }

  isSolid(x, y) {
      const cx = Math.floor(x / CHUNK_SIZE);
      const cy = Math.floor(y / CHUNK_SIZE);
      const chunk = this.state.chunks.get(`${cx},${cy}`);
      if (!chunk) return false;
      return chunk.blocks.get(`${x},${y}`) !== undefined;
  }

  simulateTick() {
    this.state.players.forEach((p, sessionId) => {
        const inp = this.inputs[sessionId];
        if (!inp) return;
        const prevX = p.x;
        const prevY = p.y;

        const pCx = Math.floor(p.x / (TILE_SIZE * CHUNK_SIZE));
        const pCy = Math.floor(p.y / (TILE_SIZE * CHUNK_SIZE));
        for (let cx = pCx - 2; cx <= pCx + 2; cx++) {
          for (let cy = pCy - 2; cy <= pCy + 2; cy++) {
            this.getOrCreateChunk(cx, cy);
          }
        }

        if (inp.left) p.vx -= 1.5;
        if (inp.right) p.vx += 1.5;

        p.vx *= 0.8;
        p.vy += 0.8; // gravity
        p.vy *= 0.98;

        // Apply X velocity
        p.x += p.vx;

        // Collision check X (swept, avoids slight clipping into tiles)
        let px1 = Math.floor(p.x / TILE_SIZE);
        let px2 = Math.floor((p.x + TILE_SIZE - 0.01) / TILE_SIZE);
        let py1 = Math.floor(p.y / TILE_SIZE);
        let py2 = Math.floor((p.y + TILE_SIZE - 0.01) / TILE_SIZE);

        if (p.vx > 0) {
            const prevPx2 = Math.floor((prevX + TILE_SIZE - 0.01) / TILE_SIZE);
            for (let tx = prevPx2 + 1; tx <= px2; tx++) {
                if (this.isSolid(tx, py1) || this.isSolid(tx, py2)) {
                    p.x = tx * TILE_SIZE - TILE_SIZE;
                    p.vx = 0;
                    break;
                }
            }
        } else if (p.vx < 0) {
            const prevPx1 = Math.floor(prevX / TILE_SIZE);
            for (let tx = prevPx1 - 1; tx >= px1; tx--) {
                if (this.isSolid(tx, py1) || this.isSolid(tx, py2)) {
                    p.x = (tx + 1) * TILE_SIZE;
                    p.vx = 0;
                    break;
                }
            }
        }

        // Apply Y velocity
        p.y += p.vy;

        // Fall into the void respawn
        if (p.y > 100 * TILE_SIZE) {
            if (p.hp > 0) {
                p.hp = 0;
                const c = this.clients.find(c => c.sessionId === sessionId);
                if (c) c.send("died", { killer: "the void" });
            }
        }

        // Collision check Y (swept, avoids slight sinking into tiles)
        px1 = Math.floor(p.x / TILE_SIZE);
        px2 = Math.floor((p.x + TILE_SIZE - 0.01) / TILE_SIZE);
        py1 = Math.floor(p.y / TILE_SIZE);
        py2 = Math.floor((p.y + TILE_SIZE - 0.01) / TILE_SIZE);

        let grounded = false;
        if (p.vy > 0) {
            const prevPy2 = Math.floor((prevY + TILE_SIZE - 0.01) / TILE_SIZE);
            for (let ty = prevPy2 + 1; ty <= py2; ty++) {
                if (this.isSolid(px1, ty) || this.isSolid(px2, ty)) {
                    p.y = ty * TILE_SIZE - TILE_SIZE;
                    p.vy = 0;
                    grounded = true;
                    break;
                }
            }
        } else if (p.vy < 0) {
            const prevPy1 = Math.floor(prevY / TILE_SIZE);
            for (let ty = prevPy1 - 1; ty >= py1; ty--) {
                if (this.isSolid(px1, ty) || this.isSolid(px2, ty)) {
                    p.y = (ty + 1) * TILE_SIZE;
                    p.vy = 0;
                    break;
                }
            }
        }

        if (grounded && inp.jumpBuffer > 0) {
            p.vy = -12;
            inp.jumpBuffer = 0;
        } else if (inp.jumpBuffer > 0) {
            inp.jumpBuffer--;
        }
    });

    // Simulate item drops physics
    const dropsToDelete = [];
    this.state.drops.forEach((drop, id) => {
        drop.vy += 0.8; // gravity
        drop.vx *= 0.9;
        drop.vy *= 0.98;

        drop.x += drop.vx;

        const px1 = Math.floor((drop.x - 4) / TILE_SIZE);
        const px2 = Math.floor((drop.x + 4) / TILE_SIZE);
        const py = Math.floor(drop.y / TILE_SIZE);

        if (this.isSolid(px1, py) || this.isSolid(px2, py)) {
            drop.x -= drop.vx;
            drop.vx = -drop.vx * 0.5;
        }

        drop.y += drop.vy;

        const py1 = Math.floor((drop.y - 4) / TILE_SIZE);
        const py2 = Math.floor((drop.y + 4) / TILE_SIZE);
        const px = Math.floor(drop.x / TILE_SIZE);

        if (this.isSolid(px, py1) || this.isSolid(px, py2)) {
            drop.y -= drop.vy;
            drop.vy = -drop.vy * 0.5;
        }

        if (drop.y > 100 * TILE_SIZE) {
            dropsToDelete.push(id);
        }
    });

    dropsToDelete.forEach(id => this.state.drops.delete(id));
  }
}

// --------------------------------------------------------
// VOICE ROOM DEFINITION (WebRTC Signaling)
// --------------------------------------------------------
class VoicePlayer extends Schema {}
type("string")(VoicePlayer.prototype, "id");
type("string")(VoicePlayer.prototype, "name");
type("boolean")(VoicePlayer.prototype, "talking");

class VoiceState extends Schema {
    constructor() {
        super();
        this.players = new MapSchema();
    }
}
type({ map: VoicePlayer })(VoiceState.prototype, "players");

class VoiceRoom extends colyseus.Room {
  onCreate(options) {
    this.maxClients = 4; // limit to 4 for peer-to-peer mesh
    this.setState(new VoiceState());

    // Relay WebRTC signaling messages
    this.onMessage("signal", (client, message) => {
        // message should contain { to: targetSessionId, data: signalData }
        const targetClient = this.clients.find(c => c.sessionId === message.to);
        if (targetClient) {
            targetClient.send("signal", {
                from: client.sessionId,
                data: message.data
            });
        }
    });

    this.onMessage("talking", (client, message) => {
        const p = this.state.players.get(client.sessionId);
        if (p) {
            p.talking = !!message;
        }
    });
  }

  updateMetadata() {
    const names = [];
    this.state.players.forEach(p => names.push(p.name));
    this.setMetadata({ playerNames: names.join(", ") });
  }

  onJoin(client, options) {
    const p = new VoicePlayer();
    p.id = client.sessionId;
    p.name = options.name || "Anon";
    p.talking = false;
    this.state.players.set(client.sessionId, p);
    console.log(`VoicePlayer ${client.sessionId} joined room ${this.roomId}`);
    this.updateMetadata();
  }

  onLeave(client, consented) {
    this.state.players.delete(client.sessionId);
    console.log(`VoicePlayer ${client.sessionId} left room ${this.roomId}`);
    this.updateMetadata();
  }
}

gameServer.define("my_game_room", GameRoom);
gameServer.define("smash_arena", SmashArenaRoom);
gameServer.define("builder_room", BuilderRoom);
gameServer.define("voice_room", VoiceRoom);

app.get("/builder-servers", (req, res) => {
  const servers = Array.from(builderServerDirectory.values()).sort((a, b) => {
    if (b.clients !== a.clients) return b.clients - a.clients;
    return a.serverName.localeCompare(b.serverName);
  });
  res.json({ servers });
});

gameServer.listen(port);
console.log(`Colyseus game server is listening on port ${port}...`);
