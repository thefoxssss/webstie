import { auth, db, doc, setDoc, getDoc, updateDoc, addDoc, collection, query, orderBy, limit, onSnapshot, signInAnonymously, onAuthStateChanged } from './firebase.js';
import { ACHIEVEMENTS, SHOP_ITEMS } from './data.js';

// Global State
window.myUid = null;
window.myName = "ANON";
window.myMoney = 1000;
window.myStats = { games: 0, wpm: 0, wins: 0 };
window.myAchievements = [];
window.myInventory = [];
window.transactionLog = [];
window.globalVol = 0.5;
window.currentGame = null;
window.keysPressed = {};
window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Animation frames
window.pAnim = null; window.sAnim = null; window.rAnim = null; window.gAnim = null; window.fAnim = null; window.typeInterval = null;

// --- UTILS ---
window.setText = (id, txt) => { const el = document.getElementById(id); if(el) el.innerText = txt; };

window.beep = (freq=440, type='square', len=0.1) => {
    if(window.audioCtx.state==='suspended') window.audioCtx.resume();
    const o=window.audioCtx.createOscillator(), g=window.audioCtx.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,window.audioCtx.currentTime);
    g.gain.setValueAtTime(0.05*window.globalVol,window.audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,window.audioCtx.currentTime+len);
    o.connect(g); g.connect(window.audioCtx.destination); o.start(); o.stop(window.audioCtx.currentTime+len);
};

window.playSuccessSound = () => { window.beep(523.25, 'triangle', 0.1); setTimeout(() => window.beep(659.25, 'triangle', 0.1), 100); setTimeout(() => window.beep(783.99, 'triangle', 0.2), 200); };

window.logTransaction = (msg, amount) => { 
    window.transactionLog.unshift({ msg, amount, ts: new Date().toLocaleTimeString() }); 
    if(window.transactionLog.length > 20) window.transactionLog.pop(); 
    window.updateBankLog(); 
};

window.updateBankLog = () => { 
    const div = document.getElementById('bankLog'); 
    div.innerHTML = window.transactionLog.map(t => `<div class="bank-entry"><span>${t.ts} ${t.msg}</span><span style="color:${t.amount>=0?'#0f0':'#f00'}">${t.amount>=0?'+':''}$${t.amount}</span></div>`).join(''); 
};

window.showToast = (title, icon, subtitle = "") => { 
    const t = document.createElement('div'); 
    t.className = 'toast'; 
    t.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-content"><div class="toast-title">${title}</div><div class="toast-desc">${subtitle}</div></div>`; 
    document.getElementById('toastBox').appendChild(t); 
    setTimeout(() => t.remove(), 4000); 
};

// --- AUTH HELPER (The Fix) ---
async function ensureAuth() {
    if (auth.currentUser) return auth.currentUser;
    try {
        console.log("Attempting auto-connection...");
        const result = await signInAnonymously(auth);
        window.myUid = result.user.uid;
        return result.user;
    } catch (e) {
        console.error("Auth Failed:", e);
        return null;
    }
}

// --- LOGIN & REGISTER ---
window.login = async (username, pin) => { 
    try { 
        // 1. Ensure we are connected to Firebase first
        const user = await ensureAuth();
        if (!user) return "NETWORK ERROR: COULD NOT CONNECT";

        // 2. Try to fetch user
        const ref = doc(db, 'gooner_users', username.toUpperCase()); 
        const snap = await getDoc(ref); 
        
        if(snap.exists()) { 
            if(snap.data().pin === pin) { 
                loadProfile(snap.data()); 
                return true; 
            } else {
                return "INVALID PIN"; 
            }
        } else {
            return "USER NOT FOUND"; 
        }
    } catch(e) { 
        console.error(e);
        return "ERROR: " + e.message; 
    } 
};

