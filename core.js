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

// Firebase project configuration.
const firebaseConfig = {
  apiKey: "AIzaSyAoXwDA6KtqSD4yfGprus8C8Mi_--1KwSw",
  authDomain: "funnys-18ff7.firebaseapp.com",
  projectId: "funnys-18ff7",
  storageBucket: "funnys-18ff7.firebasestorage.app",
  messagingSenderId: "368675604960",
  appId: "1:368675604960:web:24c5dcd6a5329c9fd94385",
  measurementId: "G-6PE47RLP8V",
};

// Firebase service handles.
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
const STOCK_MULTIPLIERS = [1, 5, 10, 25, "MAX"];

const SHOP_TOGGLE_STORAGE_PREFIX = "goonerItemToggles:";
const LOCAL_USER_STORAGE_KEY = "goonerLocalUsers";
const GOD_USERS = new Set(["NOOB", "THEFOX"]);

// Audio context for simple synth effects.
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Register per-game cleanup hooks (each game adds a stop function).
const gameStops = [];

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


function isGodUser(name = myName) {
  return GOD_USERS.has(String(name || "").toUpperCase());
}

function updateAdminMenu() {
  const adminBtn = document.getElementById("adminMenuBtn");
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
    name: "PONG AIMBOT",
    cost: 2000,
    type: "perk",
    desc: "Auto-play Pong",
  },
  {
    id: "item_slowmo",
    name: "RUNNER SLOW-MO",
    cost: 1500,
    type: "perk",
    desc: "20% Slower Speed",
  },
  {
    id: "item_shield",
    name: "1-HIT SHIELD",
    cost: 500,
    type: "consumable",
    desc: "Survive one crash",
  },
  {
    id: "item_xray",
    name: "X-RAY VISOR",
    cost: 5000,
    type: "perk",
    desc: "See Dealer Card",
  },
  {
    id: "item_cardcount",
    name: "CARD COUNTER",
    cost: 3000,
    type: "perk",
    desc: "BJ Count Assist",
  },
  {
    id: "item_double",
    name: "SNAKE OIL",
    cost: 3000,
    type: "perk",
    desc: "Double Snake Points",
  },
  {
    id: "item_dodge_stabilizer",
    name: "DODGE STABILIZER",
    cost: 2500,
    type: "perk",
    desc: "Slow falling shards",
  },
  {
    id: "item_matrix",
    name: "MATRIX MODE",
    cost: 6000,
    type: "visual",
    desc: "Toggle Matrix background",
  },
  {
    id: "item_rainbow",
    name: "RGB MODE",
    cost: 10000,
    type: "visual",
    desc: "Color Cycle",
  },
  {
    id: "item_autotype",
    name: "AUTO-TYPER",
    cost: 7500,
    type: "perk",
    desc: "Bot plays Typer",
  },
  {
    id: "item_flappy",
    name: "GAME: FLAPPY",
    cost: 10000,
    type: "visual",
    desc: "Unlock Flappy Goon",
  },
];

const STOCK_SYMBOLS = [
  { symbol: "GOON", name: "GOON TECH" },
  { symbol: "MEME", name: "MEME HOLDINGS" },
  { symbol: "BYTE", name: "BYTE INDUSTRIES" },
  { symbol: "NOVA", name: "NOVA ENERGY" },
  { symbol: "PUMP", name: "PUMP CAPITAL" },
];

const STOCK_SEED_PRICES = { GOON: 110, MEME: 90, BYTE: 130, NOVA: 75, PUMP: 55 };
const GLOBAL_MARKET_COLLECTION = "gooner_meta";
const GLOBAL_MARKET_DOC_ID = "stock_market";
const GLOBAL_MARKET_TICK_MS = 2000;

const marketState = {
  stocks: STOCK_SYMBOLS.map((entry) => {
    const start = STOCK_SEED_PRICES[entry.symbol] || 100;
    return {
      ...entry,
      price: start,
      history: Array.from({ length: 40 }, () => Number(start.toFixed(2))),
      lastMove: 0,
    };
  }),
};

