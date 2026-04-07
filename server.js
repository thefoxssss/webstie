const colyseus = require("colyseus");
const { WebSocketTransport } = require("@colyseus/ws-transport");
const { Schema, type, MapSchema, ArraySchema } = require("@colyseus/schema");
const http = require("http");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin"); // <-- Firebase is here!

// Initialize Firebase (You will eventually need your Firebase Service Account key here)
// admin.initializeApp({
//   credential: admin.credential.cert(require("./firebase-key.json"))
// });

const app = express();
app.use(cors());
const port = process.env.PORT || 2567;

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
type({ map: "number" })(BuilderPlayer.prototype, "inventory");
type(["number"])(BuilderPlayer.prototype, "hotbar");

class Block extends Schema {}
type("number")(Block.prototype, "x");
type("number")(Block.prototype, "y");
type("number")(Block.prototype, "type");

class BuilderState extends Schema {
    constructor() {
        super();
        this.players = new MapSchema();
        this.blocks = new MapSchema();
    }
}
type({ map: BuilderPlayer })(BuilderState.prototype, "players");
type({ map: Block })(BuilderState.prototype, "blocks");
type("number")(BuilderState.prototype, "worldWidth");
type("number")(BuilderState.prototype, "worldHeight");

const BUILDER_TICK_RATE = 20;
const TILE_SIZE = 32;
const MAP_WIDTH = 320;
const MAP_HEIGHT = 120;
const BUILDER_JUMP_BUFFER_TICKS = 6; // ~120ms at 50Hz

const BLOCK = {
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  GLASS: 5,
  BRICK: 6,
  SAND: 7,
  SNOW: 8,
  LEAVES: 9,
  COAL: 10,
  IRON: 11
};

const CRAFTING_RECIPES = {
  glass: { needs: { [BLOCK.SAND]: 2 }, gives: { type: BLOCK.GLASS, amount: 1 } },
  brick: { needs: { [BLOCK.STONE]: 2, [BLOCK.DIRT]: 1 }, gives: { type: BLOCK.BRICK, amount: 1 } },
  wood: { needs: { [BLOCK.LEAVES]: 2 }, gives: { type: BLOCK.WOOD, amount: 1 } },
  stone: { needs: { [BLOCK.DIRT]: 2 }, gives: { type: BLOCK.STONE, amount: 1 } }
};

function addInventory(player, typeId, amount) {
  const key = String(typeId);
  const current = player.inventory.get(key) || 0;
  player.inventory.set(key, current + amount);
}

function hasInventory(player, typeId, amount) {
  return (player.inventory.get(String(typeId)) || 0) >= amount;
}

function removeInventory(player, typeId, amount) {
  const key = String(typeId);
  const current = player.inventory.get(key) || 0;
  const next = Math.max(0, current - amount);
  player.inventory.set(key, next);
}

function maybeAddToHotbar(player, typeId) {
  for (let i = 0; i < player.hotbar.length; i++) {
    if (player.hotbar[i] === typeId) return;
    if (player.hotbar[i] === 0) {
      player.hotbar[i] = typeId;
      return;
    }
  }
}

