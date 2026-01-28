import { auth, db, signInAnonymously, onAuthStateChanged, collection, doc, setDoc, getDoc, updateDoc, onSnapshot, query, orderBy, limit, addDoc } from "./firebase.js";
import { state, ACHIEVEMENTS, SHOP_ITEMS, beep, playSuccessSound, setText, showToast, logTransaction, updateBankLog } from "./state.js";

// Import Games
import * as Geo from "./games/geo.js";
import * as Type from "./games/type.js";
import * as Pong from "./games/pong.js";
import * as Snake from "./games/snake.js";
import * as Runner from "./games/runner.js";
import * as BJ from "./games/blackjack.js";
import * as TTT from "./games/ttt.js";
import * as Flappy from "./games/flappy.js";

// --- AUTH & INIT ---
const initAuth = async () => { try{await signInAnonymously(auth);}catch(e){console.error(e);} }; 
initAuth();
onAuthStateChanged(auth, u=>{ if(u){ state.myUid=u.uid; initChat(); } });

setInterval(()=>{ 
    const d=new Date(); setText('sysClock', d.toLocaleTimeString('en-GB')); setText('sysPing', Math.floor(Math.random()*40+10)+"ms");
    if(d.getMinutes() === 37) unlockAchievement('leet'); if(d.getHours() === 3) unlockAchievement('insomniac');
},1000);

// --- GLOBAL UI FUNCTIONS ---
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
    
    if(game==='pong') Pong.initPong(); 
    if(game==='snake') Snake.initSnake(); 
    if(game==='runner') Runner.initRunner(); 
    if(game==='geo') Geo.initGeometry(); 
    if(game==='type') Type.initTypeGame(); 
    if(game==='blackjack') BJ.initBJ(); 
    if(game==='ttt') TTT.initTTT(); 
    if(game==='flappy') Flappy.initFlappy();
    
    unlockAchievement('noob');
};

function stopAllGames(){
    Geo.stop(); Type.stop(); Pong.stop(); Snake.stop(); Runner.stop(); BJ.stop(); TTT.stop(); Flappy.stop();
    state.currentGame=null; state.keysPressed = {}; 
    window.removeEventListener('keydown', quickRestartListener);
}

// --- PROFILE & LOGIC ---
async function login(username, pin) { try { const ref = doc(db, 'gooner_users', username.toUpperCase()); const snap = await getDoc(ref); if(snap.exists()) { if(snap.data().pin === pin) { loadProfile(snap.data()); return true; } else return "INVALID PIN"; } else return "USER NOT FOUND"; } catch(e) { return "ERROR: " + e.message; } }
function getRank(money) { if(money < 500) return "RAT"; if(money < 2000) return "SCRIPT KIDDIE"; if(money < 5000) return "HACKER"; if(money < 10000) return "GOONER"; if(money < 50000) return "CYBER LORD"; return "KINGPIN"; }

function loadProfile(data) { 
    state.myName = data.name; state.myMoney = data.money; state.myStats = data.stats || {games:0, wpm:0, wins:0}; state.myAchievements = data.achievements || []; state.myInventory = data.inventory || []; 
    updateUI(); 
    document.getElementById('overlayLogin').classList.remove('active'); 
    localStorage.setItem('goonerUser', state.myName); localStorage.setItem('goonerPin', data.pin); 
    if(state.myInventory.includes('item_matrix')) { document.documentElement.style.setProperty('--accent', '#00ff00'); document.getElementById('matrixCanvas').classList.add('active'); } 
    if(state.myInventory.includes('item_rainbow')) document.body.classList.add('rainbow-mode'); 
    if(state.myInventory.includes('item_flappy')) document.getElementById('btnFlappy').style.display = 'block'; 
    const lastLogin = data.lastLogin || 0; const now = Date.now(); 
    if(now - lastLogin > 86400000) { state.myMoney += 100; showToast("DAILY BONUS: $100", "💰"); } 
    updateDoc(doc(db, 'gooner_users', state.myName), { lastLogin: now }); 
}