window.register = async (username, pin) => { 
    try { 
        // 1. Ensure connection
        const user = await ensureAuth();
        if (!user) return "NETWORK ERROR: COULD NOT CONNECT";

        const ref = doc(db, 'gooner_users', username.toUpperCase()); 
        const snap = await getDoc(ref); 
        
        if(snap.exists()) return "USERNAME TAKEN"; 
        
        const data = { 
            name: username.toUpperCase(), 
            pin: pin, 
            money: 1000, 
            joined: Date.now(), 
            stats: {games:0, wpm:0, wins:0} 
        }; 
        
        await setDoc(ref, data); 
        loadProfile(data); 
        return true; 
    } catch(e) { 
        console.error(e);
        return "REG ERROR: " + e.message; 
    } 
};

function loadProfile(data) { 
    window.myName = data.name; window.myMoney = data.money; window.myStats = data.stats || {games:0, wpm:0, wins:0}; 
    window.myAchievements = data.achievements || []; window.myInventory = data.inventory || []; 
    window.updateUI(); 
    document.getElementById('overlayLogin').classList.remove('active'); 
    localStorage.setItem('goonerUser', window.myName); 
    localStorage.setItem('goonerPin', data.pin); 
    if(window.myInventory.includes('item_matrix')) { document.documentElement.style.setProperty('--accent', '#00ff00'); document.getElementById('matrixCanvas').classList.add('active'); } 
    if(window.myInventory.includes('item_rainbow')) document.body.classList.add('rainbow-mode'); 
    if(window.myInventory.includes('item_flappy')) document.getElementById('btnFlappy').style.display = 'block'; 
    const lastLogin = data.lastLogin || 0; const now = Date.now(); 
    if(now - lastLogin > 86400000) { window.myMoney += 100; window.showToast("DAILY BONUS: $100", "💰"); } 
    updateDoc(doc(db, 'gooner_users', window.myName), { lastLogin: now }); 
}

window.saveStats = async () => { 
    if(window.myName==="ANON") return; 
    await updateDoc(doc(db, 'gooner_users', window.myName), { money: window.myMoney, stats: window.myStats, achievements: window.myAchievements, inventory: window.myInventory }); 
    window.updateUI(); 
};

window.updateUI = () => { 
    window.setText('displayUser', window.myName); 
    const bankEl = document.getElementById('globalBank'); 
    const bankOverlayEl = document.getElementById('bankDisplay'); 
    const currentVal = parseInt(bankEl.innerText) || 0; 
    if(currentVal !== window.myMoney) { bankEl.style.color = window.myMoney > currentVal ? '#0f0' : '#f00'; setTimeout(() => bankEl.style.color = 'var(--accent)', 500); } 
    bankEl.innerText = window.myMoney; 
    if(bankOverlayEl) bankOverlayEl.innerText = window.myMoney; 
    window.setText('profName', window.myName); 
    window.setText('profBank', "$"+window.myMoney); 
    window.setText('profWPM', (window.myStats.wpm||0) + " WPM"); 
    window.setText('profGames', window.myStats.games||0); 
    window.setText('profUid', window.myUid ? window.myUid.substring(0,8) : "ERR"); 
    const rank = getRank(window.myMoney); 
    window.setText('displayRank', "[" + rank + "]"); 
    window.setText('profRank', rank); 
    if(window.myMoney >= 5000) window.unlockAchievement('diamond_hands'); 
    if(window.myMoney >= 1000000) window.unlockAchievement('millionaire'); 
    if(window.myMoney === 0) { window.unlockAchievement('rug_pulled'); window.myMoney = 10; window.logTransaction("EMERGENCY GRANT", 10); window.showToast("WELFARE GRANT", "💰", "Don't spend it all in one place."); window.saveStats(); } 
};

function getRank(money) { if(money < 500) return "RAT"; if(money < 2000) return "SCRIPT KIDDIE"; if(money < 5000) return "HACKER"; if(money < 10000) return "GOONER"; if(money < 50000) return "CYBER LORD"; return "KINGPIN"; }

