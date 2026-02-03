import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, onSnapshot, runTransaction, query, orderBy, limit, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyAoXwDA6KtqSD4yfGprus8C8Mi_--1KwSw", authDomain: "funnys-18ff7.firebaseapp.com", projectId: "funnys-18ff7", storageBucket: "funnys-18ff7.firebasestorage.app", messagingSenderId: "368675604960", appId: "1:368675604960:web:24c5dcd6a5329c9fd94385", measurementId: "G-6PE47RLP8V" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
const matrixAccentStoreKey = "goonerMatrixAccent";
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const gameStops = [];

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
  addDoc
};

const ACHIEVEMENTS = [
  { id: "noob", icon: "🐣", title: "NOOB", desc: "Played your first game", rarity: "common", reward: 500 },
  { id: "diamond_hands", icon: "💎", title: "DIAMOND HANDS", desc: "Bank account > $5000", rarity: "rare", reward: 2500 },
  { id: "millionaire", icon: "💸", title: "MILLIONAIRE", desc: "Bank account > $1,000,000", rarity: "legendary", reward: 50000 },
  { id: "type_god", icon: "⌨️", title: "TYPE GOD", desc: "WPM > 80", rarity: "rare", reward: 2500 },
  { id: "viper", icon: "🐍", title: "VIPER", desc: "Score > 30 in Snake", rarity: "rare", reward: 2500 },
  { id: "untouchable", icon: "🛡️", title: "UNTOUCHABLE", desc: "Perfect 10-0 in Pong", rarity: "epic", reward: 10000 },
  { id: "high_roller", icon: "🎰", title: "HIGH ROLLER", desc: "Win a bet > $500", rarity: "rare", reward: 2500 },
  { id: "shopaholic", icon: "🛍️", title: "SHOPAHOLIC", desc: "Buy 3 items", rarity: "common", reward: 500 },
  { id: "chatterbox", icon: "💬", title: "CHATTERBOX", desc: "Send 10 messages", rarity: "common", reward: 500 },
  { id: "neo", icon: "🕶️", title: "NEO", desc: "Unlock Matrix Mode", rarity: "epic", reward: 10000 },
  { id: "lonely", icon: "🐺", title: "LONE WOLF", desc: "Play 10 rounds of Solo Blackjack", rarity: "common", reward: 500 },
  { id: "rug_pulled", icon: "📉", title: "RUG PULLED", desc: "Hit $0 balance", hidden: true, rarity: "rare", reward: 1000 },
  { id: "touch_grass", icon: "🌿", title: "TOUCH GRASS", desc: "Stop touching the terminal", hidden: true, rarity: "common", reward: 500 },
  { id: "master_hacker", icon: "💀", title: "MASTER HACKER", desc: "Access root", hidden: true, rarity: "epic", reward: 10000 },
  { id: "leet", icon: "👾", title: "1337", desc: "Play at XX:37", hidden: true, rarity: "epic", reward: 10000 },
  { id: "architect", icon: "🏛️", title: "THE ARCHITECT", desc: "Ask for help", hidden: true, rarity: "rare", reward: 2500 },
  { id: "rage_quit", icon: "🤬", title: "RAGE QUIT", desc: "Score 0 in 3 games straight", hidden: true, rarity: "rare", reward: 2500 },
  { id: "insomniac", icon: "🌙", title: "INSOMNIAC", desc: "Play between 3AM-4AM", hidden: true, rarity: "epic", reward: 10000 },
  { id: "spammer", icon: "🔨", title: "SPAMMER", desc: "Click logo 50 times", hidden: true, rarity: "rare", reward: 2500 },
  { id: "void_gazer", icon: "👁️", title: "VOID GAZER", desc: "Click empty space 50 times", hidden: true, rarity: "rare", reward: 2500 }
];