export function updateUI() { 
    setText('displayUser', state.myName); const bankEl = document.getElementById('globalBank'); const bankOverlayEl = document.getElementById('bankDisplay'); 
    const currentVal = parseInt(bankEl.innerText) || 0; 
    if(currentVal !== state.myMoney) { bankEl.style.color = state.myMoney > currentVal ? '#0f0' : '#f00'; setTimeout(() => bankEl.style.color = 'var(--accent)', 500); } 
    bankEl.innerText = state.myMoney; if(bankOverlayEl) bankOverlayEl.innerText = state.myMoney; 
    setText('profName', state.myName); setText('profBank', "$"+state.myMoney); setText('profWPM', (state.myStats.wpm||0) + " WPM"); setText('profGames', state.myStats.games||0); setText('profUid', state.myUid ? state.myUid.substring(0,8) : "ERR"); 
    const rank = getRank(state.myMoney); setText('displayRank', "[" + rank + "]"); setText('profRank', rank); 
    if(state.myMoney >= 5000) unlockAchievement('diamond_hands'); if(state.myMoney >= 1000000) unlockAchievement('millionaire'); 
    if(state.myMoney === 0) { unlockAchievement('rug_pulled'); state.myMoney = 10; logTransaction("EMERGENCY GRANT", 10); showToast("WELFARE GRANT", "💰", "Don't spend it all in one place."); saveStats(); } 
}

async function register(username, pin) { try { if(!state.myUid) return "WAITING FOR NETWORK..."; const ref = doc(db, 'gooner_users', username.toUpperCase()); const snap = await getDoc(ref); if(snap.exists()) return "USERNAME TAKEN"; const data = { name: username.toUpperCase(), pin: pin, money: 1000, joined: Date.now(), stats: {games:0, wpm:0, wins:0} }; await setDoc(ref, data); loadProfile(data); return true; } catch(e) { return "REG ERROR"; } }
export async function saveStats() { if(state.myName==="ANON") return; await updateDoc(doc(db, 'gooner_users', state.myName), { money: state.myMoney, stats: state.myStats, achievements: state.myAchievements, inventory: state.myInventory }); updateUI(); }
    
export function unlockAchievement(id) { if(state.myAchievements.includes(id) || state.myName === "ANON") return; state.myAchievements.push(id); const badge = ACHIEVEMENTS.find(a => a.id === id); if(badge) { state.myMoney += badge.reward; logTransaction(`ACHIEVEMENT: ${badge.title}`, badge.reward); showToast(`UNLOCKED: ${badge.title}`, badge.icon, `+$${badge.reward}`); } saveStats(); playSuccessSound(); }

