import { auth, db } from './config.js';
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, doc, setDoc, getDoc, updateDoc, onSnapshot, query, orderBy, limit, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { beep, setText, showToast, setVolume, audioCtx } from './utils.js';

// Game Imports
import { initSnake, stopSnake, handleSnakeKey } from './games/snake.js';
import { initPong, stopPong, setPongDiff } from './games/pong.js';
import { initRunner, stopRunner, handleRunnerInput } from './games/runner.js';
import { initGeo, stopGeo, handleGeoInput } from './games/geo.js';
import { initFlappy, stopFlappy, handleFlappyInput } from './games/flappy.js';
import { initTypeGame, stopTyper, handleTypeInput } from './games/typer.js';
import { initTTT, cleanupTTT } from './games/ttt.js';
import { initBJ, cleanupBJ, handleDeckClick, handleHit, handleStand, placeBet, selectMode } from './games/blackjack.js';

// --- DATA ---
const ACHIEVEMENTS = [
    { id: 'noob', icon: '🐣', title: 'NOOB', desc: 'Played your first game', rarity: 'common', reward: 500 },
    { id: 'diamond_hands', icon: '💎', title: 'DIAMOND HANDS', desc: 'Bank account > $5000', rarity: 'rare', reward: 2500 },
    { id: 'millionaire', icon: '💸', title: 'MILLIONAIRE', desc: 'Bank account > $1,000,000', rarity: 'legendary', reward: 50000 },
    { id: 'type_god', icon: '⌨️', title: 'TYPE GOD', desc: 'WPM > 80', rarity: 'rare', reward: 2500 },
    { id: 'viper', icon: '🐍', title: 'VIPER', desc: 'Score > 30 in Snake', rarity: 'rare', reward: 2500 },
    { id: 'untouchable', icon: '🛡️', title: 'UNTOUCHABLE', desc: 'Perfect 10-0 in Pong', rarity: 'epic', reward: 10000 },
    { id: 'high_roller', icon: '🎰', title: 'HIGH ROLLER', desc: 'Win a bet > $500', rarity: 'rare', reward: 2500 },
    { id: 'shopaholic', icon: '🛍️', title: 'SHOPAHOLIC', desc: 'Buy 3 items', rarity: 'common', reward: 500 },
    { id: 'chatterbox', icon: '💬', title: 'CHATTERBOX', desc: 'Send 10 messages', rarity: 'common', reward: 500 },
    { id: 'neo', icon: '🕶️', title: 'NEO', desc: 'Unlock Matrix Mode', rarity: 'epic', reward: 10000 },
    { id: 'lonely', icon: '🐺', title: 'LONE WOLF', desc: 'Play 10 rounds of Solo Blackjack', rarity: 'common', reward: 500 },
    { id: 'rug_pulled', icon: '📉', title: 'RUG PULLED', desc: 'Hit $0 balance', hidden: true, rarity: 'rare', reward: 1000 },
    { id: 'touch_grass', icon: '🌿', title: 'TOUCH GRASS', desc: 'Stop touching the terminal', hidden: true, rarity: 'common', reward: 500 },
    { id: 'master_hacker', icon: '💀', title: 'MASTER HACKER', desc: 'Access root', hidden: true, rarity: 'epic', reward: 10000 },
    { id: 'leet', icon: '👾', title: '1337', desc: 'Play at XX:37', hidden: true, rarity: 'epic', reward: 10000 },
    { id: 'architect', icon: '🏛️', title: 'THE ARCHITECT', desc: 'Ask for help', hidden: true, rarity: 'rare', reward: 2500 },
    { id: 'rage_quit', icon: '🤬', title: 'RAGE QUIT', desc: 'Score 0 in 3 games straight', hidden: true, rarity: 'rare', reward: 2500 },
    { id: 'insomniac', icon: '🌙', title: 'INSOMNIAC', desc: 'Play between 3AM-4AM', hidden: true, rarity: 'epic', reward: 10000 },
    { id: 'spammer', icon: '🔨', title: 'SPAMMER', desc: 'Click logo 50 times', hidden: true, rarity: 'rare', reward: 2500 },
    { id: 'void_gazer', icon: '👁️', title: 'VOID GAZER', desc: 'Click empty space 50 times', hidden: true, rarity: 'rare', reward: 2500 }
];