let marketSyncStarted = false;

function buildStockSnapshot(stocks) {
  return stocks.map((stock) => ({
    symbol: stock.symbol,
    name: stock.name,
    price: Number((stock.price || 0).toFixed(2)),
    history: (Array.isArray(stock.history) ? stock.history : []).slice(-80).map((value) => Number(value || 0)),
    lastMove: Number(stock.lastMove || 0),
  }));
}

function applyMarketSnapshot(stocks) {
  const safeList = Array.isArray(stocks) ? stocks : [];
  marketState.stocks = STOCK_SYMBOLS.map((entry) => {
    const found = safeList.find((stock) => stock.symbol === entry.symbol) || {};
    const seed = STOCK_SEED_PRICES[entry.symbol] || 100;
    const price = Math.max(3, Number(found.price || seed));
    const history = Array.isArray(found.history) && found.history.length
      ? found.history.slice(-80).map((value) => Number(value || price))
      : Array.from({ length: 40 }, () => price);
    return {
      ...entry,
      price: Number(price.toFixed(2)),
      history,
      lastMove: Number(found.lastMove || 0),
    };
  });
  renderStockMarket();
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

function tickStockMarket(stocks = marketState.stocks) {
  const nextStocks = stocks.map((stock) => ({ ...stock }));
  nextStocks.forEach((stock) => {
    const drift = (Math.random() - 0.49) * 0.09;
    const momentum = stock.lastMove * 0.35;
    const swing = (Math.random() - 0.5) * 0.04;
    const next = Math.max(3, stock.price * (1 + drift + momentum + swing));
    stock.lastMove = (next - stock.price) / stock.price;
    stock.price = Number(next.toFixed(2));
    stock.history = Array.isArray(stock.history) ? [...stock.history] : [];
    stock.history.push(stock.price);
    if (stock.history.length > 80) stock.history.shift();
  });
  return nextStocks;
}

async function initGlobalStockMarket() {
  if (marketSyncStarted || !myUid) return;
  marketSyncStarted = true;
  const marketRef = doc(db, GLOBAL_MARKET_COLLECTION, GLOBAL_MARKET_DOC_ID);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(marketRef);
      if (snap.exists()) return;
      tx.set(marketRef, {
        stocks: buildStockSnapshot(marketState.stocks),
        updatedAt: Date.now(),
        updatedBy: myUid,
      });
    });
  } catch (e) {
    marketSyncStarted = false;
    return;
  }

  onSnapshot(marketRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data() || {};
    applyMarketSnapshot(data.stocks || []);
  });

  setInterval(async () => {
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(marketRef);
        if (!snap.exists()) return;
        const data = snap.data() || {};
        const updatedAt = Number(data.updatedAt || 0);
        if (Date.now() - updatedAt < GLOBAL_MARKET_TICK_MS - 150) return;

        const serverStocks = Array.isArray(data.stocks) && data.stocks.length
          ? data.stocks
          : marketState.stocks;
        const nextStocks = tickStockMarket(serverStocks);
        tx.set(marketRef, {
          stocks: buildStockSnapshot(nextStocks),
          updatedAt: Date.now(),
          updatedBy: myUid,
        });
      });
    } catch (e) {
      // passive retry via interval
    }
  }, GLOBAL_MARKET_TICK_MS);
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

// Allow games to register a cleanup routine when overlays close.
export function registerGameStop(stopFn) {
  gameStops.push(stopFn);
}

// Stop all running games and reset transient input state.
export function stopAllGames() {
  gameStops.forEach((stopFn) => stopFn());
  currentGame = null;
  keysPressed = {};
  window.removeEventListener("keydown", quickRestartListener);
}

