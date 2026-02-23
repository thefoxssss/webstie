// Core shared state + Firebase persistence for the arcade.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  query,
  orderBy,
  limit,
  where,
  addDoc,
  deleteDoc,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { LEADERBOARD_GAME_COLUMNS } from "./gameCatalog.js";

// Firebase project configuration.
const defaultFirebaseConfig = {
  apiKey: "AIzaSyAoXwDA6KtqSD4yfGprus8C8Mi_--1KwSw",
  authDomain: "funnys-18ff7.firebaseapp.com",
  projectId: "funnys-18ff7",
  storageBucket: "funnys-18ff7.firebasestorage.app",
  messagingSenderId: "368675604960",
  appId: "1:368675604960:web:24c5dcd6a5329c9fd94385",
  measurementId: "G-6PE47RLP8V",
};

// Security note:
// - API keys are identifiers, not secrets. Protect quota using Firebase Auth,
//   App Check, and allowed origins in Google Cloud console restrictions.
// - In production, inject config via hosting env/template rather than hardcoding.
export const FIREBASE_HARDENING_GUIDE = Object.freeze({
  recommendations: [
    "Restrict API key by HTTP referrer/domain allowlist.",
    "Enable Firebase App Check for Firestore + Functions.",
    "Use Auth custom claims + Firestore Rules for admin actions.",
    "Route privileged economy mutations through callable Cloud Functions.",
  ],
});

export const FIRESTORE_RULES_TEMPLATE = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthed() { return request.auth != null; }
    function isAdmin() { return isAuthed() && request.auth.token.admin == true; }

    match /gooner_users/{username} {
      allow read: if isAuthed();
      allow update: if isAuthed() && request.auth.token.name == username
                    && request.resource.data.money <= resource.data.money + 10000;
      allow create: if isAuthed();
      allow adminWrite: if isAdmin();
    }

    match /gooner_admin_ops/{opId} {
      allow create: if isAdmin();
      allow read: if isAdmin();
    }
  }
}`;

function readFirebaseOverrides() {
  try {
    const stored = localStorage.getItem("goonerFirebaseConfig");
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    console.warn("Invalid goonerFirebaseConfig override, ignoring.", err);
    return {};
  }
}

function sanitizeFirebaseConfig(config) {
  const merged = { ...defaultFirebaseConfig, ...config };
  const applyDefault = (key, validator, warning) => {
    if (!validator(merged[key])) {
      console.warn(warning);
      merged[key] = defaultFirebaseConfig[key];
    }
  };

  if (!/^AIza[\w-]{20,}$/.test(String(merged.apiKey || ""))) {
    console.warn("Firebase apiKey override is invalid, falling back to default key.");
    merged.apiKey = defaultFirebaseConfig.apiKey;
  }

  applyDefault(
    "projectId",
    (value) => /^[a-z0-9-]{5,}$/.test(String(value || "")),
    "Firebase projectId override is invalid, falling back to default project."
  );
  applyDefault(
    "authDomain",
    (value) => /\.(firebaseapp\.com|web\.app)$/.test(String(value || "")),
    "Firebase authDomain override is invalid, falling back to default domain."
  );
  applyDefault(
    "storageBucket",
    (value) => /\.(appspot\.com|firebasestorage\.app)$/.test(String(value || "")),
    "Firebase storageBucket override is invalid, falling back to default bucket."
  );
  applyDefault(
    "messagingSenderId",
    (value) => /^\d{6,}$/.test(String(value || "")),
    "Firebase messagingSenderId override is invalid, falling back to default sender ID."
  );
  applyDefault(
    "appId",
    (value) => /^\d+:\d+:web:[0-9a-f]+$/i.test(String(value || "")),
    "Firebase appId override is invalid, falling back to default app ID."
  );

  if (merged.measurementId && !/^G-[A-Z0-9]+$/i.test(String(merged.measurementId || ""))) {
    console.warn("Firebase measurementId override is invalid, falling back to default measurement ID.");
    merged.measurementId = defaultFirebaseConfig.measurementId;
  }

  return merged;
}

const firebaseConfig = sanitizeFirebaseConfig({
  ...(window.__FIREBASE_CONFIG__ || {}),
  ...readFirebaseOverrides(),
});

// Firebase service handles.

function getFirebaseErrorCode(error) {
  const code = String(error?.code || "").toLowerCase();
  return code.startsWith("firebase/") ? code.replace("firebase/", "") : code;
}

export function isFirebaseQuotaError(error) {
  const code = getFirebaseErrorCode(error);
  return code === "resource-exhausted" || code === "auth/quota-exceeded";
}

export function handleFirebaseError(error, context = "FIREBASE", fallback = "") {
  const code = getFirebaseErrorCode(error);
  if (code === "auth/invalid-api-key") {
    showToast("FIREBASE API KEY REJECTED", "⚠️", "Check runtime config.");
    return true;
  }
  if (isFirebaseQuotaError(error)) {
    showToast("FIREBASE AT CAPACITY", "⏳", "Online features will retry later.");
    return true;
  }
  if (code === "unavailable") {
    showToast("FIREBASE UNAVAILABLE", "📡", "Check your connection and retry.");
    return true;
  }
  if (fallback) showToast(context, "⚠️", fallback);
  return false;
}
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Local player state (mirrors Firestore on sync).
let myUid = null;
let myName = "ANON";
let myMoney = 1000;
let myStats = { games: 0, wpm: 0, wins: 0 };
let myAchievements = [];
let myInventory = [];
let myJoined = 0;
let myItemToggles = {};
let transactionLog = [];
let globalVol = 0.5;
let currentGame = null;
let keysPressed = {};
let lossStreak = 0;
let jobData = { cooldowns: {}, completed: { cashier: 0, frontdesk: 0, delivery: 0, stocker: 0, janitor: 0, barista: 0 } };
let loanData = { debt: 0, rate: 0, lastInterestAt: 0 };
let stockData = { holdings: {}, selected: "GOON", buyMultiplier: 1 };
let crewData = { tag: "", role: "SOLO", motto: "", recruitmentOpen: true, goal: 5000, bank: 0, wins: 0, members: [] };
let seasonData = { id: "", xp: 0, hall: [] };
const MIN_LOAN_AMOUNT = 100;
const MAX_LOAN_AMOUNT = 10000;
const SEASON_STARTING_MONEY = 1000;
const STOCK_MULTIPLIERS = [1, 5, 10, 25, "MAX"];
const GLOBAL_MARKET_COLLECTION = "gooner_meta";
const GLOBAL_MARKET_DOC_ID = "stock_market";
const STOCK_TICK_MS = 2000;

const SHOP_TOGGLE_STORAGE_PREFIX = "goonerItemToggles:";
const LOCAL_USER_STORAGE_KEY = "goonerLocalUsers";
const LOCAL_CREW_STORAGE_KEY = "goonerCrewData";
const LOCAL_SEASON_STORAGE_KEY = "goonerSeasonData";
let hasAdminClaim = false;
let permissionMask = 0;
const CHAT_BLOCKLIST_KEY = "goonerChatBlocklist";
const CHAT_MUTED_KEY = "goonerChatMuted";
const CHAT_BAD_WORDS = ["slur1", "slur2", "idiot", "stupid"];

const ADMIN_ALLOWLIST = new Set([
  "ICEC",
  "THEFOX",
  "NOOB",
]);


// Audio context for simple synth effects.
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

export const PermissionBits = Object.freeze({
  ADMIN: 1 << 0,
  GOD_MODE: 1 << 1,
  ECONOMY_WRITE: 1 << 2,
  MODERATE_CHAT: 1 << 3,
});

// Register per-game cleanup hooks (each game adds a stop function).
const gameStops = [];
let seasonBoardUnsub = null;
let activeSeasonTab = "";
let activeSeasonSubTab = "solo";
let cachedSeasonBoards = { solo: [], gang: [] };

// Centralized mutable state wrapper (keeps consumers consistent).
export const state = {
  get myUid() {
    return myUid;
  },
  set myUid(value) {
    myUid = value;
  },
  get myName() {
    return myName;
  },
  set myName(value) {
    myName = value;
  },
  get myMoney() {
    return myMoney;
  },
  set myMoney(value) {
    myMoney = value;
  },
  get myStats() {
    return myStats;
  },
  set myStats(value) {
    myStats = value;
  },
  get myAchievements() {
    return myAchievements;
  },
  set myAchievements(value) {
    myAchievements = value;
  },
  get myInventory() {
    return myInventory;
  },
  set myInventory(value) {
    myInventory = value;
  },
  get myItemToggles() {
    return myItemToggles;
  },
  set myItemToggles(value) {
    myItemToggles = value;
  },
  get transactionLog() {
    return transactionLog;
  },
  set transactionLog(value) {
    transactionLog = value;
  },
  get globalVol() {
    return globalVol;
  },
  set globalVol(value) {
    globalVol = value;
  },
  get currentGame() {
    return currentGame;
  },
  set currentGame(value) {
    currentGame = value;
    syncGameLeaderboardButton();
  },
  get keysPressed() {
    return keysPressed;
  },
  set keysPressed(value) {
    keysPressed = value;
  },
  get lossStreak() {
    return lossStreak;
  },
  set lossStreak(value) {
    lossStreak = value;
  },
  get jobData() {
    return jobData;
  },
  set jobData(value) {
    jobData = value;
  },
  get loanData() {
    return loanData;
  },
  set loanData(value) {
    loanData = value;
  },
  get stockData() {
    return stockData;
  },
  set stockData(value) {
    stockData = value;
  }
};

export function getStateSnapshot() {
  return Object.freeze({
    myUid,
    myName,
    myMoney,
    myStats: { ...myStats },
    currentGame,
    lossStreak,
  });
}

export function updateState(patch = {}, source = "system") {
  if (!patch || typeof patch !== "object") return;
  const allowed = ["currentGame", "keysPressed", "globalVol", "stockData"];
  for (const key of Object.keys(patch)) {
    if (!allowed.includes(key)) continue;
    state[key] = patch[key];
  }
  if (source !== "loop") updateUI();
}

export function dispatch(action) {
  switch (action?.type) {
    case "SET_CURRENT_GAME":
      updateState({ currentGame: action.payload }, "dispatch");
      break;
    case "SET_KEYS":
      updateState({ keysPressed: action.payload || {} }, "dispatch");
      break;
    default:
      break;
  }
}

export class EngineKernel {
  constructor({ fixedHz = 60, maxCatchupTicks = 5 } = {}) {
    this.fixedHz = fixedHz;
    this.fixedDt = 1 / fixedHz;
    this.maxCatchupTicks = maxCatchupTicks;
    this.accumulator = 0;
    this.lastTs = 0;
    this.rafId = 0;
    this.running = false;
    this.onTick = null;
    this.onRender = null;
  }

  start(onTick, onRender, options = {}) {
    this.stop();
    const { startPausedUntilInput = false } = options;
    this.onTick = onTick;
    this.onRender = onRender;
    this.accumulator = 0;
    this.lastTs = 0;
    this.running = true;
    let started = !startPausedUntilInput;
    const begin = () => {
      started = true;
    };
    const onStartKey = () => begin();
    const onStartPointer = () => begin();
    if (!started) {
      window.addEventListener("keydown", onStartKey, { passive: true });
      window.addEventListener("pointerdown", onStartPointer, { passive: true });
    }
    const frame = (ts) => {
      if (!this.running) return;
      if (!this.lastTs) this.lastTs = ts;
      const frameDt = started ? Math.min((ts - this.lastTs) / 1000, 0.1) : 0;
      this.lastTs = ts;
      this.accumulator += frameDt;
      let ticks = 0;
      while (this.accumulator >= this.fixedDt && ticks < this.maxCatchupTicks) {
        this.onTick?.(this.fixedDt, ts);
        this.accumulator -= this.fixedDt;
        ticks += 1;
      }
      if (this.accumulator > this.fixedDt * this.maxCatchupTicks) {
        this.accumulator = this.fixedDt;
      }
      this.onRender?.(this.accumulator / this.fixedDt, ts);
      this.rafId = requestAnimationFrame(frame);
    };
    this.cleanupStartGate = () => {
      window.removeEventListener("keydown", onStartKey);
      window.removeEventListener("pointerdown", onStartPointer);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stop() {
    this.running = false;
    this.cleanupStartGate?.();
    this.cleanupStartGate = null;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }
}

export class InputBuffer {
  constructor(maxEntries = 64) {
    this.maxEntries = maxEntries;
    this.entries = [];
  }

  push(command, ts = performance.now(), payload = null) {
    this.entries.push({ command, ts, payload });
    if (this.entries.length > this.maxEntries) this.entries.shift();
  }

  consume(command, sinceTs = -Infinity) {
    const idx = this.entries.findIndex((entry) => entry.command === command && entry.ts >= sinceTs);
    if (idx === -1) return null;
    return this.entries.splice(idx, 1)[0];
  }

  clear() {
    this.entries.length = 0;
  }
}

export class DrawSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.commands = [];
  }

  clear(color, x, y, w, h) {
    this.commands.push({ kind: "clear", color, x, y, w, h });
  }

  rect(color, x, y, w, h) {
    this.commands.push({ kind: "rect", color, x, y, w, h });
  }

  line(color, width, x1, y1, x2, y2) {
    this.commands.push({ kind: "line", color, width, x1, y1, x2, y2 });
  }

  flush() {
    const ctx = this.ctx;
    let fillStyle = "";
    let strokeStyle = "";
    let lineWidth = 1;
    for (const cmd of this.commands) {
      if (cmd.kind === "clear" || cmd.kind === "rect") {
        if (fillStyle !== cmd.color) {
          fillStyle = cmd.color;
          ctx.fillStyle = fillStyle;
        }
        ctx.fillRect(cmd.x, cmd.y, cmd.w, cmd.h);
        continue;
      }
      if (strokeStyle !== cmd.color) {
        strokeStyle = cmd.color;
        ctx.strokeStyle = strokeStyle;
      }
      if (lineWidth !== cmd.width) {
        lineWidth = cmd.width;
        ctx.lineWidth = lineWidth;
      }
      ctx.beginPath();
      ctx.moveTo(cmd.x1, cmd.y1);
      ctx.lineTo(cmd.x2, cmd.y2);
      ctx.stroke();
    }
    this.commands.length = 0;
  }
}

const loopSubscribers = new Map();
const sharedKernel = new EngineKernel({ fixedHz: 60 });
export function subscribeToGameLoop(id, callback) {
  loopSubscribers.set(id, callback);
  if (loopSubscribers.size > 1) return;
  sharedKernel.start(
    (dt, ts) => {
      for (const cb of loopSubscribers.values()) cb(dt, ts);
    },
    () => {}
  );
}

export function unsubscribeFromGameLoop(id) {
  loopSubscribers.delete(id);
  if (loopSubscribers.size === 0) sharedKernel.stop();
}

async function runFirestoreTask(task, context, fallback) {
  try {
    return await task();
  } catch (error) {
    handleFirebaseError(error, context, fallback);
    return null;
  }
}

export const firebase = {
  db,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  query,
  orderBy,
  limit,
  where,
  addDoc,
  deleteDoc,
  getDocs
};

export function hasActiveItem(id) {
  const owned = myInventory.includes(id);
  if (!owned) return false;
  return myItemToggles[id] !== false;
}

function setItemToggle(id, enabled) {
  if (!myInventory.includes(id)) return;
  myItemToggles[id] = enabled;
}

function getShopToggleStorageKey(username) {
  return SHOP_TOGGLE_STORAGE_PREFIX + String(username || myName || "ANON").toUpperCase();
}

function loadLocalUsers() {
  const raw = localStorage.getItem(LOCAL_USER_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalUsers(users) {
  localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(users || {}));
}

function saveLocalProfileSnapshot(data) {
  if (!data?.name) return;
  const users = loadLocalUsers();
  users[String(data.name).toUpperCase()] = data;
  saveLocalUsers(users);
}

function getLocalProfile(username) {
  const users = loadLocalUsers();
  return users[String(username || "").toUpperCase()] || null;
}

function loadLocalShopToggles(username) {
  const raw = localStorage.getItem(getShopToggleStorageKey(username));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalShopToggles() {
  if (myName === "ANON") return;
  localStorage.setItem(getShopToggleStorageKey(myName), JSON.stringify(myItemToggles || {}));
}

function applyOwnedVisuals() {
  const rainbowEnabled = hasActiveItem("item_rainbow");
  document.body.classList.toggle("rainbow-mode", rainbowEnabled);

  const flappyEnabled = hasActiveItem("item_flappy");
  document.getElementById("btnFlappy").style.display = flappyEnabled
    ? "block"
    : "none";
}


async function refreshAdminClaim() {
  try {
    const claims = await auth.currentUser?.getIdTokenResult(true);
    const tokenClaims = claims?.claims || {};
    const tokenMask = Number(tokenClaims.perms ?? tokenClaims.permissionMask ?? 0) || 0;
    const godByClaim = tokenClaims.admin === true || tokenClaims.godMode === true;
    permissionMask = tokenMask | (godByClaim ? PermissionBits.ADMIN | PermissionBits.GOD_MODE : 0);
    hasAdminClaim = (permissionMask & PermissionBits.ADMIN) !== 0;
  } catch {
    hasAdminClaim = false;
    permissionMask = 0;
  }
}

export function hasPermission(bit) {
  return (permissionMask & bit) === bit;
}

function isGodUser(name = myName) {
  const normalized = String(name || "").trim().toUpperCase();
  if (!normalized) return false;
  if (ADMIN_ALLOWLIST.has(normalized)) return true;
  const isSelf = normalized === String(myName || "").trim().toUpperCase();
  if (!isSelf) return false;
  return hasPermission(PermissionBits.GOD_MODE) || hasAdminClaim;
}

function updateAdminMenu() {
  const adminBtn =
    document.getElementById("tabAdmin") || document.getElementById("adminMenuBtn");
  const adminName = document.getElementById("adminName");
  const hasAccess = isGodUser();
  if (adminBtn) adminBtn.style.display = hasAccess ? "inline-block" : "none";
  if (adminName) adminName.innerText = hasAccess ? myName : "LOCKED";
}


// Achievements metadata (UI + reward tracking).
const ACHIEVEMENTS = [
  {
    id: "noob",
    icon: "🐣",
    title: "NOOB",
    desc: "Played your first game",
    rarity: "common",
    reward: 500,
  },
  {
    id: "diamond_hands",
    icon: "💎",
    title: "DIAMOND HANDS",
    desc: "Bank account > $5000",
    rarity: "rare",
    reward: 2500,
  },
  {
    id: "millionaire",
    icon: "💸",
    title: "MILLIONAIRE",
    desc: "Bank account > $1,000,000",
    rarity: "legendary",
    reward: 50000,
  },
  {
    id: "type_god",
    icon: "⌨️",
    title: "TYPE GOD",
    desc: "WPM > 80",
    rarity: "rare",
    reward: 2500,
  },
  {
    id: "viper",
    icon: "🐍",
    title: "VIPER",
    desc: "Score > 30 in Snake",
    rarity: "rare",
    reward: 2500,
  },
  {
    id: "grid_runner",
    icon: "🧿",
    title: "GRID RUNNER",
    desc: "Score 25 in Dodge Grid",
    rarity: "rare",
    reward: 2000,
  },
  {
    id: "untouchable",
    icon: "🛡️",
    title: "UNTOUCHABLE",
    desc: "Perfect 10-0 in Pong",
    rarity: "epic",
    reward: 10000,
  },
  {
    id: "high_roller",
    icon: "🎰",
    title: "HIGH ROLLER",
    desc: "Win a bet > $500",
    rarity: "rare",
    reward: 2500,
  },
  {
    id: "shopaholic",
    icon: "🛍️",
    title: "SHOPAHOLIC",
    desc: "Buy 3 items",
    rarity: "common",
    reward: 500,
  },
  {
    id: "chatterbox",
    icon: "💬",
    title: "CHATTERBOX",
    desc: "Send 10 messages",
    rarity: "common",
    reward: 500,
  },
  {
    id: "neo",
    icon: "🕶️",
    title: "NEO",
    desc: "Unlock Matrix Mode",
    rarity: "epic",
    reward: 10000,
  },
  {
    id: "lonely",
    icon: "🐺",
    title: "LONE WOLF",
    desc: "Play 10 rounds of Solo Blackjack",
    rarity: "common",
    reward: 500,
  },
  {
    id: "rug_pulled",
    icon: "📉",
    title: "RUG PULLED",
    desc: "Hit $0 balance",
    hidden: true,
    rarity: "rare",
    reward: 1000,
  },
  {
    id: "touch_grass",
    icon: "🌿",
    title: "TOUCH GRASS",
    desc: "Stop touching the terminal",
    hidden: true,
    rarity: "common",
    reward: 500,
  },
  {
    id: "master_hacker",
    icon: "💀",
    title: "MASTER HACKER",
    desc: "Access root",
    hidden: true,
    rarity: "epic",
    reward: 10000,
  },
  {
    id: "leet",
    icon: "👾",
    title: "1337",
    desc: "Play at XX:37",
    hidden: true,
    rarity: "epic",
    reward: 10000,
  },
  {
    id: "architect",
    icon: "🏛️",
    title: "THE ARCHITECT",
    desc: "Ask for help",
    hidden: true,
    rarity: "rare",
    reward: 2500,
  },
  {
    id: "rage_quit",
    icon: "🤬",
    title: "RAGE QUIT",
    desc: "Score 0 in 3 games straight",
    hidden: true,
    rarity: "rare",
    reward: 2500,
  },
  {
    id: "insomniac",
    icon: "🌙",
    title: "INSOMNIAC",
    desc: "Play between 3AM-4AM",
    hidden: true,
    rarity: "epic",
    reward: 10000,
  },
  {
    id: "spammer",
    icon: "🔨",
    title: "SPAMMER",
    desc: "Click logo 50 times",
    hidden: true,
    rarity: "rare",
    reward: 2500,
  },
  {
    id: "void_gazer",
    icon: "👁️",
    title: "VOID GAZER",
    desc: "Click empty space 50 times",
    hidden: true,
    rarity: "rare",
    reward: 2500,
  },
  {
    id: "signal_spy",
    icon: "📡",
    title: "SIGNAL SPY",
    desc: "Spoof the ping readout",
    hidden: true,
    rarity: "rare",
    reward: 1500,
  },
  {
    id: "clockwork",
    icon: "⏱️",
    title: "CLOCKWORK",
    desc: "Loop the system clock",
    hidden: true,
    rarity: "rare",
    reward: 1500,
  },
  {
    id: "ghost_signal",
    icon: "👻",
    title: "GHOST SIGNAL",
    desc: "Transmit a silent message",
    hidden: true,
    rarity: "epic",
    reward: 3000,
  },
  {
    id: "menu_masher",
    icon: "🧭",
    title: "MENU MASHER",
    desc: "Toggle the games menu too fast",
    hidden: true,
    rarity: "rare",
    reward: 1500,
  },
  {
    id: "bank_tapper",
    icon: "🏦",
    title: "BANK TAPPER",
    desc: "Drum the bank counter",
    hidden: true,
    rarity: "rare",
    reward: 1500,
  },
  {
    id: "flicker_fiend",
    icon: "📺",
    title: "FLICKER FIEND",
    desc: "Spam the flicker switch",
    hidden: true,
    rarity: "rare",
    reward: 1500,
  },
];

// Shop inventory (drives UI cards + gameplay modifiers).
const SHOP_ITEMS = [
  {
    id: "item_aimbot",
    icon: "🏓",
    name: "PONG AIMBOT",
    cost: 2000,
    type: "perk",
    desc: "Auto-play Pong",
  },
  {
    id: "item_slowmo",
    icon: "⏱️",
    name: "RUNNER SLOW-MO",
    cost: 1500,
    type: "perk",
    desc: "20% Slower Speed",
  },
  {
    id: "item_shield",
    icon: "🛡️",
    name: "1-HIT SHIELD",
    cost: 500,
    type: "consumable",
    desc: "Survive one crash",
  },
  {
    id: "item_xray",
    icon: "🕶️",
    name: "X-RAY VISOR",
    cost: 5000,
    type: "perk",
    desc: "See Dealer Card",
  },
  {
    id: "item_cardcount",
    icon: "🃏",
    name: "CARD COUNTER",
    cost: 3000,
    type: "perk",
    desc: "BJ Count Assist",
  },
  {
    id: "item_double",
    icon: "🐍",
    name: "SNAKE OIL",
    cost: 3000,
    type: "perk",
    desc: "Double Snake Points",
  },
  {
    id: "item_dodge_stabilizer",
    icon: "💠",
    name: "DODGE STABILIZER",
    cost: 2500,
    type: "perk",
    desc: "Slow falling shards",
  },
  {
    id: "item_matrix",
    icon: "💻",
    name: "MATRIX MODE",
    cost: 6000,
    type: "visual",
    desc: "Toggle Matrix background",
  },
  {
    id: "item_rainbow",
    icon: "🌈",
    name: "RGB MODE",
    cost: 10000,
    type: "visual",
    desc: "Color Cycle",
  },
  {
    id: "item_autotype",
    icon: "⌨️",
    name: "AUTO-TYPER",
    cost: 7500,
    type: "perk",
    desc: "Bot plays Typer",
  },
  {
    id: "item_flappy",
    icon: "🐦",
    name: "GAME: FLAPPY",
    cost: 10000,
    type: "visual",
    desc: "Unlock Flappy Goon",
  },
  {
    id: "item_salary_boost",
    icon: "💰",
    name: "ARCADE PAY CHIP",
    cost: 9000,
    type: "perk",
    desc: "+35% cash from game runs",
  },
  {
    id: "item_combo_insurance",
    icon: "🧾",
    name: "COMBO INSURANCE",
    cost: 7000,
    type: "perk",
    desc: "Game-over payout floor becomes $120",
  },
  {
    id: "item_xp_router",
    icon: "📡",
    name: "XP ROUTER",
    cost: 12000,
    type: "perk",
    desc: "+40% season XP from games",
  },
  {
    id: "item_bank_drone",
    icon: "🏦",
    name: "BANK DRONE",
    cost: 18000,
    type: "perk",
    desc: "High-score bonus scales harder",
  },
];


export function getShopItemById(id) {
  const item = SHOP_ITEMS.find((entry) => entry.id === id);
  return item ? { ...item } : null;
}

const GAME_PAYOUT_CONFIG = Object.freeze({
  pong: { rate: 10, xpRate: 1.2 },
  snake: { rate: 4, xpRate: 1.1 },
  runner: { rate: 5, xpRate: 1.15 },
  geo: { rate: 5, xpRate: 1.1 },
  flappy: { rate: 20, xpRate: 1.4 },
  dodge: { rate: 4, xpRate: 1.2 },
  blackjack: { rate: 1, xpRate: 1 },
  corebreaker: { rate: 0.2, xpRate: 1.3 },
  neondefender: { rate: 3, xpRate: 1.25 },
  voidminer: { rate: 2.5, xpRate: 1.25 },
  default: { rate: 3, xpRate: 1.1 },
});

const STOCK_SYMBOLS = [
  { symbol: "GOON", name: "GOON TECH" },
  { symbol: "MEME", name: "MEME HOLDINGS" },
  { symbol: "BYTE", name: "BYTE INDUSTRIES" },
  { symbol: "NOVA", name: "NOVA ENERGY" },
  { symbol: "PUMP", name: "PUMP CAPITAL" },
];

const STOCK_BASE_PRICES = {
  GOON: 140,
  MEME: 92,
  BYTE: 118,
  NOVA: 76,
  PUMP: 64,
};

let stopMarketSync = null;

function buildInitialStockState() {
  return STOCK_SYMBOLS.map((entry) => {
    const start = STOCK_BASE_PRICES[entry.symbol] || 100;
    return {
      ...entry,
      price: start,
      history: Array.from({ length: 40 }, (_, i) => {
        const angle = (i / 39) * Math.PI * 2;
        return Number((start * (1 + Math.sin(angle) * 0.05)).toFixed(2));
      }),
      lastMove: 0,
    };
  });
}

const marketState = {
  stocks: buildInitialStockState(),
};

function marketDocRef() {
  return doc(db, GLOBAL_MARKET_COLLECTION, GLOBAL_MARKET_DOC_ID);
}

function normalizeMarketStocks(inputStocks = []) {
  const bySymbol = new Map();
  inputStocks.forEach((stock) => {
    if (!stock?.symbol) return;
    bySymbol.set(String(stock.symbol).toUpperCase(), stock);
  });

  return STOCK_SYMBOLS.map((entry) => {
    const source = bySymbol.get(entry.symbol) || {};
    const parsedPrice = Number(source.price);
    const price = Number.isFinite(parsedPrice) ? Math.max(3, parsedPrice) : (STOCK_BASE_PRICES[entry.symbol] || 100);
    const parsedHistory = Array.isArray(source.history)
      ? source.history.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value >= 0)
      : [];
    const history = (parsedHistory.length ? parsedHistory : [price]).slice(-80).map((value) => Number(value.toFixed(2)));
    const parsedMove = Number(source.lastMove);
    return {
      ...entry,
      price: Number(price.toFixed(2)),
      history,
      lastMove: Number.isFinite(parsedMove) ? parsedMove : 0,
    };
  });
}

function getInitialMarketPayload() {
  return {
    version: 1,
    updatedAt: Date.now(),
    lastTickAt: Date.now(),
    stocks: buildInitialStockState().map((stock) => ({
      symbol: stock.symbol,
      price: stock.price,
      history: stock.history,
      lastMove: stock.lastMove,
    })),
  };
}

function applyMarketPayload(payload) {
  const stocks = normalizeMarketStocks(payload?.stocks);
  marketState.stocks = stocks;
  if (document.getElementById("overlayBank")?.classList.contains("active")) {
    renderStockMarket();
  }
}

function evolveMarketStocks(stocks) {
  return stocks.map((stock) => {
    const drift = (Math.random() - 0.49) * 0.09;
    const momentum = (Number(stock.lastMove) || 0) * 0.35;
    const swing = (Math.random() - 0.5) * 0.04;
    const current = Math.max(3, Number(stock.price) || 3);
    const next = Math.max(3, current * (1 + drift + momentum + swing));
    const lastMove = (next - current) / current;
    const history = [...(Array.isArray(stock.history) ? stock.history : []), Number(next.toFixed(2))].slice(-80);
    return {
      ...stock,
      price: Number(next.toFixed(2)),
      lastMove,
      history,
    };
  });
}

async function ensureGlobalMarket() {
  const ref = marketDocRef();
  const snap = await getDoc(ref);
  if (snap.exists()) {
    applyMarketPayload(snap.data());
    return;
  }
  const initial = getInitialMarketPayload();
  await setDoc(ref, initial).catch(() => {});
  applyMarketPayload(initial);
}

function subscribeToGlobalMarket() {
  if (stopMarketSync) return;
  const ref = marketDocRef();
  stopMarketSync = onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    applyMarketPayload(snap.data());
  }, () => {});
}

async function tickStockMarket() {
  const ref = marketDocRef();
  try {
    await runTransaction(db, async (t) => {
      const snap = await t.get(ref);
      const payload = snap.exists() ? snap.data() : getInitialMarketPayload();
      const normalizedStocks = normalizeMarketStocks(payload.stocks);
      const now = Date.now();
      const lastTick = Number(payload.lastTickAt) || 0;
      if (now - lastTick < STOCK_TICK_MS) return;
      const evolvedStocks = evolveMarketStocks(normalizedStocks);
      t.set(ref, {
        version: 1,
        updatedAt: now,
        lastTickAt: now,
        stocks: evolvedStocks.map((stock) => ({
          symbol: stock.symbol,
          price: stock.price,
          history: stock.history,
          lastMove: stock.lastMove,
        })),
      });
    });
  } catch {
    // Keep gameplay responsive offline by simulating locally until sync recovers.
    marketState.stocks = evolveMarketStocks(marketState.stocks);
    if (document.getElementById("overlayBank")?.classList.contains("active")) {
      renderStockMarket();
    }
  }
}

function getStock(symbol) {
  return marketState.stocks.find((stock) => stock.symbol === symbol) || marketState.stocks[0];
}

function ensureStockProfile() {
  const safe = stockData && typeof stockData === "object" ? stockData : {};
  stockData = {
    holdings: { ...(safe.holdings || {}) },
    selected: safe.selected || marketState.stocks[0]?.symbol || "GOON",
    buyMultiplier: STOCK_MULTIPLIERS.includes(safe.buyMultiplier)
      ? safe.buyMultiplier
      : STOCK_MULTIPLIERS.includes(Number(safe.buyMultiplier))
        ? Number(safe.buyMultiplier)
        : 1,
  };
}

function getPortfolioValue() {
  return marketState.stocks.reduce((total, stock) => {
    const shares = Number(stockData.holdings?.[stock.symbol] || 0);
    return total + shares * stock.price;
  }, 0);
}

function formatStockMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function drawStockGraph(stock) {
  const canvas = document.getElementById("stockChart");
  if (!canvas || !stock) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const min = Math.min(...stock.history);
  const max = Math.max(...stock.history);
  const span = Math.max(0.01, max - min);

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  for (let y = 1; y < 4; y += 1) {
    const yPos = (height / 4) * y;
    ctx.beginPath();
    ctx.moveTo(0, yPos);
    ctx.lineTo(width, yPos);
    ctx.stroke();
  }

  const up = stock.history[stock.history.length - 1] >= stock.history[0];
  ctx.strokeStyle = up ? "#00ff66" : "#ff3d3d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  stock.history.forEach((value, i) => {
    const x = (i / (stock.history.length - 1 || 1)) * width;
    const y = height - ((value - min) / span) * (height - 8) - 4;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function renderStockMarket() {
  ensureStockProfile();
  const list = document.getElementById("stockList");
  if (!list) return;

  const selected = getStock(stockData.selected);
  const portfolioValue = getPortfolioValue();
  setText("stockPortfolioValue", `PORTFOLIO: ${formatStockMoney(portfolioValue)}`);

  list.innerHTML = "";
  marketState.stocks.forEach((stock) => {
    const row = document.createElement("button");
    row.className = `stock-row ${selected.symbol === stock.symbol ? "active" : ""}`;
    const shares = Number(stockData.holdings?.[stock.symbol] || 0);
    const prev = stock.history.length > 1 ? stock.history[stock.history.length - 2] : stock.price;
    const dayMove = ((stock.price - prev) / (prev || 1)) * 100;
    row.innerHTML = `<span>${stock.symbol} (${shares})</span><span style="color:${dayMove >= 0 ? "#0f0" : "#f55"}">${formatStockMoney(stock.price)}</span>`;
    row.addEventListener("click", () => {
      stockData.selected = stock.symbol;
      renderStockMarket();
    });
    list.appendChild(row);
  });

  const holdings = Number(stockData.holdings?.[selected.symbol] || 0);
  const buyMultiplier = stockData.buyMultiplier || 1;
  const tradeLabel = buyMultiplier === "MAX" ? "MAX" : buyMultiplier;
  setText("stockDetailName", `${selected.name} (${selected.symbol})`);
  setText("stockDetailPrice", formatStockMoney(selected.price));
  setText(
    "stockDetailMeta",
    `OWNED: ${holdings} SHARES | RANGE: ${formatStockMoney(Math.min(...selected.history))} - ${formatStockMoney(Math.max(...selected.history))}`
  );
  const buyBtn = document.getElementById("stockBuyBtn");
  const sellBtn = document.getElementById("stockSellBtn");
  if (buyBtn) buyBtn.innerText = `BUY ${tradeLabel}`;
  if (sellBtn) sellBtn.innerText = `SELL ${tradeLabel}`;

  const multBtns = document.querySelectorAll(".stock-mult-btn");
  multBtns.forEach((btn) => {
    const raw = btn.dataset.mult || "1";
    const mult = raw === "MAX" ? "MAX" : Number(raw);
    btn.classList.toggle("active", mult === buyMultiplier);
  });

  drawStockGraph(selected);
}