const SHOP_ITEMS = [
    { id: 'item_aimbot', name: 'PONG AIMBOT', cost: 2000, type: 'perk', desc: 'Auto-play Pong' },
    { id: 'item_slowmo', name: 'RUNNER SLOW-MO', cost: 1500, type: 'perk', desc: '20% Slower Speed' },
    { id: 'item_shield', name: '1-HIT SHIELD', cost: 500, type: 'consumable', desc: 'Survive one crash' },
    { id: 'item_xray', name: 'X-RAY VISOR', cost: 5000, type: 'perk', desc: 'See Dealer Card' },
    { id: 'item_cardcount', name: 'CARD COUNTER', cost: 3000, type: 'perk', desc: 'BJ Count Assist' },
    { id: 'item_double', name: 'SNAKE OIL', cost: 3000, type: 'perk', desc: 'Double Snake Points' },
    { id: 'item_rainbow', name: 'RGB MODE', cost: 10000, type: 'visual', desc: 'Color Cycle' },
    { id: 'item_autotype', name: 'AUTO-TYPER', cost: 7500, type: 'perk', desc: 'Bot plays Typer' },
    { id: 'item_flappy', name: 'GAME: FLAPPY', cost: 10000, type: 'visual', desc: 'Unlock Flappy Goon' }
];

// --- STATE ---
let myUid=null, myName="ANON", myMoney=1000, myStats={games:0, wpm:0, wins:0}; 
let myAchievements = []; let myInventory = []; let transactionLog = [];
let currentGame=null; 
let keysPressed = {};

// --- SYSTEM API FOR MODULES ---
const System = {
    get uid() { return myUid; },
    get name() { return myName; },
    get money() { return myMoney; },
    get stats() { return myStats; },
    get inventory() { return myInventory; },
    get keys() { return keysPressed; }, // Exposed for Pong loop
    
    addMoney: (amt) => { myMoney += amt; updateUI(); },
    deductMoney: (amt) => { myMoney -= amt; updateUI(); },
    consumeItem: (id) => { 
        const idx = myInventory.indexOf(id);
        if(idx > -1) myInventory.splice(idx, 1);
    },
    
    updateHighScore: (game, score) => {
        const k = `hs_${game}`;
        const old = parseInt(localStorage.getItem(k)||0);
        if(score > old) {
            localStorage.setItem(k, score);
            saveGlobalScore(game, score);
        }
    },
    
    saveGlobalScore: (game, score) => saveGlobalScore(game, score),
    triggerGameOver: (game, score) => window.showGameOver(game, score),
    
    unlockAchievement: (id) => {
        if(myAchievements.includes(id) || myName === "ANON") return;
        myAchievements.push(id);
        const badge = ACHIEVEMENTS.find(a => a.id === id);
        if(badge) {
            myMoney += badge.reward;
            logTransaction(`ACHIEVEMENT: ${badge.title}`, badge.reward);
            showToast(`UNLOCKED: ${badge.title}`, badge.icon, `+$${badge.reward}`);
        }
        saveStats();
        beep(523.25, 'triangle', 0.1);
    },
    
    saveStats: () => saveStats()
};

// --- INIT AUTH ---
const initAuth = async () => { try{await signInAnonymously(auth);}catch(e){console.error(e);} }; 
initAuth();
onAuthStateChanged(auth, u=>{ if(u){ myUid=u.uid; initChat(); } });

// --- CLOCK ---
setInterval(()=>{ 
    const d=new Date(); setText('sysClock', d.toLocaleTimeString('en-GB')); 
    if(d.getMinutes() === 37) System.unlockAchievement('leet'); 
    if(d.getHours() === 3) System.unlockAchievement('insomniac');
},1000);

// --- GLOBAL EXPORTS ---
window.openGame = (id) => { 
    window.closeOverlays(); 
    const el = document.getElementById(id); 
    if(el) el.classList.add('active'); 
    if(id==='overlayProfile') renderBadges(); 
    if(id==='overlayShop') renderShop(); 
    if(id==='overlayBank') updateBankLog(); 
};

window.closeOverlays = () => { 
    stopAllGames(); 
    document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active')); 
    document.getElementById('menuDropdown').classList.remove('show'); 
};

window.launchGame = (game) => {
    window.closeOverlays();
    const overlayId = 'overlay' + (game === 'ttt' || game === 'geo' ? game.toUpperCase() : (game.charAt(0).toUpperCase() + game.slice(1)));
    const el = document.getElementById(overlayId); if(el) el.classList.add('active');
    currentGame = game;

    if(game==='pong') initPong(System); 
    if(game==='snake') initSnake(System); 
    if(game==='runner') initRunner(System); 
    if(game==='geo') initGeo(System); 
    if(game==='type') initTypeGame(System); 
    if(game==='blackjack') initBJ(System); 
    if(game==='ttt') initTTT(System); 
    if(game==='flappy') initFlappy(System);
    
    System.unlockAchievement('noob');
};

