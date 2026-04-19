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
// AGAR GAME LOGIC
// --------------------------------------------------------
class AgarFood extends Schema {}
type("string")(AgarFood.prototype, "id");
type("number")(AgarFood.prototype, "x");
type("number")(AgarFood.prototype, "y");
type("string")(AgarFood.prototype, "color");

class AgarPlayer extends Schema {}
type("string")(AgarPlayer.prototype, "id");
type("string")(AgarPlayer.prototype, "name");
type("number")(AgarPlayer.prototype, "x");
type("number")(AgarPlayer.prototype, "y");
type("number")(AgarPlayer.prototype, "radius");
type("string")(AgarPlayer.prototype, "color");
type("number")(AgarPlayer.prototype, "score");
type("boolean")(AgarPlayer.prototype, "isAlive");

class AgarCell extends Schema {}
type("string")(AgarCell.prototype, "id");
type("string")(AgarCell.prototype, "ownerId");
type("number")(AgarCell.prototype, "x");
type("number")(AgarCell.prototype, "y");
type("number")(AgarCell.prototype, "radius");
type("number")(AgarCell.prototype, "vx");
type("number")(AgarCell.prototype, "vy");
type("number")(AgarCell.prototype, "mergeAt");

class AgarState extends Schema {}
type({ map: AgarPlayer })(AgarState.prototype, "players");
type({ map: AgarFood })(AgarState.prototype, "foods");
type({ map: AgarCell })(AgarState.prototype, "cells");

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
// FNAF ROOM
// --------------------------------------------------------
const fnafServerDirectory = new Map();

class FnafPlayer extends Schema {}
type("number")(FnafPlayer.prototype, "x");
type("number")(FnafPlayer.prototype, "y");
type("number")(FnafPlayer.prototype, "rot");

class FnafAnimatronic extends Schema {}
type("number")(FnafAnimatronic.prototype, "x");
type("number")(FnafAnimatronic.prototype, "y");
type("string")(FnafAnimatronic.prototype, "type");

class FnafState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.animatronics = new MapSchema();
    this.power = 100;
    this.time = 0; // 0 = 12AM, 1 = 1AM, ..., 6 = 6AM
    this.doorLeft = false;
    this.doorRight = false;
    this.lightLeft = false;
    this.lightRight = false;
  }
}
type({ map: FnafPlayer })(FnafState.prototype, "players");
type({ map: FnafAnimatronic })(FnafState.prototype, "animatronics");
type("number")(FnafState.prototype, "power");
type("number")(FnafState.prototype, "time");
type("boolean")(FnafState.prototype, "doorLeft");
type("boolean")(FnafState.prototype, "doorRight");
type("boolean")(FnafState.prototype, "lightLeft");
type("boolean")(FnafState.prototype, "lightRight");

class FnafRoom extends colyseus.Room {
  onCreate(options) {
    this.maxClients = 8;
    this.autoDispose = true;
    this.serverName = (options && typeof options.serverName === "string" && options.serverName.trim())
      ? options.serverName.trim().slice(0, 24)
      : "Public FNAF World";
    this.setMetadata({ serverName: this.serverName });

    this.setState(new FnafState());

    // Initialize Animatronics
    const freddy = new FnafAnimatronic();
    freddy.x = 1.5; freddy.y = 1.5; freddy.type = "freddy";
    this.state.animatronics.set("freddy", freddy);

    const bonnie = new FnafAnimatronic();
    bonnie.x = 8.5; bonnie.y = 1.5; bonnie.type = "bonnie";
    this.state.animatronics.set("bonnie", bonnie);

    fnafServerDirectory.set(this.roomId, {
      roomId: this.roomId,
      serverName: this.serverName,
      clients: 0,
      maxClients: this.maxClients,
      createdAt: Date.now()
    });

    this.onMessage("move", (client, message) => {
      const p = this.state.players.get(client.sessionId);
      if (p) {
        p.x = message.x;
        p.y = message.y;
        p.rot = message.rot;
      }
    });

    this.onMessage("toggleAction", (client, message) => {
      if (message.action === "doorLeft") {
        this.state.doorLeft = !this.state.doorLeft;
      } else if (message.action === "doorRight") {
        this.state.doorRight = !this.state.doorRight;
      } else if (message.action === "lightLeft") {
        this.state.lightLeft = !this.state.lightLeft;
      } else if (message.action === "lightRight") {
        this.state.lightRight = !this.state.lightRight;
      }
    });

    this.tickCounter = 0;
    this.setSimulationInterval((deltaTime) => this.simulateTick(deltaTime), 1000); // run every 1s
  }

  simulateTick(deltaTime) {
    this.tickCounter++;

    // Time progression: 1 in-game hour every 60 real seconds (60 ticks)
    if (this.tickCounter % 60 === 0) {
      if (this.state.time < 6) {
        this.state.time++;
      }
    }

    // Power drain
    let drainRate = 0.1; // Base drain
    if (this.state.doorLeft) drainRate += 0.2;
    if (this.state.doorRight) drainRate += 0.2;
    if (this.state.lightLeft) drainRate += 0.1;
    if (this.state.lightRight) drainRate += 0.1;

    this.state.power = Math.max(0, this.state.power - drainRate);
    if (this.state.power === 0) {
       this.state.doorLeft = false;
       this.state.doorRight = false;
       this.state.lightLeft = false;
       this.state.lightRight = false;
    }

    // AI Movement (Very basic: slowly drift towards the office at ~5.5, 5.5)
    if (this.state.time > 0 && this.tickCounter % 5 === 0) { // Move every 5 seconds
      const officeX = 5.5;
      const officeY = 5.5;

      this.state.animatronics.forEach((anim) => {
         // Simple movement towards office
         let moveX = Math.sign(officeX - anim.x) * 0.5;
         let moveY = Math.sign(officeY - anim.y) * 0.5;

         // Basic boundary check to not go out of bounds (0-10)
         let nextX = Math.max(1, Math.min(9, anim.x + moveX));
         let nextY = Math.max(1, Math.min(9, anim.y + moveY));

         // Extremely simple door check: if they get near office doors (x=2 or x=7, y=5)
         if ((Math.abs(nextX - 2.5) < 1 && this.state.doorLeft) ||
             (Math.abs(nextX - 7.5) < 1 && this.state.doorRight)) {
            // Blocked by door
         } else {
            anim.x = nextX;
            anim.y = nextY;
         }
      });
    }
  }
  onJoin(client, options) {
    const p = new FnafPlayer();
    p.x = 2; // Default spawn
    p.y = 2;
    p.rot = 0;
    this.state.players.set(client.sessionId, p);

    const d = fnafServerDirectory.get(this.roomId);
    if (d) {
      d.clients = this.clients.length;
      fnafServerDirectory.set(this.roomId, d);
    }
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);

    const d = fnafServerDirectory.get(this.roomId);
    if (d) {
      d.clients = this.clients.length;
      fnafServerDirectory.set(this.roomId, d);
    }
  }

  onDispose() {
    fnafServerDirectory.delete(this.roomId);
  }
}

app.get("/fnaf_servers", (req, res) => {
  const active = Array.from(fnafServerDirectory.values())
    .sort((a, b) => b.clients - a.clients)
    .slice(0, 50);
  res.json(active);
});

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
type("number")(BuilderPlayer.prototype, "armorHp");
type("number")(BuilderPlayer.prototype, "maxArmorHp");
type("number")(BuilderPlayer.prototype, "armorType");
type("number")(BuilderPlayer.prototype, "selectedItemType");
type("boolean")(BuilderPlayer.prototype, "flightEnabled");
type("boolean")(BuilderPlayer.prototype, "creativeMode");
type("string")(BuilderPlayer.prototype, "sprite");


class BuilderVehicle extends Schema {}
type("string")(BuilderVehicle.prototype, "id");
type("number")(BuilderVehicle.prototype, "x");
type("number")(BuilderVehicle.prototype, "y");
type("number")(BuilderVehicle.prototype, "vx");
type("number")(BuilderVehicle.prototype, "vy");
type("number")(BuilderVehicle.prototype, "type");
type("string")(BuilderVehicle.prototype, "driverId");
type("number")(BuilderVehicle.prototype, "dir");

class BuilderBullet extends Schema {}
type("string")(BuilderBullet.prototype, "id");
type("string")(BuilderBullet.prototype, "ownerId");
type("number")(BuilderBullet.prototype, "x");
type("number")(BuilderBullet.prototype, "y");
type("number")(BuilderBullet.prototype, "vx");
type("number")(BuilderBullet.prototype, "vy");
type("number")(BuilderBullet.prototype, "damage");
type("number")(BuilderBullet.prototype, "healing");
type("number")(BuilderBullet.prototype, "life");

class Block extends Schema {}
type("number")(Block.prototype, "x");
type("number")(Block.prototype, "y");
type("number")(Block.prototype, "type");
type("number")(Block.prototype, "meta"); // Added for shapes/states

class ChestItem extends Schema {}
type("number")(ChestItem.prototype, "type");
type("number")(ChestItem.prototype, "count");

class ChestData extends Schema {
  constructor() {
    super();
    this.items = new MapSchema();
  }
}
type({ map: ChestItem })(ChestData.prototype, "items");

class FurnaceData extends Schema {}
type("number")(FurnaceData.prototype, "inputItem");
type("number")(FurnaceData.prototype, "inputCount");
type("number")(FurnaceData.prototype, "fuelItem");
type("number")(FurnaceData.prototype, "fuelCount");
type("number")(FurnaceData.prototype, "outputItem");
type("number")(FurnaceData.prototype, "outputCount");
type("number")(FurnaceData.prototype, "progress");