function renderBadges() { const grid = document.getElementById('badgeGrid'); grid.innerHTML = ''; ACHIEVEMENTS.forEach(a => { const unlocked = state.myAchievements.includes(a.id); const div = document.createElement('div'); if(a.hidden && !unlocked) { div.className = 'badge-item'; div.innerHTML = `<div class="badge-icon">🔒</div><div>???</div>`; div.onclick = () => showBadgeDetail(a, false); } else { div.className = 'badge-item unlocked ' + a.rarity; div.innerHTML = `<div class="badge-icon">${a.icon}</div><div>${a.title}</div>`; div.onclick = () => showBadgeDetail(a, true); } grid.appendChild(div); }); }
function showBadgeDetail(badge, unlocked) { setText('bdIcon', unlocked ? badge.icon : '🔒'); setText('bdTitle', unlocked ? badge.title : 'LOCKED'); setText('bdRarity', unlocked ? badge.rarity : 'UNKNOWN'); setText('bdDesc', unlocked ? badge.desc : 'This achievement is hidden until unlocked.'); setText('bdReward', unlocked ? `REWARDED: $${badge.reward}` : `REWARD: $${badge.reward}`); const rEl = document.getElementById('bdRarity'); rEl.style.color = unlocked ? `var(--${badge.rarity})` : '#555'; document.getElementById('modalBadgeDetail').classList.add('active'); }
function renderShop() { const list = document.getElementById('shopList'); setText('shopBank', state.myMoney); list.innerHTML = ''; SHOP_ITEMS.forEach(item => { const div = document.createElement('div'); div.className = 'shop-item'; let label = '$'+item.cost; let btnText = 'BUY'; let disabled = state.myMoney < item.cost; if(state.myInventory.includes(item.id) && item.type !== 'consumable') { label = 'OWNED'; btnText = 'ACTIVE'; disabled = true; } div.innerHTML = `<div>${item.name}<div style="font-size:8px;opacity:0.7">${item.desc}</div></div><div style="text-align:right"><span style="color:var(--accent)">${label}</span><button class="shop-buy-btn" onclick="window.buyItem('${item.id}')" ${disabled ? 'disabled' : ''}>${btnText}</button></div>`; list.appendChild(div); }); }
window.buyItem = (id) => { const item = SHOP_ITEMS.find(i => i.id === id); if(state.myMoney >= item.cost) { state.myMoney -= item.cost; if(item.type !== 'consumable') state.myInventory.push(id); else state.myInventory.push(id); if(id === 'item_rainbow') document.body.classList.add('rainbow-mode'); if(id === 'item_flappy') { document.getElementById('btnFlappy').style.display = 'block'; showToast("NEW GAME UNLOCKED", "🎮"); } if(state.myInventory.filter(i => i !== 'item_shield').length >= 3) unlockAchievement('shopaholic'); if(id === 'item_matrix') { unlockAchievement('neo'); document.documentElement.style.setProperty('--accent', '#00ff00'); document.getElementById('matrixCanvas').classList.add('active'); } logTransaction(`BOUGHT: ${item.name}`, -item.cost); saveStats(); renderShop(); playSuccessSound(); showToast(`BOUGHT: ${item.name}`, "🛒"); } };