function setupStockMarketUX() {
  const buyBtn = document.getElementById("stockBuyBtn");
  const sellBtn = document.getElementById("stockSellBtn");
  if (!buyBtn || !sellBtn) return;

  buyBtn.addEventListener("click", () => tradeStock(true));
  sellBtn.addEventListener("click", () => tradeStock(false));

  document.querySelectorAll(".stock-mult-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const raw = btn.dataset.mult || "1";
      const nextMultiplier = raw === "MAX" ? "MAX" : Number(raw);
      if (!STOCK_MULTIPLIERS.includes(nextMultiplier)) return;
      stockData.buyMultiplier = nextMultiplier;
      renderStockMarket();
      saveStats();
    });
  });
}

function tradeStock(isBuy) {
  ensureStockProfile();
  const stock = getStock(stockData.selected);
  if (!stock) return;

  const selectedMultiplier = stockData.buyMultiplier || 1;
  const owned = Number(stockData.holdings[stock.symbol] || 0);
  const tradeShares = selectedMultiplier === "MAX"
    ? (isBuy ? Math.floor(myMoney / stock.price) : owned)
    : Number(selectedMultiplier || 1);

  if (tradeShares <= 0) {
    setText(
      "stockTradeMsg",
      isBuy ? "NOT ENOUGH CASH TO BUY SHARES" : "NO SHARES TO SELL"
    );
    return;
  }

  if (isBuy) {
    const totalCost = Number((stock.price * tradeShares).toFixed(2));
    if (myMoney < totalCost) {
      setText("stockTradeMsg", `NOT ENOUGH CASH FOR ${tradeShares} SHARES`);
      return;
    }
    myMoney = Number((myMoney - totalCost).toFixed(2));
    stockData.holdings[stock.symbol] = owned + tradeShares;
    logTransaction(`BUY ${stock.symbol} x${tradeShares}`, -totalCost);
    setText("stockTradeMsg", `BOUGHT ${tradeShares} ${stock.symbol} @ ${formatStockMoney(stock.price)}`);
  } else {
    if (owned < tradeShares) {
      setText("stockTradeMsg", `ONLY ${owned} SHARES AVAILABLE TO SELL`);
      return;
    }
    const totalPayout = Number((stock.price * tradeShares).toFixed(2));
    stockData.holdings[stock.symbol] = owned - tradeShares;
    myMoney = Number((myMoney + totalPayout).toFixed(2));
    logTransaction(`SELL ${stock.symbol} x${tradeShares}`, totalPayout);
    setText("stockTradeMsg", `SOLD ${tradeShares} ${stock.symbol} @ ${formatStockMoney(stock.price)}`);
  }

  updateUI();
  renderStockMarket();
  saveStats();
}

setInterval(() => {
  tickStockMarket();
}, 2000);

// Allow games to register a cleanup routine when overlays close.
export function registerGameStop(stopFn) {
  gameStops.push(stopFn);
}

// Stop all running games and reset transient input state.
export function stopAllGames() {
  gameStops.forEach((stopFn) => stopFn());
  currentGame = null;
  syncGameLeaderboardButton();
  keysPressed = {};
  window.removeEventListener("keydown", quickRestartListener);
}

export class Synth {
  constructor(context) {
    this.context = context;
    this.master = context.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(context.destination);
  }

  play({ freq = 440, type = "square", len = 0.1, attack = 0.002, decay = 0.08 } = {}) {
    if (this.context.state === "suspended") this.context.resume();
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const env = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.07 * globalVol, now + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(attack + decay, len));
    osc.connect(env);
    env.connect(this.master);
    osc.start(now);
    osc.stop(now + Math.max(attack + decay, len));
  }
}

const synth = new Synth(audioCtx);

// Simple synth beep helper used across the UI for feedback.
export function beep(freq = 440, type = "square", len = 0.1) {
  synth.play({ freq, type, len });
}

// "Success" melody used after achievements or purchases.
function playSuccessSound() {
  beep(523.25, "triangle", 0.1);
  setTimeout(() => beep(659.25, "triangle", 0.1), 100);
  setTimeout(() => beep(783.99, "triangle", 0.2), 200);
}

// Convenience: set text content by element id.
export function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.innerText = txt;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeCrewTag(tag) {
  return String(tag || "").trim().toUpperCase();
}

function getSeasonId() {
  const d = new Date();
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function loadCrewData() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_CREW_STORAGE_KEY) || "{}");
    if (parsed && typeof parsed === "object") {
      crewData = { tag: "", role: "SOLO", motto: "", recruitmentOpen: true, goal: 5000, bank: 0, wins: 0, members: [], ...parsed };
    }
  } catch {}
}

function saveCrewData() {
  localStorage.setItem(LOCAL_CREW_STORAGE_KEY, JSON.stringify(crewData));
}

function loadSeasonData() {
  const currentId = getSeasonId();
  const fallback = { id: currentId, xp: 0, hall: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_SEASON_STORAGE_KEY) || "null");
    if (!parsed) {
      seasonData = fallback;
      saveSeasonData();
      return;
    }
    if (parsed.id !== currentId) {
      const archived = Number(parsed.xp || 0) > 0
        ? [{ id: parsed.id, name: myName || "ANON", xp: Number(parsed.xp || 0) }]
        : [];
      seasonData = { id: currentId, xp: 0, hall: [...(parsed.hall || []), ...archived].slice(-20) };
      saveSeasonData();
      return;
    }
    seasonData = { ...fallback, ...parsed };
  } catch {
    seasonData = fallback;
  }
}

function saveSeasonData() {
  localStorage.setItem(LOCAL_SEASON_STORAGE_KEY, JSON.stringify(seasonData));
}

function getChatSet(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.map((v) => String(v || "").toUpperCase()) : []);
  } catch {
    return new Set();
  }
}

function setChatSet(key, setValue) {
  localStorage.setItem(key, JSON.stringify(Array.from(setValue)));
}

function filterChatMessage(txt) {
  let out = String(txt || "");
  CHAT_BAD_WORDS.forEach((badWord) => {
    const rx = new RegExp("\\b" + badWord + "\\b", "gi");
    out = out.replace(rx, "***");
  });
  return out;
}

function renderLiveOps() {
  const entries = [
    { now: "DOUBLE XP // FIRST WIN OF THE DAY", mode: "WEEKLY SEASON PUSH", reward: "+25% XP", featured: "NEON DRIFT", room: "DRFT" },
    { now: "CREW BANK RUSH // DONATE FOR BONUS", mode: "SQUAD ECON", reward: "$750 CACHE", featured: "BLACKJACK PVP", room: "BJ22" },
    { now: "CHAT SIGNAL // COMMAND HUNT ACTIVE", mode: "SOCIAL OPS", reward: "SECRET BADGE", featured: "TYPE RUNNER", room: "TYPE" },
  ];
  const item = entries[Math.floor(Date.now() / 15000) % entries.length];
  setText("liveOpsNow", item.now);
  setText("liveOpsMode", item.mode);
  setText("liveOpsReward", item.reward);
  setText("liveOpsFeatured", item.featured);
  setText("liveOpsRoom", item.room);
}


const TRENDING_GAME_LABELS = {
  pong: "PONG",
  snake: "SNAKE",
  runner: "RUNNER",
  geo: "GEOMETRY",
  type: "TYPE RUNNER",
  blackjack: "BLACKJACK",
  ttt: "TIC-TAC-TOE",
  hangman: "HANGMAN",
  flappy: "FLAPPY",
  dodge: "DODGE",
  roulette: "ROULETTE",
  bonk: "BONK ARENA",
  drift: "NEON DRIFT",
  corebreaker: "COREBREAKER",
  neondefender: "NEON DEFENDER",
  voidminer: "VOID MINER",
  emulator: "CPU EMULATOR",
};

function formatTrendingWindowLabel() {
  const now = new Date();
  return `LAST REFRESH ${now.toLocaleTimeString("en-GB")} // WINDOW 24H`;
}

async function refreshTrendingGames() {
  const wrap = document.getElementById("trendingGamesList");
  const meta = document.getElementById("trendingGamesMeta");
  if (!wrap || !meta) return;
  const since = Date.now() - 24 * 60 * 60 * 1000;

  try {
    const snap = await getDocs(query(collection(db, "gooner_game_plays"), where("ts", ">=", since), limit(800)));
    const counts = new Map();
    snap.forEach((entry) => {
      const data = entry.data() || {};
      const key = String(data.game || "").toLowerCase().trim();
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const rows = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (!rows.length) {
      wrap.innerHTML = '<div class="trending-empty">NO GAME PLAYS IN THE LAST 24H.</div>';
      meta.innerText = formatTrendingWindowLabel();
      return;
    }

    wrap.innerHTML = rows
      .map(([game, plays], idx) => {
        const label = TRENDING_GAME_LABELS[game] || game.toUpperCase();
        return `<button class="trending-game-btn" type="button" data-game="${escapeHtml(game)}"><span class="trending-rank">#${idx + 1}</span><span>${escapeHtml(label)}</span><span class="trending-count">${plays} PLAYS</span></button>`;
      })
      .join("");

    meta.innerText = formatTrendingWindowLabel();
  } catch (error) {
    meta.innerText = "TRENDING SIGNAL OFFLINE";
    wrap.innerHTML = '<div class="trending-empty">UNABLE TO LOAD TRENDING GAMES.</div>';
  }
}


function renderUpdateLogMessage(message, tag = "SYNC") {
  const row = `<li><span>${escapeHtml(tag)}</span> ${escapeHtml(message)}</li>`;
  const compactList = document.getElementById("updateLogList");
  if (compactList) compactList.innerHTML = row;
  const fullList = document.getElementById("updateLogFullList");
  if (fullList) fullList.innerHTML = row;
}

function renderMonthlyTrendingGraph(rows) {
  const chart = document.getElementById("trendingMonthChart");
  const meta = document.getElementById("trendingMonthlyMeta");
  if (!chart || !meta) return;

  if (!rows.length) {
    chart.innerHTML = '<div class="trending-empty">NO TREND DATA YET FOR THE LAST 30 DAYS.</div>';
    meta.innerText = "MONTHLY TRAFFIC WINDOW: EMPTY";
    return;
  }

  const maxCount = Math.max(...rows.map((row) => row.count), 1);
  chart.innerHTML = rows
    .map((row) => {
      const width = Math.max(2, Math.round((row.count / maxCount) * 100));
      return `<div class="trend-row"><span>${escapeHtml(row.label)}</span><div class="trend-bar-track"><div class="trend-bar-fill" style="width:${width}%"></div></div><span>${row.count} PLAYS</span></div>`;
    })
    .join("");
  meta.innerText = `MONTHLY TRAFFIC WINDOW: ${rows.length} DAYS`;
}

async function refreshTrendingMonthGraph() {
  const chart = document.getElementById("trendingMonthChart");
  const meta = document.getElementById("trendingMonthlyMeta");
  if (!chart || !meta) return;

  try {
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const snap = await getDocs(query(collection(db, "gooner_game_plays"), where("ts", ">=", since), limit(4000)));
    const counts = new Map();
    snap.forEach((entry) => {
      const data = entry.data() || {};
      const ts = Number(data.ts || 0);
      if (!ts) return;
      const day = new Date(ts).toISOString().slice(5, 10);
      counts.set(day, (counts.get(day) || 0) + 1);
    });

    const rows = [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, count]) => ({ label, count }));
    renderMonthlyTrendingGraph(rows);
  } catch (_error) {
    chart.innerHTML = '<div class="trending-empty">UNABLE TO LOAD MONTHLY TREND GRAPH.</div>';
    meta.innerText = "MONTHLY TREND FEED OFFLINE";
  }
}