// --- ACHIEVEMENTS & SHOP ---
window.unlockAchievement = (id) => { 
    if(window.myAchievements.includes(id) || window.myName === "ANON") return; 
    window.myAchievements.push(id); 
    const badge = ACHIEVEMENTS.find(a => a.id === id); 
    if(badge) { window.myMoney += badge.reward; window.logTransaction(`ACHIEVEMENT: ${badge.title}`, badge.reward); window.showToast(`UNLOCKED: ${badge.title}`, badge.icon, `+$${badge.reward}`); } 
    window.saveStats(); window.playSuccessSound(); 
};

window.renderBadges = () => { 
    const grid = document.getElementById('badgeGrid'); grid.innerHTML = ''; 
    ACHIEVEMENTS.forEach(a => { 
        const unlocked = window.myAchievements.includes(a.id); 
        const div = document.createElement('div'); 
        if(a.hidden && !unlocked) { div.className = 'badge-item'; div.innerHTML = `<div class="badge-icon">🔒</div><div>???</div>`; div.onclick = () => showBadgeDetail(a, false); } 
        else { div.className = 'badge-item unlocked ' + a.rarity; div.innerHTML = `<div class="badge-icon">${a.icon}</div><div>${a.title}</div>`; div.onclick = () => showBadgeDetail(a, true); } 
        grid.appendChild(div); 
    }); 
};

function showBadgeDetail(badge, unlocked) { 
    window.setText('bdIcon', unlocked ? badge.icon : '🔒'); window.setText('bdTitle', unlocked ? badge.title : 'LOCKED'); 
    window.setText('bdRarity', unlocked ? badge.rarity : 'UNKNOWN'); 
    window.setText('bdDesc', unlocked ? badge.desc : 'This achievement is hidden until unlocked.'); 
    window.setText('bdReward', unlocked ? `REWARDED: $${badge.reward}` : `REWARD: $${badge.reward}`); 
    const rEl = document.getElementById('bdRarity'); rEl.style.color = unlocked ? `var(--${badge.rarity})` : '#555'; 
    document.getElementById('modalBadgeDetail').classList.add('active'); 
}

window.renderShop = () => { 
    const list = document.getElementById('shopList'); window.setText('shopBank', window.myMoney); list.innerHTML = ''; 
    SHOP_ITEMS.forEach(item => { 
        const div = document.createElement('div'); div.className = 'shop-item'; 
        let label = '$'+item.cost; let btnText = 'BUY'; let disabled = window.myMoney < item.cost; 
        if(window.myInventory.includes(item.id) && item.type !== 'consumable') { label = 'OWNED'; btnText = 'ACTIVE'; disabled = true; } 
        div.innerHTML = `<div>${item.name}<div style="font-size:8px;opacity:0.7">${item.desc}</div></div><div style="text-align:right"><span style="color:var(--accent)">${label}</span><button class="shop-buy-btn" onclick="window.buyItem('${item.id}')" ${disabled ? 'disabled' : ''}>${btnText}</button></div>`; 
        list.appendChild(div); 
    }); 
};

window.buyItem = (id) => { 
    const item = SHOP_ITEMS.find(i => i.id === id); 
    if(window.myMoney >= item.cost) { 
        window.myMoney -= item.cost; 
        window.myInventory.push(id); 
        if(id === 'item_rainbow') document.body.classList.add('rainbow-mode'); 
        if(id === 'item_flappy') { document.getElementById('btnFlappy').style.display = 'block'; window.showToast("NEW GAME UNLOCKED", "🎮"); } 
        if(window.myInventory.filter(i => i !== 'item_shield').length >= 3) window.unlockAchievement('shopaholic'); 
        if(id === 'item_matrix') { window.unlockAchievement('neo'); document.documentElement.style.setProperty('--accent', '#00ff00'); document.getElementById('matrixCanvas').classList.add('active'); } 
        window.logTransaction(`BOUGHT: ${item.name}`, -item.cost); 
        window.saveStats(); window.renderShop(); window.playSuccessSound(); window.showToast(`BOUGHT: ${item.name}`, "🛒"); 
    } 
};