// --- BUTTONS ---
if(localStorage.getItem('goonerUser')) login(localStorage.getItem('goonerUser'), localStorage.getItem('goonerPin'));
document.getElementById('btnLogin').onclick = async () => { const u=document.getElementById('usernameInput').value.trim(), p=document.getElementById('pinInput').value.trim(); if(u.length<3||p.length<4) return beep(200,'sawtooth',0.5); const res=await login(u,p); if(res===true) beep(600,'square',0.1); else { setText('loginMsg', res); beep(100,'sawtooth',0.5); } };
document.getElementById('btnRegister').onclick = async () => { const u=document.getElementById('usernameInput').value.trim(), p=document.getElementById('pinInput').value.trim(); if(u.length<3||p.length<4) return; const res=await register(u,p); if(res===true) beep(600,'square',0.1); else { setText('loginMsg', res); beep(100,'sawtooth',0.5); } };
document.getElementById('btnLogout').onclick = () => { localStorage.clear(); location.reload(); };
document.getElementById('menuToggle').onclick = (e) => { e.stopPropagation(); document.getElementById('menuDropdown').classList.toggle('show'); };
document.addEventListener('click', (e) => { if(!e.target.closest('#menuToggle')) document.getElementById('menuDropdown').classList.remove('show'); });
document.getElementById('themeColor').oninput = (e) => { const h = e.target.value; document.documentElement.style.setProperty('--accent', h); const r=parseInt(h.slice(1,3),16), g=parseInt(h.slice(3,5),16), b=parseInt(h.slice(5,7),16); document.documentElement.style.setProperty('--accent-dim', `rgba(${r},${g},${b},0.2)`); document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.6)`); };
document.getElementById('volSlider').oninput = (e) => state.globalVol = e.target.value/100;
document.getElementById('scanSlider').oninput = (e) => document.documentElement.style.setProperty('--scanline-opacity', e.target.value/100);
document.getElementById('flickerToggle').onclick = (e) => { document.body.classList.toggle('flicker-on'); e.target.innerText = document.body.classList.contains('flicker-on')?"ON":"OFF"; };
document.getElementById('fsToggle').onclick = () => { if(!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); };

// --- INPUT HANDLER ---
document.addEventListener('keydown', e => { 
    state.keysPressed[e.key] = true; 
    if(state.currentGame==='snake'){const k=e.key; Snake.handleInput(k); } 
});
document.addEventListener('keyup', e => { state.keysPressed[e.key] = false; });

// --- LEADERBOARD & CHAT ---
// (Copy loadLeaderboard, saveGlobalScore, initChat logic here from original script. It is long but straightforward copy-paste)
// For brevity, I'm abbreviating the Chat Logic to show where it goes:
let chatCount = 0; 
function initChat() { 
    const chatRef = collection(db, 'gooner_global_chat'); 
    const q = query(chatRef, orderBy('ts', 'desc'), limit(15)); 
    onSnapshot(q, (snap) => { const list = document.getElementById('chatHistory'); list.innerHTML = ''; const msgs = []; snap.forEach(d => msgs.push(d.data())); msgs.reverse().forEach(m => { const d = document.createElement('div'); d.className = 'chat-msg'; d.innerHTML = `<span class="chat-user">${m.user}:</span> ${m.msg}`; list.appendChild(d); }); list.scrollTop = list.scrollHeight; }); 
    document.getElementById('chatInput').addEventListener('keypress', async (e) => { if(e.key === 'Enter') { const txt = e.target.value.trim(); if(txt.length > 0) { await addDoc(chatRef, { user: state.myName, msg: txt, ts: Date.now() }); e.target.value = ''; } } }); 
}

export async function saveGlobalScore(game, score) { if(score<=0 || state.myName==="ANON") return; await addDoc(collection(db, 'gooner_scores'), { game: game, name: state.myName, score: score }); }
document.querySelectorAll('.score-tab').forEach(t => t.onclick = () => { document.querySelectorAll('.score-tab').forEach(x => x.classList.remove('active')); t.classList.add('active'); loadLeaderboard(t.dataset.tab); });
function loadLeaderboard(game) { const list = document.getElementById('scoreList'); list.innerHTML = 'LOADING...'; const q = query(collection(db, 'gooner_scores'), orderBy('score', 'desc'), limit(100)); onSnapshot(q, (snap) => { list.innerHTML = ''; const data = []; snap.forEach(d => data.push(d.data())); const uniqueScores = {}; data.filter(d => d.game === game).forEach(s => { if (!uniqueScores[s.name] || s.score > uniqueScores[s.name].score) { uniqueScores[s.name] = s; } }); const filtered = Object.values(uniqueScores).sort((a,b) => b.score - a.score).slice(0, 10); if(filtered.length===0) list.innerHTML = '<div style="padding:10px">NO DATA</div>'; filtered.forEach((s, i) => { const item = document.createElement('div'); item.className = 'score-item'; item.innerHTML = `<span class="score-rank">#${i+1}</span> <span>${s.name}</span> <span>${s.score}</span>`; list.appendChild(item); }); }); }

// --- GAME OVER ---
function quickRestartListener(e) { if (e.key === ' ' || e.key === 'Enter') { document.getElementById('goRestart').click(); window.removeEventListener('keydown', quickRestartListener); } }
window.showGameOver=(g,s)=>{ stopAllGames(); beep(150, 'sawtooth', 0.5); setText('gameOverText', 'SYSTEM_FAILURE: SCORE_' + s); document.getElementById('modalGameOver').classList.add('active'); window.addEventListener('keydown', quickRestartListener); };
document.getElementById('goRestart').onclick=()=>{ document.getElementById('modalGameOver').classList.remove('active'); window.removeEventListener('keydown', quickRestartListener); window.launchGame(state.currentGame); };
document.getElementById('goExit').onclick=()=>{ window.closeOverlays(); document.getElementById('modalGameOver').classList.remove('active'); };