function generateBuilderTerrain(state) {
  const biomeStrip = [];
  let cursor = 0;
  while (cursor < MAP_WIDTH) {
    const len = 24 + Math.floor(Math.random() * 26);
    const biomeRoll = Math.random();
    const biome = biomeRoll < 0.25 ? "plains" : biomeRoll < 0.5 ? "forest" : biomeRoll < 0.72 ? "desert" : biomeRoll < 0.88 ? "mountains" : "snow";
    const end = Math.min(MAP_WIDTH, cursor + len);
    for (let x = cursor; x < end; x++) biomeStrip[x] = biome;
    cursor = end;
  }

  let height = Math.floor(MAP_HEIGHT * 0.4);
  for (let x = 0; x < MAP_WIDTH; x++) {
    const biome = biomeStrip[x];
    const driftScale = biome === "mountains" ? 2 : 1;
    height += Math.floor((Math.random() * 3 - 1) * driftScale);
    const minHeight = biome === "mountains" ? Math.floor(MAP_HEIGHT * 0.24) : Math.floor(MAP_HEIGHT * 0.32);
    const maxHeight = biome === "mountains" ? Math.floor(MAP_HEIGHT * 0.55) : Math.floor(MAP_HEIGHT * 0.48);
    height = Math.max(minHeight, Math.min(maxHeight, height));

    for (let y = height; y < MAP_HEIGHT; y++) {
      const b = new Block();
      b.x = x;
      b.y = y;
      if (y === height) {
        b.type = biome === "desert" ? BLOCK.SAND : biome === "snow" ? BLOCK.SNOW : BLOCK.GRASS;
      } else if (y < height + 4) {
        b.type = biome === "desert" ? BLOCK.SAND : BLOCK.DIRT;
      } else {
        b.type = BLOCK.STONE;
      }
      state.blocks.set(`${x},${y}`, b);
    }

    const canTree = (biome === "forest" || biome === "plains" || biome === "snow") && Math.random() < (biome === "forest" ? 0.25 : 0.09);
    if (canTree && height > 6) {
      const trunk = 3 + Math.floor(Math.random() * 3);
      for (let t = 1; t <= trunk; t++) {
        const wood = new Block();
        wood.x = x;
        wood.y = height - t;
        wood.type = BLOCK.WOOD;
        state.blocks.set(`${wood.x},${wood.y}`, wood);
      }
      for (let lx = x - 2; lx <= x + 2; lx++) {
        for (let ly = height - trunk - 2; ly <= height - trunk; ly++) {
          if (lx < 1 || lx >= MAP_WIDTH - 1 || ly < 1) continue;
          if (Math.abs(lx - x) + Math.abs(ly - (height - trunk - 1)) > 3) continue;
          const leaves = new Block();
          leaves.x = lx;
          leaves.y = ly;
          leaves.type = biome === "snow" ? BLOCK.SNOW : BLOCK.LEAVES;
          state.blocks.set(`${leaves.x},${leaves.y}`, leaves);
        }
      }
    }
  }

  const caveCount = Math.floor(MAP_WIDTH / 10);
  for (let i = 0; i < caveCount; i++) {
    const centerX = 8 + Math.floor(Math.random() * (MAP_WIDTH - 16));
    const centerY = Math.floor(MAP_HEIGHT * 0.45) + Math.floor(Math.random() * Math.floor(MAP_HEIGHT * 0.45));
    const radiusX = 3 + Math.floor(Math.random() * 8);
    const radiusY = 2 + Math.floor(Math.random() * 5);
    for (let x = centerX - radiusX; x <= centerX + radiusX; x++) {
      for (let y = centerY - radiusY; y <= centerY + radiusY; y++) {
        if (x < 1 || x >= MAP_WIDTH - 1 || y < 2 || y >= MAP_HEIGHT - 1) continue;
        const nx = (x - centerX) / radiusX;
        const ny = (y - centerY) / radiusY;
        if ((nx * nx + ny * ny) <= 1 && Math.random() > 0.15) {
          state.blocks.delete(`${x},${y}`);
        }
      }
    }
  }

  state.blocks.forEach(block => {
    if (block.type !== BLOCK.STONE) return;
    const roll = Math.random();
    if (roll < 0.02) block.type = BLOCK.IRON;
    else if (roll < 0.06) block.type = BLOCK.COAL;
  });
}