async function fetchMergedPullRequests(owner, repo, maxPages = 6) {
  const merged = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`;
    const response = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(`GITHUB HTTP ${response.status}`);
    const pulls = await response.json();
    if (!Array.isArray(pulls) || !pulls.length) break;
    merged.push(...pulls.filter((pr) => pr && pr.merged_at));
    if (pulls.length < 100) break;
  }
  return merged.sort((a, b) => new Date(b.merged_at).getTime() - new Date(a.merged_at).getTime());
}

let mergedUpdateLogRows = [];

function normalizeUpdateLogRow(row, fallbackNumber = "?") {
  const rowObj = row && typeof row === "object" ? row : {};
  const rawNumber = rowObj.number ?? rowObj.pull_number ?? rowObj.id ?? fallbackNumber;
  const normalizedDigits = String(rawNumber).match(/\d+/)?.[0];
  const number = `#${normalizedDigits || String(fallbackNumber).replace(/^#/, "") || "?"}`;

  const rawTitle = rowObj.title ?? rowObj.name ?? rowObj.message ?? rowObj.body;
  const cleanedTitle = String(rawTitle || "").trim();
  const title = cleanedTitle || `CHANGE ${number}`;

  const mergedAtRaw = rowObj.mergedAt ?? rowObj.merged_at ?? rowObj.date;
  const mergedAtMs = Date.parse(String(mergedAtRaw || ""));
  const mergedAt = Number.isFinite(mergedAtMs) ? new Date(mergedAtMs).toISOString() : "";

  return { number, title, mergedAt };
}

function formatUpdateLogDateHeading(isoDate) {
  const parsed = Date.parse(String(isoDate || ""));
  if (!Number.isFinite(parsed)) return "UNKNOWN DATE";
  return new Date(parsed).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function renderFullUpdateLogRows(searchTerm = "") {
  const fullList = document.getElementById("updateLogFullList");
  const fullMeta = document.getElementById("updateLogFullMeta");
  if (!fullList || !fullMeta) return;

  const normalizedQuery = String(searchTerm || "").trim().toLowerCase();
  const rows = normalizedQuery
    ? mergedUpdateLogRows.filter((row) => row.number.toLowerCase().includes(normalizedQuery) || row.title.toLowerCase().includes(normalizedQuery))
    : mergedUpdateLogRows;

  if (!rows.length) {
    fullList.innerHTML = '<li><span>EMPTY</span> NO UPDATES MATCH THIS SEARCH.</li>';
    fullMeta.innerText = normalizedQuery ? `NO MATCHES FOR "${String(searchTerm).trim().toUpperCase()}"` : "NO MERGED UPDATES FOUND";
    return;
  }

  let previousDateHeading = "";
  fullList.innerHTML = rows
    .map((row) => {
      const dateHeading = formatUpdateLogDateHeading(row.mergedAt);
      const dateRow = dateHeading !== previousDateHeading
        ? `<li class="update-log-day-title">${escapeHtml(dateHeading)}</li>`
        : "";
      previousDateHeading = dateHeading;
      return `${dateRow}<li><span>${escapeHtml(row.number)}</span> ${escapeHtml(row.title)}</li>`;
    })
    .join("");
  fullMeta.innerText = normalizedQuery
    ? `SHOWING ${rows.length} OF ${mergedUpdateLogRows.length} MERGED UPDATES`
    : `SHOWING ${rows.length} MERGED UPDATES`;
}

function initUpdateLogSearch() {
  const input = document.getElementById("updateLogSearchInput");
  if (!input || input.dataset.ready === "1") return;
  input.dataset.ready = "1";
  input.addEventListener("input", () => {
    renderFullUpdateLogRows(input.value);
  });
}

async function refreshUpdateLogFromMergedPrs() {
  const panel = document.getElementById("updateLogPanel");
  const list = document.getElementById("updateLogList");
  const input = document.getElementById("updateLogSearchInput");
  if (!panel || !list) return;

  initUpdateLogSearch();

  const owner = String(panel.dataset.githubOwner || "").trim();
  const repo = String(panel.dataset.githubRepo || "").trim();
  if (!owner || !repo) {
    renderUpdateLogMessage("SET data-github-owner / data-github-repo TO ENABLE AUTO LOG", "CONFIG");
    return;
  }

  const cacheKey = `goonerUpdateLog:${owner}/${repo}`;
  const cacheTtlMs = 5 * 60 * 1000;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (cached && Date.now() - Number(cached.ts || 0) < cacheTtlMs && Array.isArray(cached.rows) && Array.isArray(cached.allRows)) {
      list.innerHTML = cached.rows.join("");
      mergedUpdateLogRows = cached.allRows.map((row, index) => normalizeUpdateLogRow(row, index + 1));
      renderFullUpdateLogRows(input?.value || "");
      return;
    }
  } catch {}

  try {
    const merged = await fetchMergedPullRequests(owner, repo);

    if (!merged.length) {
      mergedUpdateLogRows = [];
      renderUpdateLogMessage("NO MERGED PULL REQUESTS FOUND", "EMPTY");
      renderFullUpdateLogRows(input?.value || "");
      return;
    }

    const allRows = merged.map((pr, index) => {
      const normalized = normalizeUpdateLogRow(pr, index + 1);
      const match = normalized.title.match(/commit\s*#?\s*(\d+)/i);
      return {
        ...normalized,
        number: match ? `#${match[1]}` : normalized.number,
      };
    });

    mergedUpdateLogRows = allRows;
    const compactRows = allRows.slice(0, 5).map((row) => `<li><span>${escapeHtml(row.number)}</span> ${escapeHtml(row.title)}</li>`);
    list.innerHTML = compactRows.join("");
    renderFullUpdateLogRows(input?.value || "");
    localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), rows: compactRows, allRows }));
  } catch (_error) {
    renderUpdateLogMessage("UNABLE TO LOAD MERGED PR FEED", "OFFLINE");
    const fullMeta = document.getElementById("updateLogFullMeta");
    if (fullMeta) fullMeta.innerText = "FULL UPDATE LOG OFFLINE";
  }
}

function initTrendingGamesPanel() {
  const wrap = document.getElementById("trendingGamesList");
  if (!wrap || wrap.dataset.ready === "1") return;
  wrap.dataset.ready = "1";

  wrap.addEventListener("click", (event) => {
    const button = event.target.closest("[data-game]");
    const game = button?.dataset.game;
    if (!game) return;
    if (typeof window.launchGame === "function") {
      window.launchGame(game, "trending");
    }
  });

  refreshTrendingGames();
  setInterval(refreshTrendingGames, 60000);
}

function initRandomGameButton() {
  const button = document.getElementById("randomGameBtn");
  if (!button || button.dataset.ready === "1") return;
  button.dataset.ready = "1";

  button.addEventListener("click", () => {
    const gameButtons = Array.from(document.querySelectorAll(".games-grid .game-card[data-game]"));
    if (!gameButtons.length || typeof window.launchGame !== "function") return;

    const visibleGames = gameButtons.filter((gameBtn) => gameBtn.offsetParent !== null);
    const pool = visibleGames.length ? visibleGames : gameButtons;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const game = String(pick?.dataset.game || "").trim();
    if (!game) return;
    window.launchGame(game, "random");
  });
}

function initHomePanelOverlayButtons() {
  const buttons = document.querySelectorAll("[data-open-overlay]");
  buttons.forEach((button) => {
    if (button.dataset.ready === "1") return;
    button.dataset.ready = "1";
    button.addEventListener("click", () => {
      const overlayId = String(button.dataset.openOverlay || "").trim();
      if (!overlayId) return;
      openGame(overlayId);
      if (overlayId === "overlayTrending") refreshTrendingMonthGraph();
      if (overlayId === "overlayUpdates") refreshUpdateLogFromMergedPrs();
    });
  });
}

export function trackGamePlay(game) {
  const normalized = String(game || "").toLowerCase().trim();
  if (!normalized) return;
  addDoc(collection(db, "gooner_game_plays"), {
    game: normalized,
    name: myName || "ANON",
    ts: Date.now(),
  }).catch(() => {});
}

function getAvailableSeasonIds() {
  const ids = [String(seasonData.id || "").toUpperCase(), ...(seasonData.hall || []).map((entry) => String(entry.id || "").toUpperCase())]
    .filter(Boolean);
  return Array.from(new Set(ids));
}

function renderSeasonTabs() {
  const tabWrap = document.getElementById("seasonTabs");
  if (!tabWrap) return;
  const seasonIds = getAvailableSeasonIds();
  if (!seasonIds.length) {
    tabWrap.innerHTML = '<div class="score-item">NO SEASONS AVAILABLE</div>';
    return;
  }
  if (!seasonIds.includes(activeSeasonTab)) activeSeasonTab = seasonIds[0];
  tabWrap.innerHTML = seasonIds
    .map((id) => `<div class="score-tab ${id === activeSeasonTab ? "active" : ""}" data-season-tab="${escapeHtml(id)}">SEASON ${escapeHtml(id)}</div>`)
    .join("");
  tabWrap.querySelectorAll("[data-season-tab]").forEach((el) => {
    el.onclick = () => {
      activeSeasonTab = el.dataset.seasonTab || seasonIds[0];
      renderSeasonTabs();
      renderSeasonBoard();
    };
  });
}

function renderSeasonSubTabs() {
  const subWrap = document.getElementById("seasonSubTabs");
  if (!subWrap) return;
  subWrap.querySelectorAll("[data-season-subtab]").forEach((el) => {
    el.classList.toggle("active", (el.dataset.seasonSubtab || "solo") === activeSeasonSubTab);
    el.onclick = () => {
      activeSeasonSubTab = el.dataset.seasonSubtab || "solo";
      renderSeasonSubTabs();
      renderSeasonBoard();
    };
  });
}

function renderSeasonBoard() {
  const boardList = document.getElementById("seasonBoardList");
  const title = document.getElementById("seasonBoardTitle");
  if (!boardList || !title) return;
  const modeLabel = activeSeasonSubTab === "gang" ? "GANG SCORES" : "SOLO SCORES";
  title.innerText = `SEASON ${activeSeasonTab || "--"} // ${modeLabel}`;

  if (!activeSeasonTab) {
    boardList.innerHTML = '<div class="score-item">NO SEASON DATA</div>';
    return;
  }

  if (activeSeasonTab === String(seasonData.id || "").toUpperCase()) {
    const rows = getLiveSeasonBoardRows(activeSeasonSubTab);
    boardList.innerHTML = rows.length
      ? rows
          .map((row, idx) => activeSeasonSubTab === "gang"
            ? `<div class="score-item">#${idx + 1} [${escapeHtml(row.tag)}] // $${Math.round(row.money)} // ${row.members} OPS</div>`
            : `<div class="score-item">#${idx + 1} ${escapeHtml(row.name)} <span style="opacity:.7">${escapeHtml(row.crewTag)}</span> // $${Math.round(row.money)}</div>`)
          .join("")
      : `<div class="score-item">LOADING ${modeLabel}...</div>`;
    return;
  }

  const archivedEntries = (seasonData.hall || [])
    .filter((entry) => String(entry.id || "").toUpperCase() === activeSeasonTab)
    .sort((a, b) => Number(b.money || 0) - Number(a.money || 0))
    .slice(0, 10);

  if (activeSeasonSubTab === "gang") {
    const crewTotals = {};
    archivedEntries.forEach((entry) => {
      const crewTag = String(entry.crewTag || "SOLO").toUpperCase();
      if (crewTag === "SOLO") return;
      if (!crewTotals[crewTag]) crewTotals[crewTag] = { tag: crewTag, money: 0, members: 0 };
      crewTotals[crewTag].money += Number(entry.money || 0);
      crewTotals[crewTag].members += 1;
    });
    const crewRows = Object.values(crewTotals).sort((a, b) => b.money - a.money).slice(0, 10);
    boardList.innerHTML = crewRows.length
      ? crewRows.map((row, idx) => `<div class="score-item">#${idx + 1} [${escapeHtml(row.tag)}] // $${Math.round(row.money)} // ${row.members} OPS</div>`).join("")
      : '<div class="score-item">NO ARCHIVED GANG SCORES FOR THIS SEASON</div>';
    return;
  }

  boardList.innerHTML = archivedEntries.length
    ? archivedEntries.map((entry, idx) => `<div class="score-item">#${idx + 1} ${escapeHtml(entry.name)} <span style="opacity:.7">${escapeHtml(String(entry.crewTag || "SOLO").toUpperCase())}</span> // $${Math.round(Number(entry.money || entry.xp) || 0)}</div>`).join("")
    : '<div class="score-item">NO ARCHIVED SOLO SCORES FOR THIS SEASON</div>';
}

function getLiveSeasonBoardRows(mode = "solo") {
  const normalizedName = String(myName || "ANON").toUpperCase();
  const normalizedCrewTag = normalizeCrewTag(crewData.tag) || "SOLO";
  const localMoney = Math.max(0, Number(myMoney) || 0);

  if (mode === "gang") {
    const gangTotals = {};
    (cachedSeasonBoards.gang || []).forEach((row) => {
      const tag = normalizeCrewTag(row.tag);
      if (!tag) return;
      gangTotals[tag] = {
        tag,
        money: Math.max(0, Number(row.money) || 0),
        members: Math.max(0, Math.floor(Number(row.members) || 0)),
      };
    });

    if (normalizedCrewTag !== "SOLO") {
      const existing = gangTotals[normalizedCrewTag];
      if (existing) {
        existing.money = Math.max(existing.money, localMoney);
        existing.members = Math.max(existing.members, 1);
      } else {
        gangTotals[normalizedCrewTag] = { tag: normalizedCrewTag, money: localMoney, members: 1 };
      }
    }

    return Object.values(gangTotals).sort((a, b) => b.money - a.money).slice(0, 10);
  }

  const soloRows = (cachedSeasonBoards.solo || []).filter((row) => String(row.name || "").toUpperCase() !== normalizedName);
  soloRows.push({ name: normalizedName, money: localMoney, crewTag: normalizedCrewTag });
  return soloRows.sort((a, b) => b.money - a.money).slice(0, 10);
}

function renderSeasonPanel() {
  ensureCurrentSeason();
  const target = 10000;
  const seasonMoney = Math.max(0, Math.floor(Number(myMoney) || 0));
  const pct = Math.max(0, Math.min(100, Math.floor((seasonMoney / target) * 100)));
  setText("seasonName", `WEEKLY SEASON ${seasonData.id}`);
  setText("seasonProgressLabel", `$${seasonMoney} / $${target}`);
  const fill = document.getElementById("seasonProgressFill");
  if (fill) fill.style.width = `${pct}%`;

  const missions = [
    { id: "games", label: "PLAY 10 GAMES", done: (myStats.games || 0) >= 10, xp: 300 },
    { id: "chat", label: "SEND 20 CHAT MESSAGES", done: chatCount >= 20, xp: 250 },
    { id: "bank", label: "REACH $10000 BANK", done: Number(myMoney) >= 10000, xp: 350 },
    { id: "wins", label: "WIN 8 MATCHES", done: (myStats.wins || 0) >= 8, xp: 400 },
  ];
  const wrap = document.getElementById("seasonMissions");
  if (wrap) {
    wrap.innerHTML = missions
      .map((mission) => `<div class="score-item ${mission.done ? "season-mission-done" : ""}">${mission.done ? "✅" : "⬜"} ${mission.label} <span style="opacity:.7">+${mission.xp} XP</span></div>`)
      .join("");
  }

  const hall = document.getElementById("seasonHall");
  if (hall) {
    if (!seasonData.hall.length) {
      hall.innerHTML = '<div class="score-item">HALL OF FAME WILL POPULATE WEEK TO WEEK</div>';
    } else {
      hall.innerHTML = seasonData.hall
        .slice(-5)
        .reverse()
        .map((entry) => `<div class="score-item">${escapeHtml(entry.id)} // ${escapeHtml(entry.name)} // $${Math.round(Number(entry.money ?? entry.xp) || 0)}</div>`)
        .join("");
    }
  }

  renderSeasonTabs();
  renderSeasonSubTabs();
  renderSeasonBoard();
  loadSeasonLeaderboards();
}


function ensureCurrentSeason() {
  const currentId = getSeasonId();
  if (seasonData.id === currentId) return;
  if (Number(myMoney || 0) > 0) {
    seasonData.hall = [...(seasonData.hall || []), { id: seasonData.id, name: myName, money: Number(myMoney || 0), crewTag: crewData.tag || "SOLO" }].slice(-20);
  }
  seasonData.id = currentId;
  seasonData.xp = 0;
  myMoney = SEASON_STARTING_MONEY;
  logTransaction("WEEKLY SEASON RESET", 0);
  showToast("WEEKLY RESET", "📆", `BANK RESET TO $${SEASON_STARTING_MONEY}`);
  saveSeasonData();
}

function grantSeasonXp(amount) {
  if (myName === "ANON") return;
  ensureCurrentSeason();
  seasonData.xp += Math.max(0, Math.floor(amount));
  saveSeasonData();
  renderSeasonPanel();
}

function loadSeasonLeaderboards() {
  const boardList = document.getElementById("seasonBoardList");
  if (!boardList) return;
  if (seasonBoardUnsub) seasonBoardUnsub();

  const q = query(collection(db, "gooner_users"), limit(200));
  seasonBoardUnsub = onSnapshot(q, (snap) => {
    const players = [];
    const crews = {};
    snap.forEach((d) => {
      const data = d.data() || {};
      const playerName = String(data.name || d.id || "ANON").toUpperCase();
      const playerSeason = data.seasonData || {};
      const playerMoney = Number(playerSeason.id === getSeasonId() ? data.money : SEASON_STARTING_MONEY) || 0;
      const playerCrew = data.crewData || {};
      const crewTag = String(playerCrew.tag || "").toUpperCase();
      players.push({ name: playerName, money: playerMoney, crewTag: crewTag || "SOLO" });
      if (crewTag) {
        if (!crews[crewTag]) crews[crewTag] = { tag: crewTag, money: 0, members: 0 };
        crews[crewTag].money += playerMoney;
        crews[crewTag].members += 1;
      }
    });

    cachedSeasonBoards.solo = players.sort((a, b) => b.money - a.money).slice(0, 10);
    cachedSeasonBoards.gang = Object.values(crews).sort((a, b) => b.money - a.money).slice(0, 10);
    renderSeasonBoard();
  });
}

function renderCrewPanel() {
  setText("crewName", crewData.tag || "NONE");
  setText("crewRole", crewData.role || "SOLO");
  setText("crewMotto", crewData.motto || "---");
  setText("crewRecruitment", crewData.recruitmentOpen ? "OPEN" : "CLOSED");
  setText("crewGoal", `$${Math.round(crewData.goal || 0)}`);
  setText("crewBank", `$${Math.round(crewData.bank || 0)}`);
  setText("crewWins", Math.round(crewData.wins || 0));
  setText("crewXp", Math.round(myMoney || 0));
  setText("crewMembers", (crewData.members || []).length);
}

function initCrewUx() {
  const createBtn = document.getElementById("crewCreateBtn");
  const leaveBtn = document.getElementById("crewLeaveBtn");
  const contributeBtn = document.getElementById("crewContributeBtn");
  const mottoBtn = document.getElementById("crewMottoBtn");
  const recruitmentBtn = document.getElementById("crewRecruitmentBtn");
  const goalBtn = document.getElementById("crewGoalBtn");
  const input = document.getElementById("crewInput");
  const mottoInput = document.getElementById("crewMottoInput");
  const donateInput = document.getElementById("crewDonateAmount");
  if (!createBtn || !leaveBtn || !contributeBtn || !input) return;

  createBtn.onclick = () => {
    const tag = normalizeCrewTag(input.value);
    if (!/^[A-Z0-9_]{3,8}$/.test(tag)) {
      setText("crewMsg", "USE 3-8 LETTER/NUMBER TAG");
      return;
    }
    const isNew = !crewData.tag || crewData.tag !== tag;
    crewData.tag = tag;
    crewData.role = isNew ? "CAPTAIN" : (crewData.role || "MEMBER");
    crewData.members = Array.from(new Set([...(crewData.members || []), myName]));
    saveCrewData();
    renderCrewPanel();
    setText("crewMsg", `LINKED TO CREW ${tag}`);
    showToast("CREW LINK ESTABLISHED", "🛰️", tag);
  };

  leaveBtn.onclick = () => {
    crewData = { tag: "", role: "SOLO", motto: "", recruitmentOpen: true, goal: 5000, bank: 0, wins: 0, members: [] };
    saveCrewData();
    renderCrewPanel();
    setText("crewMsg", "LEFT CREW CHANNEL");
  };

  contributeBtn.onclick = async () => {
    if (!crewData.tag) return setText("crewMsg", "JOIN A CREW FIRST");
    const amount = Math.max(100, parseInt((donateInput?.value || "500"), 10) || 0);
    if (myMoney < amount) return setText("crewMsg", `NEED $${amount} TO DONATE`);
    myMoney -= amount;
    crewData.bank += amount;
    saveCrewData();
    await saveStats();
    renderCrewPanel();
    setText("crewMsg", `DONATED $${amount}`);
  };

  if (mottoBtn) {
    mottoBtn.onclick = async () => {
      if (!crewData.tag) return setText("crewMsg", "JOIN A CREW FIRST");
      crewData.motto = String(mottoInput?.value || "").trim().toUpperCase().slice(0, 24);
      saveCrewData();
      await saveStats();
      renderCrewPanel();
      setText("crewMsg", "CREW MOTTO UPDATED");
    };
  }

  if (recruitmentBtn) {
    recruitmentBtn.onclick = async () => {
      if (!crewData.tag) return setText("crewMsg", "JOIN A CREW FIRST");
      crewData.recruitmentOpen = !crewData.recruitmentOpen;
      saveCrewData();
      await saveStats();
      renderCrewPanel();
      setText("crewMsg", `RECRUITMENT ${crewData.recruitmentOpen ? "OPEN" : "CLOSED"}`);
    };
  }

  if (goalBtn) {
    goalBtn.onclick = async () => {
      if (!crewData.tag) return setText("crewMsg", "JOIN A CREW FIRST");
      const goals = [5000, 10000, 25000, 50000];
      const idx = goals.indexOf(Number(crewData.goal || 5000));
      crewData.goal = goals[(idx + 1) % goals.length];
      saveCrewData();
      await saveStats();
      renderCrewPanel();
      setText("crewMsg", `WEEKLY GOAL SET TO $${crewData.goal}`);
    };
  }
}

// Track recent money changes for the bank log.
export function logTransaction(msg, amount) {
  transactionLog.unshift({ msg, amount, ts: new Date().toLocaleTimeString() });
  if (transactionLog.length > 20) transactionLog.pop();
  updateBankLog();
}

// Render the bank log history into the overlay.
export function updateBankLog() {
  const div = document.getElementById("bankLog");
  div.innerHTML = transactionLog
    .map(
      (t) =>
        `<div class="bank-entry"><span>${t.ts} ${t.msg}</span><span style="color:${
          t.amount >= 0 ? "#0f0" : "#f00"
        }">${t.amount >= 0 ? "+" : ""}$${t.amount}</span></div>`
    )
    .join("");
}

