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
let transactionLog = [];
let globalVol = 0.5;
let currentGame = null;
let keysPressed = {};
let lossStreak = 0;

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
onAuthStateChanged(auth, (u) => {
  if (u) {
    myUid = u.uid;
    initChat();
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
  closeOverlays();
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  if (id === "overlayProfile") renderBadges();
  if (id === "overlayShop") renderShop();
  if (id === "overlayBank") updateBankLog();
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
  try {
    const ref = doc(db, "gooner_users", username.toUpperCase());
    const snap = await getDoc(ref);
    if (snap.exists()) {
      if (snap.data().pin === pin) {
        loadProfile(snap.data());
        return true;
      }
      return "INVALID PIN";
    }
    return "USER NOT FOUND";
  } catch (e) {
    return "ERROR: " + e.message;
  }
}

// Convert money tiers into user-facing rank labels.
function getRank(money) {
  if (money < 500) return "RAT";
  if (money < 2000) return "SCRIPT KIDDIE";
  if (money < 5000) return "HACKER";
  if (money < 10000) return "GOONER";
  if (money < 50000) return "CYBER LORD";
  return "KINGPIN";
}

// Populate local state from stored profile data.
function loadProfile(data) {
  myName = data.name;
  myMoney = data.money;
  myStats = data.stats || { games: 0, wpm: 0, wins: 0 };
  myAchievements = data.achievements || [];
  myInventory = data.inventory || [];
  updateUI();
  document.getElementById("overlayLogin").classList.remove("active");
  localStorage.setItem("goonerUser", myName);
  localStorage.setItem("goonerPin", data.pin);
  if (myInventory.includes("item_matrix")) {
    setMatrixMode(true);
    document.documentElement.style.setProperty("--accent", "#00ff00");
  }
  if (myInventory.includes("item_rainbow")) document.body.classList.add("rainbow-mode");
  if (myInventory.includes("item_flappy")) document.getElementById("btnFlappy").style.display = "block";
  const lastLogin = data.lastLogin || 0;
  const now = Date.now();
  if (now - lastLogin > 86400000) {
    myMoney += 100;
    showToast("DAILY BONUS: $100", "💰");
  }
  updateDoc(doc(db, "gooner_users", myName), { lastLogin: now });
  updateMatrixToggle();
}

// Render all user-facing UI fields based on the latest state.
function updateUI() {
  setText("displayUser", myName);
  const bankEl = document.getElementById("globalBank");
  const bankOverlayEl = document.getElementById("bankDisplay");
  const currentVal = parseInt(bankEl.innerText) || 0;
  if (currentVal !== myMoney) {
    bankEl.style.color = myMoney > currentVal ? "#0f0" : "#f00";
    setTimeout(() => (bankEl.style.color = "var(--accent)"), 500);
  }
  bankEl.innerText = myMoney;
  if (bankOverlayEl) bankOverlayEl.innerText = myMoney;
  setText("profName", myName);
  setText("profBank", "$" + myMoney);
  setText("profWPM", (myStats.wpm || 0) + " WPM");
  setText("profGames", myStats.games || 0);
  setText("profUid", myUid ? myUid.substring(0, 8) : "ERR");
  const rank = getRank(myMoney);
  setText("displayRank", "[" + rank + "]");
  setText("profRank", rank);
  if (myMoney >= 5000) unlockAchievement("diamond_hands");
  if (myMoney >= 1000000) unlockAchievement("millionaire");
  updateMatrixToggle();
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
  try {
    if (!myUid) return "WAITING FOR NETWORK...";
    const ref = doc(db, "gooner_users", username.toUpperCase());
    const snap = await getDoc(ref);
    if (snap.exists()) return "USERNAME TAKEN";
    const data = {
      name: username.toUpperCase(),
      pin: pin,
      money: 1000,
      joined: Date.now(),
      stats: { games: 0, wpm: 0, wins: 0 },
    };
    await setDoc(ref, data);
    loadProfile(data);
    return true;
  } catch (e) {
    return "REG ERROR";
  }
}

// Persist stats + inventory changes to Firestore.
export async function saveStats() {
  if (myName === "ANON") return;
  await updateDoc(doc(db, "gooner_users", myName), {
    money: myMoney,
    stats: myStats,
    achievements: myAchievements,
    inventory: myInventory,
  });
  updateUI();
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

// Render the shop list with pricing + purchase state.
function renderShop() {
  const list = document.getElementById("shopList");
  setText("shopBank", myMoney);
  list.innerHTML = "";
  SHOP_ITEMS.forEach((item) => {
    const div = document.createElement("div");
    div.className = "shop-item";
    let label = "$" + item.cost;
    let btnText = "BUY";
    let disabled = myMoney < item.cost;
    if (myInventory.includes(item.id) && item.type !== "consumable") {
      label = "OWNED";
      btnText = "ACTIVE";
      disabled = true;
    }
    div.innerHTML = `<div>${item.name}<div style="font-size:8px;opacity:0.7">${
      item.desc
    }</div></div><div style="text-align:right"><span style="color:var(--accent)">${label}</span><button class="shop-buy-btn" onclick="window.buyItem('${
      item.id
    }')" ${disabled ? "disabled" : ""}>${btnText}</button></div>`;
    list.appendChild(div);
  });
}

// Purchase an item, apply its effects, and update the UI.
export function buyItem(id) {
  const item = SHOP_ITEMS.find((i) => i.id === id);
  if (myMoney >= item.cost) {
    myMoney -= item.cost;
    if (item.type !== "consumable") myInventory.push(id);
    else myInventory.push(id);
    if (id === "item_rainbow") document.body.classList.add("rainbow-mode");
    if (id === "item_flappy") {
      document.getElementById("btnFlappy").style.display = "block";
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
  const hasAccess = myInventory.includes("item_matrix");
  const enabled = canvas.classList.contains("active");
  toggle.disabled = !hasAccess;
  toggle.innerText = hasAccess ? (enabled ? "ON" : "OFF") : "LOCKED";
}
// Toggle Matrix mode on user click (if unlocked).
document.getElementById("matrixToggle").onclick = () => {
  if (!myInventory.includes("item_matrix")) {
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
const renderLeaderboardRows = (list, rows, { valuePrefix = "" } = {}) => {
  list.innerHTML = "";
  if (!rows.length) {
    list.innerHTML = '<div style="padding:10px">NO DATA</div>';
    return;
  }
  rows.forEach((row, i) => {
    const item = document.createElement("div");
    item.className = "score-item";
    item.innerHTML = `<span class="score-rank">#${i + 1}</span> <span>${row.name}</span> <span>${valuePrefix}${row.score}</span>`;
    list.appendChild(item);
  });
};

// Render the leaderboard for the currently selected game.
function loadLeaderboard(game) {
  const list = document.getElementById("scoreList");
  list.innerHTML = "LOADING...";
  if (leaderboardUnsub) leaderboardUnsub();
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