// Simple synth beep helper used across the UI for feedback.
export function beep(freq = 440, type = "square", len = 0.1) {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audioCtx.currentTime);
  g.gain.setValueAtTime(0.05 * globalVol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + len);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + len);
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
    await signInAnonymously(auth);
  } catch (e) {
    console.error(e);
  }
};
initAuth();
setupBankTransferUX();
setupLoanUX();
setupStockMarketUX();
onAuthStateChanged(auth, (u) => {
  if (u) {
    myUid = u.uid;
    initChat();
    initGlobalStockMarket();
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

// Open an overlay by id, optionally render its contents.
export function openGame(id) {
  if (id === "overlayAdmin" && !isGodUser()) return;
  closeOverlays();
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  if (id === "overlayProfile") renderBadges();
  if (id === "overlayShop") renderShop();
  if (["overlayJobs", "overlayJobCashier", "overlayJobFrontdesk", "overlayJobDelivery", "overlayJobStocker", "overlayJobJanitor", "overlayJobBarista"].includes(id)) renderJobs();
  if (id === "overlayBank") {
    updateBankLog();
    renderStockMarket();
    setText("bankTransferMsg", "");
    setText("bankLoanMsg", "");
    setText("stockTradeMsg", "");
  }
  if (id === "overlayScores") {
    const activeTab = document.querySelector(".score-tab.active");
    loadLeaderboard(activeTab?.dataset.tab || "richest");
  }
}

// Close overlays and clear dropdown state.
export function closeOverlays() {
  stopAllGames();
  document
    .querySelectorAll(".overlay")
    .forEach((o) => o.classList.remove("active"));
  document.getElementById("menuDropdown").classList.remove("show");
}

// Attempt to log in with username + PIN and load their profile.
async function login(username, pin) {
  const normalized = String(username || "").toUpperCase();
  try {
    const ref = doc(db, "gooner_users", normalized);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const profile = snap.data();
      if (profile.pin === pin) {
        saveLocalProfileSnapshot(profile);
        loadProfile(profile);
        return true;
      }
      return "INVALID PIN";
    }
    const localProfile = getLocalProfile(normalized);
    if (localProfile) {
      if (localProfile.pin !== pin) return "INVALID PIN";
      loadProfile(localProfile);
      return true;
    }
    return "USER NOT FOUND";
  } catch (e) {
    const localProfile = getLocalProfile(normalized);
    if (localProfile) {
      if (localProfile.pin !== pin) return "INVALID PIN";
      loadProfile(localProfile);
      return true;
    }
    return "ERROR: " + e.message;
  }
}

// Convert money tiers into user-facing rank labels.
function getRank(money, name = myName) {
  if (isGodUser(name)) return "GOD";
  if (money < 500) return "RAT";
  if (money < 2000) return "SCRIPT KIDDIE";
  if (money < 5000) return "HACKER";
  if (money < 10000) return "GOONER";
  if (money < 50000) return "CYBER LORD";
  return "KINGPIN";
}

function getRankProgress(money) {
  const tiers = [
    { label: "RAT", min: 0, max: 500 },
    { label: "SCRIPT KIDDIE", min: 500, max: 2000 },
    { label: "HACKER", min: 2000, max: 5000 },
    { label: "GOONER", min: 5000, max: 10000 },
    { label: "CYBER LORD", min: 10000, max: 50000 },
    { label: "KINGPIN", min: 50000, max: Infinity },
  ];
  const currentTier = tiers.find((tier) => money >= tier.min && money < tier.max) || tiers[0];
  if (!Number.isFinite(currentTier.max)) {
    return { label: "MAX RANK UNLOCKED", pct: 100 };
  }
  const span = currentTier.max - currentTier.min;
  const earned = money - currentTier.min;
  const pct = Math.max(0, Math.min(100, Math.round((earned / span) * 100)));
  return {
    label: `$${Math.max(0, currentTier.max - money)} TO ${tiers[tiers.indexOf(currentTier) + 1].label}`,
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
  const currentVal = parseFloat(bankEl.innerText) || 0;
  if (currentVal !== myMoney) {
    bankEl.style.color = myMoney > currentVal ? "#0f0" : "#f00";
    setTimeout(() => (bankEl.style.color = "var(--accent)"), 500);
  }
  bankEl.innerText = Number(myMoney || 0).toFixed(2);
  if (bankOverlayEl) bankOverlayEl.innerText = Number(myMoney || 0).toFixed(2);
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
  const rank = getRank(myMoney);
  setText("displayRank", "[" + rank + "]");
  setText("profRank", rank);
  setText("profSummaryRank", "[" + rank + "]");
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
  const normalized = String(username || "").toUpperCase();
  const data = {
    name: normalized,
    pin: pin,
    money: 1000,
    joined: Date.now(),
    stats: { games: 0, wpm: 0, wins: 0 },
    jobs: { cooldowns: {}, completed: { cashier: 0, frontdesk: 0, delivery: 0, stocker: 0, janitor: 0, barista: 0 } },
    stockData: { holdings: {}, selected: "GOON", buyMultiplier: 1 },
  };

  const localProfile = getLocalProfile(normalized);
  if (localProfile) return "USERNAME TAKEN";

  try {
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
  if (!isGodUser()) return;
  const grant = Math.max(0, Math.floor(Number(amount) || 0));
  if (!grant) return;
  myMoney += grant;
  logTransaction("ADMIN GRANT", grant);
  showToast(`ADMIN GRANT: +$${grant.toLocaleString()}`, "🛡️");
  await saveStats();
}

export async function adminInjectJackpot() {
  if (!isGodUser()) return;
  const jackpot = 5000000;
  myMoney += jackpot;
  logTransaction("ADMIN JACKPOT", jackpot);
  showToast(`JACKPOT INJECTED: +$${jackpot.toLocaleString()}`, "🎰");
  await saveStats();
}

export async function adminSetMaxCash() {
  if (!isGodUser()) return;
  const previous = Math.floor(Number(myMoney) || 0);
  myMoney = 999999999;
  const delta = Math.max(0, myMoney - previous);
  if (delta > 0) logTransaction("ADMIN BANK OVERRIDE", delta);
  showToast("BANK SET TO $999,999,999", "💰");
  await saveStats();
}

export async function adminGrantAllShopItems() {
  if (!isGodUser()) return;
  let unlocked = 0;
  SHOP_ITEMS.forEach((item) => {
    if (!myInventory.includes(item.id)) {
      myInventory.push(item.id);
      unlocked++;
    }
    setItemToggle(item.id, true);
  });
  applyOwnedVisuals();
  showToast(
    unlocked ? `ADMIN UNLOCKED ${unlocked} ITEMS` : "ALL SHOP ITEMS ALREADY OWNED",
    "🧰"
  );
  await saveStats();
}

export async function adminClearDebtAndCooldowns() {
  if (!isGodUser()) return;
  loanData.debt = 0;
  loanData.rate = 0;
  loanData.lastInterestAt = Date.now();
  jobData.cooldowns = {};
  showToast("DEBT PURGED + JOBS RESET", "🧽");
  await saveStats();
}

export async function adminBoostStats() {
  if (!isGodUser()) return;
  myStats.games = Math.max(0, Number(myStats.games) || 0) + 250;
  myStats.wins = Math.max(0, Number(myStats.wins) || 0) + 100;
  myStats.wpm = Math.max(120, Number(myStats.wpm) || 0);
  jobData.completed = {
    math: Math.max(50, Number(jobData.completed?.math) || 0),
    code: Math.max(50, Number(jobData.completed?.code) || 0),
    click: Math.max(50, Number(jobData.completed?.click) || 0),
  };
  showToast("STATS BOOSTED TO GOD-TIER", "📈");
  await saveStats();
}

export async function adminMaxPortfolio() {
  if (!isGodUser()) return;
  ensureStockProfile();
  marketState.stocks.forEach((stock) => {
    stockData.holdings[stock.symbol] = 9999;
  });
  stockData.selected = marketState.stocks[0]?.symbol || stockData.selected;
  showToast("PORTFOLIO MAXED OUT", "📊");
  await saveStats();
}

async function adminApplyGlobalMarketShift(multiplier, successMsg, icon) {
  const marketRef = doc(db, GLOBAL_MARKET_COLLECTION, GLOBAL_MARKET_DOC_ID);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(marketRef);
      if (!snap.exists()) return;
      const data = snap.data() || {};
      const serverStocks = Array.isArray(data.stocks) && data.stocks.length
        ? data.stocks
        : marketState.stocks;
      const shifted = serverStocks.map((stock) => {
        const current = Math.max(3, Number(stock.price || STOCK_SEED_PRICES[stock.symbol] || 100));
        const next = Math.max(3, Number((current * multiplier).toFixed(2)));
        const baseHistory = Array.isArray(stock.history) ? stock.history.slice(-79).map((v) => Number(v || current)) : [];
        baseHistory.push(next);
        return {
          symbol: stock.symbol,
          name: stock.name || STOCK_SYMBOLS.find((s) => s.symbol === stock.symbol)?.name || stock.symbol,
          price: next,
          history: baseHistory,
          lastMove: (next - current) / (current || 1),
        };
      });
      tx.set(marketRef, {
        stocks: buildStockSnapshot(shifted),
        updatedAt: Date.now(),
        updatedBy: myUid,
      });
    });
    showToast(successMsg, icon);
  } catch (e) {
    showToast("GLOBAL MARKET UPDATE FAILED", "⚠️", "Try again.");
  }
function setMarketShift(multiplier) {
  marketState.stocks.forEach((stock) => {
    const next = Math.max(3, Number((stock.price * multiplier).toFixed(2)));
    stock.lastMove = (next - stock.price) / (stock.price || 1);
    stock.price = next;
    stock.history.push(next);
    if (stock.history.length > 80) stock.history.shift();
  });
  renderStockMarket();
}

export async function adminMarketMoonshot() {
  if (!isGodUser()) return;
  await adminApplyGlobalMarketShift(1.35, "GLOBAL MARKET MOONSHOT APPLIED", "🚀");
  setMarketShift(1.35);
  showToast("MARKET SENT TO THE MOON", "🚀");
  await saveStats();
}

export async function adminMarketMeltdown() {
  if (!isGodUser()) return;
  await adminApplyGlobalMarketShift(0.55, "GLOBAL MARKET MELTDOWN APPLIED", "💥");
}

export async function adminCrashAllPlayerStocksToZero() {
  if (!isGodUser()) return;
  await adminApplyGlobalMarketShift(0.01, "GLOBAL MARKET CRASHED TO NEAR ZERO", "🧨");
  setMarketShift(0.55);
  showToast("MARKET MELTDOWN TRIGGERED", "💥");
  await saveStats();
}

export async function adminPrestigePack() {
  if (!isGodUser()) return;
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
  loanData = { debt: 0, rate: 0, lastInterestAt: Date.now() };
  applyOwnedVisuals();
  showToast("PRESTIGE PACK DEPLOYED", "👑");
  await saveStats();
}

export async function adminBanWave() {
  if (!isGodUser()) return;
  try {
    const snap = await getDocs(collection(db, "gooner_users"));
    const removals = [];
    snap.forEach((playerDoc) => {
      const playerName = String(playerDoc.id || "").toUpperCase();
      if (!playerName || isGodUser(playerName)) return;
      removals.push(deleteDoc(doc(db, "gooner_users", playerName)));
    });
    await Promise.all(removals);
    showToast(`BAN WAVE COMPLETE: ${removals.length} REMOVED`, "☠️");
  } catch (e) {
    showToast("BAN WAVE FAILED", "⚠️", "Try again.");
  }
}

export async function adminUnlockAllAchievements() {
  if (!isGodUser()) return;
  const missing = ACHIEVEMENTS.filter((achievement) => !myAchievements.includes(achievement.id));
  if (!missing.length) {
    showToast("ALL ACHIEVEMENTS ALREADY UNLOCKED", "✅");
    return;
  }

  let rewardTotal = 0;
  missing.forEach((achievement) => {
    myAchievements.push(achievement.id);
    rewardTotal += achievement.reward || 0;
  });
  if (rewardTotal > 0) {
    myMoney += rewardTotal;
    logTransaction("ADMIN ACHIEVEMENT SYNC", rewardTotal);
  }
  showToast(`UNLOCKED ${missing.length} ACHIEVEMENTS`, "🛡️");
  await saveStats();
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
    lastLogin: Date.now(),
  };
  saveLocalProfileSnapshot(snapshot);
  await updateDoc(doc(db, "gooner_users", myName), {
    money: myMoney,
    stats: myStats,
    achievements: myAchievements,
    inventory: myInventory,
    itemToggles: myItemToggles,
    jobs: jobData,
    loanData,
    stockData,
  }).catch(() => {});
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
  if (Number.isNaN(amount) || amount < 100) {
    formatLoanStatus("MIN LOAN IS $100", "#f66");
    return;
  }

  const randomRate = (Math.floor(Math.random() * 19) + 18) / 100;
  const now = Date.now();
  loanData.debt = (loanData.debt || 0) + amount;
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

  const target = userInput.value.trim().toUpperCase();
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
      const mySnap = await transaction.get(myRef);
      const targetSnap = await transaction.get(targetRef);

      if (!mySnap.exists()) throw new Error("PROFILE NOT FOUND");
      if (!targetSnap.exists()) throw new Error("PLAYER NOT FOUND");
      const freshMoney = mySnap.data().money ?? 0;
      if (freshMoney < amount) throw new Error("NOT ENOUGH CASH");

      transaction.update(myRef, { money: freshMoney - amount });
      transaction.update(targetRef, { money: (targetSnap.data().money ?? 0) + amount });
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
    div.innerHTML = `<div>${item.name}<div style="font-size:8px;opacity:0.7">${
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
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-content"><div class="toast-title">${title}</div><div class="toast-desc">${subtitle}</div></div>`;
  document.getElementById("toastBox").appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// Auto-login if credentials exist in local storage.
if (localStorage.getItem("goonerUser")) {
  login(
    localStorage.getItem("goonerUser"),
    localStorage.getItem("goonerPin")
  );
}
// Login form handlers.
document.getElementById("btnLogin").onclick = async () => {
  const u = document.getElementById("usernameInput").value.trim();
  const p = document.getElementById("pinInput").value.trim();
  if (u.length < 3 || p.length < 4) return beep(200, "sawtooth", 0.5);
  const res = await login(u, p);
  if (res === true) beep(600, "square", 0.1);
  else {
    setText("loginMsg", res);
    beep(100, "sawtooth", 0.5);
  }
};
// Registration form handler.
document.getElementById("btnRegister").onclick = async () => {
  const u = document.getElementById("usernameInput").value.trim();
  const p = document.getElementById("pinInput").value.trim();
  if (u.length < 3 || p.length < 4) return;
  const res = await register(u, p);
  if (res === true) beep(600, "square", 0.1);
  else {
    setText("loginMsg", res);
    beep(100, "sawtooth", 0.5);
  }
};
// Logout resets local storage + reloads the app.
document.getElementById("btnLogout").onclick = () => {
  localStorage.clear();
  location.reload();
};
// Toggle the hamburger menu dropdown.
document.getElementById("menuToggle").onclick = (e) => {
  e.stopPropagation();
  document.getElementById("menuDropdown").classList.toggle("show");
  registerMenuMash();
};
// Click outside closes the dropdown menu.
document.addEventListener("click", (e) => {
  if (!e.target.closest("#menuToggle")) document.getElementById("menuDropdown").classList.remove("show");
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
  document.documentElement.style.setProperty("--accent-glow", `rgba(${r},${g},${b},0.6)`);
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
// Initialize realtime chat streaming and input handling.
function initChat() {
  const chatRef = collection(db, "gooner_global_chat");
  const q = query(chatRef, orderBy("ts", "desc"), limit(15));
  onSnapshot(q, (snap) => {
    const list = document.getElementById("chatHistory");
    list.innerHTML = "";
    const msgs = [];
    snap.forEach((d) => msgs.push(d.data()));
    msgs.reverse().forEach((m) => {
      const d = document.createElement("div");
      d.className = "chat-msg";
      d.innerHTML = `<span class="chat-user">${m.user}:</span> ${m.msg}`;
      list.appendChild(d);
    });
    list.scrollTop = list.scrollHeight;
  });
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
    }
    if (txt === "/ghost") {
      unlockAchievement("ghost_signal");
      showToast("GHOST SIGNAL", "👻", "Silent channel open.");
      e.target.value = "";
      return;
    }

    // Normal message flow.
    chatCount++;
    if (chatCount === 10) unlockAchievement("chatterbox");
    await addDoc(chatRef, { user: myName, msg: txt, ts: Date.now() });
    e.target.value = "";
  });
}

// Update and persist a local high score for a given game.
export function updateHighScore(game, score) {
  const k = `hs_${game}`;
  const old = parseInt(localStorage.getItem(k) || 0);
  if (score > old) {
    localStorage.setItem(k, score);
    saveGlobalScore(game, score);
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
}

// Persist a high score globally so it appears on the leaderboard.
export async function saveGlobalScore(game, score) {
  if (score <= 0 || myName === "ANON") return;
  await addDoc(collection(db, "gooner_scores"), {
    game: game,
    name: myName,
    score: score,
  });
}

// Scoreboard tab switching.
document.querySelectorAll(".score-tab").forEach((t) => {
  t.onclick = () => {
    document
      .querySelectorAll(".score-tab")
      .forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    loadLeaderboard(t.dataset.tab);
  };
});
let leaderboardUnsub = null;
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

// Render the leaderboard for the currently selected game.
function loadLeaderboard(game) {
  const list = document.getElementById("scoreList");
  list.innerHTML = "LOADING...";
  if (leaderboardUnsub) leaderboardUnsub();
  if (game === "players") {
    const q = query(collection(db, "gooner_users"), orderBy("name"), limit(100));
    leaderboardUnsub = onSnapshot(q, (snap) => {
      const rows = [];
      snap.forEach((d) => {
        const data = d.data();
        const playerName = data.name || d.id;
        rows.push({
          name: playerName,
          score: data.rank || getRank(Number(data.money) || 0, playerName),
          canRemove: playerName !== myName && !isGodUser(playerName),
        });
      });
      renderLeaderboardRows(list, rows, { showAdminRemove: true });
    });
    return;
  }

  if (game === "richest") {
    const q = query(collection(db, "gooner_users"), orderBy("money", "desc"), limit(10));
    leaderboardUnsub = onSnapshot(q, (snap) => {
      const rows = [];
      snap.forEach((d) => {
        const data = d.data();
        rows.push({ name: data.name || d.id, score: data.money ?? 0 });
      });
      renderLeaderboardRows(list, rows, { valuePrefix: "$" });
    });
    return;
  }

  const q = query(collection(db, "gooner_scores"), where("game", "==", game), limit(200));
  leaderboardUnsub = onSnapshot(q, (snap) => {
    const data = [];
    snap.forEach((d) => data.push(d.data()));
    const uniqueScores = {};
    data.forEach((s) => {
      if (!uniqueScores[s.name] || s.score > uniqueScores[s.name].score) {
        uniqueScores[s.name] = s;
      }
    });
    const filtered = Object.values(uniqueScores)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    renderLeaderboardRows(list, filtered);
  });
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

// Show a game over modal and set up restart handling.
export function showGameOver(game, score) {
  stopAllGames();
  currentGame = game;
  beep(150, "sawtooth", 0.5);
  setText("gameOverText", "SYSTEM_FAILURE: SCORE_" + score);
  document.getElementById("modalGameOver").classList.add("active");
  window.addEventListener("keydown", quickRestartListener);
}

// Track active keys for games that rely on continuous input.
document.addEventListener("keydown", (e) => {
  keysPressed[e.key] = true;
});
document.addEventListener("keyup", (e) => {
  keysPressed[e.key] = false;
});