class BuilderRoom extends colyseus.Room {
  onCreate(options) {
    this.maxClients = 50;
    this.autoDispose = false;

    const state = new BuilderState();

    state.worldWidth = MAP_WIDTH;
    state.worldHeight = MAP_HEIGHT;
    generateBuilderTerrain(state);

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
      if (!p) return;
      const x = Math.floor(message.x / TILE_SIZE);
      const y = Math.floor(message.y / TILE_SIZE);
      const blockType = Number(message.type) || BLOCK.STONE;

      if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
        const key = `${x},${y}`;
        // Check if block already exists
        if (!this.state.blocks.get(key) && hasInventory(p, blockType, 1)) {
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
                b.type = blockType;
                this.state.blocks.set(key, b);
                removeInventory(p, blockType, 1);
            }
        }
      }
    });

    this.onMessage("break", (client, message) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const x = Math.floor(message.x / TILE_SIZE);
      const y = Math.floor(message.y / TILE_SIZE);
      const key = `${x},${y}`;
      const block = this.state.blocks.get(key);
      if (block) {
          this.state.blocks.delete(key);
          addInventory(p, block.type, 1);
          maybeAddToHotbar(p, block.type);
      }
    });

    this.onMessage("craft", (client, message) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const recipe = CRAFTING_RECIPES[message.recipeId];
      if (!recipe) return;

      for (const [typeId, amount] of Object.entries(recipe.needs)) {
        if (!hasInventory(p, Number(typeId), amount)) return;
      }
      for (const [typeId, amount] of Object.entries(recipe.needs)) {
        removeInventory(p, Number(typeId), amount);
      }
      addInventory(p, recipe.gives.type, recipe.gives.amount);
      maybeAddToHotbar(p, recipe.gives.type);
    });

    this.setSimulationInterval(() => this.simulateTick(), BUILDER_TICK_RATE);
  }

  onJoin(client, options) {
    const p = new BuilderPlayer();
    p.id = client.sessionId;
    p.name = options.name || "Builder";
    p.x = Math.random() * (MAP_WIDTH * TILE_SIZE - TILE_SIZE);
    p.y = 100;
    p.vx = 0;
    p.vy = 0;
    p.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
    p.inventory = new MapSchema();
    p.hotbar = new ArraySchema(BLOCK.STONE, BLOCK.DIRT, BLOCK.GRASS, BLOCK.WOOD, BLOCK.SAND, BLOCK.SNOW, BLOCK.BRICK, BLOCK.GLASS, BLOCK.LEAVES);
    addInventory(p, BLOCK.STONE, 64);
    addInventory(p, BLOCK.DIRT, 64);
    addInventory(p, BLOCK.GRASS, 32);
    addInventory(p, BLOCK.WOOD, 16);
    addInventory(p, BLOCK.SAND, 24);
    addInventory(p, BLOCK.LEAVES, 16);
    this.state.players.set(client.sessionId, p);

    this.inputs[client.sessionId] = { left: false, right: false, jumpBuffer: 0 };
  }

  onLeave(client, consented) {
    this.state.players.delete(client.sessionId);
    delete this.inputs[client.sessionId];
  }

  isSolid(x, y) {
      if (x < 0 || x >= MAP_WIDTH) return true; // keep horizontal bounds solid
      if (y < 0) return true; // keep ceiling solid
      // Do not make the bottom solid, so players can fall off and respawn
      if (y >= MAP_HEIGHT) return false;
      return this.state.blocks.get(`${x},${y}`) !== undefined;
  }

  simulateTick() {
    this.state.players.forEach((p, sessionId) => {
        const inp = this.inputs[sessionId];
        if (!inp) return;
        const prevX = p.x;
        const prevY = p.y;

        if (inp.left) p.vx -= 1.5;
        if (inp.right) p.vx += 1.5;

        p.vx *= 0.8;
        p.vy += 0.8; // gravity
        p.vy *= 0.98;

        // Apply X velocity
        p.x += p.vx;

        // Bounds check X
        if (p.x < 0) { p.x = 0; p.vx = 0; }
        if (p.x > MAP_WIDTH * TILE_SIZE - TILE_SIZE) { p.x = MAP_WIDTH * TILE_SIZE - TILE_SIZE; p.vx = 0; }

        // Collision check X (swept, avoids slight clipping into tiles)
        let px1 = Math.floor(p.x / TILE_SIZE);
        let px2 = Math.floor((p.x + TILE_SIZE - 1) / TILE_SIZE);
        let py1 = Math.floor(p.y / TILE_SIZE);
        let py2 = Math.floor((p.y + TILE_SIZE - 1) / TILE_SIZE);

        if (p.vx > 0) {
            const prevPx2 = Math.floor((prevX + TILE_SIZE - 1) / TILE_SIZE);
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

        // Bounds check Y
        if (p.y > MAP_HEIGHT * TILE_SIZE) {
            // Respawn if they fall off
            p.y = 100;
            p.vy = 0;
        }

        // Collision check Y (swept, avoids slight sinking into tiles)
        px1 = Math.floor(p.x / TILE_SIZE);
        px2 = Math.floor((p.x + TILE_SIZE - 1) / TILE_SIZE);
        py1 = Math.floor(p.y / TILE_SIZE);
        py2 = Math.floor((p.y + TILE_SIZE - 1) / TILE_SIZE);

        let grounded = false;
        if (p.vy > 0) {
            const prevPy2 = Math.floor((prevY + TILE_SIZE - 1) / TILE_SIZE);
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

gameServer.listen(port);
console.log(`Colyseus game server is listening on port ${port}...`);