// --- LEADERBOARD & CHAT ---
window.updateHighScore = (game, score) => { 
    const k = `hs_${game}`; const old = parseInt(localStorage.getItem(k)||0); 
    if(score > old) { localStorage.setItem(k, score); saveGlobalScore(game, score); return score; } 
    return old; 
};

window.loadHighScores = () => { 
    window.setText('hsPong', localStorage.getItem('hs_pong')||0); 
    window.setText('hsSnake', localStorage.getItem('hs_snake')||0); 
    window.setText('hsRunner', localStorage.getItem('hs_runner')||0); 
    window.setText('hsGeo', localStorage.getItem('hs_geo')||0); 
    window.setText('hsFlappy', localStorage.getItem('hs_flappy')||0); 
};

async function saveGlobalScore(game, score) { 
    if(score<=0 || window.myName==="ANON") return; 
    await addDoc(collection(db, 'gooner_scores'), { game: game, name: window.myName, score: score }); 
}

window.loadLeaderboard = (game) => { 
    const list = document.getElementById('scoreList'); list.innerHTML = 'LOADING...'; 
    const q = query(collection(db, 'gooner_scores'), orderBy('score', 'desc'), limit(100)); 
    onSnapshot(q, (snap) => { 
        list.innerHTML = ''; const data = []; snap.forEach(d => data.push(d.data())); 
        const uniqueScores = {}; 
        data.filter(d => d.game === game).forEach(s => { if (!uniqueScores[s.name] || s.score > uniqueScores[s.name].score) { uniqueScores[s.name] = s; } }); 
        const filtered = Object.values(uniqueScores).sort((a,b) => b.score - a.score).slice(0, 10); 
        if(filtered.length===0) list.innerHTML = '<div style="padding:10px">NO DATA</div>'; 
        filtered.forEach((s, i) => { const item = document.createElement('div'); item.className = 'score-item'; item.innerHTML = `<span class="score-rank">#${i+1}</span> <span>${s.name}</span> <span>${s.score}</span>`; list.appendChild(item); }); 
    }); 
};

export function initChat() { 
    const chatRef = collection(db, 'gooner_global_chat'); 
    const q = query(chatRef, orderBy('ts', 'desc'), limit(15)); 
    let chatCount = 0;
    onSnapshot(q, (snap) => { 
        const list = document.getElementById('chatHistory'); list.innerHTML = ''; const msgs = []; 
        snap.forEach(d => msgs.push(d.data())); 
        msgs.reverse().forEach(m => { const d = document.createElement('div'); d.className = 'chat-msg'; d.innerHTML = `<span class="chat-user">${m.user}:</span> ${m.msg}`; list.appendChild(d); }); 
        list.scrollTop = list.scrollHeight; 
    }); 
    document.getElementById('chatInput').addEventListener('keypress', async (e) => { 
        if(e.key === 'Enter') { 
            const txt = e.target.value.trim(); 
            if(txt.length > 0) { 
                if(txt === '/clear') { document.getElementById('chatHistory').innerHTML=''; e.target.value=''; return;} 
                if(txt === '/root') { e.target.value = ''; document.getElementById('hackOverlay').classList.add('active'); setTimeout(() => { document.getElementById('hackOverlay').classList.remove('active'); window.unlockAchievement('master_hacker'); }, 2000); return; } 
                if(txt === '/help') { window.unlockAchievement('architect'); } 
                chatCount++; if(chatCount === 10) window.unlockAchievement('chatterbox'); 
                await addDoc(chatRef, { user: window.myName, msg: txt, ts: Date.now() }); 
                e.target.value = ''; 
            } 
        } 
    }); 
}

// Initial Auth
const initAuth = async () => { try{await signInAnonymously(auth);}catch(e){console.error(e);} }; 
initAuth();
onAuthStateChanged(auth, u=>{ if(u){ window.myUid=u.uid; initChat(); } });
