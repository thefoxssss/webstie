import { auth, db } from './config.js';
import { beep, setText, showToast } from './utils.js';
// Import your games
import { initSnake, stopSnake, handleSnakeKey } from './games/snake.js';
// import { initPong... } from './games/pong.js'; (Do this for all games)

// Global State
let myName = "ANON";
let myMoney = 1000;
let myInventory = [];
let currentGame = null;

// The System Object passed to games
const System = {
    get inventory() { return myInventory; },
    updateHighScore: (game, score) => { /* logic here */ },
    triggerGameOver: (game, score) => { 
        showGameOver(game, score); 
    },
    unlockAchievement: (id) => { /* logic here */ }
};

// --- GLOBAL EXPORTS (So HTML buttons work) ---
window.launchGame = (gameId) => {
    window.closeOverlays();
    const el = document.getElementById('overlay' + capitalize(gameId));
    if(el) el.classList.add('active');
    
    currentGame = gameId;

    if(gameId === 'snake') initSnake(System);
    // if(gameId === 'pong') initPong(System);
};

window.closeOverlays = () => {
    // Stop all games
    stopSnake(); 
    // stopPong();
    
    document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
    currentGame = null;
};

// Input Listener for all games
document.addEventListener('keydown', (e) => {
    if(currentGame === 'snake') handleSnakeKey(e.key);
});

// ... Add your Auth/Login logic here ...

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