// Kick off anonymous auth so we can load/save data immediately.
const initAuth = async () => {
  try {
    const cred = await signInAnonymously(auth);
    if (cred?.user?.uid && !myUid) myUid = cred.user.uid;
    return true;
  } catch (e) {
    console.error(e);
    handleFirebaseError(e, "AUTH", "Login services are temporarily offline.");
    return false;
  }
};
const authInitPromise = initAuth();
loadCrewData();
loadSeasonData();
renderLiveOps();
initTrendingGamesPanel();
initRandomGameButton();
initHomePanelOverlayButtons();
initGameLeaderboardButton();
syncGameLeaderboardButton();
refreshTrendingMonthGraph();
refreshUpdateLogFromMergedPrs();
setupBankTransferUX();
setupLoanUX();
setupStockMarketUX();
initCrewUx();
setInterval(renderLiveOps, 15000);
setInterval(refreshUpdateLogFromMergedPrs, 5 * 60 * 1000);
onAuthStateChanged(auth, async (u) => {
  if (u) {
    myUid = u.uid;
    await refreshAdminClaim();
    updateAdminMenu();
    await ensureGlobalMarket();
    subscribeToGlobalMarket();
    initChat();
    refreshTrendingGames();
    refreshTrendingMonthGraph();
    refreshUpdateLogFromMergedPrs();
  }
});

// Update clock/ping display and check time-based achievements.
setInterval(() => {
  const d = new Date();
  setText("sysClock", d.toLocaleTimeString("en-GB"));
  setText("sysPing", Math.floor(Math.random() * 40 + 10) + "ms");
  if (d.getMinutes() === 37) unlockAchievement("leet");
  if (d.getHours() === 3) unlockAchievement("insomniac");
}, 1000);

function openConfigOverlay() {
  const configOverlay = document.getElementById("overlayConfig");
  if (!configOverlay) return;
  configOverlay.classList.add("active");
  document.body.classList.add("overlay-open");
}

const TOP_PANEL_OVERLAY_IDS = [
  "overlayConfig",
  "overlayBank",
  "overlayShop",
  "overlayProfile",
  "overlayScores",
  "overlaySeason",
  "overlayCrew",
  "overlayAdmin",
  "overlayGames",
];

function runOverlayOpenHooks(id) {
  if (id === "overlayAdmin") adminRefreshTargetUsers();
  if (id === "overlayProfile") renderBadges();
  if (id === "overlayShop") renderShop();
  if (id === "overlaySeason") renderSeasonPanel();
  if (id === "overlayCrew") renderCrewPanel();
  if (["overlayJobs", "overlayJobCashier", "overlayJobFrontdesk", "overlayJobDelivery", "overlayJobStocker", "overlayJobJanitor", "overlayJobBarista"].includes(id)) renderJobs();
  if (id === "overlayBank") {
    updateBankLog();
    renderStockMarket();
    setText("bankTransferMsg", "");
    setText("bankLoanMsg", "");
    setText("stockTradeMsg", "");
  }
  if (id === "overlayScores") {
    loadLeaderboard();
  }
  if (id === "overlayTrending") {
    refreshTrendingMonthGraph();
  }
  if (id === "overlayUpdates") {
    refreshUpdateLogFromMergedPrs();
  }
}

export function closeConfigOverlay() {
  const configOverlay = document.getElementById("overlayConfig");
  if (!configOverlay) return;
  if (configOverlay.classList.contains("active") && typeof window.toggleTopPanelOverlay === "function") {
    window.toggleTopPanelOverlay("overlayConfig");
    return;
  }
  configOverlay.classList.remove("active");
  const hasActiveOverlay = Boolean(document.querySelector(".overlay.active"));
  document.body.classList.toggle("overlay-open", hasActiveOverlay);
}

window.openConfigOverlay = openConfigOverlay;
window.closeConfigOverlay = closeConfigOverlay;
window.toggleConfigOverlay = () => {
  if (typeof window.toggleTopPanelOverlay === "function") {
    window.toggleTopPanelOverlay("overlayConfig");
    return;
  }
  const configOverlay = document.getElementById("overlayConfig");
  if (!configOverlay) return;
  if (configOverlay.classList.contains("active")) {
    closeConfigOverlay();
  } else {
    openConfigOverlay();
  }
};

window.toggleTopPanelOverlay = (id) => {
  if (id === "overlayAdmin" && !isGodUser()) return;
  const target = document.getElementById(id);
  if (!target) return;

  const isClosingSameOverlay = target.classList.contains("active");

  TOP_PANEL_OVERLAY_IDS.forEach((overlayId) => {
    if (overlayId === id) return;
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.classList.remove("active");
  });

  if (isClosingSameOverlay) {
    target.classList.remove("active");
  } else {
    target.classList.add("active");
    runOverlayOpenHooks(id);
  }

  const hasActiveOverlay = Boolean(document.querySelector(".overlay.active"));
  document.body.classList.toggle("overlay-open", hasActiveOverlay);
  document.body.classList.toggle("games-directory-open", Boolean(document.getElementById("overlayGames")?.classList.contains("active")));
};

// Open an overlay by id, optionally render its contents.
export function openGame(id) {
  if (id === "overlayAdmin" && !isGodUser()) return;
  if (id === "overlayConfig") {
    openConfigOverlay();
    return;
  }
  closeOverlays();
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  document.body.classList.toggle("overlay-open", Boolean(el));
  document.body.classList.toggle("games-directory-open", id === "overlayGames");
  runOverlayOpenHooks(id);
}

// Close overlays and clear dropdown state.
export function closeOverlays() {
  stopAllGames();
  document
    .querySelectorAll(".overlay")
    .forEach((o) => o.classList.remove("active"));
  clearLeaderboardSubscriptions();
  const menuDropdown = document.getElementById("menuDropdown");
  if (menuDropdown) menuDropdown.classList.remove("show");
  document.body.classList.remove("games-directory-open");
  document.body.classList.remove("overlay-open");
}

function normalizeUsername(username) {
  return String(username || "").trim().toUpperCase();
}

function normalizePin(pin) {
  return String(pin || "").trim();
}

function isValidCredentials(username, pin) {
  return /^[A-Z0-9_]{3,10}$/.test(username) && /^\d{4}$/.test(pin);
}

async function getRemoteProfileByUsername(normalized) {
  const directSnap = await getDoc(doc(db, "gooner_users", normalized));
  if (directSnap.exists()) return directSnap.data();

  const fallbackQuery = await getDocs(query(collection(db, "gooner_users"), where("name", "==", normalized), limit(1)));
  if (!fallbackQuery.empty) return fallbackQuery.docs[0].data();

  return null;
}

// Attempt to log in with username + PIN and load their profile.
async function login(username, pin) {
  const normalized = normalizeUsername(username);
  const normalizedPin = normalizePin(pin);
  if (!isValidCredentials(normalized, normalizedPin)) {
    return "USE 3-10 CHAR CODENAME + 4-DIGIT PIN";
  }
  try {
    await authInitPromise;
    const profile = await getRemoteProfileByUsername(normalized);
    if (profile) {
      if (normalizePin(profile.pin) === normalizedPin) {
        saveLocalProfileSnapshot(profile);
        loadProfile(profile);
        return true;
      }
      return "INVALID PIN";
    }
    const localProfile = getLocalProfile(normalized);
    if (localProfile) {
      if (normalizePin(localProfile.pin) !== normalizedPin) return "INVALID PIN";
      loadProfile(localProfile);
      return true;
    }
    return "USER NOT FOUND";
  } catch (e) {
    const localProfile = getLocalProfile(normalized);
    if (localProfile) {
      if (normalizePin(localProfile.pin) !== normalizedPin) return "INVALID PIN";
      loadProfile(localProfile);
      return true;
    }
    return "ERROR: " + e.message;
  }
}

// Convert money tiers into user-facing rank labels.
function formatBankAmount(value) {
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value.toFixed(2);
    return String(value);
  }
  if (value === null || value === undefined) return "0.00";
  const raw = String(value).trim();
  if (!raw) return "0.00";
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) return parsed.toFixed(2);
  return raw;
}

function getComparableMoney(value) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  if (parsed === Infinity) return Number.MAX_VALUE;
  if (parsed === -Infinity) return -Number.MAX_VALUE;
  return 0;
}

const RANK_TIERS = [
  { key: "iron", label: "IRON", min: 0, max: 1500, badge: "⬢", className: "rank-iron" },
  { key: "bronze", label: "BRONZE", min: 1500, max: 5000, badge: "⬡", className: "rank-bronze" },
  { key: "silver", label: "SILVER", min: 5000, max: 15000, badge: "◈", className: "rank-silver" },
  { key: "gold", label: "GOLD", min: 15000, max: 40000, badge: "✦", className: "rank-gold" },
  { key: "platinum", label: "PLATINUM", min: 40000, max: 90000, badge: "✧", className: "rank-platinum" },
  { key: "diamond", label: "DIAMOND", min: 90000, max: 175000, badge: "💎", className: "rank-diamond" },
  { key: "ascendant", label: "ASCENDANT", min: 175000, max: 300000, badge: "⬣", className: "rank-ascendant" },
  { key: "immortal", label: "IMMORTAL", min: 300000, max: 500000, badge: "👑", className: "rank-immortal" },
  { key: "radiant", label: "RADIANT", min: 500000, max: Infinity, badge: "☀", className: "rank-radiant" },
];

function getRankTier(money) {
  return RANK_TIERS.find((tier) => money >= tier.min && money < tier.max) || RANK_TIERS[0];
}

function getRankData(money, name = myName) {
  if (isGodUser(name)) {
    return {
      label: "GOD",
      badge: "⚡",
      className: "rank-god",
      min: Number.MAX_SAFE_INTEGER,
      max: Number.MAX_SAFE_INTEGER,
    };
  }
  return getRankTier(Number(money) || 0);
}

function getRank(money, name = myName) {
  return getRankData(money, name).label;
}

function getRankProgress(money) {
  const currentTier = getRankTier(Number(money) || 0);
  if (!Number.isFinite(currentTier.max)) {
    return { label: "RADIANT // MAX RANK", pct: 100 };
  }
  const nextTier = RANK_TIERS[RANK_TIERS.indexOf(currentTier) + 1];
  const span = currentTier.max - currentTier.min;
  const earned = money - currentTier.min;
  const pct = Math.max(0, Math.min(100, Math.round((earned / span) * 100)));
  return {
    label: `$${Math.max(0, currentTier.max - money).toLocaleString()} TO ${nextTier.label}`,
    pct,
  };
}

// Populate local state from stored profile data.
function loadProfile(data) {
  myName = data.name;
  myMoney = data.money;
  myStats = data.stats || { games: 0, wpm: 0, wins: 0 };
  myAchievements = data.achievements || [];
  myInventory = data.inventory || [];
  myJoined = data.joined || 0;
  myItemToggles = { ...(data.itemToggles || {}), ...loadLocalShopToggles(data.name) };
  jobData = data.jobs || { cooldowns: {}, completed: { cashier: 0, frontdesk: 0, delivery: 0, stocker: 0, janitor: 0, barista: 0 } };
  loanData = data.loanData || { debt: 0, rate: 0, lastInterestAt: 0 };
  stockData = data.stockData || { holdings: {}, selected: "GOON", buyMultiplier: 1 };
  crewData = { tag: "", role: "SOLO", motto: "", recruitmentOpen: true, goal: 5000, bank: 0, wins: 0, members: [], ...(data.crewData || crewData || {}) };
  seasonData = { id: getSeasonId(), xp: 0, hall: [], ...(data.seasonData || seasonData || {}) };
  const currentSeasonId = getSeasonId();
  if (seasonData.id !== currentSeasonId) {
    if (Number(data.money || 0) > 0) {
      seasonData.hall = [...(seasonData.hall || []), { id: seasonData.id, name: myName, money: Number(data.money || 0), crewTag: crewData.tag || "SOLO" }].slice(-20);
    }
    seasonData.id = currentSeasonId;
    seasonData.xp = 0;
    myMoney = SEASON_STARTING_MONEY;
    showToast("WEEKLY RESET", "📆", `BANK RESET TO $${SEASON_STARTING_MONEY}`);
    updateDoc(doc(db, "gooner_users", myName), {
      money: myMoney,
      seasonData,
    }).catch(() => {});
  }
  ensureStockProfile();
  saveLocalShopToggles();
  updateUI();
  document.getElementById("overlayLogin").classList.remove("active");
  localStorage.setItem("goonerUser", myName);
  localStorage.setItem("goonerPin", data.pin);
  if (hasActiveItem("item_matrix")) {
    setMatrixMode(true);
    document.documentElement.style.setProperty("--accent", "#00ff00");
  }
  applyOwnedVisuals();
  const lastLogin = data.lastLogin || 0;
  const now = Date.now();
  if (now - lastLogin > 86400000) {
    myMoney += 100;
    showToast("DAILY BONUS: $100", "💰");
  }
  updateDoc(doc(db, "gooner_users", myName), { lastLogin: now });
  updateMatrixToggle();
  updateAdminMenu();
}

// Render all user-facing UI fields based on the latest state.
function updateUI() {
  setText("displayUser", myName);
  const bankEl = document.getElementById("globalBank");
  const bankOverlayEl = document.getElementById("bankDisplay");
  const currentVal = getComparableMoney(bankEl.innerText);
  const nextVal = getComparableMoney(myMoney);
  if (currentVal !== nextVal) {
    bankEl.style.color = nextVal > currentVal ? "#0f0" : "#f00";
    setTimeout(() => (bankEl.style.color = "var(--accent)"), 500);
  }
  bankEl.innerText = formatBankAmount(myMoney);
  if (bankOverlayEl) bankOverlayEl.innerText = formatBankAmount(myMoney);
  setText("loanDebt", `$${Math.max(0, Math.round(loanData.debt || 0))}`);
  setText("loanRate", `${Math.round((loanData.rate || 0) * 100)}%`);
  setText("profName", myName);
  setText("profBank", "$" + myMoney);
  setText("profWPM", (myStats.wpm || 0) + " WPM");
  setText("profGames", myStats.games || 0);
  setText("profWins", myStats.wins || 0);
  setText("profAch", `${myAchievements.length} / ${ACHIEVEMENTS.length}`);
  setText("profJoined", myJoined ? new Date(myJoined).toLocaleDateString("en-GB") : "UNKNOWN");
  setText("profUid", myUid ? myUid.substring(0, 8) : "ERR");
  if (crewData.tag) {
    crewData.wins = Math.max(Number(crewData.wins) || 0, Number(myStats.wins) || 0);
    if (!crewData.members.includes(myName)) crewData.members.push(myName);
    crewData.role = crewData.role || "MEMBER";
    crewData.goal = Number(crewData.goal || 5000);
    saveCrewData();
  }
  renderCrewPanel();
  renderSeasonPanel();
  renderLiveOps();
  const rank = getRank(myMoney);
  const rankData = getRankData(myMoney);
  setText("displayRank", "[" + rank + "]");
  setText("displayRankBadge", rankData.badge);
  setText("profRank", rank);
  setText("profRankBadge", rankData.badge);
  setText("profSummaryRank", "[" + rank + "]");
  const rankBadgeEls = [document.getElementById("displayRankBadge"), document.getElementById("profRankBadge")];
  rankBadgeEls.forEach((el) => {
    if (!el) return;
    el.className = `rank-badge ${rankData.className}`;
    el.title = `${rankData.label} RANK BADGE`;
  });
  const rankProgress = getRankProgress(myMoney);
  setText("profProgressLabel", rankProgress.label);
  const progressFill = document.getElementById("profProgressFill");
  if (progressFill) progressFill.style.width = `${rankProgress.pct}%`;
  if (myMoney >= 5000) unlockAchievement("diamond_hands");
  if (myMoney >= 1000000) unlockAchievement("millionaire");
  updateMatrixToggle();
  updateAdminMenu();
  if (myMoney === 0) {
    unlockAchievement("rug_pulled");
    myMoney = 10;
    logTransaction("EMERGENCY GRANT", 10);
    showToast("WELFARE GRANT", "💰", "Don't spend it all in one place.");
    saveStats();
  }
}

// Create a new user profile in Firestore.
async function register(username, pin) {
  const normalized = normalizeUsername(username);
  const normalizedPin = normalizePin(pin);
  if (!isValidCredentials(normalized, normalizedPin)) {
    return "USE 3-10 CHAR CODENAME + 4-DIGIT PIN";
  }
  const data = {
    name: normalized,
    pin: normalizedPin,
    money: 1000,
    joined: Date.now(),
    stats: { games: 0, wpm: 0, wins: 0 },
    jobs: { cooldowns: {}, completed: { cashier: 0, frontdesk: 0, delivery: 0, stocker: 0, janitor: 0, barista: 0 } },
    stockData: { holdings: {}, selected: "GOON", buyMultiplier: 1 },
  };

  const localProfile = getLocalProfile(normalized);
  if (localProfile) return "USERNAME TAKEN";

  try {
    await authInitPromise;
    if (!myUid) throw new Error("OFFLINE");
    const ref = doc(db, "gooner_users", normalized);
    const snap = await getDoc(ref);
    if (snap.exists()) return "USERNAME TAKEN";
    await setDoc(ref, data);
    saveLocalProfileSnapshot(data);
    loadProfile(data);
    return true;
  } catch {
    saveLocalProfileSnapshot(data);
    loadProfile(data);
    return true;
  }
}


export async function adminGrantCash(amount) {
  const grant = Math.max(0, Math.floor(Number(amount) || 0));
  if (!grant) {
    showToast("INVALID GRANT AMOUNT", "⚠️");
    return;
  }
  await applyAdminActionToTargets({
    actionName: "GRANT CASH",
    emptyToast: "SELECT A TARGET FIRST",
    mutateRemote: (targetData) => ({
      money: Math.max(0, Number(targetData?.money) || 0) + grant,
    }),
    mutateLocal: () => {
      myMoney += grant;
      logTransaction("ADMIN CASH GRANT", grant);
    },
    successToast: (targets) => `GRANTED +$${grant.toLocaleString()} TO ${targets.length} PLAYER(S)`,
    failToast: "ADMIN CASH GRANT FAILED",
  });
}

function getAdminTargetUser() {
  const userInput = document.getElementById("adminTargetUser");
  const candidate = String(userInput?.value || "")
    .trim()
    .toUpperCase();
  if (!candidate) return "";
  if (!/^[A-Z0-9_]{3,10}$/.test(candidate)) return "";
  return candidate;
}

function getAdminTargetScope() {
  const scopeSelect = document.getElementById("adminTargetScope");
  const scope = String(scopeSelect?.value || "self").trim().toLowerCase();
  if (["all", "others", "self", "username"].includes(scope)) return scope;
  return "self";
}

async function resolveAdminTargetUsers() {
  const scope = getAdminTargetScope();
  const selected = getAdminTargetUser();
  if (selected) return [selected];
  if (scope === "self") return [myName];
  if (scope === "username") return [myName];

  const names = [];
  const snap = await getDocs(query(collection(db, "gooner_users"), orderBy("name"), limit(200)));
  snap.forEach((playerDoc) => {
    const playerName = String(playerDoc.data()?.name || playerDoc.id || "")
      .trim()
      .toUpperCase();
    if (!playerName) return;
    if (scope === "others" && playerName === myName) return;
    names.push(playerName);
  });
  return names;
}

async function applyAdminActionToTargets({ actionName, emptyToast, mutateRemote, mutateLocal, successToast, failToast }) {
  if (!isGodUser()) return;
  try {
    const targets = await resolveAdminTargetUsers();
    if (!targets.length) {
      showToast(emptyToast, "⚠️");
      return;
    }

    const uniqueTargets = Array.from(new Set(targets));
    await Promise.all(
      uniqueTargets.map((target) =>
        runTransaction(db, async (transaction) => {
          const targetRef = doc(db, "gooner_users", target);
          const targetSnap = await transaction.get(targetRef);
          if (!targetSnap.exists()) return;
          const patch = mutateRemote(targetSnap.data(), target);
          if (patch && typeof patch === "object" && Object.keys(patch).length) {
            transaction.update(targetRef, patch);
          }
        })
      )
    );

    if (uniqueTargets.includes(myName)) {
      mutateLocal?.();
      await saveStats();
    }

    showToast(successToast(uniqueTargets), "✅", `${actionName}: ${uniqueTargets.length} target(s)`);
  } catch {
    showToast(failToast, "⚠️", "Try refreshing player list and retry.");
  }
}

export async function adminRefreshTargetUsers() {
  if (!isGodUser()) return;
  const userInput = document.getElementById("adminTargetUser");
  const userList = document.getElementById("adminTargetUserList");
  if (!userInput || !userList) return;

  const previous = String(userInput.value || "")
    .trim()
    .toUpperCase();
  userList.innerHTML = "";

  try {
    const snap = await getDocs(query(collection(db, "gooner_users"), orderBy("name"), limit(200)));
    const names = [];
    snap.forEach((playerDoc) => {
      const playerName = String(playerDoc.data()?.name || playerDoc.id || "")
        .trim()
        .toUpperCase();
      if (playerName) names.push(playerName);
    });

    names
      .sort((a, b) => a.localeCompare(b))
      .forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        userList.appendChild(option);
      });

    if (previous && names.includes(previous)) userInput.value = previous;
    showToast(`TARGET LIST READY (${names.length})`, "🎯");
  } catch {
    showToast("FAILED TO LOAD TARGETS", "⚠️", "Check connection.");
  }
}

function readAdminNumberInput(id, fallback = 0) {
  const input = document.getElementById(id);
  const value = Number(input?.value);
  return Number.isFinite(value) ? value : fallback;
}

function readAdminTextInput(id) {
  const input = document.getElementById(id);
  return String(input?.value || "").trim();
}

function clearAdminTextInput(id) {
  const input = document.getElementById(id);
  if (input) input.value = "";
}

function readAdminActionChoice(id, allowed, fallback) {
  const input = document.getElementById(id);
  const value = String(input?.value || "")
    .trim()
    .toLowerCase();
  return allowed.includes(value) ? value : fallback;
}