class Explosive extends Schema {}
type("number")(Explosive.prototype, "x");
type("number")(Explosive.prototype, "y");
type("number")(Explosive.prototype, "type");
type("number")(Explosive.prototype, "timer");

class ItemDrop extends Schema {}
type("string")(ItemDrop.prototype, "id");
type("number")(ItemDrop.prototype, "x");
type("number")(ItemDrop.prototype, "y");
type("number")(ItemDrop.prototype, "vx");
type("number")(ItemDrop.prototype, "vy");
type("number")(ItemDrop.prototype, "type");
type("number")(ItemDrop.prototype, "count");
type("string")(ItemDrop.prototype, "ownerId");
type("number")(ItemDrop.prototype, "noPickupBefore");

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
        this.bullets = new MapSchema();
        this.chests = new MapSchema();
        this.furnaces = new MapSchema();
        this.explosives = new MapSchema();
        this.vehicles = new MapSchema();
    }
}
type({ map: BuilderPlayer })(BuilderState.prototype, "players");
type({ map: Chunk })(BuilderState.prototype, "chunks");
type({ map: ItemDrop })(BuilderState.prototype, "drops");
type({ map: BuilderBullet })(BuilderState.prototype, "bullets");
type({ map: ChestData })(BuilderState.prototype, "chests");
type({ map: FurnaceData })(BuilderState.prototype, "furnaces");
type({ map: Explosive })(BuilderState.prototype, "explosives");
type({ map: BuilderVehicle })(BuilderState.prototype, "vehicles");

const BUILDER_TICK_RATE = 20;
const TILE_SIZE = 32;
const CHUNK_SIZE = 16;
const BUILDER_JUMP_BUFFER_TICKS = 6; // ~120ms at 50Hz

class BuilderRoom extends colyseus.Room {
  onCreate(options) {
    this.maxClients = 50;
    this.autoDispose = true;
    this.serverName = (options && typeof options.serverName === "string" && options.serverName.trim())
      ? options.serverName.trim().slice(0, 24)
      : "Public World";
    this.setMetadata({ serverName: this.serverName });
    this.worldSeed = Number.isFinite(options?.worldSeed)
      ? Math.trunc(options.worldSeed)
      : Math.floor(Math.random() * 2147483647);
    this.seedOffsetX = (this.worldSeed % 100000) * 0.001;
    this.seedOffsetY = (Math.floor(this.worldSeed / 100000) % 100000) * 0.001;

    const state = new BuilderState();
    this.setState(state);

    this.inputs = {};
    this.offlineChunks = new Map();
    this.tickCount = 0;

    this.onMessage("input", (client, message) => {
      const pId = client.sessionId;
      if (this.inputs[pId]) {
        this.inputs[pId].left = message.left;
        this.inputs[pId].right = message.right;
        this.inputs[pId].up = !!message.up;
        this.inputs[pId].down = !!message.down;
        this.inputs[pId].flight = !!message.flight;
        if (message.upPress) this.inputs[pId].jumpBuffer = BUILDER_JUMP_BUFFER_TICKS;
      }
    });

    this.onMessage("select_item", (client, message) => {
      const p = this.state.players.get(client.sessionId);
      if (p) {
        p.selectedItemType = message.type;
      }
    });

    this.onMessage("set_creative_mode", (client, message) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.creativeMode = !!message?.enabled;
      if (p.creativeMode) {
        p.hp = p.maxHp;
        p.armorHp = p.maxArmorHp;
      }
    });


