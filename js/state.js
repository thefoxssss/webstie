export const state = {
    myUid: null,
    myName: "ANON",
    myMoney: 1000,
    myStats: { games: 0, wpm: 0, wins: 0 },
    myAchievements: [],
    myInventory: [],
    transactionLog: [],
    globalVol: 0.5,
    currentGame: null,
    keysPressed: {},
    audioCtx: new (window.AudioContext || window.webkitAudioContext)()
};

export const ACHIEVEMENTS = [
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

export const SHOP_ITEMS = [
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

// Audio Utils
export function beep(freq=440, type='square', len=0.1) {
    if(state.audioCtx.state==='suspended') state.audioCtx.resume();
    const o=state.audioCtx.createOscillator(), g=state.audioCtx.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,state.audioCtx.currentTime);
    g.gain.setValueAtTime(0.05*state.globalVol,state.audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,state.audioCtx.currentTime+len);
    o.connect(g); g.connect(state.audioCtx.destination); o.start(); o.stop(state.audioCtx.currentTime+len);
}

export function playSuccessSound() { 
    beep(523.25, 'triangle', 0.1); 
    setTimeout(() => beep(659.25, 'triangle', 0.1), 100); 
    setTimeout(() => beep(783.99, 'triangle', 0.2), 200); 
}

export function setText(id, txt) { 
    const el = document.getElementById(id); 
    if(el) el.innerText = txt; 
}

export function showToast(title, icon, subtitle = "") { 
    const t = document.createElement('div'); 
    t.className = 'toast'; 
    t.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-content"><div class="toast-title">${title}</div><div class="toast-desc">${subtitle}</div></div>`; 
    document.getElementById('toastBox').appendChild(t); 
    setTimeout(() => t.remove(), 4000); 
}

export function updateBankLog() { 
    const div = document.getElementById('bankLog'); 
    div.innerHTML = state.transactionLog.map(t => `<div class="bank-entry"><span>${t.ts} ${t.msg}</span><span style="color:${t.amount>=0?'#0f0':'#f00'}">${t.amount>=0?'+':''}$${t.amount}</span></div>`).join(''); 
}

export function logTransaction(msg, amount) { 
    state.transactionLog.unshift({ msg, amount, ts: new Date().toLocaleTimeString() }); 
    if(state.transactionLog.length > 20) state.transactionLog.pop(); 
    updateBankLog(); 
}

export function updateHighScore(game, score) { 
    const k = `hs_${game}`; 
    const old = parseInt(localStorage.getItem(k)||0); 
    if(score > old) { 
        localStorage.setItem(k, score); 
        return score; 
    } 
    return old; 
}