function parseTypedAdminValue(type, raw) {
  if (type === "string") return String(raw || "").trim();
  if (type === "integer") {
    const value = Math.floor(Number(raw));
    return Number.isFinite(value) ? value : null;
  }
  if (type === "boolean") {
    const normalized = String(raw || "").trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
    return null;
  }
  if (type === "list") {
    return String(raw || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return null;
}

function validateAdminSettingValue(key, type, value) {
  const setting = String(key || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(setting)) return { ok: false, message: "INVALID SETTING KEY" };
  if (type === "integer" && (!Number.isInteger(value) || value < 0 || value > 1000000000)) {
    return { ok: false, message: "INTEGER OUT OF RANGE" };
  }
  if (setting === "role") {
    const allowed = ["PLAYER", "MOD", "ADMIN", "OWNER"];
    if (type !== "string" || !allowed.includes(String(value || "").toUpperCase())) {
      return { ok: false, message: "INVALID ROLE" };
    }
  }
  if (setting === "status") {
    const allowed = ["ACTIVE", "MUTED", "SUSPENDED", "BANNED"];
    if (type !== "string" || !allowed.includes(String(value || "").toUpperCase())) {
      return { ok: false, message: "INVALID STATUS" };
    }
  }
  if (["permissions", "tags", "restrictions"].includes(setting)) {
    const list = Array.isArray(value) ? value : [String(value || "")];
    if (!list.every((entry) => /^[A-Z0-9_]{2,32}$/i.test(String(entry || "").trim()))) {
      return { ok: false, message: "INVALID LIST ENTRY" };
    }
  }
  return { ok: true };
}

function applySettingAction(currentValue, action, type, value) {
  if (action === "set") return value;
  if (type === "integer") {
    const base = Number.isInteger(currentValue) ? currentValue : 0;
    if (action === "add") return base + value;
    if (action === "remove") return Math.max(0, base - value);
  }
  if (type === "boolean") {
    if (action === "add") return true;
    if (action === "remove") return false;
  }
  if (type === "string") {
    const base = String(currentValue || "");
    if (action === "add") return `${base}${value}`.trim();
    if (action === "remove") return base.replace(String(value), "").trim();
  }
  if (type === "list") {
    const base = new Set(Array.isArray(currentValue) ? currentValue.map((entry) => String(entry).trim()) : []);
    const updates = Array.isArray(value) ? value : [value];
    if (action === "add") updates.forEach((entry) => base.add(String(entry).trim()));
    if (action === "remove") updates.forEach((entry) => base.delete(String(entry).trim()));
    return Array.from(base).filter(Boolean);
  }
  return value;
}

async function adminApplySettingAction({ key, type, action, value, successLabel = "SETTING UPDATED" }) {
  const validation = validateAdminSettingValue(key, type, value);
  if (!validation.ok) {
    showToast(validation.message, "⚠️");
    return;
  }
  await applyAdminActionToTargets({
    actionName: `SETTING:${key.toUpperCase()}`,
    emptyToast: "NO PLAYERS MATCHED",
    mutateRemote: (targetData) => {
      const settings = { ...(targetData?.adminSettings || {}) };
      const currentValue = settings[key];
      settings[key] = applySettingAction(currentValue, action, type, value);
      return { adminSettings: settings };
    },
    mutateLocal: () => {
      state.adminSettings = state.adminSettings || {};
      const currentValue = state.adminSettings[key];
      state.adminSettings[key] = applySettingAction(currentValue, action, type, value);
    },
    successToast: (targets) => `${successLabel} FOR ${targets.length} PLAYER(S)`,
    failToast: "SETTING UPDATE FAILED",
  });
}

export async function adminGrantCashFromInput() {
  await adminGrantCash(readAdminNumberInput("adminCashAmount", 0));
}

export async function adminSetCashFromInput() {
  const amount = Math.max(0, Math.floor(readAdminNumberInput("adminCashAmount", 0)));
  await applyAdminActionToTargets({
    actionName: "SET CASH",
    emptyToast: "NO PLAYERS MATCHED",
    mutateRemote: () => ({ money: amount }),
    mutateLocal: () => {
      const previous = Math.floor(Number(myMoney) || 0);
      myMoney = amount;
      logTransaction("ADMIN CASH SET", myMoney - previous);
    },
    successToast: (targets) => `SET CASH FOR ${targets.length} PLAYER(S)`,
    failToast: "SET CASH FAILED",
  });
}

export async function adminMultiplyCashFromInput() {
  const multiplier = Math.max(0, readAdminNumberInput("adminCashAmount", 1));
  await applyAdminActionToTargets({
    actionName: "MULTIPLY CASH",
    emptyToast: "NO PLAYERS MATCHED",
    mutateRemote: (targetData) => ({ money: Math.floor((Number(targetData?.money) || 0) * multiplier) }),
    mutateLocal: () => {
      const previous = Math.floor(Number(myMoney) || 0);
      myMoney = Math.floor(previous * multiplier);
      logTransaction("ADMIN CASH MULTIPLIER", myMoney - previous);
    },
    successToast: (targets) => `MULTIPLIED CASH FOR ${targets.length} PLAYER(S)`,
    failToast: "MULTIPLY CASH FAILED",
  });
}

export async function adminSetDebtFromInput() {
  const debt = Math.max(0, Math.floor(readAdminNumberInput("adminCashAmount", 0)));
  const now = Date.now();
  await applyAdminActionToTargets({
    actionName: "SET DEBT",
    emptyToast: "NO PLAYERS MATCHED",
    mutateRemote: (targetData) => ({ loanData: { ...(targetData?.loanData || {}), debt, lastInterestAt: now } }),
    mutateLocal: () => {
      loanData = { ...(loanData || {}), debt, lastInterestAt: now };
    },
    successToast: (targets) => `SET DEBT FOR ${targets.length} PLAYER(S)`,
    failToast: "SET DEBT FAILED",
  });
}

export async function adminForgiveInterest() {
  const now = Date.now();
  await applyAdminActionToTargets({
    actionName: "FORGIVE INTEREST",
    emptyToast: "SELECT A TARGET FIRST",
    mutateRemote: (targetData) => ({
      loanData: {
        ...(targetData?.loanData || {}),
        rate: 0,
        lastInterestAt: now,
      },
    }),
    mutateLocal: () => {
      loanData.rate = 0;
      loanData.lastInterestAt = now;
    },
    successToast: (targets) => `FORGAVE INTEREST FOR ${targets.length} PLAYER(S)`,
    failToast: "INTEREST FORGIVENESS FAILED",
  });
}

export async function adminGrantAllShopItems() {
  await applyAdminActionToTargets({
    actionName: "UNLOCK SHOP ITEMS",
    emptyToast: "SELECT A TARGET FIRST",
    mutateRemote: (targetData) => {
      const inventory = new Set(Array.isArray(targetData?.inventory) ? targetData.inventory : []);
      const itemToggles = { ...(targetData?.itemToggles || {}) };
      SHOP_ITEMS.forEach((item) => {
        inventory.add(item.id);
        itemToggles[item.id] = true;
      });
      return { inventory: Array.from(inventory), itemToggles };
    },
    mutateLocal: () => {
      SHOP_ITEMS.forEach((item) => {
        if (!myInventory.includes(item.id)) myInventory.push(item.id);
        setItemToggle(item.id, true);
      });
      applyOwnedVisuals();
    },
    successToast: (targets) => `UNLOCKED ALL SHOP ITEMS FOR ${targets.length} PLAYER(S)`,
    failToast: "SHOP ITEM UNLOCK FAILED",
  });
}

export async function adminClearDebtAndCooldowns() {
  const now = Date.now();
  await applyAdminActionToTargets({
    actionName: "CLEAR DEBT + COOLDOWNS",
    emptyToast: "SELECT A TARGET FIRST",
    mutateRemote: (targetData) => ({
      loanData: { ...(targetData?.loanData || {}), debt: 0, rate: 0, lastInterestAt: now },
      jobs: { ...(targetData?.jobs || {}), cooldowns: {} },
    }),
    mutateLocal: () => {
      loanData.debt = 0;
      loanData.rate = 0;
      loanData.lastInterestAt = now;
      jobData.cooldowns = {};
    },
    successToast: (targets) => `DEBT + COOLDOWNS CLEARED FOR ${targets.length} PLAYER(S)`,
    failToast: "DEBT CLEAR FAILED",
  });
}

export async function adminBoostStatsFromInput() {
  const amount = Math.max(1, Math.floor(readAdminNumberInput("adminStatAmount", 100)));
  await applyAdminActionToTargets({
    actionName: "BOOST STATS",
    emptyToast: "NO PLAYERS MATCHED",
    mutateRemote: (targetData) => ({
      stats: {
        games: Math.max(0, Number(targetData?.stats?.games) || 0) + amount * 2,
        wins: Math.max(0, Number(targetData?.stats?.wins) || 0) + amount,
        wpm: Math.max(120, Number(targetData?.stats?.wpm) || 0),
      },
    }),
    mutateLocal: () => {
      myStats.games = Math.max(0, Number(myStats.games) || 0) + amount * 2;
      myStats.wins = Math.max(0, Number(myStats.wins) || 0) + amount;
      myStats.wpm = Math.max(120, Number(myStats.wpm) || 0);
    },
    successToast: (targets) => `STATS BOOSTED FOR ${targets.length} PLAYER(S)`,
    failToast: "STAT BOOST FAILED",
  });
}

export async function adminSetJobCompletionsFromInput() {
  const amount = Math.max(0, Math.floor(readAdminNumberInput("adminStatAmount", 0)));
  const jobKeys = ["cashier", "frontdesk", "delivery", "stocker", "janitor", "barista", "math", "code", "click"];
  await applyAdminActionToTargets({
    actionName: "SET JOB COMPLETIONS",
    emptyToast: "NO PLAYERS MATCHED",
    mutateRemote: (targetData) => {
      const completed = { ...(targetData?.jobs?.completed || {}) };
      jobKeys.forEach((key) => {
        completed[key] = amount;
      });
      return { jobs: { ...(targetData?.jobs || {}), completed } };
    },
    mutateLocal: () => {
      const completed = { ...(jobData?.completed || {}) };
      jobKeys.forEach((key) => {
        completed[key] = amount;
      });
      jobData.completed = completed;
    },
    successToast: (targets) => `UPDATED JOB COMPLETIONS FOR ${targets.length} PLAYER(S)`,
    failToast: "JOB COMPLETION UPDATE FAILED",
  });
}

export async function adminSetPortfolioSharesFromInput() {
  const shares = Math.max(0, Math.floor(readAdminNumberInput("adminPortfolioAmount", 0)));
  await applyAdminActionToTargets({
    actionName: "SET PORTFOLIO SHARES",
    emptyToast: "NO PLAYERS MATCHED",
    mutateRemote: (targetData) => {
      const targetStock = {
        holdings: { ...(targetData?.stockData?.holdings || {}) },
        selected: targetData?.stockData?.selected || marketState.stocks[0]?.symbol || "GOON",
        buyMultiplier: targetData?.stockData?.buyMultiplier || 1,
      };
      marketState.stocks.forEach((stock) => {
        targetStock.holdings[stock.symbol] = shares;
      });
      return { stockData: targetStock };
    },
    mutateLocal: () => {
      ensureStockProfile();
      marketState.stocks.forEach((stock) => {
        stockData.holdings[stock.symbol] = shares;
      });
      stockData.selected = marketState.stocks[0]?.symbol || stockData.selected;
    },
    successToast: (targets) => `UPDATED PORTFOLIO SHARES FOR ${targets.length} PLAYER(S)`,
    failToast: "PORTFOLIO UPDATE FAILED",
  });
}

async function setMarketShift(multiplier, minimumPrice = 3, fallbackPrice = minimumPrice) {
  const ref = marketDocRef();
  const floor = Math.max(0, Number(minimumPrice) || 0);
  const fallback = Math.max(floor, Number(fallbackPrice) || floor);
  try {
    await runTransaction(db, async (t) => {
      const snap = await t.get(ref);
      const payload = snap.exists() ? snap.data() : getInitialMarketPayload();
      const shifted = normalizeMarketStocks(payload.stocks).map((stock) => {
        const current = Math.max(floor, Number(stock.price) || fallback);
        const next = Math.max(floor, Number((current * multiplier).toFixed(2)));
        const history = [...(Array.isArray(stock.history) ? stock.history : []), next].slice(-80);
        return {
          ...stock,
          price: next,
          lastMove: current > 0 ? (next - current) / current : 0,
          history,
        };
      });
      const now = Date.now();
      t.set(ref, {
        version: 1,
        updatedAt: now,
        lastTickAt: now,
        stocks: shifted.map((stock) => ({
          symbol: stock.symbol,
          price: stock.price,
          history: stock.history,
          lastMove: stock.lastMove,
        })),
      });
    });
  } catch {
    marketState.stocks = normalizeMarketStocks(marketState.stocks).map((stock) => {
      const current = Math.max(floor, Number(stock.price) || fallback);
      const next = Math.max(floor, Number((current * multiplier).toFixed(2)));
      const history = [...(Array.isArray(stock.history) ? stock.history : []), next].slice(-80);
      return {
        ...stock,
        price: next,
        lastMove: current > 0 ? (next - current) / current : 0,
        history,
      };
    });
    renderStockMarket();
  }
}

export async function adminMarketCrashToZero() {
  if (!isGodUser()) return;
  await setMarketShift(0, 0.01, 0.01);
  showToast("MARKET CRASHED TO ZERO", "📉");
  await saveStats();
}

export async function adminMarketPumpFromInput() {
  if (!isGodUser()) return;
  const percent = Math.max(1, readAdminNumberInput("adminMarketAmount", 35));
  await setMarketShift(1 + percent / 100);
  showToast(`MARKET UP +${percent}%`, "📈");
  await saveStats();
}

export async function adminMarketDropFromInput() {
  if (!isGodUser()) return;
  const percent = Math.max(1, readAdminNumberInput("adminMarketAmount", 35));
  await setMarketShift(Math.max(0, 1 - percent / 100), 0.01, 0.01);
  showToast(`MARKET DOWN -${percent}%`, "📉");
  await saveStats();
}

export async function adminMarketMultiplyFromInput() {
  if (!isGodUser()) return;
  const multiplier = Math.max(0, readAdminNumberInput("adminMarketAmount", 2));
  await setMarketShift(multiplier, 0.01, 0.01);
  showToast(`MARKET MULTIPLIED x${multiplier}`, "📊");
  await saveStats();
}

export async function adminSendChatAnnouncement() {
  if (!isGodUser()) return;
  const message = filterChatMessage(readAdminTextInput("adminChatMessage")).slice(0, 80);
  if (!message) {
    showToast("CHAT MESSAGE REQUIRED", "⚠️");
    return;
  }
  const sent = await runFirestoreTask(
    () => addDoc(collection(db, "gooner_global_chat"), { user: myName, msg: `[ADMIN] ${message}`, ts: Date.now() }),
    "ADMIN CHAT",
    "Announcement failed."
  );
  if (!sent) return;
  clearAdminTextInput("adminChatMessage");
  showToast("ANNOUNCEMENT SENT", "📣");
}

export async function adminSendChatSystemMessage() {
  if (!isGodUser()) return;
  const message = filterChatMessage(readAdminTextInput("adminChatMessage")).slice(0, 80);
  if (!message) {
    showToast("CHAT MESSAGE REQUIRED", "⚠️");
    return;
  }
  const sent = await runFirestoreTask(
    () => addDoc(collection(db, "gooner_global_chat"), { user: "SYSTEM", msg: message, ts: Date.now() }),
    "ADMIN CHAT",
    "System message failed."
  );
  if (!sent) return;
  clearAdminTextInput("adminChatMessage");
  showToast("SYSTEM MESSAGE SENT", "🛰️");
}

export async function adminClearRecentChatFromInput() {
  if (!isGodUser()) return;
  const count = Math.max(1, Math.floor(readAdminNumberInput("adminChatClearCount", 10)));
  try {
    const snap = await getDocs(query(collection(db, "gooner_global_chat"), orderBy("ts", "desc"), limit(count)));
    if (snap.empty) {
      showToast("NO CHAT MESSAGES FOUND", "ℹ️");
      return;
    }
    await Promise.all(snap.docs.map((row) => deleteDoc(row.ref)));
    showToast(`REMOVED ${snap.docs.length} CHAT MESSAGE(S)`, "🧹");
  } catch {
    showToast("CHAT CLEAR FAILED", "⚠️", "Try again shortly.");
  }
}

export async function adminApplySettingActionFromInput() {
  const key = String(readAdminTextInput("adminSettingKey") || "")
    .trim()
    .toLowerCase();
  const type = readAdminActionChoice("adminSettingType", ["string", "integer", "boolean", "list"], "string");
  const action = readAdminActionChoice("adminSettingAction", ["add", "remove", "set"], "set");
  const parsed = parseTypedAdminValue(type, readAdminTextInput("adminSettingValue"));
  if (parsed === null || key.length < 3) {
    showToast("INVALID SETTING INPUT", "⚠️");
    return;
  }
  await adminApplySettingAction({ key, type, action, value: parsed, successLabel: "SETTING APPLIED" });
}

export async function adminSetRoleFromInput() {
  const role = String(readAdminTextInput("adminRoleInput") || "").toUpperCase();
  await adminApplySettingAction({ key: "role", type: "string", action: "set", value: role, successLabel: "ROLE SET" });
}

export async function adminSetStatusFromInput() {
  const status = String(readAdminTextInput("adminStatusInput") || "").toUpperCase();
  await adminApplySettingAction({ key: "status", type: "string", action: "set", value: status, successLabel: "STATUS SET" });
}

export async function adminGrantPermissionFromInput() {
  const permission = String(readAdminTextInput("adminPermissionInput") || "").toUpperCase();
  await adminApplySettingAction({ key: "permissions", type: "list", action: "add", value: [permission], successLabel: "PERMISSION ADDED" });
}

export async function adminRevokePermissionFromInput() {
  const permission = String(readAdminTextInput("adminPermissionInput") || "").toUpperCase();
  await adminApplySettingAction({ key: "permissions", type: "list", action: "remove", value: [permission], successLabel: "PERMISSION REMOVED" });
}

export async function adminAddTagFromInput() {
  const tag = String(readAdminTextInput("adminTagInput") || "").toUpperCase();
  await adminApplySettingAction({ key: "tags", type: "list", action: "add", value: [tag], successLabel: "TAG ADDED" });
}

export async function adminRemoveTagFromInput() {
  const tag = String(readAdminTextInput("adminTagInput") || "").toUpperCase();
  await adminApplySettingAction({ key: "tags", type: "list", action: "remove", value: [tag], successLabel: "TAG REMOVED" });
}

export async function adminSetLimitFromInput() {
  const key = String(readAdminTextInput("adminLimitKeyInput") || "")
    .trim()
    .toLowerCase();
  const value = Math.max(0, Math.floor(readAdminNumberInput("adminLimitValueInput", 0)));
  await adminApplySettingAction({ key: `limit_${key}`, type: "integer", action: "set", value, successLabel: "LIMIT SET" });
}

export async function adminSetPreferenceFromInput() {
  const key = String(readAdminTextInput("adminPreferenceKeyInput") || "")
    .trim()
    .toLowerCase();
  const value = readAdminTextInput("adminPreferenceValueInput");
  await adminApplySettingAction({ key: `pref_${key}`, type: "string", action: "set", value, successLabel: "PREFERENCE SET" });
}

export async function adminRemoveRestrictionFromInput() {
  const restriction = String(readAdminTextInput("adminRestrictionInput") || "").toUpperCase();
  await adminApplySettingAction({ key: "restrictions", type: "list", action: "remove", value: [restriction], successLabel: "RESTRICTION REMOVED" });
}

export async function adminLogAdminActionFromInput() {
  if (!isGodUser()) return;
  const message = readAdminTextInput("adminActionLogInput");
  if (!message) {
    showToast("LOG MESSAGE REQUIRED", "⚠️");
    return;
  }
  const ok = await runFirestoreTask(
    () => addDoc(collection(db, "gooner_admin_ops"), { actor: myName, message: message.slice(0, 100), ts: Date.now() }),
    "ADMIN LOG",
    "Admin log failed."
  );
  if (!ok) return;
  clearAdminTextInput("adminActionLogInput");
  showToast("ADMIN ACTION LOGGED", "🧾");
}

export async function adminScheduleTaskFromInput() {
  const taskName = readAdminTextInput("adminTaskNameInput");
  const delayMinutes = Math.max(1, Math.floor(readAdminNumberInput("adminTaskTimeInput", 1)));
  if (!taskName) {
    showToast("TASK NAME REQUIRED", "⚠️");
    return;
  }
  await applyAdminActionToTargets({
    actionName: "SCHEDULE TASK",
    emptyToast: "NO PLAYERS MATCHED",
    mutateRemote: (targetData) => {
      const queued = Array.isArray(targetData?.adminScheduledTasks) ? targetData.adminScheduledTasks : [];
      return {
        adminScheduledTasks: [
          ...queued,
          { name: taskName.slice(0, 40), runAt: Date.now() + delayMinutes * 60000, createdBy: myName },
        ].slice(-50),
      };
    },
    mutateLocal: () => {},
    successToast: (targets) => `TASK SCHEDULED FOR ${targets.length} PLAYER(S)`,
    failToast: "TASK SCHEDULE FAILED",
  });
}

export async function adminClearScheduledTasksFromInput() {
  const removeCount = Math.max(1, Math.floor(readAdminNumberInput("adminTaskClearCount", 1)));
  await applyAdminActionToTargets({
    actionName: "CLEAR SCHEDULED TASKS",
    emptyToast: "NO PLAYERS MATCHED",
    mutateRemote: (targetData) => {
      const queued = Array.isArray(targetData?.adminScheduledTasks) ? targetData.adminScheduledTasks : [];
      return { adminScheduledTasks: queued.slice(removeCount) };
    },
    mutateLocal: () => {},
    successToast: (targets) => `REMOVED SCHEDULED TASKS FOR ${targets.length} PLAYER(S)`,
    failToast: "TASK CLEAR FAILED",
  });
}

export async function adminPrestigePack() {
  const now = Date.now();
  await applyAdminActionToTargets({
    actionName: "PRESTIGE PACK",
    emptyToast: "SELECT A TARGET FIRST",
    mutateRemote: (targetData) => {
      const inventory = new Set(Array.isArray(targetData?.inventory) ? targetData.inventory : []);
      const achievements = new Set(Array.isArray(targetData?.achievements) ? targetData.achievements : []);
      const itemToggles = { ...(targetData?.itemToggles || {}) };
      SHOP_ITEMS.forEach((item) => {
        inventory.add(item.id);
        itemToggles[item.id] = true;
      });
      ACHIEVEMENTS.forEach((achievement) => achievements.add(achievement.id));
      return {
        money: Math.max(Math.floor(Number(targetData?.money) || 0), 999999999),
        inventory: Array.from(inventory),
        itemToggles,
        achievements: Array.from(achievements),
        stats: {
          games: Math.max(1000, Number(targetData?.stats?.games) || 0),
          wins: Math.max(750, Number(targetData?.stats?.wins) || 0),
          wpm: Math.max(140, Number(targetData?.stats?.wpm) || 0),
        },
        jobs: { ...(targetData?.jobs || {}), completed: { math: 99, code: 99, click: 99 }, cooldowns: {} },
        loanData: { debt: 0, rate: 0, lastInterestAt: now },
      };
    },
    mutateLocal: () => {
      const previousMoney = Math.floor(Number(myMoney) || 0);
      myMoney = Math.max(previousMoney, 999999999);
      const moneyDelta = Math.max(0, myMoney - previousMoney);
      if (moneyDelta > 0) logTransaction("ADMIN PRESTIGE PACK", moneyDelta);
      SHOP_ITEMS.forEach((item) => {
        if (!myInventory.includes(item.id)) myInventory.push(item.id);
        setItemToggle(item.id, true);
      });
      ACHIEVEMENTS.forEach((achievement) => {
        if (!myAchievements.includes(achievement.id)) myAchievements.push(achievement.id);
      });
      myStats.games = Math.max(1000, Number(myStats.games) || 0);
      myStats.wins = Math.max(750, Number(myStats.wins) || 0);
      myStats.wpm = Math.max(140, Number(myStats.wpm) || 0);
      jobData.completed = { math: 99, code: 99, click: 99 };
      jobData.cooldowns = {};
      loanData = { debt: 0, rate: 0, lastInterestAt: now };
      applyOwnedVisuals();
    },
    successToast: (targets) => `PRESTIGE PACK DEPLOYED TO ${targets.length} PLAYER(S)`,
    failToast: "PRESTIGE PACK FAILED",
  });
}

export async function adminUnlockAllAchievements() {
  await applyAdminActionToTargets({
    actionName: "UNLOCK ACHIEVEMENTS",
    emptyToast: "SELECT A TARGET FIRST",
    mutateRemote: (targetData) => {
      const current = new Set(Array.isArray(targetData?.achievements) ? targetData.achievements : []);
      ACHIEVEMENTS.forEach((achievement) => current.add(achievement.id));
      return { achievements: Array.from(current) };
    },
    mutateLocal: () => {
      const missing = ACHIEVEMENTS.filter((achievement) => !myAchievements.includes(achievement.id));
      let rewardTotal = 0;
      missing.forEach((achievement) => {
        myAchievements.push(achievement.id);
        rewardTotal += achievement.reward || 0;
      });
      if (rewardTotal > 0) {
        myMoney += rewardTotal;
        logTransaction("ADMIN ACHIEVEMENT SYNC", rewardTotal);
      }
    },
    successToast: (targets) => `UNLOCKED ACHIEVEMENTS FOR ${targets.length} PLAYER(S)`,
    failToast: "ACHIEVEMENT UNLOCK FAILED",
  });
}

// Persist stats + inventory changes to Firestore.
export async function saveStats() {
  if (myName === "ANON") return;
  saveLocalShopToggles();
  const snapshot = {
    name: myName,
    pin: localStorage.getItem("goonerPin") || "0000",
    money: myMoney,
    joined: myJoined || Date.now(),
    stats: myStats,
    achievements: myAchievements,
    inventory: myInventory,
    itemToggles: myItemToggles,
    jobs: jobData,
    loanData,
    stockData,
    crewData,
    seasonData,
    lastLogin: Date.now(),
  };
  saveLocalProfileSnapshot(snapshot);
  await runFirestoreTask(
    () =>
      updateDoc(doc(db, "gooner_users", myName), {
        money: myMoney,
        stats: myStats,
        achievements: myAchievements,
        inventory: myInventory,
        itemToggles: myItemToggles,
        jobs: jobData,
        loanData,
        stockData,
        crewData,
        seasonData,
      }),
    "SAVE PROFILE",
    "Progress saved locally; cloud sync retry pending."
  );
  updateUI();
}

function formatLoanStatus(msg, color = "#aaa") {
  const el = document.getElementById("bankLoanMsg");
  if (!el) return;
  el.innerText = msg;
  el.style.color = color;
}

function setupLoanUX() {
  const amountInput = document.getElementById("loanAmount");
  const takeBtn = document.getElementById("loanTakeBtn");
  const repayBtn = document.getElementById("loanRepayBtn");
  if (!amountInput || !takeBtn || !repayBtn) return;
  amountInput.min = String(MIN_LOAN_AMOUNT);
  amountInput.max = String(MAX_LOAN_AMOUNT);

  amountInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      takeLoan();
    }
  });

  takeBtn.addEventListener("click", () => takeLoan());
  repayBtn.addEventListener("click", () => repayLoan());
}