    this.onMessage("interact_vehicle", (client, message) => {
        const pId = client.sessionId;
        const p = this.state.players.get(pId);
        if (!p || p.hp <= 0) return;

        if (message.action === "enter") {
            const vId = message.vehicleId;
            const vehicle = this.state.vehicles.get(vId);
            if (vehicle && !vehicle.driverId) {
                // Check distance
                const dist = Math.hypot(vehicle.x - p.x, vehicle.y - p.y);
                if (dist < TILE_SIZE * 4) {
                    vehicle.driverId = pId;
                }
            }
        } else if (message.action === "exit") {
            // Find any vehicle driven by this player
            this.state.vehicles.forEach((v) => {
                if (v.driverId === pId) {
                    v.driverId = "";
                    // Nudge player up slightly to avoid getting stuck inside
                    p.y -= TILE_SIZE;
                }
            });
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


      // Check for vehicle placement
      if (message.type === 66) { // Plane
          const v = new BuilderVehicle();
          v.id = Math.random().toString(36).substring(2, 9);
          v.x = message.x;
          v.y = message.y;
          v.vx = 0;
          v.vy = 0;
          v.type = 66;
          v.driverId = "";
          v.dir = 1;
          this.state.vehicles.set(v.id, v);
          client.send("consume");
          return;
      }

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

this.onMessage("interact", (client, message) => {
        const p = this.state.players.get(client.sessionId);
        if (!p || p.hp <= 0) return;

        const x = Math.floor(message.x / TILE_SIZE);
        const y = Math.floor(message.y / TILE_SIZE);
        const cx = Math.floor(x / CHUNK_SIZE);
        const cy = Math.floor(y / CHUNK_SIZE);

        const distSq = (p.x+TILE_SIZE/2 - message.x)**2 + (p.y+TILE_SIZE/2 - message.y)**2;
        if (distSq > (TILE_SIZE * 6)**2) return;

        // Right-clicking a live bomb (TNT / Nuke) defuses it and places the block back.
        let explosiveIdToDefuse = null;
        let explosiveToDefuse = null;
        this.state.explosives.forEach((exp, expId) => {
            if (explosiveIdToDefuse) return;
            const expTileX = Math.floor(exp.x / TILE_SIZE);
            const expTileY = Math.floor(exp.y / TILE_SIZE);
            if (expTileX === x && expTileY === y) {
                explosiveIdToDefuse = expId;
                explosiveToDefuse = exp;
            }
        });
        if (explosiveIdToDefuse && explosiveToDefuse) {
            const chunk = this.getOrCreateChunk(cx, cy);
            const blockKey = `${x},${y}`;
            if (!chunk.blocks.get(blockKey)) {
                const b = new Block();
                b.x = x;
                b.y = y;
                b.type = explosiveToDefuse.type;
                chunk.blocks.set(blockKey, b);
            }
            this.state.explosives.delete(explosiveIdToDefuse);
            return;
        }

        const chunk = this.state.chunks.get(`${cx},${cy}`);
        if (chunk) {
            const b = chunk.blocks.get(`${x},${y}`);
            if (b && (b.type === 33 || b.type === 34)) {
                // Ignite TNT (33) or Nuke (34)
                const explosive = new Explosive();
                explosive.x = x * TILE_SIZE + TILE_SIZE/2;
                explosive.y = y * TILE_SIZE + TILE_SIZE/2;
                explosive.type = b.type;
                explosive.timer = b.type === 34 ? 200 : 60; // Nuke takes longer
                this.state.explosives.set(`exp-${Date.now()}-${Math.random()}`, explosive);

                chunk.blocks.delete(`${x},${y}`);
            } else if (b && (b.type === 31 || b.type === 32)) {
                // Chest or Furnace
                const containerId = `${x},${y}`;
                if (b.type === 31 && !this.state.chests.has(containerId)) {
                    this.state.chests.set(containerId, new ChestData());
                } else if (b.type === 32 && !this.state.furnaces.has(containerId)) {
                    this.state.furnaces.set(containerId, new FurnaceData());
                }
            }
        }
    });

    this.onMessage("container_move", (client, message) => {
        const p = this.state.players.get(client.sessionId);
        if (!p || p.hp <= 0) return;

        const containerId = message.containerId; // "x,y"
        const chest = this.state.chests.get(containerId);
        if (!chest) return;
        if (!message?.item || !Number.isFinite(message.item.type) || !Number.isFinite(message.item.count)) return;
        if (message.item.count <= 0) return;
        const slotKey = message.slot?.toString?.();
        if (slotKey === undefined) return;
        const maxStack = 99;

        if (message.action === "put") {
            const currentItem = chest.items.get(slotKey);
            if (currentItem && currentItem.type === message.item.type) {
                currentItem.count = Math.min(maxStack, currentItem.count + message.item.count);
            } else if (!currentItem) {
                const newItem = new ChestItem();
                newItem.type = message.item.type;
                newItem.count = Math.min(maxStack, message.item.count);
                chest.items.set(slotKey, newItem);
            }
        } else if (message.action === "take") {
            const currentItem = chest.items.get(slotKey);
            if (currentItem && currentItem.type === message.item.type) {
                currentItem.count -= Math.min(currentItem.count, message.item.count);
                if (currentItem.count <= 0) {
                    chest.items.delete(slotKey);
                }
            }
        }
    });

    this.onMessage("furnace_sync", (client, message) => {
        const p = this.state.players.get(client.sessionId);
        if (!p || p.hp <= 0) return;

        const containerId = message.containerId;
        let furnace = this.state.furnaces.get(containerId);
        if (!furnace) {
            const [xStr, yStr] = (containerId || "").split(",");
            const x = Number.parseInt(xStr, 10);
            const y = Number.parseInt(yStr, 10);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            const cx = Math.floor(x / CHUNK_SIZE);
            const cy = Math.floor(y / CHUNK_SIZE);
            const chunk = this.state.chunks.get(`${cx},${cy}`);
            const block = chunk?.blocks.get(`${x},${y}`);
            if (!block || block.type !== 32) return;
            furnace = new FurnaceData();
            this.state.furnaces.set(containerId, furnace);
        }

        furnace.inputItem = message.inputItem || 0;
        furnace.inputCount = message.inputCount || 0;
        furnace.fuelItem = message.fuelItem || 0;
        furnace.fuelCount = message.fuelCount || 0;
        furnace.outputItem = message.outputItem || 0;
        furnace.outputCount = message.outputCount || 0;
    });

this.onMessage("hammer", (client, message) => {
        const p = this.state.players.get(client.sessionId);
        if (!p || p.hp <= 0) return;
        if (p.selectedItemType !== 36) return; // Must be holding hammer

        const x = Math.floor(message.x / TILE_SIZE);
        const y = Math.floor(message.y / TILE_SIZE);
        const cx = Math.floor(x / CHUNK_SIZE);
        const cy = Math.floor(y / CHUNK_SIZE);

        const distSq = (p.x+TILE_SIZE/2 - message.x)**2 + (p.y+TILE_SIZE/2 - message.y)**2;
        if (distSq > (TILE_SIZE * 6)**2) return;

        const chunk = this.state.chunks.get(`${cx},${cy}`);
        if (chunk) {
            const b = chunk.blocks.get(`${x},${y}`);
            if (b) {
                if (b.type === 48 && !p.creativeMode) return; // Bedrock cannot be reshaped
                // Cycle meta: 0 (full) -> 1 (bottom slab) -> 2 (top slab) -> 3 (left slope) -> 4 (right slope)
                b.meta = ((b.meta || 0) + 1) % 5;
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
      const spawnDropAt = (type, count = 1) => {
          if (!type || count <= 0) return;
          const drop = new ItemDrop();
          drop.id = `drop-${Date.now()}-${Math.random()}`;
          drop.x = x * TILE_SIZE + TILE_SIZE / 2;
          drop.y = y * TILE_SIZE + TILE_SIZE / 2;
          drop.vx = (Math.random() - 0.5) * 4;
          drop.vy = -4 - Math.random() * 4;
          drop.type = type;
          drop.count = count;
          drop.ownerId = "";
          drop.noPickupBefore = Date.now() + 250;
          this.state.drops.set(drop.id, drop);
      };

      if (chunk) {
          const key = `${x},${y}`;
          const b = chunk.blocks.get(key);
          if (b) {
              if (b.type === 48 && !p.creativeMode) return; // Bedrock is unbreakable unless creative
              let dropType = b.type;
              if (b.type === 7 || b.type === 41) dropType = b.type; // Logs
              else if (b.type === 8 || b.type === 42) {
                  // Leaves have a chance to drop Sapling (29) or Apple (30)
                  const r = Math.random();
                  if (r < 0.05) dropType = 30; // 5% apple
                  else if (r < 0.15) dropType = 29; // 10% sapling
                  else dropType = b.type; // 85% leaf
              } else if (b.type === 31) {
                  const containerId = `${x},${y}`;
                  const chest = this.state.chests.get(containerId);
                  if (chest) {
                      chest.items.forEach((item) => spawnDropAt(item.type, item.count));
                      this.state.chests.delete(containerId);
                  }
              } else if (b.type === 32) {
                  const containerId = `${x},${y}`;
                  const furnace = this.state.furnaces.get(containerId);
                  if (furnace) {
                      if (furnace.inputItem && furnace.inputCount > 0) spawnDropAt(furnace.inputItem, furnace.inputCount);
                      if (furnace.fuelItem && furnace.fuelCount > 0) spawnDropAt(furnace.fuelItem, furnace.fuelCount);
                      if (furnace.outputItem && furnace.outputCount > 0) spawnDropAt(furnace.outputItem, furnace.outputCount);
                      this.state.furnaces.delete(containerId);
                  }
              }

              spawnDropAt(dropType, 1);

              chunk.blocks.delete(key);
          }
      }
    });


    this.onMessage("consume", (client, message) => {
        const p = this.state.players.get(client.sessionId);
        if (!p || p.hp <= 0) return;

        if (message.type === 30) { // Apple
            p.hp += 4;
            if (p.hp > p.maxHp) p.hp = p.maxHp;
        }
    });


    this.onMessage("pickup", (client, message) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0) return;

      const drop = this.state.drops.get(message.id);
      if (!drop) return;
      if (Date.now() < (drop.noPickupBefore || 0)) return;

      const dx = p.x + TILE_SIZE/2 - drop.x;
      const dy = p.y + TILE_SIZE/2 - drop.y;
      if (dx*dx + dy*dy < (TILE_SIZE * 2) ** 2) {
          this.state.drops.delete(drop.id);
          client.send("picked_up", { id: drop.id, type: drop.type, count: drop.count, x: drop.x, y: drop.y });
      }
    });

    this.onMessage("attack", (client, message) => {
      const attacker = this.state.players.get(client.sessionId);
      if (!attacker || attacker.hp <= 0) return;

      const target = this.state.players.get(message.targetId);
      if (!target || target.hp <= 0 || target.creativeMode) return;

      const dx = attacker.x - target.x;
      const dy = attacker.y - target.y;
      const distSq = dx*dx + dy*dy;

      // Melee range logic
      let attackRangeSq = (TILE_SIZE * 3) ** 2;
      let damage = message.damage || 1;
      let healing = 0;

      // If holding sword
      if (attacker.selectedItemType === 11) {
          attackRangeSq = (TILE_SIZE * 4) ** 2; // slightly longer range
          damage = 5; // more damage
      } else if (attacker.selectedItemType === 61) {
          attackRangeSq = (TILE_SIZE * 4) ** 2;
          damage = 0;
          healing = 3;
      }

      if (distSq < attackRangeSq) {
          if (healing > 0) {
              target.hp = Math.min(target.maxHp, target.hp + healing);
          } else {
              this.damagePlayer(target, damage, attacker.name);
          }
          target.vy = -6;
          target.vx = (target.x - attacker.x > 0 ? 1 : -1) * 8;
      }
    });

    this.onMessage("equip_armor", (client, message) => {
        const player = this.state.players.get(client.sessionId);
        if (!player || player.hp <= 0) return;

        player.armorType = message.type || 0;

        // Setup armor stats based on type
        // 18: Copper, 19: Iron, 20: Gold, 21: Diamond, 22: Uranium
        let maxArmor = 0;
        if (player.armorType === 18) maxArmor = 5;
        else if (player.armorType === 19) maxArmor = 10;
        else if (player.armorType === 20) maxArmor = 15;
        else if (player.armorType === 21) maxArmor = 20;
        else if (player.armorType === 22) maxArmor = 30;
        else if (player.armorType === 62) maxArmor = 0;

        player.maxArmorHp = maxArmor;
        if (player.armorHp > maxArmor) {
            player.armorHp = maxArmor;
        }
    });

    this.onMessage("shoot", (client, message) => {
        const player = this.state.players.get(client.sessionId);
        if (!player || player.hp <= 0) return;

        // Ensure they have a gun selected
        const gunType = player.selectedItemType;
        if (![23, 24, 25, 26, 27, 63].includes(gunType)) return;

        const targetX = message.x;
        const targetY = message.y;

        const dx = targetX - (player.x + TILE_SIZE / 2);
        const dy = targetY - (player.y + TILE_SIZE / 2);
        const angle = Math.atan2(dy, dx);

        // Stats based on gun
        let speed = 15;
        let damage = 2;
        let healing = 0;
        let spread = 0;
        let projectiles = 1;

        if (gunType === 23) { speed = 15; damage = 2; }
        else if (gunType === 24) { speed = 20; damage = 3; }
        else if (gunType === 25) { speed = 20; damage = 4; projectiles = 3; spread = 0.2; } // Shotgun
        else if (gunType === 26) { speed = 30; damage = 5; } // Rifle
        else if (gunType === 27) { speed = 40; damage = 8; } // Laser
        else if (gunType === 63) { speed = 28; damage = 0; healing = 2; } // TariqCore Beam

        for (let i = 0; i < projectiles; i++) {
            const bulletId = Math.random().toString(36).substring(2, 9);
            const b = new BuilderBullet();
            b.id = bulletId;
            b.ownerId = client.sessionId;
            b.x = player.x + TILE_SIZE / 2;
            b.y = player.y + TILE_SIZE / 2;

            let finalAngle = angle;
            if (projectiles > 1) {
                finalAngle += (Math.random() - 0.5) * spread;
            }

            b.vx = Math.cos(finalAngle) * speed;
            b.vy = Math.sin(finalAngle) * speed;
            b.damage = damage;
            b.healing = healing;
            b.life = 40; // ticks

            this.state.bullets.set(bulletId, b);
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
            const tx = Number(message?.targetX);
            const ty = Number(message?.targetY);
            if (Number.isFinite(tx) && Number.isFinite(ty)) {
                const dx = tx - drop.x;
                const dy = ty - drop.y;
                const mag = Math.hypot(dx, dy) || 1;
                drop.vx = (dx / mag) * 8;
                drop.vy = (dy / mag) * 8 - 3;
            } else {
                drop.vx = (Math.random() - 0.5) * 8;
                drop.vy = -4 - Math.random() * 8;
            }
            drop.type = item.type;
            drop.count = item.count;
            drop.ownerId = client.sessionId;
            drop.noPickupBefore = Date.now() + 700;
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
        p.selectedItemType = 0;
    });

    this.onMessage("recall", (client) => {
        const p = this.state.players.get(client.sessionId);
        if (!p || p.hp <= 0) return;

        // Recall player to spawn (0, 0 area)
        const spawnX = Math.floor(Math.random() * 20) - 10;
        const noise = layeredNoise(spawnX, 0, 4, 0.5, 0.05);
        const spawnY = Math.floor(20 + noise * 15) - 2;
        p.x = spawnX * TILE_SIZE;
        p.y = spawnY * TILE_SIZE;
        p.vx = 0;
        p.vy = 0;
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
    p.armorHp = 0;
    p.maxArmorHp = 0;
    p.armorType = 0;
    p.selectedItemType = 0;
    p.flightEnabled = false;
    p.creativeMode = false;
    p.sprite = typeof options.sprite === "string" ? options.sprite.slice(0, 10000) : "";
    p.lastCx = -999;
    p.lastCy = -999;
    this.state.players.set(client.sessionId, p);

    this.inputs[client.sessionId] = { left: false, right: false, up: false, down: false, flight: false, jumpBuffer: 0 };
    this.syncServerDirectory();
  }

  onLeave(client, consented) {
    this.state.players.delete(client.sessionId);
    delete this.inputs[client.sessionId];
    if (this.clients.length === 0) {
      this.saveWorld();
    }
    this.syncServerDirectory();
  }

  damagePlayer(target, amount, killerName) {
      if (target.hp <= 0 || target.creativeMode) return;

      if (target.armorHp > 0) {
          if (amount >= target.armorHp) {
              amount -= target.armorHp;
              target.armorHp = 0;
          } else {
              target.armorHp -= amount;
              amount = 0;
          }
      }

      if (amount > 0) {
          target.hp -= amount;
      }

      if (target.hp <= 0) {
          const targetClient = this.clients.find(c => c.sessionId === target.id);
          if (targetClient) {
              targetClient.send("died", { killer: killerName });
          }
      }
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

      const data = { worldSeed: this.worldSeed, chunks: {}, chests: {}, furnaces: {} };
      this.state.chunks.forEach((chunk, key) => {
        data.chunks[key] = [];
        chunk.blocks.forEach((block) => {
          data.chunks[key].push({ x: block.x, y: block.y, type: block.type, meta: block.meta || 0 });
        });
      });
      this.offlineChunks.forEach((chunkData, key) => {
        data.chunks[key] = chunkData;
      });
      this.state.chests.forEach((chest, key) => {
        const items = {};
        chest.items.forEach((item, slot) => {
          items[slot] = { type: item.type, count: item.count };
        });
        data.chests[key] = items;
      });
      this.state.furnaces.forEach((furnace, key) => {
        data.furnaces[key] = {
            inputItem: furnace.inputItem, inputCount: furnace.inputCount,
            fuelItem: furnace.fuelItem, fuelCount: furnace.fuelCount,
            outputItem: furnace.outputItem, outputCount: furnace.outputCount,
            progress: furnace.progress
        };
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
        const rawData = JSON.parse(raw);
        const data = rawData.chunks ? rawData : { chunks: rawData, chests: {}, furnaces: {} }; // backcompat
        if (Number.isFinite(data.worldSeed)) {
          this.worldSeed = Math.trunc(data.worldSeed);
          this.seedOffsetX = (this.worldSeed % 100000) * 0.001;
          this.seedOffsetY = (Math.floor(this.worldSeed / 100000) % 100000) * 0.001;
        }

        for (const chunkKey in data.chunks) {
          this.offlineChunks.set(chunkKey, data.chunks[chunkKey]);
        }
        for (const chestKey in data.chests) {
            const chest = new ChestData();
            for (const slot in data.chests[chestKey]) {
                const itemData = data.chests[chestKey][slot];
                const item = new ChestItem();
                item.type = itemData.type;
                item.count = itemData.count;
                chest.items.set(slot, item);
            }
            this.state.chests.set(chestKey, chest);
        }
        for (const furnaceKey in data.furnaces) {
            const furnaceData = data.furnaces[furnaceKey];
            const furnace = new FurnaceData();
            furnace.inputItem = furnaceData.inputItem || 0;
            furnace.inputCount = furnaceData.inputCount || 0;
            furnace.fuelItem = furnaceData.fuelItem || 0;
            furnace.fuelCount = furnaceData.fuelCount || 0;
            furnace.outputItem = furnaceData.outputItem || 0;
            furnace.outputCount = furnaceData.outputCount || 0;
            furnace.progress = furnaceData.progress || 0;
            this.state.furnaces.set(furnaceKey, furnace);
        }
        console.log(`World loaded: ${filePath}`);
      }
    } catch (e) {
      console.error("Failed to load world", e);
    }
  }

  seededNoise(x, y, octaves, persistence, scale) {
    return layeredNoise(
      x + this.seedOffsetX,
      y + this.seedOffsetY,
      octaves,
      persistence,
      scale
    );
  }

  getSurfaceHeight(worldX) {
    // Add biome variation to surface height
    const baseNoise = this.seededNoise(worldX, 0, 4, 0.5, 0.05);
    const macroNoise = this.seededNoise(worldX, 1000, 2, 0.5, 0.01); // Hills vs flats
    return Math.floor(20 + baseNoise * 15 + macroNoise * 20);
  }

  getBiome(worldX) {
    const tempNoise = this.seededNoise(worldX, 5000, 2, 0.5, 0.005);
    const moistureNoise = this.seededNoise(worldX, 8000, 2, 0.5, 0.005);

    // tempNoise and moistureNoise roughly center around 0 (since they accumulate perlin which can be negative or positive, actually the custom layeredNoise returns 0 to 1 average... wait, let's just use simple thresholds on the return value)

    // Our layeredNoise implementation averages around 0 if it has negative values, or 0.5 if mapped.
    // Let's assume layeredNoise returns values roughly between -1 and 1
    if (tempNoise > 0.2) return "desert";
    if (tempNoise < -0.2) return "snow";
    return "forest";
  }

  generateChunk(cx, cy) {
    const key = `${cx},${cy}`;
    if (this.state.chunks.has(key)) return;

    const chunk = new Chunk();
    this.state.chunks.set(key, chunk); // Set early to avoid re-generation

    const minY = cy * CHUNK_SIZE;
    const maxY = (cy + 1) * CHUNK_SIZE;

    // 1. Generate Ground with Caves
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const worldX = cx * CHUNK_SIZE + x;
      const h = this.getSurfaceHeight(worldX);
      const biome = this.getBiome(worldX);

      const startY = Math.max(minY, h);
      const endY = Math.min(maxY, h + 200);

      for (let y = startY; y < endY; y++) {
        let isCave = false;
        if (y >= h + 25) {
            const caveNoise = this.seededNoise(worldX, y, 3, 0.5, 0.1);
            isCave = Math.abs(caveNoise) < 0.08;
        }

        if (!isCave) {
            const b = new Block();
            b.x = worldX;
            b.y = y;
            b.meta = 0;

            if (y === h) {
              if (biome === "desert") b.type = 38; // Sand
              else if (biome === "snow") b.type = 39; // Snow
              else b.type = 1; // Grass
            } else if (y < h + 4) {
              if (biome === "desert") b.type = 38; // Sand
              else if (biome === "snow") b.type = 2; // Dirt under snow
              else b.type = 2; // Dirt
            } else {
              b.type = 3; // Stone
              if (biome === "desert" && y < h + 10) b.type = 40; // Sandstone

              const depth = y - h;
              const rand = Math.abs(Math.sin(worldX * 12.345 + y * 67.890)) * 100;

              if (depth > 150 && rand < 0.5) b.type = 17; // Uranium
              else if (depth > 100 && rand < 1.5) b.type = 16; // Diamond
              else if (depth > 60 && rand < 3) b.type = 15; // Gold
              else if (depth > 40 && rand < 5) b.type = 14; // Iron
              else if (depth > 20 && rand < 7) b.type = 13; // Copper
              else if (depth > 5 && rand < 10) b.type = 12; // Coal
            }
            chunk.blocks.set(`${worldX},${y}`, b);
        }
      }
    }

    // 2. Deterministic Tree/Cactus Generation
    for (let tx = cx * CHUNK_SIZE - 2; tx < (cx + 1) * CHUNK_SIZE + 2; tx++) {
      const biome = this.getBiome(tx);
      const spawnChance = Math.abs(Math.sin(tx * 1234.56)) * 100;

      let threshold = 8;
      if (biome === "desert") threshold = 3; // fewer cacti

      if (spawnChance < threshold) {
        const surfaceY = this.getSurfaceHeight(tx);

        if (biome === "desert") {
            // Cactus
            const height = 2 + Math.floor(Math.abs(Math.cos(tx * 789.01)) * 3);
            for (let dy = 1; dy <= height; dy++) {
                const ty = surfaceY - dy;
                if (ty >= minY && ty < maxY && tx >= cx * CHUNK_SIZE && tx < (cx + 1) * CHUNK_SIZE) {
                    const b = new Block();
                    b.x = tx;
                    b.y = ty;
                    b.type = 37; // Cactus
                    b.meta = 0;
                    chunk.blocks.set(`${tx},${ty}`, b);
                }
            }
        } else {
            // Trees
            const trunkHeight = 4 + Math.floor(Math.abs(Math.cos(tx * 789.01)) * 3);
            for (let dy = 1; dy <= trunkHeight; dy++) {
              const ty = surfaceY - dy;
              if (ty >= minY && ty < maxY && tx >= cx * CHUNK_SIZE && tx < (cx + 1) * CHUNK_SIZE) {
                const b = new Block();
                b.x = tx;
                b.y = ty;
                b.type = (biome === "snow") ? 41 : 7; // Pine log or regular log
                b.meta = 0;
                chunk.blocks.set(`${tx},${ty}`, b);
              }
            }
            for (let lx = -2; lx <= 2; lx++) {
              for (let ly = -2; ly <= 2; ly++) {
                if (Math.abs(lx) + Math.abs(ly) > 3) continue;
                const finalLx = tx + lx;
                const finalLy = surfaceY - trunkHeight - 2 + ly;
                if (
                  finalLx >= cx * CHUNK_SIZE && finalLx < (cx + 1) * CHUNK_SIZE &&
                  finalLy >= minY && finalLy < maxY
                ) {
                  const key = `${finalLx},${finalLy}`;
                  if (!chunk.blocks.has(key)) {
                    const b = new Block();
                    b.x = finalLx;
                    b.y = finalLy;
                    b.type = (biome === "snow") ? 42 : 8; // Pine Leaves or Regular Leaves
                    b.meta = 0;
                    chunk.blocks.set(key, b);
                  }
                }
              }
            }
        }
      }
    }

    // 3. Tariq Heaven biome strip at top of the world (~500 blocks up)
    this.generateTariqHeavenBiome(chunk, cx, minY, maxY);

    // 4. Landmark near x=6900
    this.generateTwinToursMonument(chunk, cx, minY, maxY);
  }

  generateTariqHeavenBiome(chunk, cx, minY, maxY) {
    const skyBandCenter = -500;
    if (maxY < skyBandCenter - 44 || minY > skyBandCenter + 44) return;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      const worldX = cx * CHUNK_SIZE + x;
      const islandBaseY = skyBandCenter + Math.floor(this.seededNoise(worldX, 2200, 2, 0.5, 0.03) * 8);
      const islandChance = Math.abs(Math.sin(worldX * 0.095)) < 0.2;
      if (!islandChance) continue;

      const halfWidth = 5 + Math.floor(Math.abs(Math.sin(worldX * 0.31)) * 6);
      const coreDepth = 3 + Math.floor(Math.abs(Math.cos(worldX * 0.57)) * 4);

      for (let ix = -halfWidth; ix <= halfWidth; ix++) {
        const iX = worldX + ix;
        const distanceNorm = Math.abs(ix) / Math.max(1, halfWidth);
        const roundness = 1 - (distanceNorm * distanceNorm);
        const topY = islandBaseY + Math.floor((1 - roundness) * 2);
        const localDepth = Math.max(2, Math.floor(coreDepth * (0.55 + roundness * 0.6)));
        for (let dy = 0; dy < coreDepth; dy++) {
          if (dy >= localDepth) continue;
          const y = topY + dy;
          if (y < minY || y >= maxY || iX < cx * CHUNK_SIZE || iX >= (cx + 1) * CHUNK_SIZE) continue;
          const b = new Block();
          b.x = iX;
          b.y = y;
          b.meta = 0;
          b.type = 64; // cloud platform ground
          if (dy > 1 && Math.abs(Math.sin(iX * 19.13 + y * 7.71)) < 0.05) b.type = 60; // TariqCore
          chunk.blocks.set(`${iX},${y}`, b);
        }
      }

      // tree: ladder logs + plank leaves
      if (Math.abs(Math.sin(worldX * 0.41)) < 0.06) {
        const trunkHeight = 4 + Math.floor(Math.abs(Math.cos(worldX * 0.73)) * 3);
        for (let dy = 1; dy <= trunkHeight; dy++) {
          const ty = islandBaseY - dy;
          if (ty >= minY && ty < maxY) {
            const b = new Block();
            b.x = worldX;
            b.y = ty;
            b.type = 35;
            b.meta = 0;
            chunk.blocks.set(`${worldX},${ty}`, b);
          }
        }
        for (let lx = -2; lx <= 2; lx++) {
          for (let ly = -2; ly <= 2; ly++) {
            if (Math.abs(lx) + Math.abs(ly) > 3) continue;
            const tx = worldX + lx;
            const ty = islandBaseY - trunkHeight - 1 + ly;
            if (tx >= cx * CHUNK_SIZE && tx < (cx + 1) * CHUNK_SIZE && ty >= minY && ty < maxY) {
              const key = `${tx},${ty}`;
              if (!chunk.blocks.has(key)) {
                const b = new Block();
                b.x = tx;
                b.y = ty;
                b.type = 9;
                b.meta = 0;
                chunk.blocks.set(key, b);
              }
            }
          }
        }
      }
    }
  }

  generateTwinToursMonument(chunk, cx, minY, maxY) {
    const monumentX = 6900;
    const surfaceY = this.getSurfaceHeight(monumentX);
    const plazaY = surfaceY - 1;
    const towerHeight = 400;
    const towerWidth = 14;
    const towerGap = 18;

    const leftTowerStart = monumentX - towerGap / 2 - towerWidth;
    const rightTowerStart = monumentX + towerGap / 2;
    const minX = leftTowerStart - 16;
    const maxX = rightTowerStart + towerWidth + 16;
    const topY = plazaY - towerHeight - 26;
    const bottomY = plazaY + 24;

    const chunkMinX = cx * CHUNK_SIZE;
    const chunkMaxX = (cx + 1) * CHUNK_SIZE - 1;
    if (chunkMaxX < minX || chunkMinX > maxX || maxY < topY || minY > bottomY) return;

    const setBlock = (x, y, type) => {
      if (x < chunkMinX || x > chunkMaxX || y < minY || y >= maxY) return;
      const b = new Block();
      b.x = x;
      b.y = y;
      b.type = type;
      b.meta = 0;
      chunk.blocks.set(`${x},${y}`, b);
    };

    const clearBlock = (x, y) => {
      if (x < chunkMinX || x > chunkMaxX || y < minY || y >= maxY) return;
      chunk.blocks.delete(`${x},${y}`);
    };

    // Stone plaza.
    for (let x = minX; x <= maxX; x++) {
      for (let y = plazaY; y <= plazaY + 2; y++) setBlock(x, y, 3);
    }

    const buildFoundation = (startX) => {
      const endX = startX + towerWidth - 1;
      for (let x = startX - 2; x <= endX + 2; x++) {
        for (let y = plazaY + 3; y <= plazaY + 14; y++) setBlock(x, y, 3);
      }
      for (let x = startX; x <= endX; x++) {
        for (let y = plazaY + 15; y <= plazaY + 22; y++) setBlock(x, y, 3);
      }
    };

    const buildSkyBridge = (fromX, toX, y) => {
      for (let x = fromX; x <= toX; x++) {
        setBlock(x, y, 3);
        setBlock(x, y - 1, 3);
        if (x === fromX || x === toX) {
          setBlock(x, y - 2, 3);
          setBlock(x, y - 3, 3);
        }
      }
    };

    const buildTower = (startX) => {
      const endX = startX + towerWidth - 1;
      const topMainY = plazaY - towerHeight;
      for (let x = startX; x <= endX; x++) {
        for (let y = topMainY; y <= plazaY; y++) {
          const edge = x === startX || x === endX || y === topMainY || y === plazaY;
          if (edge) {
            const floorBand = y % 24 === 0;
            const corner = (x === startX || x === endX) && (y % 8 < 2);
            setBlock(x, y, (floorBand || corner) ? 14 : 3);
          } else {
            clearBlock(x, y);
          }
        }
      }

      // vertical ribs
      for (let ribX = startX + 2; ribX <= endX - 2; ribX += 3) {
        for (let y = topMainY + 4; y <= plazaY - 2; y++) {
          if (y % 6 < 2) setBlock(ribX, y, 7);
        }
      }

      // window cutouts every 18 blocks
      for (let y = plazaY - 12; y >= topMainY + 20; y -= 18) {
        for (let wx = startX + 3; wx <= endX - 3; wx++) {
          clearBlock(wx, y);
          clearBlock(wx, y - 1);
        }
        clearBlock(startX, y);
        clearBlock(endX, y);
      }

      // stepped spire
      let layerInset = 0;
      for (let y = topMainY - 1; y >= topMainY - 24; y--) {
        if ((topMainY - y) % 6 === 0 && layerInset < Math.floor(towerWidth / 2) - 1) layerInset++;
        for (let x = startX + layerInset; x <= endX - layerInset; x++) {
          setBlock(x, y, (x === startX + layerInset || x === endX - layerInset || y === topMainY - 24) ? 14 : 3);
        }
      }
    };

    buildFoundation(leftTowerStart);
    buildFoundation(rightTowerStart);
    buildTower(leftTowerStart);
    buildTower(rightTowerStart);

    // dual skybridges linking towers.
    for (let x = leftTowerStart + towerWidth; x < rightTowerStart; x++) {
      for (let y = plazaY - 18; y <= plazaY - 16; y++) setBlock(x, y, 3);
    }
    buildSkyBridge(leftTowerStart + towerWidth - 2, rightTowerStart + 1, plazaY - 128);
    buildSkyBridge(leftTowerStart + towerWidth - 2, rightTowerStart + 1, plazaY - 286);
  }

  getOrCreateChunk(cx, cy) {
    const key = `${cx},${cy}`;
    let chunk = this.state.chunks.get(key);
    if (!chunk) {
      if (this.offlineChunks.has(key)) {
        // Load from offline
        const chunkData = this.offlineChunks.get(key);
        chunk = new Chunk();
        chunkData.forEach(bData => {
          const b = new Block();
          b.x = bData.x;
          b.y = bData.y;
          b.type = bData.type;
          b.meta = bData.meta || 0;
          chunk.blocks.set(`${b.x},${b.y}`, b);
        });
        this.state.chunks.set(key, chunk);
        this.offlineChunks.delete(key);
      } else {
        // Generate new
        this.generateChunk(cx, cy);
        chunk = this.state.chunks.get(key);
      }
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
      const b = chunk.blocks.get(`${x},${y}`);
      if (!b) return false;
      if (b.type === 35) return false; // Ladder is pass-through
      if (b.type === 64) return false; // Cloud platforms are one-way
      return true;
  }

  getBlockType(x, y) {
      const cx = Math.floor(x / CHUNK_SIZE);
      const cy = Math.floor(y / CHUNK_SIZE);
      const chunk = this.state.chunks.get(`${cx},${cy}`);
      if (!chunk) return 0;
      const b = chunk.blocks.get(`${x},${y}`);
      return b ? b.type : 0;
  }

  simulateTick() {
    this.tickCount++;
    if (this.tickCount % 100 === 0) {
      // Unload distant chunks
      const activeChunkKeys = new Set();
      this.state.players.forEach((p) => {
        const pCx = Math.floor(p.x / (TILE_SIZE * CHUNK_SIZE));
        const pCy = Math.floor(p.y / (TILE_SIZE * CHUNK_SIZE));
        for (let cx = pCx - 3; cx <= pCx + 3; cx++) {
          for (let cy = pCy - 3; cy <= pCy + 3; cy++) {
            activeChunkKeys.add(`${cx},${cy}`);
          }
        }
      });

      this.state.chunks.forEach((chunk, key) => {
        if (!activeChunkKeys.has(key)) {
          // Serialize and unload
          const chunkData = [];
          chunk.blocks.forEach((block) => {
            chunkData.push({ x: block.x, y: block.y, type: block.type, meta: block.meta || 0 });
          });
          this.offlineChunks.set(key, chunkData);
          this.state.chunks.delete(key);
        }
      });
    }

    // Bullet simulation
    // Tree growth (saplings)
    if (Math.random() < 0.05) { // Occasional check
        this.state.chunks.forEach((chunk, chunkKey) => {
            const [cxStr, cyStr] = chunkKey.split(',');
            const cx = parseInt(cxStr);
            const cy = parseInt(cyStr);
            chunk.blocks.forEach((block, blockKey) => {
                if (block.type === 29 && Math.random() < 0.01) { // Sapling
                    // Grow tree!
                    const tx = block.x;
                    const ty = block.y;
                    const trunkHeight = 4 + Math.floor(Math.random() * 3);

                    // Remove sapling
                    chunk.blocks.delete(blockKey);

                    // Place trunk
                    for (let dy = 0; dy < trunkHeight; dy++) {
                        const newY = ty - dy;
                        const key = `${tx},${newY}`;
                        const b = new Block();
                        b.x = tx; b.y = newY; b.type = 7; b.meta = 0;
                        chunk.blocks.set(key, b);
                    }

                    // Place leaves
                    for (let lx = -2; lx <= 2; lx++) {
                        for (let ly = -2; ly <= 2; ly++) {
                            if (Math.abs(lx) + Math.abs(ly) > 3) continue;
                            const finalLx = tx + lx;
                            const finalLy = ty - trunkHeight + 1 + ly;
                            const key = `${finalLx},${finalLy}`;
                            if (!chunk.blocks.has(key)) {
                                const b = new Block();
                                b.x = finalLx; b.y = finalLy; b.type = 8; b.meta = 0;
                                chunk.blocks.set(key, b);
                            }
                        }
                    }
                }
            });
        });
    }


    // Furnace Smelting Logic
    const furnaceOutputByInput = new Map([
        [13, 43],
        [14, 44],
        [15, 45],
        [16, 46],
        [17, 47],
    ]);
    const furnaceFuelTypes = new Set([12, 7, 9]); // coal, log, planks
    const furnaceProgressPerSmelt = 100;
    const furnaceOutputMaxStack = 99;

    this.state.furnaces.forEach((furnace) => {
        const outputType = furnaceOutputByInput.get(furnace.inputItem) || 0;
        const canUseFuel = furnaceFuelTypes.has(furnace.fuelItem);
        const hasWork = furnace.inputCount > 0 && furnace.fuelCount > 0 && outputType > 0 && canUseFuel;
        const outputCompatible = furnace.outputCount === 0 || furnace.outputItem === outputType;
        const outputHasSpace = furnace.outputCount < furnaceOutputMaxStack;
        if (!(hasWork && outputCompatible && outputHasSpace)) {
            furnace.progress = 0;
            return;
        }

        furnace.progress += 1;
        if (furnace.progress < furnaceProgressPerSmelt) return;
        furnace.progress = 0;

        const smeltingInputType = furnace.inputItem;
        const smeltingOutputType = furnaceOutputByInput.get(smeltingInputType) || 0;
        if (smeltingOutputType <= 0) return;

        furnace.inputCount = Math.max(0, furnace.inputCount - 1);
        if (furnace.inputCount === 0) furnace.inputItem = 0;

        furnace.fuelCount = Math.max(0, furnace.fuelCount - 1);
        if (furnace.fuelCount === 0) furnace.fuelItem = 0;

        if (furnace.outputCount === 0) {
            furnace.outputItem = smeltingOutputType;
            furnace.outputCount = 1;
            return;
        }
        furnace.outputCount = Math.min(furnaceOutputMaxStack, furnace.outputCount + 1);
    });

    this.state.bullets.forEach((b, id) => {
        b.x += b.vx;
        b.y += b.vy;
        b.life--;

        let hit = false;

        // Block collision
        const bx = Math.floor(b.x / TILE_SIZE);
        const by = Math.floor(b.y / TILE_SIZE);
        if (this.isSolid(bx, by)) {
            hit = true;
        }

        // Player collision
        if (!hit) {
            this.state.players.forEach((p, sessionId) => {
                if (hit || sessionId === b.ownerId || p.hp <= 0 || p.creativeMode) return;

                if (b.x >= p.x && b.x <= p.x + TILE_SIZE &&
                    b.y >= p.y && b.y <= p.y + TILE_SIZE) {

                    const owner = this.state.players.get(b.ownerId);
                    if (b.healing > 0) {
                        p.hp = Math.min(p.maxHp, p.hp + b.healing);
                    } else {
                        this.damagePlayer(p, b.damage, owner ? owner.name : "Unknown");
                    }

                    // Knockback
                    p.vx += b.vx * 0.5;
                    p.vy += b.vy * 0.5 - 2;
                    hit = true;
                }
            });
        }

        if (hit || b.life <= 0) {
            this.state.bullets.delete(id);
        }
    });

    // Vehicle movement
    this.state.vehicles.forEach((v, vId) => {
        if (v.driverId && this.inputs[v.driverId]) {
            const inp = this.inputs[v.driverId];
            if (v.type === 66) { // Plane logic
                if (inp.up) v.vy -= 2.5;
                if (inp.down) v.vy += 2.5;
                if (inp.left) v.vx -= 3.0;
                if (inp.right) v.vx += 3.0;
                v.vx *= 0.95;
                v.vy *= 0.95;
                if (inp.left) v.dir = -1;
                if (inp.right) v.dir = 1;
            }
        } else {
            // Gravity if no driver or not a plane
            v.vy += 0.8;
            v.vx *= 0.8;
            v.vy *= 0.98;
        }

        v.x += v.vx;
        v.y += v.vy;

        // Collision for vehicle
        const cx = Math.floor(v.x / (TILE_SIZE * CHUNK_SIZE));
        const cy = Math.floor(v.y / (TILE_SIZE * CHUNK_SIZE));
        const chunk = this.getOrCreateChunk(cx, cy);

        // Basic collision (bottom)
        const bx = Math.floor((v.x + TILE_SIZE / 2) / TILE_SIZE);
        const by = Math.floor((v.y + TILE_SIZE) / TILE_SIZE);
        if (this.isSolid(bx, by)) {
            v.y = by * TILE_SIZE - TILE_SIZE;
            v.vy = 0;
        }
    });

    this.state.players.forEach((p, sessionId) => {
        const inp = this.inputs[sessionId];
        if (!inp) return;

        // If player is in a vehicle, snap to it and skip normal movement
        let inVehicle = false;
        this.state.vehicles.forEach((v) => {
            if (v.driverId === sessionId) {
                p.x = v.x;
                p.y = v.y;
                p.vx = 0;
                p.vy = 0;
                inVehicle = true;
            }
        });
        if (inVehicle) return;

        const prevX = p.x;
        const prevY = p.y;

        // Armor Regen (1 hp per second roughly, since tick rate is 20)
        if (p.hp > 0 && p.armorHp < p.maxArmorHp && Math.random() < (1 / BUILDER_TICK_RATE)) {
            p.armorHp++;
        }
        if (p.hp > 0 && p.armorType === 62 && Math.random() < (2 / BUILDER_TICK_RATE)) {
            p.hp = Math.min(p.maxHp, p.hp + 1);
        }

const pCx = Math.floor(p.x / (TILE_SIZE * CHUNK_SIZE));
        const pCy = Math.floor(p.y / (TILE_SIZE * CHUNK_SIZE));

        // Only request new chunks if the player moved to a new chunk
        if (p.lastCx !== pCx || p.lastCy !== pCy) {
          for (let cx = pCx - 2; cx <= pCx + 2; cx++) {
            for (let cy = pCy - 2; cy <= pCy + 2; cy++) {
              this.getOrCreateChunk(cx, cy);
            }
          }
          p.lastCx = pCx;
          p.lastCy = pCy;
        }

        // Check for ladder
        const centerTx = Math.floor((p.x + TILE_SIZE/2) / TILE_SIZE);
        const centerTy = Math.floor((p.y + TILE_SIZE/2) / TILE_SIZE);
        let onLadder = false;
        const pChunk = this.state.chunks.get(`${Math.floor(centerTx/CHUNK_SIZE)},${Math.floor(centerTy/CHUNK_SIZE)}`);
        if (pChunk) {
            const b = pChunk.blocks.get(`${centerTx},${centerTy}`);
            if (b && b.type === 35) { // 35 = Ladder
                onLadder = true;
            }
        }

if (onLadder) {
            p.vx *= 0.7; // slower horizontal on ladder
            p.vy = 0; // nullify gravity
            if (inp.up) {
                p.vy = -3;
            } else if (inp.down) {
                p.vy = 3;
            }
        }

        p.flightEnabled = p.creativeMode || (p.armorType === 65 && !!inp.flight);

        if (inp.left) p.vx -= 1.5;
        if (inp.right) p.vx += 1.5;

        if (p.flightEnabled) {

                if (inp.up) p.vy -= 1.8;
            if (inp.down) p.vy += 1.8;
            p.vx *= 0.9;
            p.vy *= 0.9;
        } else {
            p.vx *= 0.8;
            if (!onLadder) {
                p.vy += 0.8; // gravity only if not on ladder
            }
            p.vy *= 0.98;
        }

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
        if (!p.creativeMode && p.y > 300 * TILE_SIZE) {
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
                const isCloudLeft = this.getBlockType(px1, ty) === 64;
                const isCloudRight = this.getBlockType(px2, ty) === 64;
                const cloudTopY = ty * TILE_SIZE;
                const wasAboveCloud = (prevY + TILE_SIZE) <= cloudTopY + 1;
                const cloudCollides = (isCloudLeft || isCloudRight) && wasAboveCloud;
                if (this.isSolid(px1, ty) || this.isSolid(px2, ty) || cloudCollides) {
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

        if (!onLadder && grounded && inp.jumpBuffer > 0) {
            p.vy = -12;
            inp.jumpBuffer = 0;
        } else if (!onLadder && inp.jumpBuffer > 0) {
            inp.jumpBuffer--;
        }
    });

// Explosives logic
    const explosivesToDelete = [];
    this.state.explosives.forEach((exp, id) => {
        exp.timer--;
        if (exp.timer <= 0) {
            // EXPLODE!
            const isNuke = exp.type === 34;
            const radius = isNuke ? (TILE_SIZE * 1000) : (TILE_SIZE * 5);
            const damage = isNuke ? 100 : 20;
            const chainFuse = isNuke ? 30 : 10;

            // Damage players
            this.state.players.forEach(p => {
                if (p.hp <= 0 || p.creativeMode) return;
                const dx = p.x + TILE_SIZE/2 - exp.x;
                const dy = p.y + TILE_SIZE/2 - exp.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < radius) {
                    this.damagePlayer(p, damage, isNuke ? "Nuke" : "TNT");
                    const knockback = (radius - dist) / radius * (isNuke ? 30 : 15);
                    p.vx += (dx / dist) * knockback;
                    p.vy += (dy / dist) * knockback - 5;
                }
            });

            // Chain-react with nearby live explosives instead of deleting them.
            this.state.explosives.forEach((otherExp, otherId) => {
                if (otherId === id) return;
                const dx = otherExp.x - exp.x;
                const dy = otherExp.y - exp.y;
                if (dx * dx + dy * dy > radius * radius) return;
                if (otherExp.timer > chainFuse) {
                    otherExp.timer = chainFuse;
                }
            });

            // Destroy blocks
            const blockRadius = Math.ceil(radius / TILE_SIZE);
            const expTx = Math.floor(exp.x / TILE_SIZE);
            const expTy = Math.floor(exp.y / TILE_SIZE);

            for (let dx = -blockRadius; dx <= blockRadius; dx++) {
                for (let dy = -blockRadius; dy <= blockRadius; dy++) {
                    if (dx*dx + dy*dy <= blockRadius*blockRadius) {
                        const tx = expTx + dx;
                        const ty = expTy + dy;
                        const cx = Math.floor(tx / CHUNK_SIZE);
                        const cy = Math.floor(ty / CHUNK_SIZE);
                        const chunk = this.state.chunks.get(`${cx},${cy}`);
                        if (chunk) {
                            const b = chunk.blocks.get(`${tx},${ty}`);
                            if (b) {
                                if (b.type === 48) continue; // Bedrock is blast-proof
                                if (b.type === 33 || b.type === 34) {
                                    // TNT / Nuke chain reaction: ignite instead of destroying.
                                    const explosive = new Explosive();
                                    explosive.x = tx * TILE_SIZE + TILE_SIZE / 2;
                                    explosive.y = ty * TILE_SIZE + TILE_SIZE / 2;
                                    explosive.type = b.type;
                                    explosive.timer = chainFuse;
                                    this.state.explosives.set(`exp-${Date.now()}-${Math.random()}`, explosive);
                                    chunk.blocks.delete(`${tx},${ty}`);
                                    continue;
                                }
                                // Destroy and maybe drop item
                                if (Math.random() < (isNuke ? 0.2 : 0.5)) {
                                    const drop = new ItemDrop();
                                    drop.id = `drop-${Date.now()}-${Math.random()}`;
                                    drop.x = tx * TILE_SIZE + TILE_SIZE / 2;
                                    drop.y = ty * TILE_SIZE + TILE_SIZE / 2;
                                    drop.vx = (Math.random() - 0.5) * 8;
                                    drop.vy = -4 - Math.random() * 8;
                                    drop.type = b.type;
                                    drop.count = 1;
                                    drop.ownerId = "";
                                    drop.noPickupBefore = Date.now() + 250;
                                    this.state.drops.set(drop.id, drop);
                                }
                                chunk.blocks.delete(`${tx},${ty}`);
                            }
                        }
                    }
                }
            }

            explosivesToDelete.push(id);
        }
    });
    explosivesToDelete.forEach(id => this.state.explosives.delete(id));

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

        if (drop.y > 300 * TILE_SIZE) {
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

gameServer.define("fnaf_room", FnafRoom);
gameServer.define("my_game_room", GameRoom);
gameServer.define("smash_arena", SmashArenaRoom);
gameServer.define("builder_room", BuilderRoom);

const AGAR_MAP_WIDTH = 4000;
const AGAR_MAP_HEIGHT = 4000;
const AGAR_MAX_FOOD = 500;
const AGAR_BASE_RADIUS = 20;
const AGAR_TICK_RATE = 20; // ms per tick
const AGAR_MAX_CELLS = 8;
const AGAR_SPLIT_MIN_RADIUS = 24;
const AGAR_SPLIT_LAUNCH_SPEED = 24;
const AGAR_MERGE_COOLDOWN_MS = 9000;

const agarServerDirectory = new Map();

class AgarRoom extends colyseus.Room {
  onCreate(options) {
    this.maxClients = 50;
    this.autoDispose = true;
    this.serverName = (options && typeof options.serverName === "string" && options.serverName.trim())
      ? options.serverName.trim().slice(0, 24)
      : "Public Agar World";
    this.setMetadata({ serverName: this.serverName });

    const state = new AgarState();
    state.players = new MapSchema();
    state.foods = new MapSchema();
    state.cells = new MapSchema();
    this.setState(state);

    this.inputs = {};
    this.foodCounter = 0;
    this.cellCounter = 0;

    // Initial food spawn
    for (let i = 0; i < AGAR_MAX_FOOD / 2; i++) {
      this.spawnFood();
    }

    this.onMessage("input", (client, message) => {
      const pId = client.sessionId;
      if (this.inputs[pId] && typeof message.targetX === "number" && typeof message.targetY === "number" && Number.isFinite(message.targetX) && Number.isFinite(message.targetY)) {
        this.inputs[pId].targetX = message.targetX;
        this.inputs[pId].targetY = message.targetY;
      }
    });

    this.onMessage("split", (client) => {
      const pId = client.sessionId;
      if (this.inputs[pId]) this.inputs[pId].splitRequested = true;
    });

    this.onMessage("respawn", (client) => {
      const pId = client.sessionId;
      const player = this.state.players.get(pId);
      if (player && !player.isAlive) {
        this.spawnPlayerCells(pId, player);
      }
    });

    this.setSimulationInterval(() => this.simulateTick(), AGAR_TICK_RATE);

    agarServerDirectory.set(this.roomId, {
      roomId: this.roomId,
      serverName: this.serverName,
      clients: this.clients.length,
      maxClients: this.maxClients
    });
  }

  spawnFood() {
    if (this.state.foods.size >= AGAR_MAX_FOOD) return;
    const food = new AgarFood();
    food.id = "food_" + this.foodCounter++;
    food.x = Math.random() * AGAR_MAP_WIDTH;
    food.y = Math.random() * AGAR_MAP_HEIGHT;
    const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff"];
    food.color = colors[Math.floor(Math.random() * colors.length)];
    this.state.foods.set(food.id, food);
  }

  createCell(ownerId, x, y, radius, vx = 0, vy = 0, mergeAt = Date.now() + AGAR_MERGE_COOLDOWN_MS) {
    const c = new AgarCell();
    c.id = `cell_${this.cellCounter++}`;
    c.ownerId = ownerId;
    c.x = x;
    c.y = y;
    c.radius = radius;
    c.vx = vx;
    c.vy = vy;
    c.mergeAt = mergeAt;
    this.state.cells.set(c.id, c);
    return c;
  }

  getPlayerCells(playerId) {
    const cells = [];
    this.state.cells.forEach((c) => {
      if (c.ownerId === playerId) cells.push(c);
    });
    return cells;
  }

  updatePlayerAggregate(playerId) {
    const player = this.state.players.get(playerId);
    if (!player) return;
    const cells = this.getPlayerCells(playerId);
    if (cells.length === 0) {
      player.isAlive = false;
      return;
    }
    let largest = cells[0];
    let area = 0;
    let weightedX = 0;
    let weightedY = 0;
    cells.forEach((c) => {
      const a = c.radius * c.radius;
      area += a;
      weightedX += c.x * a;
      weightedY += c.y * a;
      if (c.radius > largest.radius) largest = c;
    });
    player.x = weightedX / area;
    player.y = weightedY / area;
    player.radius = largest.radius;
    player.score = Math.floor(area);
    player.isAlive = true;
  }

  spawnPlayerCells(playerId, player) {
    const now = Date.now();
    const x = Math.random() * AGAR_MAP_WIDTH;
    const y = Math.random() * AGAR_MAP_HEIGHT;
    this.state.cells.forEach((cell, cellId) => {
      if (cell.ownerId === playerId) this.state.cells.delete(cellId);
    });
    this.createCell(playerId, x, y, AGAR_BASE_RADIUS, 0, 0, now + AGAR_MERGE_COOLDOWN_MS);
    player.x = x;
    player.y = y;
    player.radius = AGAR_BASE_RADIUS;
    player.score = AGAR_BASE_RADIUS * AGAR_BASE_RADIUS;
    player.isAlive = true;
    if (this.inputs[playerId]) {
      this.inputs[playerId].targetX = x;
      this.inputs[playerId].targetY = y;
      this.inputs[playerId].splitRequested = false;
    }
  }

  consumeFood(cell) {
    const foodsToRemove = [];
    this.state.foods.forEach((food, foodId) => {
      const dx = cell.x - food.x;
      const dy = cell.y - food.y;
      if ((dx * dx + dy * dy) < (cell.radius * cell.radius)) {
        foodsToRemove.push(foodId);
        cell.radius += 0.45;
      }
    });
    foodsToRemove.forEach((id) => this.state.foods.delete(id));
  }

  trySplitPlayer(playerId, input, now) {
    const owned = this.getPlayerCells(playerId);
    if (owned.length === 0 || owned.length >= AGAR_MAX_CELLS) return;
    const nextCells = [...owned].sort((a, b) => b.radius - a.radius);
    for (const cell of nextCells) {
      if (this.getPlayerCells(playerId).length >= AGAR_MAX_CELLS) break;
      if (cell.radius < AGAR_SPLIT_MIN_RADIUS) continue;
      const dx = (input.targetX ?? cell.x) - cell.x;
      const dy = (input.targetY ?? cell.y) - cell.y;
      const dist = Math.hypot(dx, dy) || 1;
      const dirX = dx / dist;
      const dirY = dy / dist;
      const newRadius = cell.radius / Math.sqrt(2);
      cell.radius = newRadius;
      const launchDist = newRadius * 2.2;
      this.createCell(
        playerId,
        Math.min(AGAR_MAP_WIDTH, Math.max(0, cell.x + dirX * launchDist)),
        Math.min(AGAR_MAP_HEIGHT, Math.max(0, cell.y + dirY * launchDist)),
        newRadius,
        dirX * AGAR_SPLIT_LAUNCH_SPEED,
        dirY * AGAR_SPLIT_LAUNCH_SPEED,
        now + AGAR_MERGE_COOLDOWN_MS
      );
      cell.mergeAt = now + AGAR_MERGE_COOLDOWN_MS;
    }
  }

  simulateTick() {
    const now = Date.now();
    // 1) split requests and movement
    this.state.players.forEach((player, id) => {
      if (!player.isAlive) return;
      const input = this.inputs[id] || {};
      if (input.splitRequested) {
        this.trySplitPlayer(id, input, now);
        input.splitRequested = false;
      }
      const owned = this.getPlayerCells(id);
      owned.forEach((cell) => {
        const targetX = input.targetX ?? cell.x;
        const targetY = input.targetY ?? cell.y;
        const dx = targetX - cell.x;
        const dy = targetY - cell.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist > 1) {
          const baseSpeed = Math.max(1.2, 12 - Math.log(Math.max(8, cell.radius)) * 2.5);
          cell.x += (dx / dist) * baseSpeed;
          cell.y += (dy / dist) * baseSpeed;
        }
        if (Math.abs(cell.vx) > 0.01 || Math.abs(cell.vy) > 0.01) {
          cell.x += cell.vx;
          cell.y += cell.vy;
          cell.vx *= 0.83;
          cell.vy *= 0.83;
        }
        if (cell.x < 0) { cell.x = 0; cell.vx = 0; }
        if (cell.y < 0) { cell.y = 0; cell.vy = 0; }
        if (cell.x > AGAR_MAP_WIDTH) { cell.x = AGAR_MAP_WIDTH; cell.vx = 0; }
        if (cell.y > AGAR_MAP_HEIGHT) { cell.y = AGAR_MAP_HEIGHT; cell.vy = 0; }
      });
    });

    // 2) food and cell-vs-cell collisions
    this.state.cells.forEach((cell) => this.consumeFood(cell));

    const deathBy = new Map();
    const cellEntries = Array.from(this.state.cells.entries());
    for (let i = 0; i < cellEntries.length; i++) {
      const [idA, a] = cellEntries[i];
      if (!this.state.cells.has(idA)) continue;
      for (let j = i + 1; j < cellEntries.length; j++) {
        const [idB, b] = cellEntries[j];
        if (!this.state.cells.has(idA) || !this.state.cells.has(idB)) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (a.ownerId === b.ownerId) {
          if (now >= a.mergeAt && now >= b.mergeAt && dist < Math.max(a.radius, b.radius)) {
            const larger = a.radius >= b.radius ? a : b;
            const smaller = larger === a ? b : a;
            larger.radius = Math.sqrt(larger.radius * larger.radius + smaller.radius * smaller.radius);
            this.state.cells.delete(smaller.id);
          }
          continue;
        }
        const bigger = a.radius >= b.radius ? a : b;
        const smaller = bigger === a ? b : a;
        if (bigger.radius > smaller.radius * 1.15 && dist < (bigger.radius - smaller.radius * 0.3)) {
          const killerName = this.state.players.get(bigger.ownerId)?.name || "another player";
          deathBy.set(smaller.ownerId, killerName);
          bigger.radius = Math.sqrt(bigger.radius * bigger.radius + smaller.radius * smaller.radius);
          this.state.cells.delete(smaller.id);
        }
      }
    }

    // 3) refresh player aggregates + death notices
    this.state.players.forEach((player, id) => {
      const wasAlive = player.isAlive;
      this.updatePlayerAggregate(id);
      if (wasAlive && !player.isAlive) {
        const loserClient = this.clients.find((c) => c.sessionId === id);
        if (loserClient) loserClient.send("died", { killer: deathBy.get(id) || "another player" });
      }
    });

    // 3. Replenish food occasionally
    if (Math.random() < 0.2) {
      this.spawnFood();
    }
  }

  onJoin(client, options) {
    const p = new AgarPlayer();
    p.id = client.sessionId;
    p.name = (options.name || "Anon").slice(0, 16);
    p.x = Math.random() * AGAR_MAP_WIDTH;
    p.y = Math.random() * AGAR_MAP_HEIGHT;
    p.radius = AGAR_BASE_RADIUS;
    p.color = "#" + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    p.score = AGAR_BASE_RADIUS * AGAR_BASE_RADIUS;
    p.isAlive = true;

    this.state.players.set(client.sessionId, p);
    this.inputs[client.sessionId] = { targetX: p.x, targetY: p.y, splitRequested: false };
    this.spawnPlayerCells(client.sessionId, p);

    this.updateMetadata();
  }

  onLeave(client, consented) {
    this.state.cells.forEach((cell, cellId) => {
      if (cell.ownerId === client.sessionId) this.state.cells.delete(cellId);
    });
    this.state.players.delete(client.sessionId);
    delete this.inputs[client.sessionId];
    this.updateMetadata();
  }

  updateMetadata() {
    const d = agarServerDirectory.get(this.roomId);
    if (d) {
      d.clients = this.clients.length;
      agarServerDirectory.set(this.roomId, d);
    }
  }

  onDispose() {
    agarServerDirectory.delete(this.roomId);
  }
}

gameServer.define("voice_room", VoiceRoom);

gameServer.define("agar_room", AgarRoom);

app.get("/agar-servers", (req, res) => {
  const servers = Array.from(agarServerDirectory.values()).sort((a, b) => {
    if (b.clients !== a.clients) return b.clients - a.clients;
    return a.serverName.localeCompare(b.serverName);
  });
  res.json({ servers });
});


app.get("/builder-servers", (req, res) => {
  const servers = Array.from(builderServerDirectory.values()).sort((a, b) => {
    if (b.clients !== a.clients) return b.clients - a.clients;
    return a.serverName.localeCompare(b.serverName);
  });
  res.json({ servers });
});

gameServer.listen(port);
console.log(`Colyseus game server is listening on port ${port}...`);
