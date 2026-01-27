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

// --- Auth & Startup ---
const initAuth = async () => { 
    try { await signInAnonymously(auth); } catch (e) { console.error(e); } 
};

onAuthStateChanged(auth, async (u) => {
    if (u) {
        state.myUid = u.uid;
        // Load User Data logic here (simplified for brevity)
        const ref = doc(db, 'gooner_users', "ANON"); // Replace with actual login logic
        // ... load data ...
    }
});

// Init
initAuth();

// --- Blackjack Event Binding (Since HTML buttons call window functions) ---
// Bind Blackjack buttons to the module functions
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