function takeLoan() {
  const amountInput = document.getElementById("loanAmount");
  if (!amountInput) return;
  if (myName === "ANON") {
    formatLoanStatus("LOGIN REQUIRED", "#f66");
    return;
  }
  const amount = parseInt(amountInput.value, 10);
  if (loanData.debt > 0) {
    formatLoanStatus("ONLY ONE ACTIVE LOAN ALLOWED", "#f66");
    return;
  }
  if (Number.isNaN(amount) || amount < MIN_LOAN_AMOUNT) {
    formatLoanStatus(`MIN LOAN IS $${MIN_LOAN_AMOUNT}`, "#f66");
    return;
  }
  if (amount > MAX_LOAN_AMOUNT) {
    formatLoanStatus(`MAX LOAN IS $${MAX_LOAN_AMOUNT}`, "#f66");
    return;
  }

  const randomRate = (Math.floor(Math.random() * 19) + 18) / 100;
  const now = Date.now();
  loanData.debt = amount;
  loanData.rate = randomRate;
  loanData.lastInterestAt = now;
  myMoney += amount;
  logTransaction(`HIGH-RISK LOAN @ ${Math.round(randomRate * 100)}% APR`, amount);
  formatLoanStatus(`LOAN APPROVED: +$${amount} @ ${Math.round(randomRate * 100)}%`, "#f80");
  amountInput.value = "";
  updateUI();
  saveStats();
}

function repayLoan() {
  if (!loanData.debt || loanData.debt <= 0) {
    formatLoanStatus("NO ACTIVE LOAN", "#aaa");
    return;
  }
  const pay = Math.min(myMoney, Math.ceil(loanData.debt));
  if (pay <= 0) {
    formatLoanStatus("NOT ENOUGH CASH TO REPAY", "#f66");
    return;
  }

  loanData.debt = Math.max(0, loanData.debt - pay);
  myMoney -= pay;
  logTransaction("LOAN REPAYMENT", -pay);
  if (loanData.debt <= 0) {
    loanData.debt = 0;
    loanData.rate = 0;
    loanData.lastInterestAt = 0;
    formatLoanStatus("DEBT CLEARED", "#0f0");
  } else {
    formatLoanStatus(`PAID $${pay}. REMAINING: $${Math.ceil(loanData.debt)}`, "#ff0");
  }
  updateUI();
  saveStats();
}

function applyLoanInterestTick() {
  if (myName === "ANON") return;
  if (!loanData.debt || loanData.debt <= 0 || !loanData.rate) return;
  const now = Date.now();
  const last = loanData.lastInterestAt || now;
  const elapsed = now - last;
  const tickMs = 15000;
  if (elapsed < tickMs) return;

  const cycles = Math.floor(elapsed / tickMs);
  const gameTimeScale = 120;
  const interestPerCycle =
    Math.pow(1 + loanData.rate, (tickMs / (24 * 60 * 60 * 1000)) * gameTimeScale) - 1;
  let debt = loanData.debt;
  for (let i = 0; i < cycles; i++) {
    const variableCycleRate = interestPerCycle * (0.9 + Math.random() * 0.2);
    debt *= 1 + variableCycleRate;
  }
  const growth = Math.round(debt - loanData.debt);
  if (growth <= 0) return;
  loanData.debt = debt;
  loanData.lastInterestAt = last + cycles * tickMs;
  logTransaction("LOAN INTEREST ACCRUED", -growth);
  formatLoanStatus(`INTEREST ACCRUED: +$${growth} DEBT`, "#f66");
  updateUI();
  saveStats();
}

setInterval(() => {
  applyLoanInterestTick();
}, 3000);

// Send money to another player account using a transaction for consistency.
function setupBankTransferUX() {
  const userInput = document.getElementById("bankTransferUser");
  const amountInput = document.getElementById("bankTransferAmount");
  const presetContainer = document.getElementById("bankTransferPresets");
  const sendButton = document.getElementById("bankTransferSend");
  if (!userInput || !amountInput || !presetContainer || !sendButton) return;

  const sendOnEnter = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      tradeMoney();
    }
  };
  userInput.addEventListener("keydown", sendOnEnter);
  amountInput.addEventListener("keydown", sendOnEnter);

  presetContainer.querySelectorAll("button[data-amount]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.amount;
      if (value === "max") {
        amountInput.value = Math.max(1, myMoney);
      } else {
        amountInput.value = value;
      }
      amountInput.focus();
    });
  });

  sendButton.addEventListener("click", () => {
    tradeMoney();
  });
}

export async function tradeMoney() {
  const msg = document.getElementById("bankTransferMsg");
  const userInput = document.getElementById("bankTransferUser");
  const amountInput = document.getElementById("bankTransferAmount");
  if (!msg || !userInput || !amountInput) return;

  const rawTarget = userInput.value.trim();
  const target = rawTarget.toUpperCase();
  const amount = parseInt(amountInput.value, 10);
  if (myName === "ANON") {
    msg.innerText = "LOGIN REQUIRED";
    msg.style.color = "#f66";
    return;
  }
  if (!target || Number.isNaN(amount) || amount <= 0) {
    msg.innerText = "ENTER PLAYER + VALID AMOUNT";
    msg.style.color = "#f66";
    return;
  }
  if (target === myName) {
    msg.innerText = "CAN'T SEND TO YOURSELF";
    msg.style.color = "#f66";
    return;
  }

  try {
    await runTransaction(db, async (transaction) => {
      const myRef = doc(db, "gooner_users", myName);
      const targetRef = doc(db, "gooner_users", target);
      const targetRawRef = rawTarget && rawTarget !== target ? doc(db, "gooner_users", rawTarget) : null;
      const mySnap = await transaction.get(myRef);
      const targetSnap = await transaction.get(targetRef);
      const targetRawSnap = targetRawRef ? await transaction.get(targetRawRef) : null;
      const receiverSnap = targetSnap.exists() ? targetSnap : targetRawSnap;
      const receiverRef = targetSnap.exists() ? targetRef : targetRawRef;

      if (!mySnap.exists()) throw new Error("PROFILE NOT FOUND");
      if (!receiverSnap?.exists() || !receiverRef) throw new Error("PLAYER NOT FOUND");
      const freshMoney = mySnap.data().money ?? 0;
      if (freshMoney < amount) throw new Error("NOT ENOUGH CASH");

      transaction.update(myRef, { money: freshMoney - amount });
      transaction.update(receiverRef, { money: (receiverSnap.data().money ?? 0) + amount });
    });

    myMoney -= amount;
    logTransaction(`TRANSFER TO ${target}`, -amount);
    updateUI();
    userInput.value = "";
    amountInput.value = "";
    msg.innerText = `SENT $${amount} TO ${target}`;
    msg.style.color = "#0f0";
    showToast("TRANSFER SENT", "💸", `${target} +$${amount}`);
  } catch (e) {
    msg.innerText = e.message || "TRANSFER FAILED";
    msg.style.color = "#f66";
  }
}

// Consume exactly one shield charge if available.
export function consumeShield() {
  if (!hasActiveItem("item_shield")) return false;
  const shieldIndex = myInventory.indexOf("item_shield");
  if (shieldIndex === -1) return false;
  myInventory.splice(shieldIndex, 1);
  saveStats();
  return true;
}

// Unlock an achievement, award money, and show a toast.
export function unlockAchievement(id) {
  if (myAchievements.includes(id) || myName === "ANON") return;
  myAchievements.push(id);
  const badge = ACHIEVEMENTS.find((a) => a.id === id);
  if (badge) {
    myMoney += badge.reward;
    logTransaction(`ACHIEVEMENT: ${badge.title}`, badge.reward);
    showToast(`UNLOCKED: ${badge.title}`, badge.icon, `+$${badge.reward}`);
  }
  grantSeasonXp(80);
  saveStats();
  playSuccessSound();
}

// Render the badge grid UI for achievements.
function renderBadges() {
  const grid = document.getElementById("badgeGrid");
  grid.innerHTML = "";
  ACHIEVEMENTS.forEach((a) => {
    const unlocked = myAchievements.includes(a.id);
    const div = document.createElement("div");
    if (a.hidden && !unlocked) {
      div.className = "badge-item";
      div.innerHTML = `<div class="badge-icon">🔒</div><div>???</div>`;
      div.onclick = () => showBadgeDetail(a, false);
    } else {
      div.className = "badge-item unlocked " + a.rarity;
      div.innerHTML = `<div class="badge-icon">${a.icon}</div><div>${a.title}</div>`;
      div.onclick = () => showBadgeDetail(a, true);
    }
    grid.appendChild(div);
  });
}

// Show a modal with badge details (locked vs unlocked).
function showBadgeDetail(badge, unlocked) {
  setText("bdIcon", unlocked ? badge.icon : "🔒");
  setText("bdTitle", unlocked ? badge.title : "LOCKED");
  setText("bdRarity", unlocked ? badge.rarity : "UNKNOWN");
  setText("bdDesc", unlocked ? badge.desc : "This achievement is hidden until unlocked.");
  setText("bdReward", unlocked ? `REWARDED: $${badge.reward}` : `REWARD: $${badge.reward}`);
  const rEl = document.getElementById("bdRarity");
  rEl.style.color = unlocked ? `var(--${badge.rarity})` : "#555";
  document.getElementById("modalBadgeDetail").classList.add("active");
}

const JOBS = {
  cashier: { name: "CASHIER RUSH", reward: 120, cooldownMs: 30000 },
  frontdesk: { name: "FRONT DESK MEMORY", reward: 160, cooldownMs: 40000 },
  delivery: { name: "DELIVERY DRIVER RUN", reward: 200, cooldownMs: 45000 },
  stocker: { name: "STOCK SHELF SORT", reward: 180, cooldownMs: 38000 },
  janitor: { name: "JANITOR SPOT CHECK", reward: 150, cooldownMs: 32000 },
  barista: { name: "ARCADE BARISTA", reward: 220, cooldownMs: 42000 },
};

const JOB_BOARD = {
  cashier: "jobCashierBoard",
  frontdesk: "jobFrontdeskBoard",
  delivery: "jobDeliveryBoard",
  stocker: "jobStockerBoard",
  janitor: "jobJanitorBoard",
};

const activeJobs = { cashier: null, frontdesk: null, delivery: null, stocker: null, janitor: null, barista: null };

function getCooldownText(type) {
  const left = (jobData.cooldowns?.[type] || 0) - Date.now();
  if (left <= 0) return "READY";
  return `COOLDOWN: ${Math.ceil(left / 1000)}s`;
}

function setJobMsg(type, msg) {
  const map = {
    cashier: "jobCashierMsg",
    frontdesk: "jobFrontdeskMsg",
    delivery: "jobDeliveryMsg",
    stocker: "jobStockerMsg",
    janitor: "jobJanitorMsg",
    barista: "jobBaristaMsg",
  };
  if (map[type]) setText(map[type], msg);
}

function markJobComplete(type) {
  const cfg = JOBS[type];
  myMoney += cfg.reward;
  if (!jobData.completed) {
    jobData.completed = { cashier: 0, frontdesk: 0, delivery: 0, stocker: 0, janitor: 0, barista: 0 };
  }
  jobData.completed[type] = (jobData.completed[type] || 0) + 1;
  if (!jobData.cooldowns) jobData.cooldowns = {};
  jobData.cooldowns[type] = Date.now() + cfg.cooldownMs;
  logTransaction(`JOB: ${cfg.name}`, cfg.reward);
  showToast(`JOB COMPLETE: ${cfg.name}`, "💼", `+$${cfg.reward}`);
  setText("jobsMsg", `${cfg.name} PAID OUT +$${cfg.reward}`);
  setJobMsg(type, `PAYDAY +$${cfg.reward}`);
  activeJobs[type] = null;
  saveStats();
  renderJobs();
}

function failJob(type, msg, reset = false) {
  setJobMsg(type, msg);
  setText("jobsMsg", msg);
  beep(120, "sawtooth", 0.35);
  if (reset) activeJobs[type] = null;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function renderBoard(type) {
  const board = document.getElementById(JOB_BOARD[type]);
  if (!board) return;
  const state = activeJobs[type];
  if (!state || !state.entities || state.entities.length === 0) {
    board.innerHTML = '<div class="job-board-empty">PRESS START SHIFT</div>';
    return;
  }
  board.innerHTML = state.entities
    .map(
      (e) =>
        `<button class="job-target ${type} ${e.good ? "good" : "bad"}" style="left:${e.x}%;top:${e.y}%;width:${e.size}px;height:${e.size}px" onclick="window.submitJob('${type}','${e.id}')">${e.label}</button>`
    )
    .join("");
}

function setCashierPrompt() {
  const c = activeJobs.cashier;
  if (!c) return;
  setText("jobCashierPrompt", `CUSTOMER ${c.round + 1}/${c.goal}: ${c.expr} = ?`);
}

function setFrontdeskPrompt() {
  const f = activeJobs.frontdesk;
  if (!f) return;
  if (f.showing) return setText("jobFrontdeskPrompt", `MEMORIZE: ${f.sequenceLabels.join(" ")}`);
  setText("jobFrontdeskPrompt", `REPEAT CODE ${f.round + 1}/${f.goal}: STEP ${f.step + 1}/${f.sequence.length}`);
}

function setDeliveryPrompt() {
  const d = activeJobs.delivery;
  if (!d) return;
  const left = Math.max(0, Math.ceil((d.durationMs - (Date.now() - d.startedAt)) / 1000));
  setText("jobDeliveryPrompt", `CHECKPOINTS ${d.count}/${d.goal} | LIVES ${d.lives} | TIME ${left}s`);
}

function setStockerPrompt() {
  const s2 = activeJobs.stocker;
  if (!s2) return;
  setText("jobStockerPrompt", `AISLE ${s2.round + 1}/${s2.goal}: PICK ALL ${s2.targetLabel} (${s2.left} LEFT)`);
}

function setJanitorPrompt() {
  const j = activeJobs.janitor;
  if (!j) return;
  const left = Math.max(0, Math.ceil((j.durationMs - (Date.now() - j.startedAt)) / 1000));
  setText("jobJanitorPrompt", `SPILLS CLEANED ${j.count}/${j.goal} | TIME ${left}s`);
}

function setBaristaPrompt() {
  const b = activeJobs.barista;
  if (!b) return;
  const t = Math.floor((Math.sin((Date.now() - b.startedAt) / b.periodMs) + 1) * 35 + 120);
  b.currentTemp = t;
  setText("jobBaristaPrompt", `SHOT ${b.count + 1}/${b.goal}: PULL BETWEEN ${b.targetMin}-${b.targetMax}°`);
  setText("jobBaristaTemp", `${t}°`);
  const meter = document.getElementById("jobBaristaMeter");
  if (meter) {
    const pct = Math.max(0, Math.min(100, ((t - 120) / 70) * 100));
    meter.style.width = `${pct}%`;
    meter.className = `job-meter-fill ${t >= b.targetMin && t <= b.targetMax ? "ok" : "bad"}`;
  }
}

function spawnCashierRound() {
  const c = activeJobs.cashier;
  if (!c) return;
  const a = randInt(6, 30);
  const b = randInt(4, 25);
  c.answer = a + b;
  c.expr = `${a} + ${b}`;
  const labels = [c.answer, c.answer - 2, c.answer + 2, c.answer - 4, c.answer + 4, c.answer + randInt(5, 9)]
    .map((n) => `$${Math.max(1, n)}`);
  const choices = [...new Set(labels)].slice(0, 6);
  while (choices.length < 6) choices.push(`$${randInt(5, 70)}`);
  choices.sort(() => Math.random() - 0.5);
  c.entities = choices.map((label, i) => ({
    id: `cash-${Date.now()}-${i}`,
    label,
    good: label === `$${c.answer}`,
    x: randInt(10, 90),
    y: randInt(15, 85),
    size: randInt(44, 70),
  }));
  setCashierPrompt();
  renderBoard("cashier");
}

function spawnFrontdeskRound() {
  const f = activeJobs.frontdesk;
  if (!f) return;
  const codes = ["A1", "B2", "C3", "D4", "E5", "F6"];
  f.entities = codes.map((label, i) => ({
    id: `front-${label}`,
    label,
    good: false,
    x: 20 + (i % 3) * 30,
    y: 30 + Math.floor(i / 3) * 35,
    size: 62,
  }));
  f.sequence = Array.from({ length: 4 }, () => f.entities[randInt(0, f.entities.length - 1)].id);
  f.sequenceLabels = f.sequence.map((id) => f.entities.find((e) => e.id === id).label);
  f.step = 0;
  f.showing = true;
  setFrontdeskPrompt();
  renderBoard("frontdesk");
  setTimeout(() => {
    if (!activeJobs.frontdesk || activeJobs.frontdesk !== f) return;
    f.showing = false;
    setFrontdeskPrompt();
  }, 1700);
}

function spawnDeliveryRound() {
  const d = activeJobs.delivery;
  if (!d) return;
  const hazards = ["🚧", "⚠️", "🛑", "⛔", "❌"];
  d.entities = [{ id: `del-good-${Date.now()}`, label: "✅", good: true, x: randInt(10, 90), y: randInt(15, 85), size: 58 }];
  for (let i = 0; i < 4; i++) {
    d.entities.push({
      id: `del-bad-${Date.now()}-${i}`,
      label: hazards[randInt(0, hazards.length - 1)],
      good: false,
      x: randInt(10, 90),
      y: randInt(15, 85),
      size: randInt(44, 60),
    });
  }
  setDeliveryPrompt();
  renderBoard("delivery");
}

function spawnStockerRound() {
  const s2 = activeJobs.stocker;
  if (!s2) return;
  const categories = {
    COLD: ["🥛", "🧈", "🧃"],
    DRY: ["🍞", "🍚", "🥫"],
    CLEAN: ["🧼", "🧻", "🧽"],
  };
  const keys = Object.keys(categories);
  s2.targetLabel = keys[randInt(0, keys.length - 1)];
  s2.entities = [];
  s2.left = 0;
  for (let i = 0; i < 8; i++) {
    const cat = keys[randInt(0, keys.length - 1)];
    const label = categories[cat][randInt(0, categories[cat].length - 1)];
    const good = cat === s2.targetLabel;
    if (good) s2.left += 1;
    s2.entities.push({
      id: `stock-${Date.now()}-${i}`,
      label,
      good,
      x: randInt(10, 90),
      y: randInt(15, 85),
      size: 54,
    });
  }
  if (s2.left === 0) return spawnStockerRound();
  setStockerPrompt();
  renderBoard("stocker");
}

function spawnJanitorRound() {
  const j = activeJobs.janitor;
  if (!j) return;
  const icons = ["🧽", "🧽", "🫧", "🟫", "🟧", "🟢", "💧"];
  j.entities = [];
  for (let i = 0; i < 8; i++) {
    const label = icons[randInt(0, icons.length - 1)];
    j.entities.push({
      id: `jan-${Date.now()}-${i}`,
      label,
      good: label === "🧽",
      x: randInt(10, 90),
      y: randInt(15, 85),
      size: randInt(42, 66),
    });
  }
  if (!j.entities.some((e) => e.good)) j.entities[0].good = true;
  setJanitorPrompt();
  renderBoard("janitor");
}

function renderJobs() {
  setText("jobCashierStatus", getCooldownText("cashier"));
  setText("jobFrontdeskStatus", getCooldownText("frontdesk"));
  setText("jobDeliveryStatus", getCooldownText("delivery"));
  setText("jobStockerStatus", getCooldownText("stocker"));
  setText("jobJanitorStatus", getCooldownText("janitor"));
  setText("jobBaristaStatus", getCooldownText("barista"));

  setText("jobCashierPrompt", activeJobs.cashier ? document.getElementById("jobCashierPrompt").textContent : getCooldownText("cashier"));
  setText("jobFrontdeskPrompt", activeJobs.frontdesk ? document.getElementById("jobFrontdeskPrompt").textContent : getCooldownText("frontdesk"));
  setText("jobDeliveryPrompt", activeJobs.delivery ? document.getElementById("jobDeliveryPrompt").textContent : getCooldownText("delivery"));
  setText("jobStockerPrompt", activeJobs.stocker ? document.getElementById("jobStockerPrompt").textContent : getCooldownText("stocker"));
  setText("jobJanitorPrompt", activeJobs.janitor ? document.getElementById("jobJanitorPrompt").textContent : getCooldownText("janitor"));

  if (activeJobs.cashier) setCashierPrompt();
  if (activeJobs.frontdesk) setFrontdeskPrompt();
  if (activeJobs.delivery) setDeliveryPrompt();
  if (activeJobs.stocker) setStockerPrompt();
  if (activeJobs.janitor) setJanitorPrompt();

  if (activeJobs.barista) setBaristaPrompt();
  else {
    setText("jobBaristaPrompt", getCooldownText("barista"));
    setText("jobBaristaTemp", "--°");
    const meter = document.getElementById("jobBaristaMeter");
    if (meter) {
      meter.style.width = "0%";
      meter.className = "job-meter-fill";
    }
  }

  ["cashier", "frontdesk", "delivery", "stocker", "janitor"].forEach((type) => renderBoard(type));
}

export function startJob(type) {
  showToast("JOBS RETIRED", "🕹️", "Earn money by playing games now.");
  setText("jobsMsg", "JOBS REMOVED — SCORE IN GAMES TO EARN CASH.");
  setJobMsg(type, "JOBS DISABLED");
  return;
  if (myName === "ANON") return failJob(type, "LOGIN REQUIRED");
  const cfg = JOBS[type];
  if (!cfg) return;

  const cooldownEnd = jobData.cooldowns?.[type] || 0;
  if (Date.now() < cooldownEnd) return failJob(type, `${cfg.name} ${getCooldownText(type)}`);

  if (type === "cashier") {
    activeJobs.cashier = { round: 0, goal: 4, entities: [], answer: 0, expr: "" };
    spawnCashierRound();
  }

  if (type === "frontdesk") {
    activeJobs.frontdesk = { round: 0, goal: 4, entities: [], sequence: [], sequenceLabels: [], step: 0, showing: true };
    spawnFrontdeskRound();
  }

  if (type === "delivery") {
    activeJobs.delivery = { count: 0, goal: 8, lives: 3, startedAt: Date.now(), durationMs: 17000, entities: [] };
    spawnDeliveryRound();
  }

  if (type === "stocker") {
    activeJobs.stocker = { round: 0, goal: 4, entities: [], targetLabel: "", left: 0 };
    spawnStockerRound();
  }

  if (type === "janitor") {
    activeJobs.janitor = { count: 0, goal: 8, startedAt: Date.now(), durationMs: 14000, entities: [] };
    spawnJanitorRound();
  }

  if (type === "barista") {
    activeJobs.barista = { count: 0, goal: 5, startedAt: Date.now(), periodMs: 360, targetMin: 155, targetMax: 165, currentTemp: 120 };
    setBaristaPrompt();
  }

  setText("jobsMsg", `${cfg.name} STARTED`);
  setJobMsg(type, "SHIFT STARTED");
  renderJobs();
}

export function submitJob(type, payload = null) {
  const cfg = JOBS[type];
  if (!cfg) return;
  const state = activeJobs[type];
  if (!state) return failJob(type, "START SHIFT FIRST");

  if (type === "barista") {
    setBaristaPrompt();
    const t = state.currentTemp;
    if (t >= state.targetMin && t <= state.targetMax) {
      state.count += 1;
      if (state.count >= state.goal) return markJobComplete(type);
      return setJobMsg(type, `PERFECT SHOT ${state.count}/${state.goal}`);
    }
    return failJob(type, "SHOT BURNT/WEAK. TIME IT BETTER.");
  }

  if (!payload) return failJob(type, "CLICK A TARGET ON THE BOARD.");

  if ((type === "delivery" || type === "janitor") && Date.now() - state.startedAt > state.durationMs) {
    activeJobs[type] = null;
    renderJobs();
    return failJob(type, "SHIFT ENDED. TIME'S UP.");
  }

  const selected = state.entities?.find((e) => e.id === payload);
  if (!selected) return failJob(type, "TARGET ALREADY GONE.");

  if (type === "cashier") {
    if (!selected.good) {
      activeJobs.cashier = null;
      renderJobs();
      return failJob(type, "WRONG TOTAL. CUSTOMER LEFT.");
    }
    state.round += 1;
    if (state.round >= state.goal) return markJobComplete(type);
    spawnCashierRound();
    return setJobMsg(type, `NEXT CUSTOMER ${state.round + 1}/${state.goal}`);
  }

  if (type === "frontdesk") {
    if (state.showing) return failJob(type, "WAIT FOR CODE TO HIDE.");
    const expected = state.sequence[state.step];
    if (payload !== expected) {
      activeJobs.frontdesk = null;
      renderJobs();
      return failJob(type, "WRONG KEYCARD. SECURITY ALERT.");
    }
    state.step += 1;
    if (state.step >= state.sequence.length) {
      state.round += 1;
      if (state.round >= state.goal) return markJobComplete(type);
      spawnFrontdeskRound();
      return setJobMsg(type, `BOOKING CONFIRMED ${state.round}/${state.goal}`);
    }
    setFrontdeskPrompt();
    return setJobMsg(type, `SEQUENCE ${state.step}/${state.sequence.length}`);
  }

  if (type === "delivery") {
    if (!selected.good) {
      state.lives -= 1;
      if (state.lives <= 0) {
        activeJobs.delivery = null;
        renderJobs();
        return failJob(type, "CRASHED VAN. SHIFT FAILED.");
      }
      spawnDeliveryRound();
      return failJob(type, `HAZARD HIT. ${state.lives} LIVES LEFT.`);
    }
    state.count += 1;
    if (state.count >= state.goal) return markJobComplete(type);
    spawnDeliveryRound();
    return setJobMsg(type, `CHECKPOINT ${state.count}/${state.goal}`);
  }

  if (type === "stocker") {
    if (!selected.good) return failJob(type, "WRONG SECTION. FIND CORRECT AISLE.");
    state.entities = state.entities.filter((e) => e.id !== payload);
    state.left -= 1;
    if (state.left <= 0) {
      state.round += 1;
      if (state.round >= state.goal) return markJobComplete(type);
      spawnStockerRound();
      return setJobMsg(type, `AISLE CLEARED ${state.round}/${state.goal}`);
    }
    setStockerPrompt();
    renderBoard("stocker");
    return setJobMsg(type, `${state.left} TARGETS LEFT`);
  }

  if (type === "janitor") {
    if (!selected.good) return failJob(type, "THAT'S NOT A SPILL. KEEP LOOKING.");
    state.count += 1;
    if (state.count >= state.goal) return markJobComplete(type);
    spawnJanitorRound();
    return setJobMsg(type, `SPILLS CLEANED ${state.count}/${state.goal}`);
  }
}

// Render the shop list with pricing + purchase state.
function renderShop() {
  const list = document.getElementById("shopList");
  setText("shopBank", myMoney);
  list.innerHTML = "";
  SHOP_ITEMS.forEach((item) => {
    const div = document.createElement("div");
    div.className = "shop-item";
    const ownedCount = myInventory.filter((ownedId) => ownedId === item.id).length;
    const isOwned = ownedCount > 0;
    const isEnabled = hasActiveItem(item.id);
    let label = "$" + item.cost;
    let btnText = "BUY";
    let disabled = myMoney < item.cost;
    if (isOwned) {
      label = item.type === "consumable" ? `OWNED x${ownedCount}` : "OWNED";
      if (item.type !== "consumable") {
        btnText = "OWNED";
        disabled = true;
      }
    }
    const toggleBtn = isOwned
      ? `<button class="shop-toggle-btn" onclick="window.toggleItem('${item.id}')">${
          isEnabled ? "ON" : "OFF"
        }</button>`
      : "";
    div.innerHTML = `<div><span class="shop-item-icon" aria-hidden="true">${item.icon || "🛒"}</span>${item.name}<div style="font-size:8px;opacity:0.7">${
      item.desc
    }</div></div><div style="text-align:right"><span style="color:var(--accent)">${label}</span><div class="shop-item-actions"><button class="shop-buy-btn" onclick="window.buyItem('${
      item.id
    }')" ${disabled ? "disabled" : ""}>${btnText}</button>${toggleBtn}</div></div>`;
    list.appendChild(div);
  });
}

// Purchase an item, apply its effects, and update the UI.
export function buyItem(id) {
  const item = SHOP_ITEMS.find((i) => i.id === id);
  if (myMoney >= item.cost) {
    myMoney -= item.cost;
    myInventory.push(id);
    setItemToggle(id, true);
    applyOwnedVisuals();
    if (id === "item_flappy") {
      showToast("NEW GAME UNLOCKED", "🎮");
    }
    if (myInventory.filter((i) => i !== "item_shield").length >= 3) {
      unlockAchievement("shopaholic");
    }
    if (id === "item_matrix") {
      unlockAchievement("neo");
      setMatrixMode(true);
      document.documentElement.style.setProperty("--accent", "#00ff00");
    }
    updateMatrixToggle();
    logTransaction(`BOUGHT: ${item.name}`, -item.cost);
    saveStats();
    renderShop();
    playSuccessSound();
    showToast(`BOUGHT: ${item.name}`, "🛒");
  }
}

export function toggleItem(id) {
  if (!myInventory.includes(id)) return;
  const enabled = !hasActiveItem(id);
  setItemToggle(id, enabled);
  if (id === "item_matrix" && !enabled) {
    setMatrixMode(false);
  }
  applyOwnedVisuals();
  updateMatrixToggle();
  saveStats();
  renderShop();
  const itemName = SHOP_ITEMS.find((item) => item.id === id)?.name || "ITEM";
  showToast(`${enabled ? "ENABLED" : "DISABLED"}: ${itemName}`, enabled ? "🟢" : "🔴");
}

// Display a toast notification with optional subtitle.
export function showToast(title, icon, subtitle = "") {
  const toastBox = document.getElementById("toastBox");
  if (!toastBox) return;

  toastBox.classList.toggle("in-game", !!currentGame);

  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-content"><div class="toast-title">${title}</div><div class="toast-desc">${subtitle}</div></div>`;
  toastBox.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// Auto-login if credentials exist in local storage.
if (localStorage.getItem("goonerUser")) {
  authInitPromise.finally(() => {
    login(
      localStorage.getItem("goonerUser"),
      localStorage.getItem("goonerPin")
    );
  });
}
// Login form handlers.
document.getElementById("btnLogin").onclick = async () => {
  const u = normalizeUsername(document.getElementById("usernameInput").value);
  const p = normalizePin(document.getElementById("pinInput").value);
  const res = await login(u, p);
  if (res === true) beep(600, "square", 0.1);
  else {
    setText("loginMsg", res);
    beep(100, "sawtooth", 0.5);
  }
};
// Registration form handler.
document.getElementById("btnRegister").onclick = async () => {
  const u = normalizeUsername(document.getElementById("usernameInput").value);
  const p = normalizePin(document.getElementById("pinInput").value);
  const res = await register(u, p);
  if (res === true) beep(600, "square", 0.1);
  else {
    setText("loginMsg", res);
    beep(100, "sawtooth", 0.5);
  }
};

document.getElementById("usernameInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") document.getElementById("btnLogin").click();
});