function stopAllGames(){
    stopSnake(); stopPong(); stopRunner(); stopGeo(); stopFlappy(); stopTyper();
    cleanupTTT(); cleanupBJ();
    currentGame=null; keysPressed = {}; 
    window.removeEventListener('keydown', quickRestartListener);
}

// --- LOGIN & PROFILE ---
async function login(username, pin) { 
    try { 
        const ref = doc(db, 'gooner_users', username.toUpperCase()); 
        const snap = await getDoc(ref); 
        if(snap.exists()) { 
            if(snap.data().pin === pin) { loadProfile(snap.data()); return true; } 
            else return "INVALID PIN"; 
        } else return "USER NOT FOUND"; 
    } catch(e) { return "ERROR: " + e.message; } 
}

function loadProfile(data) { 
    myName = data.name; myMoney = data.money; myStats = data.stats || {games:0, wpm:0, wins:0}; 
    myAchievements = data.achievements || []; myInventory = data.inventory || []; 
    updateUI(); 
    document.getElementById('overlayLogin').classList.remove('active'); 
    localStorage.setItem('goonerUser', myName); localStorage.setItem('goonerPin', data.pin); 
    if(myInventory.includes('item_matrix')) { document.documentElement.style.setProperty('--accent', '#00ff00'); document.getElementById('matrixCanvas').classList.add('active'); } 
    if(myInventory.includes('item_rainbow')) document.body.classList.add('rainbow-mode'); 
    if(myInventory.includes('item_flappy')) document.getElementById('btnFlappy').style.display = 'block'; 
}

async function register(username, pin) { 
    try { 
        if(!myUid) return "WAITING FOR NETWORK..."; 
        const ref = doc(db, 'gooner_users', username.toUpperCase()); 
        const snap = await getDoc(ref); 
        if(snap.exists()) return "USERNAME TAKEN"; 
        const data = { name: username.toUpperCase(), pin: pin, money: 1000, joined: Date.now(), stats: {games:0, wpm:0, wins:0} }; 
        await setDoc(ref, data); loadProfile(data); return true; 
    } catch(e) { return "REG ERROR"; } 
}

async function saveStats() { 
    if(myName==="ANON") return; 
    await updateDoc(doc(db, 'gooner_users', myName), { money: myMoney, stats: myStats, achievements: myAchievements, inventory: myInventory }); 
    updateUI(); 
}

function updateUI() { 
    setText('displayUser', myName); 
    const bankEl = document.getElementById('globalBank'); 
    bankEl.innerText = myMoney; 
    setText('profName', myName); setText('profBank', "$"+myMoney); 
    
    // Rank logic
    let rank = "RAT";
    if(myMoney > 500) rank = "SCRIPT KIDDIE";
    if(myMoney > 2000) rank = "HACKER";
    if(myMoney > 5000) rank = "GOONER";
    if(myMoney > 50000) rank = "CYBER LORD";
    
    setText('displayRank', "[" + rank + "]"); setText('profRank', rank); 
    
    if(myMoney >= 5000) System.unlockAchievement('diamond_hands'); 
    if(myMoney >= 1000000) System.unlockAchievement('millionaire'); 
    if(myMoney === 0) { 
        System.unlockAchievement('rug_pulled'); 
        myMoney = 10; logTransaction("EMERGENCY GRANT", 10); 
        showToast("WELFARE GRANT", "💰", "Don't spend it all in one place."); 
        saveStats(); 
    } 
}

// --- LOGS & BANK ---
function logTransaction(msg, amount) { 
    transactionLog.unshift({ msg, amount, ts: new Date().toLocaleTimeString() }); 
    if(transactionLog.length > 20) transactionLog.pop(); 
    updateBankLog(); 
}
function updateBankLog() { 
    const div = document.getElementById('bankLog'); 
    div.innerHTML = transactionLog.map(t => `<div class="bank-entry"><span>${t.ts} ${t.msg}</span><span style="color:${t.amount>=0?'#0f0':'#f00'}">${t.amount>=0?'+':''}$${t.amount}</span></div>`).join(''); 
}