const SHOP_ITEMS = [
  { id: "item_aimbot", name: "PONG AIMBOT", cost: 2000, type: "perk", desc: "Auto-play Pong" },
  { id: "item_slowmo", name: "RUNNER SLOW-MO", cost: 1500, type: "perk", desc: "20% Slower Speed" },
  { id: "item_shield", name: "1-HIT SHIELD", cost: 500, type: "consumable", desc: "Survive one crash" },
  { id: "item_xray", name: "X-RAY VISOR", cost: 5000, type: "perk", desc: "See Dealer Card" },
  { id: "item_cardcount", name: "CARD COUNTER", cost: 3000, type: "perk", desc: "BJ Count Assist" },
  { id: "item_double", name: "SNAKE OIL", cost: 3000, type: "perk", desc: "Double Snake Points" },
  { id: "item_matrix", name: "MATRIX MODE", cost: 6000, type: "visual", desc: "Toggle Matrix background" },
  { id: "item_rainbow", name: "RGB MODE", cost: 10000, type: "visual", desc: "Color Cycle" },
  { id: "item_autotype", name: "AUTO-TYPER", cost: 7500, type: "perk", desc: "Bot plays Typer" },
  { id: "item_flappy", name: "GAME: FLAPPY", cost: 10000, type: "visual", desc: "Unlock Flappy Goon" }
];

export function registerGameStop(stopFn) {
  gameStops.push(stopFn);
}

export function stopAllGames() {
  gameStops.forEach((stopFn) => stopFn());
  currentGame = null;
  keysPressed = {};
  window.removeEventListener("keydown", quickRestartListener);
}

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

function playSuccessSound() {
  beep(523.25, "triangle", 0.1);
  setTimeout(() => beep(659.25, "triangle", 0.1), 100);
  setTimeout(() => beep(783.99, "triangle", 0.2), 200);
}

export function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.innerText = txt;
}

export function logTransaction(msg, amount) {
  transactionLog.unshift({ msg, amount, ts: new Date().toLocaleTimeString() });
  if (transactionLog.length > 20) transactionLog.pop();
  updateBankLog();
}

export function updateBankLog() {
  const div = document.getElementById("bankLog");
  div.innerHTML = transactionLog
    .map(
      (t) =>
        `<div class="bank-entry"><span>${t.ts} ${t.msg}</span><span style="color:${t.amount >= 0 ? "#0f0" : "#f00"}">${t.amount >= 0 ? "+" : ""}$${t.amount}</span></div>`
    )
    .join("");
}

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

setInterval(() => {
  const d = new Date();
  setText("sysClock", d.toLocaleTimeString("en-GB"));
  setText("sysPing", Math.floor(Math.random() * 40 + 10) + "ms");
  if (d.getMinutes() === 37) unlockAchievement("leet");
  if (d.getHours() === 3) unlockAchievement("insomniac");
}, 1000);

export function openGame(id) {
  closeOverlays();
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  if (id === "overlayProfile") renderBadges();
  if (id === "overlayShop") renderShop();
  if (id === "overlayBank") updateBankLog();
}

export function closeOverlays() {
  stopAllGames();
  document.querySelectorAll(".overlay").forEach((o) => o.classList.remove("active"));
  document.getElementById("menuDropdown").classList.remove("show");
}

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

function getRank(money) {
  if (money < 500) return "RAT";
  if (money < 2000) return "SCRIPT KIDDIE";
  if (money < 5000) return "HACKER";
  if (money < 10000) return "GOONER";
  if (money < 50000) return "CYBER LORD";
  return "KINGPIN";
}

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

async function register(username, pin) {
  try {
    if (!myUid) return "WAITING FOR NETWORK...";
    const ref = doc(db, "gooner_users", username.toUpperCase());
    const snap = await getDoc(ref);
    if (snap.exists()) return "USERNAME TAKEN";
    const data = { name: username.toUpperCase(), pin: pin, money: 1000, joined: Date.now(), stats: { games: 0, wpm: 0, wins: 0 } };
    await setDoc(ref, data);
    loadProfile(data);
    return true;
  } catch (e) {
    return "REG ERROR";
  }
}