document.getElementById("pinInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") document.getElementById("btnLogin").click();
});
// Logout resets local storage + reloads the app.
document.getElementById("btnLogout").onclick = () => {
  localStorage.clear();
  location.reload();
};

const UI_CONFIG_KEY = "goonerUiConfigV1";

function readUiConfig() {
  try {
    return JSON.parse(localStorage.getItem(UI_CONFIG_KEY) || "{}");
  } catch (_error) {
    return {};
  }
}

function writeUiConfig(nextConfig) {
  localStorage.setItem(UI_CONFIG_KEY, JSON.stringify({ ...readUiConfig(), ...nextConfig }));
}

function applyUiScale(value) {
  document.documentElement.style.setProperty("--ui-scale", String(value));
  document.body.style.zoom = `${value}`;
}

function applyUiTextSize(valuePx) {
  document.documentElement.style.fontSize = `${valuePx}px`;
}

function applyContrastMode(enabled) {
  document.body.classList.toggle("high-contrast", enabled);
  const contrastToggle = document.getElementById("contrastToggle");
  if (contrastToggle) contrastToggle.textContent = enabled ? "ON" : "OFF";
}

function applyReducedMotion(enabled) {
  document.body.classList.toggle("reduce-motion", enabled);
  const motionToggle = document.getElementById("motionToggle");
  if (motionToggle) motionToggle.textContent = enabled ? "ON" : "OFF";
}
// Open the games directory from top navigation and keep menu-mash tracking.
const menuToggleBtn = document.getElementById("menuToggle");
const menuDropdownEl = document.getElementById("menuDropdown");
if (menuToggleBtn) {
  menuToggleBtn.onclick = (e) => {
    e.stopPropagation();
    registerMenuMash();
    if (menuDropdownEl) menuDropdownEl.classList.remove("show");
    if (typeof window.toggleTopPanelOverlay === "function") {
      window.toggleTopPanelOverlay("overlayGames");
      return;
    }
    openGame("overlayGames");
  };
}
// Click outside closes the dropdown menu if the legacy dropdown exists.
document.addEventListener("click", (e) => {
  if (!menuDropdownEl || !menuDropdownEl.children.length) return;
  if (!e.target.closest("#menuToggle")) menuDropdownEl.classList.remove("show");
});
// Enable/disable matrix canvas rendering.
function setMatrixMode(enabled) {
  const canvas = document.getElementById("matrixCanvas");
  if (!canvas) return;
  canvas.classList.toggle("active", enabled);
  updateMatrixToggle();
}
// Update Matrix toggle button text and state.
function updateMatrixToggle() {
  const toggle = document.getElementById("matrixToggle");
  const canvas = document.getElementById("matrixCanvas");
  if (!toggle || !canvas) return;
  const hasAccess = hasActiveItem("item_matrix");
  const enabled = canvas.classList.contains("active");
  toggle.disabled = !hasAccess;
  toggle.innerText = hasAccess ? (enabled ? "ON" : "OFF") : "LOCKED";
}
// Toggle Matrix mode on user click (if unlocked).
document.getElementById("matrixToggle").onclick = () => {
  if (!hasActiveItem("item_matrix")) {
    showToast("MATRIX LOCKED", "🔒", "Buy Matrix Mode in the shop.");
    updateMatrixToggle();
    return;
  }
  const canvas = document.getElementById("matrixCanvas");
  setMatrixMode(!canvas.classList.contains("active"));
};
// Theme accent color picker updates CSS variables.
document.getElementById("themeColor").oninput = (e) => {
  const h = e.target.value;
  document.documentElement.style.setProperty("--accent", h);
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  document.documentElement.style.setProperty("--accent-dim", `rgba(${r},${g},${b},0.2)`);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const glowR = Math.round(r + (255 - r) * 0.45);
  const glowG = Math.round(g + (255 - g) * 0.45);
  const glowB = Math.round(b + (255 - b) * 0.45);
  const glowAlpha = luminance < 0.25 ? 0.95 : 0.7;
  document.documentElement.style.setProperty("--accent-glow", `rgba(${glowR},${glowG},${glowB},${glowAlpha})`);
};
// Volume slider controls global audio volume.
document.getElementById("volSlider").oninput = (e) => {
  globalVol = e.target.value / 100;
};
// Scanline slider controls overlay opacity.
document.getElementById("scanSlider").oninput = (e) =>
  document.documentElement.style.setProperty(
    "--scanline-opacity",
    e.target.value / 100
  );
// Flicker toggle applies CSS class to the body.
document.getElementById("flickerToggle").onclick = (e) => {
  document.body.classList.toggle("flicker-on");
  e.target.innerText = document.body.classList.contains("flicker-on") ? "ON" : "OFF";
  registerFlickerFiend();
};
// Fullscreen toggle for immersion.
document.getElementById("fsToggle").onclick = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
};

document.getElementById("uiScaleSlider").oninput = (e) => {
  const value = Number(e.target.value) / 100;
  applyUiScale(value);
  writeUiConfig({ uiScale: value });
};

document.getElementById("uiTextSlider").oninput = (e) => {
  const value = Number(e.target.value);
  applyUiTextSize(value);
  writeUiConfig({ uiTextSize: value });
};

document.getElementById("contrastToggle").onclick = () => {
  const enabled = !document.body.classList.contains("high-contrast");
  applyContrastMode(enabled);
  writeUiConfig({ highContrast: enabled });
};

document.getElementById("motionToggle").onclick = () => {
  const enabled = !document.body.classList.contains("reduce-motion");
  applyReducedMotion(enabled);
  writeUiConfig({ reducedMotion: enabled });
};

(function hydrateUiConfig() {
  const config = readUiConfig();
  const uiScale = Number(config.uiScale || 1);
  const uiTextSize = Number(config.uiTextSize || 11);
  applyUiScale(uiScale);
  applyUiTextSize(uiTextSize);
  applyContrastMode(Boolean(config.highContrast));
  applyReducedMotion(Boolean(config.reducedMotion));
  const uiScaleSlider = document.getElementById("uiScaleSlider");
  const uiTextSlider = document.getElementById("uiTextSlider");
  if (uiScaleSlider) uiScaleSlider.value = String(Math.round(uiScale * 100));
  if (uiTextSlider) uiTextSlider.value = String(uiTextSize);
})();

// Konami code sequence for a hidden Matrix unlock.
const konamiCode = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];
let konamiIndex = 0;
document.addEventListener("keydown", (e) => {
  if (e.key === konamiCode[konamiIndex]) {
    konamiIndex++;
    if (konamiIndex === konamiCode.length) {
      activateMatrixHack();
      konamiIndex = 0;
    }
  } else konamiIndex = 0;
});
// Secret cheat flow for Matrix unlock + cash bonus.
function activateMatrixHack() {
  if (myName === "ANON") return alert("LOGIN FIRST");
  if (!myInventory.includes("item_matrix")) myInventory.push("item_matrix");
  setItemToggle("item_matrix", true);
  document.documentElement.style.setProperty("--accent", "#00ff00");
  setMatrixMode(true);
  showToast("MATRIX MODE ACTIVATED", "🐇");
  myMoney += 1000;
  saveStats();
  playSuccessSound();
}
let logoClicks = 0;
// Secret: clicking the logo many times gives a reward.
document.getElementById("mainBtn").onclick = () => {
  logoClicks++;
  if (logoClicks === 50) {
    unlockAchievement("spammer");
    showToast("SECRET FOUND", "🤫", "500 Credits");
    myMoney += 500;
    saveStats();
    logoClicks = 0;
  }
};
let bgClicks = 0;
// Secret: clicking empty background counts towards a hidden badge.
document.addEventListener("click", (e) => {
  if (e.target.tagName === "BODY" || e.target.classList.contains("wrap")) {
    bgClicks++;
    if (bgClicks === 50) unlockAchievement("void_gazer");
  } else {
    bgClicks = 0;
  }
});

let bankClicks = 0;
let bankTimer = null;
const bankCounterEl = document.getElementById("globalBank");
if (bankCounterEl) {
  bankCounterEl.addEventListener("click", () => {
    bankClicks++;
    if (!bankTimer) {
      bankTimer = setTimeout(() => {
        bankClicks = 0;
        bankTimer = null;
      }, 4000);
    }
    if (bankClicks === 15) {
      unlockAchievement("bank_tapper");
      showToast("BANK TAPPED", "🏦", "Counting faster than the mint.");
      bankClicks = 0;
      clearTimeout(bankTimer);
      bankTimer = null;
    }
  });
}

let menuMashCount = 0;
let menuMashTimer = null;
function registerMenuMash() {
  menuMashCount++;
  if (!menuMashTimer) {
    menuMashTimer = setTimeout(() => {
      menuMashCount = 0;
      menuMashTimer = null;
    }, 5000);
  }
  if (menuMashCount === 12) {
    unlockAchievement("menu_masher");
    showToast("MENU OVERRIDE", "🧭", "Navigation scrambled.");
    menuMashCount = 0;
    clearTimeout(menuMashTimer);
    menuMashTimer = null;
  }
}

let flickerClickCount = 0;
let flickerTimer = null;
function registerFlickerFiend() {
  flickerClickCount++;
  if (!flickerTimer) {
    flickerTimer = setTimeout(() => {
      flickerClickCount = 0;
      flickerTimer = null;
    }, 4000);
  }
  if (flickerClickCount === 6) {
    unlockAchievement("flicker_fiend");
    showToast("CRT OVERDRIVE", "📺", "Flicker stabilized.");
    flickerClickCount = 0;
    clearTimeout(flickerTimer);
    flickerTimer = null;
  }
}

let pingClicks = 0;
let pingTimer = null;
const pingEl = document.getElementById("sysPing");
if (pingEl) {
  pingEl.addEventListener("click", () => {
    pingClicks++;
    if (!pingTimer) {
      pingTimer = setTimeout(() => {
        pingClicks = 0;
        pingTimer = null;
      }, 4000);
    }
    if (pingClicks === 10) {
      unlockAchievement("signal_spy");
      showToast("PING SPOOFED", "📡", "Latency masked.");
      pingClicks = 0;
      clearTimeout(pingTimer);
      pingTimer = null;
    }
  });
}

let clockClicks = 0;
let clockTimer = null;
const clockEl = document.getElementById("sysClock");
if (clockEl) {
  clockEl.addEventListener("click", () => {
    clockClicks++;
    if (!clockTimer) {
      clockTimer = setTimeout(() => {
        clockClicks = 0;
        clockTimer = null;
      }, 3000);
    }
    if (clockClicks === 7) {
      unlockAchievement("clockwork");
      showToast("TIME LOOP STABILIZED", "⏱️", "Chrono buffer reset.");
      clockClicks = 0;
      clearTimeout(clockTimer);
      clockTimer = null;
    }
  });
}

let chatCount = 0;
let lastChatAt = 0;
let lastChatMsg = "";
let activeChatTab = "global";
let stopChatListener = null;

function getChatTabConfig(tab) {
  const crewTag = normalizeCrewTag(crewData?.tag || "");
  const configs = {
    dm: {
      label: "MESSAGES",
      placeholder: "@USER MESSAGE...",
      meta: "DIRECT MESSAGES // USE @USERNAME MESSAGE",
      getQuery: () => query(collection(db, "gooner_user_chat"), where("participants", "array-contains", normalizeUsername(myName)), orderBy("ts", "desc"), limit(25)),
      send: (txt) => {
        const match = txt.match(/^@([A-Za-z0-9_\-]{2,16})\s+(.+)$/);
        if (!match) return { error: "USE @USERNAME FOLLOWED BY A MESSAGE." };
        const to = normalizeUsername(match[1]);
        const body = filterChatMessage(match[2] || "").slice(0, 60);
        if (!body) return { error: "MESSAGE BODY CANNOT BE EMPTY." };
        if (to === normalizeUsername(myName)) return { error: "CAN'T DM YOURSELF." };
        return {
          payload: { user: myName, to, participants: [normalizeUsername(myName), to], msg: body, ts: Date.now() },
          collectionName: "gooner_user_chat"
        };
      },
      renderMessage: (m) => {
        const sender = normalizeUsername(m.user || "ANON");
        const to = normalizeUsername(m.to || "");
        const mine = sender === normalizeUsername(myName);
        const prefix = mine ? `TO ${to || "UNKNOWN"}` : `FROM ${sender}`;
        return `<span class="chat-user">${escapeHtml(prefix)}:</span> ${escapeHtml(filterChatMessage(m.msg || ""))}`;
      }
    },
    global: {
      label: "GLOBAL",
      placeholder: "TYPE MESSAGE...",
      meta: "GLOBAL CHANNEL // TYPE MESSAGE...",
      getQuery: () => query(collection(db, "gooner_global_chat"), orderBy("ts", "desc"), limit(25)),
      send: (txt) => ({ payload: { user: myName, msg: filterChatMessage(txt).slice(0, 60), ts: Date.now() }, collectionName: "gooner_global_chat" }),
      renderMessage: (m) => {
        const user = String(m.user || "ANON").toUpperCase();
        return `<span class="chat-user">${escapeHtml(user)}:</span> ${escapeHtml(filterChatMessage(m.msg || ""))}`;
      }
    },
    crew: {
      label: "CREW",
      placeholder: "SEND TO CREW...",
      meta: crewTag ? `CREW CHANNEL [${crewTag}]` : "CREW CHANNEL // JOIN A CREW TO CHAT",
      getQuery: () => {
        if (!crewTag) return null;
        return query(collection(db, "gooner_crew_chat"), where("crewTag", "==", crewTag), orderBy("ts", "desc"), limit(25));
      },
      send: (txt) => {
        if (!crewTag) return { error: "JOIN A CREW BEFORE USING CREW CHAT." };
        return { payload: { user: myName, crewTag, msg: filterChatMessage(txt).slice(0, 60), ts: Date.now() }, collectionName: "gooner_crew_chat" };
      },
      renderMessage: (m) => {
        const user = String(m.user || "ANON").toUpperCase();
        return `<span class="chat-user">${escapeHtml(user)}:</span> ${escapeHtml(filterChatMessage(m.msg || ""))}`;
      }
    }
  };
  return configs[tab] || configs.global;
}