// --- SHOP & BADGES ---
function renderBadges() { 
    const grid = document.getElementById('badgeGrid'); grid.innerHTML = ''; 
    ACHIEVEMENTS.forEach(a => { 
        const unlocked = myAchievements.includes(a.id); 
        const div = document.createElement('div'); 
        if(a.hidden && !unlocked) { 
            div.className = 'badge-item'; div.innerHTML = `<div class="badge-icon">🔒</div><div>???</div>`; 
        } else { 
            div.className = 'badge-item unlocked ' + a.rarity; 
            div.innerHTML = `<div class="badge-icon">${a.icon}</div><div>${a.title}</div>`; 
            div.onclick = () => showBadgeDetail(a, true); 
        } 
        grid.appendChild(div); 
    }); 
}

function showBadgeDetail(badge, unlocked) {
    setText('bdIcon', unlocked ? badge.icon : '🔒');
    setText('bdTitle', unlocked ? badge.title : 'LOCKED');
    setText('bdDesc', unlocked ? badge.desc : 'Hidden');
    document.getElementById('modalBadgeDetail').classList.add('active');
}

function renderShop() { 
    const list = document.getElementById('shopList'); setText('shopBank', myMoney); list.innerHTML = ''; 
    SHOP_ITEMS.forEach(item => { 
        const div = document.createElement('div'); div.className = 'shop-item'; 
        let label = '$'+item.cost; let btnText = 'BUY'; let disabled = myMoney < item.cost; 
        if(myInventory.includes(item.id) && item.type !== 'consumable') { label = 'OWNED'; btnText = 'ACTIVE'; disabled = true; } 
        div.innerHTML = `<div>${item.name}<div style="font-size:8px;opacity:0.7">${item.desc}</div></div><div style="text-align:right"><span style="color:var(--accent)">${label}</span><button class="shop-buy-btn" onclick="window.buyItem('${item.id}')" ${disabled ? 'disabled' : ''}>${btnText}</button></div>`; 
        list.appendChild(div); 
    }); 
}

window.buyItem = (id) => { 
    const item = SHOP_ITEMS.find(i => i.id === id); 
    if(myMoney >= item.cost) { 
        myMoney -= item.cost; 
        myInventory.push(id); 
        if(id === 'item_rainbow') document.body.classList.add('rainbow-mode'); 
        if(id === 'item_flappy') { document.getElementById('btnFlappy').style.display = 'block'; showToast("NEW GAME UNLOCKED", "🎮"); } 
        if(id === 'item_matrix') { System.unlockAchievement('neo'); document.documentElement.style.setProperty('--accent', '#00ff00'); document.getElementById('matrixCanvas').classList.add('active'); } 
        logTransaction(`BOUGHT: ${item.name}`, -item.cost); 
        saveStats(); renderShop(); 
        beep(600); 
        showToast(`BOUGHT: ${item.name}`, "🛒"); 
    } 
};

// --- CHAT ---
let chatCount = 0; 
function initChat() { 
    const chatRef = collection(db, 'gooner_global_chat'); 
    const q = query(chatRef, orderBy('ts', 'desc'), limit(15)); 
    onSnapshot(q, (snap) => { 
        const list = document.getElementById('chatHistory'); list.innerHTML = ''; 
        const msgs = []; snap.forEach(d => msgs.push(d.data())); 
        msgs.reverse().forEach(m => { 
            const d = document.createElement('div'); d.className = 'chat-msg'; 
            d.innerHTML = `<span class="chat-user">${m.user}:</span> ${m.msg}`; 
            list.appendChild(d); 
        }); 
        list.scrollTop = list.scrollHeight; 
    }); 
    document.getElementById('chatInput').addEventListener('keypress', async (e) => { 
        if(e.key === 'Enter') { 
            const txt = e.target.value.trim(); 
            if(txt.length > 0) { 
                if(txt === '/clear') { document.getElementById('chatHistory').innerHTML=''; e.target.value=''; return;} 
                if(txt === '/root') { System.unlockAchievement('master_hacker'); return; } 
                if(txt === '/help') { System.unlockAchievement('architect'); } 
                chatCount++; if(chatCount === 10) System.unlockAchievement('chatterbox'); 
                await addDoc(chatRef, { user: myName, msg: txt, ts: Date.now() }); 
                e.target.value = ''; 
            } 
        } 
    }); 
}

// --- SCORES ---
async function saveGlobalScore(game, score) { 
    if(score<=0 || myName==="ANON") return; 
    await addDoc(collection(db, 'gooner_scores'), { game: game, name: myName, score: score }); 
}