export async function saveStats() {
  if (myName === "ANON") return;
  await updateDoc(doc(db, "gooner_users", myName), { money: myMoney, stats: myStats, achievements: myAchievements, inventory: myInventory });
  updateUI();
}

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
    div.innerHTML = `<div>${item.name}<div style="font-size:8px;opacity:0.7">${item.desc}</div></div><div style="text-align:right"><span style="color:var(--accent)">${label}</span><button class="shop-buy-btn" onclick="window.buyItem('${item.id}')" ${disabled ? "disabled" : ""}>${btnText}</button></div>`;
    list.appendChild(div);
  });
}

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
    if (myInventory.filter((i) => i !== "item_shield").length >= 3) unlockAchievement("shopaholic");
    if (id === "item_matrix") {
      unlockAchievement("neo");
      setMatrixMode(true);
    }
    updateMatrixToggle();
    logTransaction(`BOUGHT: ${item.name}`, -item.cost);
    saveStats();
    renderShop();
    playSuccessSound();
    showToast(`BOUGHT: ${item.name}`, "🛒");
  }
}

export function showToast(title, icon, subtitle = "") {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-content"><div class="toast-title">${title}</div><div class="toast-desc">${subtitle}</div></div>`;
  document.getElementById("toastBox").appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

if (localStorage.getItem("goonerUser")) login(localStorage.getItem("goonerUser"), localStorage.getItem("goonerPin"));
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
document.getElementById("btnLogout").onclick = () => {
  localStorage.clear();
  location.reload();
};
document.getElementById("menuToggle").onclick = (e) => {
  e.stopPropagation();
  document.getElementById("menuDropdown").classList.toggle("show");
};
document.addEventListener("click", (e) => {
  if (!e.target.closest("#menuToggle")) document.getElementById("menuDropdown").classList.remove("show");
});
function setAccentColor(hex) {
  if (!hex) return;
  document.documentElement.style.setProperty("--accent", hex);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  document.documentElement.style.setProperty("--accent-dim", `rgba(${r},${g},${b},0.2)`);
  document.documentElement.style.setProperty("--accent-glow", `rgba(${r},${g},${b},0.6)`);
}

function setMatrixMode(enabled) {
  const canvas = document.getElementById("matrixCanvas");
  if (!canvas) return;
  if (enabled) {
    const currentAccent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    if (currentAccent) localStorage.setItem(matrixAccentStoreKey, currentAccent);
    setAccentColor("#00ff00");
  } else {
    const storedAccent = localStorage.getItem(matrixAccentStoreKey);
    if (storedAccent) setAccentColor(storedAccent);
  }
  canvas.classList.toggle("active", enabled);
  updateMatrixToggle();
}
function updateMatrixToggle() {
  const toggle = document.getElementById("matrixToggle");
  const canvas = document.getElementById("matrixCanvas");
  if (!toggle || !canvas) return;
  const hasAccess = myInventory.includes("item_matrix");
  const enabled = canvas.classList.contains("active");
  toggle.disabled = !hasAccess;
  toggle.innerText = hasAccess ? (enabled ? "ON" : "OFF") : "LOCKED";
}
document.getElementById("matrixToggle").onclick = () => {
  if (!myInventory.includes("item_matrix")) {
    showToast("MATRIX LOCKED", "🔒", "Buy Matrix Mode in the shop.");
    updateMatrixToggle();
    return;
  }
  const canvas = document.getElementById("matrixCanvas");
  setMatrixMode(!canvas.classList.contains("active"));
};
document.getElementById("themeColor").oninput = (e) => {
  const h = e.target.value;
  localStorage.setItem(matrixAccentStoreKey, h);
  if (!document.getElementById("matrixCanvas").classList.contains("active")) {
    setAccentColor(h);
  }
};
document.getElementById("volSlider").oninput = (e) => {
  globalVol = e.target.value / 100;
};
document.getElementById("scanSlider").oninput = (e) => document.documentElement.style.setProperty("--scanline-opacity", e.target.value / 100);
document.getElementById("flickerToggle").onclick = (e) => {
  document.body.classList.toggle("flicker-on");
  e.target.innerText = document.body.classList.contains("flicker-on") ? "ON" : "OFF";
};
document.getElementById("fsToggle").onclick = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
};