function renderChatTab() {
  const input = document.getElementById("chatInput");
  const list = document.getElementById("chatHistory");
  const meta = document.getElementById("chatMeta");
  const tabConfig = getChatTabConfig(activeChatTab);
  document.querySelectorAll(".chat-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.chatTab === activeChatTab);
  });
  if (input) input.placeholder = tabConfig.placeholder;
  if (meta) meta.textContent = tabConfig.meta;
  if (stopChatListener) {
    stopChatListener();
    stopChatListener = null;
  }
  if (!tabConfig.getQuery()) {
    if (list) list.innerHTML = '<div class="chat-msg">NO CREW LINKED. JOIN A CREW TO UNLOCK THIS TAB.</div>';
    return;
  }
  stopChatListener = onSnapshot(tabConfig.getQuery(), (snap) => {
    if (!list) return;
    list.innerHTML = "";
    const blocklist = getChatSet(CHAT_BLOCKLIST_KEY);
    const muted = getChatSet(CHAT_MUTED_KEY);
    const msgs = [];
    snap.forEach((d) => msgs.push(d.data()));
    msgs.reverse().forEach((m) => {
      const user = normalizeUsername(m.user || "ANON");
      if (blocklist.has(user) || muted.has(user)) return;
      const d = document.createElement("div");
      d.className = "chat-msg";
      d.innerHTML = tabConfig.renderMessage(m);
      list.appendChild(d);
    });
    list.scrollTop = list.scrollHeight;
  });
}

// Initialize realtime chat streaming and input handling.
function initChat() {
  document.querySelectorAll(".chat-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeChatTab = btn.dataset.chatTab || "global";
      renderChatTab();
    });
  });
  renderChatTab();
  document.getElementById("chatInput").addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;

    const txt = e.target.value.trim();
    if (!txt.length) return;

    // Local-only commands (no remote write).
    if (txt === "/clear") {
      document.getElementById("chatHistory").innerHTML = "";
      e.target.value = "";
      return;
    }
    if (txt === "/root") {
      e.target.value = "";
      document.getElementById("hackOverlay").classList.add("active");
      setTimeout(() => {
        document.getElementById("hackOverlay").classList.remove("active");
        unlockAchievement("master_hacker");
      }, 2000);
      return;
    }
    if (txt === "/help") {
      unlockAchievement("architect");
      showToast("CHAT OPS", "🛠️", "/mute USER /unmute USER /block USER");
      e.target.value = "";
      return;
    }
    if (txt === "/ghost") {
      unlockAchievement("ghost_signal");
      showToast("GHOST SIGNAL", "👻", "Silent channel open.");
      e.target.value = "";
      return;
    }

    if (txt.toLowerCase().startsWith("/mute ") || txt.toLowerCase().startsWith("/block ")) {
      const user = normalizeUsername(txt.split(/\s+/)[1]);
      const muted = getChatSet(CHAT_MUTED_KEY);
      muted.add(user);
      setChatSet(CHAT_MUTED_KEY, muted);
      showToast("MUTED USER", "🔇", user);
      e.target.value = "";
      return;
    }
    if (txt.toLowerCase().startsWith("/unmute ")) {
      const user = normalizeUsername(txt.split(/\s+/)[1]);
      const muted = getChatSet(CHAT_MUTED_KEY);
      muted.delete(user);
      setChatSet(CHAT_MUTED_KEY, muted);
      showToast("UNMUTED USER", "🔊", user);
      e.target.value = "";
      return;
    }

    const now = Date.now();
    if (now - lastChatAt < 1000) {
      showToast("RATE LIMITED", "⏳", "Wait 1 second between messages.");
      return;
    }
    if (txt.toLowerCase() === lastChatMsg.toLowerCase()) {
      showToast("DUPLICATE BLOCKED", "🧱", "Send a different message.");
      return;
    }

    const tabConfig = getChatTabConfig(activeChatTab);
    const sendConfig = tabConfig.send(txt);
    if (sendConfig.error) {
      showToast(tabConfig.label, "⚠️", sendConfig.error);
      return;
    }

    lastChatAt = now;
    lastChatMsg = txt;
    chatCount++;
    grantSeasonXp(10);
    if (chatCount === 10) unlockAchievement("chatterbox");
    const posted = await runFirestoreTask(
      () => addDoc(collection(db, sendConfig.collectionName), sendConfig.payload),
      "CHAT",
      "Message not sent."
    );
    if (!posted) return;
    e.target.value = "";
  });
}

const gameCashProgress = {};
const gameLeaderboardCache = {};
const leaderboardScoreSyncState = {};
const LEADERBOARD_SCORE_SYNC_COOLDOWN_MS = 60000;
const LEADERBOARD_SCORE_SYNC_MIN_DELTA = 25;
let leaderboardDifficultyFilter = "all";
let leaderboardPlayerCountFilter = "all";

function normalizeLeaderboardMode(mode) {
  const normalized = String(mode || "").toLowerCase().trim();
  if (["easy", "hard", "single", "multiplayer"].includes(normalized)) return normalized;
  return "single";
}

function getLeaderboardBaseline(game) {
  const key = String(game || "").toLowerCase().trim();
  if (!key) return 100;
  const cached = gameLeaderboardCache[key];
  if (cached && Date.now() - cached.updatedAt < 60000) return cached.baseline;

  const fallback = Math.max(25, Number(localStorage.getItem(`hs_${key}`)) || 100);
  if (!cached?.loading) {
    gameLeaderboardCache[key] = {
      baseline: cached?.baseline || fallback,
      updatedAt: cached?.updatedAt || 0,
      loading: true,
    };

    getDocs(query(collection(db, "gooner_scores"), where("game", "==", key), limit(200)))
      .then((snap) => {
        const bestByPlayer = {};
        snap.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const player = String(data.name || "ANON");
          const score = Math.max(0, Number(data.score) || 0);
          if (!bestByPlayer[player] || score > bestByPlayer[player]) bestByPlayer[player] = score;
        });

        const topScores = Object.values(bestByPlayer)
          .sort((a, b) => b - a)
          .slice(0, 10);
        const baseline = topScores.length
          ? topScores[Math.floor((topScores.length - 1) / 2)]
          : fallback;

        gameLeaderboardCache[key] = {
          baseline: Math.max(25, Math.floor(baseline)),
          updatedAt: Date.now(),
          loading: false,
        };
      })
      .catch(() => {
        gameLeaderboardCache[key] = {
          baseline: fallback,
          updatedAt: Date.now(),
          loading: false,
        };
      });
  }

  return cached?.baseline || fallback;
}

function awardScoreCash(game, score) {
  const key = String(game || "").toLowerCase().trim();
  const current = Math.max(0, Number(score) || 0);
  if (!key || !Number.isFinite(current)) return;

  const previous = gameCashProgress[key] || 0;
  if (current <= previous) return;

  const delta = current - previous;
  const leaderboardBaseline = getLeaderboardBaseline(key);
  const perPoint = Math.max(0.25, Math.min(10, 180 / Math.max(25, leaderboardBaseline)));
  const progressionCash = Math.max(1, Math.round(delta * perPoint));
  const firstRunBonus = previous === 0 ? 20 : 0;
  const payout = Math.min(5000, progressionCash + firstRunBonus);

  gameCashProgress[key] = current;
  myMoney += payout;
  logTransaction(`GAME PAYOUT: ${key.toUpperCase()} +${delta} SCORE`, payout);
}

// Update and persist a local high score for a given game.
export function updateHighScore(game, score, options = {}) {
  awardScoreCash(game, score);
  const key = String(game || "").toLowerCase().trim();
  const k = `hs_${key}`;
  const old = parseInt(localStorage.getItem(k) || 0);
  if (score > old) {
    localStorage.setItem(k, score);
    const mode = normalizeLeaderboardMode(options.mode);
    const forceGlobalSync = options.forceGlobalSync === true;
    const syncState = leaderboardScoreSyncState[key] || { lastSentAt: 0, lastSentScore: 0 };
    const enoughTimeElapsed = Date.now() - syncState.lastSentAt >= LEADERBOARD_SCORE_SYNC_COOLDOWN_MS;
    const enoughScoreDelta = score - syncState.lastSentScore >= LEADERBOARD_SCORE_SYNC_MIN_DELTA;
    if (forceGlobalSync || enoughTimeElapsed || enoughScoreDelta) {
      leaderboardScoreSyncState[key] = { lastSentAt: Date.now(), lastSentScore: score };
      saveGlobalScore(key, score, { mode });
    }
    return score;
  }
  return old;
}

// Load per-game high scores into the profile overlay.
export function loadHighScores() {
  setText("hsPong", localStorage.getItem("hs_pong") || 0);
  setText("hsSnake", localStorage.getItem("hs_snake") || 0);
  setText("hsRunner", localStorage.getItem("hs_runner") || 0);
  setText("hsGeo", localStorage.getItem("hs_geo") || 0);
  setText("hsFlappy", localStorage.getItem("hs_flappy") || 0);
  setText("hsDodge", localStorage.getItem("hs_dodge") || 0);
  setText("hsCorebreaker", localStorage.getItem("hs_corebreaker") || 0);
  setText("hsNeondefender", localStorage.getItem("hs_neondefender") || 0);
  setText("hsVoidminer", localStorage.getItem("hs_voidminer") || 0);
}

// Persist a high score globally so it appears on the leaderboard.
export async function saveGlobalScore(game, score, options = {}) {
  if (score <= 0 || myName === "ANON") return;
  const mode = normalizeLeaderboardMode(options.mode);
  await runFirestoreTask(
    () =>
      addDoc(collection(db, "gooner_scores"), {
        game: game,
        name: myName,
        score: score,
        mode,
      }),
    "LEADERBOARD",
    "Score queued for retry."
  );
}

// Scoreboard columns rendering.
let leaderboardUnsubs = [];

const formatLeaderboardModeLabel = (mode) => {
  if (mode === "easy") return "EASY";
  if (mode === "hard") return "HARD";
  if (mode === "multiplayer") return "MULTIPLAYER";
  return "SINGLE PLAYER";
};

const LEADERBOARD_COLUMNS = [
  { id: "players", title: "PLAYERS", type: "players", tags: ["players", "operator", "rank"] },
  { id: "richest", title: "RICHEST", type: "richest", tags: ["bank", "money", "cash", "economy"] },
  ...LEADERBOARD_GAME_COLUMNS.flatMap((game) => {
    const modes = (game.leaderboardModes || ["single"]).filter(Boolean);
    return modes.map((mode) => ({
      id: `${game.id}__${mode}`,
      gameId: game.id,
      mode,
      title: `${game.title} // ${formatLeaderboardModeLabel(mode)}`,
      type: "game",
      tags: [...(game.tags || []), mode, formatLeaderboardModeLabel(mode).toLowerCase()],
      leaderboardModes: [mode],
    }));
  }),
];

const clearLeaderboardSubscriptions = () => {
  leaderboardUnsubs.forEach((unsub) => {
    if (typeof unsub === "function") unsub();
  });
  leaderboardUnsubs = [];
};

const getLeaderboardFilterValue = () => {
  const filterInput = document.getElementById("leaderboardFilter");
  return String(filterInput?.value || "")
    .trim()
    .toUpperCase();
};

function getModePlayerCount(mode) {
  return mode === "multiplayer" ? "multiplayer" : "single";
}

function shouldIncludeScoreRowByFilters(mode) {
  const normalizedMode = normalizeLeaderboardMode(mode);
  if (leaderboardDifficultyFilter !== "all") {
    if (!["easy", "hard"].includes(normalizedMode) || normalizedMode !== leaderboardDifficultyFilter) return false;
  }
  if (leaderboardPlayerCountFilter !== "all" && getModePlayerCount(normalizedMode) !== leaderboardPlayerCountFilter) return false;
  return true;
}

const renderLeaderboardRows = (
  list,
  rows,
  {
    valuePrefix = "",
    emptyText = "NO DATA YET — PLAY A ROUND TO POPULATE THIS BOARD",
    showAdminRemove = false,
  } = {}
) => {
  list.innerHTML = "";
  if (!rows.length) {
    list.innerHTML = `<div style="padding:10px">${emptyText}</div>`;
    return;
  }
  rows.forEach((row, i) => {
    const item = document.createElement("div");
    item.className = "score-item";

    const rank = document.createElement("span");
    rank.className = "score-rank";
    rank.innerText = `#${i + 1}`;

    const name = document.createElement("span");
    name.innerText = row.name;

    if (row.rankData) {
      const badge = document.createElement("span");
      badge.className = `rank-badge inline ${row.rankData.className}`;
      badge.innerText = row.rankData.badge;
      badge.title = row.rankData.label;
      name.prepend(badge);
    }

    const value = document.createElement("span");
    value.innerText = `${valuePrefix}${row.score}`;

    item.append(rank, name, value);

    if (showAdminRemove && isGodUser() && row.canRemove) {
      const actions = document.createElement("div");
      actions.className = "score-actions";
      const removeBtn = document.createElement("button");
      removeBtn.className = "menu-btn admin-remove-btn";
      removeBtn.innerText = "REMOVE";
      removeBtn.onclick = () => adminRemoveAccount(row.name);
      actions.appendChild(removeBtn);
      item.appendChild(actions);
    }

    list.appendChild(item);
  });
};

async function adminRemoveAccount(targetName) {
  if (!isGodUser()) return;
  const name = String(targetName || "").toUpperCase();
  if (!name || name === myName || isGodUser(name)) return;

  try {
    await deleteDoc(doc(db, "gooner_users", name));
    showToast(`PLAYER REMOVED: ${name}`, "🗑️");
  } catch (e) {
    showToast("ACCOUNT REMOVE FAILED", "⚠️", "Try again.");
  }
}

function loadLeaderboardColumn(column, body) {
  body.innerHTML = "<div class=\"score-item\">LOADING...</div>";

  if (column.type === "players") {
    const q = query(collection(db, "gooner_users"), orderBy("name"), limit(100));
    leaderboardUnsubs.push(
      onSnapshot(q, (snap) => {
        const rows = [];
        snap.forEach((d) => {
          const data = d.data();
          const playerName = data.name || d.id;
          rows.push({
            name: playerName,
            score: data.rank || getRank(Number(data.money) || 0, playerName),
            rankData: getRankData(Number(data.money) || 0, playerName),
            canRemove: playerName !== myName && !isGodUser(playerName),
          });
        });
        renderLeaderboardRows(body, rows, { showAdminRemove: true });
      })
    );
    return;
  }

  if (column.type === "richest") {
    const q = query(collection(db, "gooner_users"), orderBy("money", "desc"), limit(10));
    leaderboardUnsubs.push(
      onSnapshot(q, (snap) => {
        const rows = [];
        snap.forEach((d) => {
          const data = d.data();
          rows.push({ name: data.name || d.id, score: data.money ?? 0 });
        });
        renderLeaderboardRows(body, rows, { valuePrefix: "$" });
      })
    );
    return;
  }

  const q = query(collection(db, "gooner_scores"), where("game", "==", column.gameId), limit(200));
  leaderboardUnsubs.push(
    onSnapshot(q, (snap) => {
      const data = [];
      snap.forEach((d) => data.push(d.data()));
      const modeFiltered = data.filter((row) => {
        const entryMode = normalizeLeaderboardMode(row.mode);
        if (column.mode && entryMode !== column.mode) return false;
        return shouldIncludeScoreRowByFilters(entryMode);
      });
      const uniqueScores = {};
      modeFiltered.forEach((scoreRow) => {
        if (!uniqueScores[scoreRow.name] || scoreRow.score > uniqueScores[scoreRow.name].score) {
          uniqueScores[scoreRow.name] = scoreRow;
        }
      });
      const filtered = Object.values(uniqueScores)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      renderLeaderboardRows(body, filtered);
    })
  );
}

// Render all leaderboard columns and subscribe to each data feed.
function loadLeaderboard() {
  const list = document.getElementById("scoreList");
  const filterInput = document.getElementById("leaderboardFilter");
  const difficultySelect = document.getElementById("leaderboardDifficultyFilter");
  const playerCountSelect = document.getElementById("leaderboardPlayerCountFilter");
  if (!list) return;

  if (filterInput && !filterInput.dataset.bound) {
    filterInput.addEventListener("input", () => loadLeaderboard());
    filterInput.dataset.bound = "1";
  }

  if (difficultySelect && !difficultySelect.dataset.bound) {
    difficultySelect.addEventListener("change", () => {
      leaderboardDifficultyFilter = String(difficultySelect.value || "all").toLowerCase();
      loadLeaderboard();
    });
    difficultySelect.dataset.bound = "1";
  }

  if (playerCountSelect && !playerCountSelect.dataset.bound) {
    playerCountSelect.addEventListener("change", () => {
      leaderboardPlayerCountFilter = String(playerCountSelect.value || "all").toLowerCase();
      loadLeaderboard();
    });
    playerCountSelect.dataset.bound = "1";
  }

  if (difficultySelect) leaderboardDifficultyFilter = String(difficultySelect.value || "all").toLowerCase();
  if (playerCountSelect) leaderboardPlayerCountFilter = String(playerCountSelect.value || "all").toLowerCase();

  clearLeaderboardSubscriptions();
  list.innerHTML = "";

  const filterValue = getLeaderboardFilterValue();
  const visibleColumns = filterValue
    ? LEADERBOARD_COLUMNS.filter((column) => {
        const searchable = `${column.id} ${column.title} ${(column.tags || []).join(" ")}`.toUpperCase();
        return searchable.includes(filterValue);
      })
    : LEADERBOARD_COLUMNS;

  const filteredColumns = visibleColumns.filter((column) => {
    if (column.type !== "game") return true;

    if (leaderboardDifficultyFilter !== "all" && !(column.leaderboardModes || []).includes(leaderboardDifficultyFilter)) return false;

    if (leaderboardPlayerCountFilter !== "all") {
      const gamePlayerCount = (column.leaderboardModes || []).includes("multiplayer") ? "multiplayer" : "single";
      if (gamePlayerCount !== leaderboardPlayerCountFilter) return false;
    }

    return true;
  });

  if (!filteredColumns.length) {
    list.innerHTML = `<div class="score-item">NO LEADERBOARD TYPE MATCHES CURRENT FILTERS</div>`;
    return;
  }

  const columnsWrap = document.createElement("div");
  columnsWrap.className = "score-columns";

  filteredColumns.forEach((column) => {
    const card = document.createElement("section");
    card.className = "score-column";

    const title = document.createElement("h3");
    title.innerText = column.title;

    const body = document.createElement("div");
    body.className = "score-column-body";

    card.append(title, body);
    columnsWrap.appendChild(card);
    loadLeaderboardColumn(column, body);
  });

  list.appendChild(columnsWrap);
}


function initGameLeaderboardButton() {
  const btn = document.getElementById("gameLeaderboardJumpBtn");
  if (!btn || btn.dataset.bound) return;
  btn.addEventListener("click", () => {
    if (!currentGame) return;
    openGameLeaderboard(currentGame);
  });
  btn.dataset.bound = "1";
}

function syncGameLeaderboardButton() {
  const btn = document.getElementById("gameLeaderboardJumpBtn");
  if (!btn) return;
  const hasGame = Boolean(currentGame);
  btn.classList.toggle("active", hasGame);
  btn.style.display = hasGame ? "block" : "none";
  btn.textContent = hasGame ? `VIEW ${String(currentGame).toUpperCase()} LEADERBOARD` : "VIEW LEADERBOARD";
}

export function openGameLeaderboard(gameId) {
  leaderboardDifficultyFilter = "all";
  leaderboardPlayerCountFilter = "all";
  openGame("overlayScores");

  const normalizedGameId = String(gameId || "").toLowerCase();
  const gameColumn = LEADERBOARD_COLUMNS.find((column) => column.type === "game" && column.gameId === normalizedGameId);
  const filterInput = document.getElementById("leaderboardFilter");
  if (filterInput) filterInput.value = normalizedGameId || gameColumn?.title || String(gameId || "");

  const difficultySelect = document.getElementById("leaderboardDifficultyFilter");
  if (difficultySelect) difficultySelect.value = "all";
  const playerCountSelect = document.getElementById("leaderboardPlayerCountFilter");
  if (playerCountSelect) playerCountSelect.value = "all";

  loadLeaderboard();
}

// Count consecutive losses for the rage-quit achievement.
export function checkLossStreak() {
  lossStreak++;
  if (lossStreak === 3) unlockAchievement("rage_quit");
}

// Reset loss streak after a win or successful run.
export function resetLossStreak() {
  lossStreak = 0;
}

// Listen for space/enter to quickly restart after game over.
function quickRestartListener(e) {
  if (e.key === " " || e.key === "Enter") {
    document.getElementById("goRestart").click();
    window.removeEventListener("keydown", quickRestartListener);
  }
}

// Explicitly clear the quick restart key listener.
export function clearRestartListener() {
  window.removeEventListener("keydown", quickRestartListener);
}

function calculateGameRewards(game, score) {
  const safeScore = Math.max(0, Math.floor(Number(score) || 0));
  const cfg = GAME_PAYOUT_CONFIG[game] || GAME_PAYOUT_CONFIG.default;
  const baseline = 20;
  const scaled = Math.floor(safeScore * cfg.rate);
  let cashReward = Math.min(12000, baseline + scaled);
  if (hasActiveItem("item_bank_drone")) {
    cashReward += Math.floor(Math.sqrt(safeScore) * 12);
  }
  if (hasActiveItem("item_salary_boost")) {
    cashReward = Math.floor(cashReward * 1.35);
  }
  if (hasActiveItem("item_combo_insurance")) {
    cashReward = Math.max(cashReward, 120);
  }

  let xpReward = Math.max(10, Math.floor(Math.sqrt(safeScore + 1) * 4 * cfg.xpRate));
  if (hasActiveItem("item_xp_router")) {
    xpReward = Math.floor(xpReward * 1.4);
  }
  return { cashReward, xpReward };
}

// Show a game over modal and set up restart handling.
export function showGameOver(game, score) {
  stopAllGames();
  currentGame = game;
  const rewards = calculateGameRewards(game, score);
  myMoney += rewards.cashReward;
  logTransaction(`GAME PAYOUT: ${String(game || "arcade").toUpperCase()}`, rewards.cashReward);
  grantSeasonXp(rewards.xpReward);
  saveStats();
  updateUI();
  beep(150, "sawtooth", 0.5);
  setText("gameOverText", "SYSTEM_FAILURE: SCORE_" + score);
  showToast(`RUN COMPLETE: +$${rewards.cashReward}`, "💸", `+${rewards.xpReward} SEASON XP`);
  const modal = document.getElementById("modalGameOver");
  const activeOverlays = Array.from(document.querySelectorAll(".overlay.active"));
  const activeGameOverlay =
    activeOverlays.find((overlay) =>
      overlay.classList.contains("game-overlay") || overlay.querySelector("canvas, .embedded-game-frame")
    ) || activeOverlays[activeOverlays.length - 1] || null;

  const gameSurface = activeGameOverlay?.querySelector("canvas, .embedded-game-frame");
  let modalHost = null;
  if (gameSurface?.parentElement) {
    if (gameSurface.parentElement.classList.contains("game-surface-host")) {
      modalHost = gameSurface.parentElement;
    } else {
      const surfaceHost = document.createElement("div");
      surfaceHost.className = "game-surface-host";
      gameSurface.parentElement.insertBefore(surfaceHost, gameSurface);
      surfaceHost.appendChild(gameSurface);
      modalHost = surfaceHost;
    }
  }
  if (!modalHost) {
    modalHost = activeGameOverlay?.querySelector(".game-content-shell") || activeGameOverlay || document.body;
  }

  modalHost.classList.add("game-over-host");
  modalHost.appendChild(modal);
  modal.classList.add("active");
  window.addEventListener("keydown", quickRestartListener);
}

// Track active keys for games that rely on continuous input.
document.addEventListener("keydown", (e) => {
  keysPressed[e.key] = true;
});
document.addEventListener("keyup", (e) => {
  keysPressed[e.key] = false;
});