// --- EVENT LISTENERS ---
if(localStorage.getItem('goonerUser')) login(localStorage.getItem('goonerUser'), localStorage.getItem('goonerPin'));
document.getElementById('btnLogin').onclick = async () => { const u=document.getElementById('usernameInput').value.trim(), p=document.getElementById('pinInput').value.trim(); if(u.length<3||p.length<4) return beep(200); const res=await login(u,p); if(res===true) beep(600); else { setText('loginMsg', res); beep(100); } };
document.getElementById('btnRegister').onclick = async () => { const u=document.getElementById('usernameInput').value.trim(), p=document.getElementById('pinInput').value.trim(); if(u.length<3||p.length<4) return; const res=await register(u,p); if(res===true) beep(600); else { setText('loginMsg', res); beep(100); } };
document.getElementById('btnLogout').onclick = () => { localStorage.clear(); location.reload(); };
document.getElementById('menuToggle').onclick = (e) => { e.stopPropagation(); document.getElementById('menuDropdown').classList.toggle('show'); };
document.addEventListener('click', (e) => { if(!e.target.closest('#menuToggle')) document.getElementById('menuDropdown').classList.remove('show'); });

// --- GAME INPUTS ---
document.addEventListener('keydown', (e) => {
    keysPressed[e.key] = true;
    if(currentGame === 'snake') handleSnakeKey(e.key);
    if(currentGame === 'runner') handleRunnerInput(e.key);
    if(currentGame === 'geo') handleGeoInput(e.key);
    if(currentGame === 'flappy') handleFlappyInput(e.key);
});
document.addEventListener('keyup', (e) => { keysPressed[e.key] = false; });
document.getElementById('typeHiddenInput').addEventListener('input', (e) => { if(currentGame === 'type') handleTypeInput(e, System); });

// --- SETTINGS ---
document.getElementById('themeColor').oninput = (e) => { 
    const h = e.target.value; 
    document.documentElement.style.setProperty('--accent', h); 
    const r=parseInt(h.slice(1,3),16), g=parseInt(h.slice(3,5),16), b=parseInt(h.slice(5,7),16); 
    document.documentElement.style.setProperty('--accent-dim', `rgba(${r},${g},${b},0.2)`); 
    document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.6)`); 
};
document.getElementById('volSlider').oninput = (e) => setVolume(e.target.value/100);
document.getElementById('scanSlider').oninput = (e) => document.documentElement.style.setProperty('--scanline-opacity', e.target.value/100);
document.getElementById('flickerToggle').onclick = (e) => { document.body.classList.toggle('flicker-on'); e.target.innerText = document.body.classList.contains('flicker-on')?"ON":"OFF"; };
document.getElementById('fsToggle').onclick = () => { if(!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); };

// --- GAMEOVER ---
window.showGameOver = (g,s) => { 
    stopAllGames(); 
    beep(150, 'sawtooth', 0.5); 
    setText('gameOverText', 'SYSTEM_FAILURE: SCORE_' + s); 
    document.getElementById('modalGameOver').classList.add('active'); 
    window.addEventListener('keydown', quickRestartListener); 
};
function quickRestartListener(e) { if (e.key === ' ' || e.key === 'Enter') { document.getElementById('goRestart').click(); window.removeEventListener('keydown', quickRestartListener); } }
document.getElementById('goRestart').onclick = () => { 
    document.getElementById('modalGameOver').classList.remove('active'); 
    window.removeEventListener('keydown', quickRestartListener); 
    window.launchGame(currentGame);
};
document.getElementById('goExit').onclick = () => { window.closeOverlays(); document.getElementById('modalGameOver').classList.remove('active'); };

// --- BLACKJACK EXPORTS TO WINDOW (HTML Buttons) ---
window.bjSelect = (m) => selectMode(m, System);
window.setPongDiff = (d) => setPongDiff(d);
window.initTypeGame = () => initTypeGame(System); // Restart button in overlay

// Bind BJ buttons manually since they are in HTML
document.getElementById('bjHit').onclick = () => handleHit(System);
document.getElementById('bjStand').onclick = () => handleStand(System);
document.getElementById('bjDeck').onclick = () => handleDeckClick(System);
document.querySelectorAll('.bj-chip').forEach(c => {
    c.onclick = () => {
        const v = parseInt(c.dataset.v) || 0;
        if(c.id === 'bjClear') placeBet('CLEAR', System);
        else if(c.id === 'bjAllIn') placeBet('ALL', System);
        else placeBet(v, System);
    };
});