const konamiCode = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
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
function activateMatrixHack() {
  if (myName === "ANON") return alert("LOGIN FIRST");
  if (!myInventory.includes("item_matrix")) myInventory.push("item_matrix");
  setMatrixMode(true);
  showToast("MATRIX MODE ACTIVATED", "🐇");
  myMoney += 1000;
  saveStats();
  playSuccessSound();
}
let logoClicks = 0;
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
document.addEventListener("click", (e) => {
  if (e.target.tagName === "BODY" || e.target.classList.contains("wrap")) {
    bgClicks++;
    if (bgClicks === 50) unlockAchievement("void_gazer");
  } else {
    bgClicks = 0;
  }
});

let chatCount = 0;
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
  if (e.key === "Enter") {
    const txt = e.target.value.trim();
      if (txt.length > 0) {
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
        chatCount++;
        if (chatCount === 10) unlockAchievement("chatterbox");
        await addDoc(chatRef, { user: myName, msg: txt, ts: Date.now() });
        e.target.value = "";
      }
    }
  });
}

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

export function loadHighScores() {
  setText("hsPong", localStorage.getItem("hs_pong") || 0);
  setText("hsSnake", localStorage.getItem("hs_snake") || 0);
  setText("hsRunner", localStorage.getItem("hs_runner") || 0);
  setText("hsGeo", localStorage.getItem("hs_geo") || 0);
  setText("hsFlappy", localStorage.getItem("hs_flappy") || 0);
}

export async function saveGlobalScore(game, score) {
  if (score <= 0 || myName === "ANON") return;
  await addDoc(collection(db, "gooner_scores"), { game: game, name: myName, score: score });
}

document.querySelectorAll(".score-tab").forEach((t) => (t.onclick = () => {
  document.querySelectorAll(".score-tab").forEach((x) => x.classList.remove("active"));
  t.classList.add("active");
  loadLeaderboard(t.dataset.tab);
}));
function loadLeaderboard(game) {
  const list = document.getElementById("scoreList");
  list.innerHTML = "LOADING...";
  const q = query(collection(db, "gooner_scores"), orderBy("score", "desc"), limit(100));
  onSnapshot(q, (snap) => {
    list.innerHTML = "";
    const data = [];
    snap.forEach((d) => data.push(d.data()));
    const uniqueScores = {};
    data
      .filter((d) => d.game === game)
      .forEach((s) => {
        if (!uniqueScores[s.name] || s.score > uniqueScores[s.name].score) {
          uniqueScores[s.name] = s;
        }
      });
    const filtered = Object.values(uniqueScores)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    if (filtered.length === 0) list.innerHTML = '<div style="padding:10px">NO DATA</div>';
    filtered.forEach((s, i) => {
      const item = document.createElement("div");
      item.className = "score-item";
      item.innerHTML = `<span class="score-rank">#${i + 1}</span> <span>${s.name}</span> <span>${s.score}</span>`;
      list.appendChild(item);
    });
  });
}

export function checkLossStreak() {
  lossStreak++;
  if (lossStreak === 3) unlockAchievement("rage_quit");
}

export function resetLossStreak() {
  lossStreak = 0;
}

function quickRestartListener(e) {
  if (e.key === " " || e.key === "Enter") {
    document.getElementById("goRestart").click();
    window.removeEventListener("keydown", quickRestartListener);
  }
}

export function clearRestartListener() {
  window.removeEventListener("keydown", quickRestartListener);
}

export function showGameOver(game, score) {
  stopAllGames();
  currentGame = game;
  beep(150, "sawtooth", 0.5);
  setText("gameOverText", "SYSTEM_FAILURE: SCORE_" + score);
  document.getElementById("modalGameOver").classList.add("active");
  window.addEventListener("keydown", quickRestartListener);
}

document.addEventListener("keydown", (e) => {
  keysPressed[e.key] = true;
});
document.addEventListener("keyup", (e) => {
  keysPressed[e.key] = false;
});
