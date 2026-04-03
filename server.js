const colyseus = require("colyseus");
const { WebSocketTransport } = require("@colyseus/ws-transport");
const { Schema, type, MapSchema } = require("@colyseus/schema");
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

const BUILDER_TICK_RATE = 20;
const TILE_SIZE = 32;
const MAP_WIDTH = 100;
const MAP_HEIGHT = 40;

class BuilderRoom extends colyseus.Room {
  onCreate(options) {
    this.maxClients = 50;
    this.autoDispose = false;

    const state = new BuilderState();

    // Generate initial terrain
    for (let x = 0; x < MAP_WIDTH; x++) {
      for (let y = MAP_HEIGHT - 5; y < MAP_HEIGHT; y++) {
        const b = new Block();
        b.x = x;
        b.y = y;
        b.type = y === MAP_HEIGHT - 5 ? 1 : 2; // 1: grass, 2: dirt
        state.blocks.set(`${x},${y}`, b);
      }
    }

    this.setState(state);

    this.inputs = {};

    this.onMessage("input", (client, message) => {
      const pId = client.sessionId;
      if (this.inputs[pId]) {
        this.inputs[pId].left = message.left;
        this.inputs[pId].right = message.right;
        if (message.upPress) this.inputs[pId].upPress = true;
      }
    });

    this.onMessage("build", (client, message) => {
      const x = Math.floor(message.x / TILE_SIZE);
      const y = Math.floor(message.y / TILE_SIZE);

      if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
        const key = `${x},${y}`;
        // Check if block already exists
        if (!this.state.blocks.get(key)) {
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
                this.state.blocks.set(key, b);
            }
        }
      }
    });

    this.onMessage("break", (client, message) => {
      const x = Math.floor(message.x / TILE_SIZE);
      const y = Math.floor(message.y / TILE_SIZE);
      const key = `${x},${y}`;
      if (this.state.blocks.get(key)) {
          this.state.blocks.delete(key);
      }
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
    this.state.players.set(client.sessionId, p);

    this.inputs[client.sessionId] = { left: false, right: false, upPress: false };
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

        // Collision check X
        let px1 = Math.floor(p.x / TILE_SIZE);
        let px2 = Math.floor((p.x + TILE_SIZE - 1) / TILE_SIZE);
        let py1 = Math.floor(p.y / TILE_SIZE);
        let py2 = Math.floor((p.y + TILE_SIZE - 1) / TILE_SIZE);

        if (p.vx > 0 && (this.isSolid(px2, py1) || this.isSolid(px2, py2))) {
            p.x = px2 * TILE_SIZE - TILE_SIZE;
            p.vx = 0;
        } else if (p.vx < 0 && (this.isSolid(px1, py1) || this.isSolid(px1, py2))) {
            p.x = (px1 + 1) * TILE_SIZE;
            p.vx = 0;
        }

        // Apply Y velocity
        p.y += p.vy;

        // Bounds check Y
        if (p.y > MAP_HEIGHT * TILE_SIZE) {
            // Respawn if they fall off
            p.y = 100;
            p.vy = 0;
        }

        // Collision check Y
        px1 = Math.floor(p.x / TILE_SIZE);
        px2 = Math.floor((p.x + TILE_SIZE - 1) / TILE_SIZE);
        py1 = Math.floor(p.y / TILE_SIZE);
        py2 = Math.floor((p.y + TILE_SIZE - 1) / TILE_SIZE);

        let grounded = false;
        if (p.vy > 0 && (this.isSolid(px1, py2) || this.isSolid(px2, py2))) {
            p.y = py2 * TILE_SIZE - TILE_SIZE;
            p.vy = 0;
            grounded = true;
        } else if (p.vy < 0 && (this.isSolid(px1, py1) || this.isSolid(px2, py1))) {
            p.y = (py1 + 1) * TILE_SIZE;
            p.vy = 0;
        }

        if (grounded && inp.upPress) {
            p.vy = -12;
        }

        inp.upPress = false;
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
