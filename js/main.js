import { auth, db, state } from './config.js';
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { beep, showToast, setText, saveStats } from './utils.js';

// Import Games
import * as Blackjack from './games/blackjack.js';
import * as Arcade from './games/arcade.js';

// --- UI Controller ---
window.gameUI = {
    openOverlay: (id) => {
        window.gameUI.closeAll();
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
        // Add logic for specific overlays (load shop items, etc) here
    },
    
    closeAll: () => {
        // Stop Games
        state.currentGame = null;
        Blackjack.cleanupBJ();
        Arcade.stopArcade();
        
        document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
        document.getElementById('menuDropdown').classList.remove('show');
    },

    launch: (game) => {
        window.gameUI.closeAll();
        // Open the specific overlay ID based on game name
        const map = {
            'blackjack': 'overlayBlackjack',
            'pong': 'overlayPong',
            'snake': 'overlaySnake',
            'geo': 'overlayGeo'
        };
        const el = document.getElementById(map[game]);
        if(el) el.classList.add('active');

        // Init Game Logic
        if (game === 'blackjack') {
            window.bjGame = Blackjack; // Expose for HTML buttons
            Blackjack.initBJ();
        } else if (game === 'pong') {
            Arcade.initPong();
        } else if (game === 'snake') {
            Arcade.initSnake();
        }
    },

    showGameOver: (score) => {
        window.gameUI.closeAll();
        setText('gameOverText', `SCORE: ${score}`);
        document.getElementById('modalGameOver').classList.add('active');
    }
};

// --- Input Handling ---
document.addEventListener('keydown', (e) => {
    state.keysPressed[e.key] = true;
    if (state.currentGame === 'snake') Arcade.handleSnakeKey(e.key);
});
document.addEventListener('keyup', (e) => state.keysPressed[e.key] = false);

// --- User System (Login/Register) ---

function getRank(money) {
    if(money < 500) return "RAT";
    if(money < 2000) return "SCRIPT KIDDIE";
    if(money < 5000) return "HACKER";
    if(money < 10000) return "GOONER";
    if(money < 50000) return "CYBER LORD";
    return "KINGPIN";
}

function updateUI() {
    setText('displayUser', state.myName);
    
    // Bank Display Animation
    const bankEl = document.getElementById('globalBank');
    const bankOverlayEl = document.getElementById('bankDisplay');
    const currentVal = parseInt(bankEl.innerText) || 0;
    
    if(currentVal !== state.myMoney) {
        bankEl.style.color = state.myMoney > currentVal ? '#0f0' : '#f00';
        setTimeout(() => bankEl.style.color = 'var(--accent)', 500);
    }
    
    bankEl.innerText = state.myMoney;
    if(bankOverlayEl) bankOverlayEl.innerText = state.myMoney;

    // Profile Overlay Data
    setText('profName', state.myName);
    setText('profBank', "$" + state.myMoney);
    setText('profWPM', (state.myStats.wpm||0) + " WPM");
    setText('profGames', state.myStats.games||0);
    setText('profUid', state.myUid ? state.myUid.substring(0,8) : "ERR");
    
    const rank = getRank(state.myMoney);
    setText('displayRank', "[" + rank + "]");
    setText('profRank', rank);
}

function loadProfile(data) {
    state.myName = data.name;
    state.myMoney = data.money;
    state.myStats = data.stats || {games:0, wpm:0, wins:0};
    state.myAchievements = data.achievements || [];
    state.myInventory = data.inventory || [];
    
    updateUI();
    
    // Hide Login Overlay & Save Local Storage
    document.getElementById('overlayLogin').classList.remove('active');
    localStorage.setItem('goonerUser', state.myName);
    localStorage.setItem('goonerPin', data.pin);
    
    showToast("WELCOME BACK", "🔓", state.myName);
    
    // Apply Inventory Effects (Simple version)
    if(state.myInventory.includes('item_matrix')) {
        document.getElementById('matrixCanvas').classList.add('active');
    }
}

async function login(username, pin) {
    try {
        const ref = doc(db, 'gooner_users', username.toUpperCase());
        const snap = await getDoc(ref);
        if(snap.exists()) {
            if(snap.data().pin === pin) {
                loadProfile(snap.data());
                return true;
            } else return "INVALID PIN";
        } else return "USER NOT FOUND";
    } catch(e) {
        return "ERROR: " + e.message;
    }
}

async function register(username, pin) {
    try {
        if(!state.myUid) return "WAITING FOR NETWORK...";
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
        return "REG ERROR: " + e.message;
    }
}

// --- Auth & Startup ---
const initAuth = async () => { 
    try { await signInAnonymously(auth); } catch (e) { console.error(e); } 
};

onAuthStateChanged(auth, async (u) => {
    if (u) {
        state.myUid = u.uid;
        console.log("Connected to Mainframe:", u.uid);
        
        // Auto-login check
        const savedUser = localStorage.getItem('goonerUser');
        const savedPin = localStorage.getItem('goonerPin');
        
        if (savedUser && savedPin) {
            login(savedUser, savedPin);
        }
    }
});

// Init
initAuth();

// --- Event Listeners ---

// Login Button
document.getElementById('btnLogin').onclick = async () => {
    const u = document.getElementById('usernameInput').value.trim();
    const p = document.getElementById('pinInput').value.trim();
    if(u.length < 3 || p.length < 4) return beep(200, 'sawtooth', 0.5);
    
    const res = await login(u, p);
    if(res === true) beep(600, 'square', 0.1);
    else {
        setText('loginMsg', res);
        beep(100, 'sawtooth', 0.5);
    }
};

// Register Button
document.getElementById('btnRegister').onclick = async () => {
    const u = document.getElementById('usernameInput').value.trim();
    const p = document.getElementById('pinInput').value.trim();
    if(u.length < 3 || p.length < 4) return;
    
    const res = await register(u, p);
    if(res === true) beep(600, 'square', 0.1);
    else {
        setText('loginMsg', res);
        beep(100, 'sawtooth', 0.5);
    }
};

// Logout (Needs HTML button with id='btnLogout')
const btnLogout = document.getElementById('btnLogout');
if(btnLogout) {
    btnLogout.onclick = () => {
        localStorage.clear();
        location.reload();
    };
}

// Blackjack Bindings
document.getElementById('bjDeck').onclick = Blackjack.handleDeckClick;
document.getElementById('bjHit').onclick = Blackjack.hit;
document.getElementById('bjStand').onclick = Blackjack.stand;

// Chip clicks
document.querySelectorAll('.bj-chip').forEach(c => {
    c.onclick = () => {
        let val = parseInt(c.dataset.v) || 0;
        let type = 'add';
        if(c.id === 'bjClear') type = 'clear';
        if(c.id === 'bjAllIn') type = 'all';
        Blackjack.handleChip(val, type);
    }
});
