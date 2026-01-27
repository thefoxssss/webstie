import { db, state } from '../config.js';
import { beep, setText, saveStats, showToast } from '../utils.js';
import { doc, getDoc, updateDoc, setDoc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Game specific variables
let bjMode = 'solo';
let bjDeck = [];
let bjPlayerHand = [];
let bjDealerHand = [];
let bjCurrentBet = 0;
let bjRoomCode = null;
let bjRoomUnsub = null;
let bjMySeatIdx = -1;
let soloRounds = 0;

const suits = ['♠','♥','♦','♣'];
const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

// Main Entry Point
export function initBJ() {
    state.currentGame = 'blackjack';
    bjCurrentBet = 0;
    document.getElementById('bjMode').style.display = 'flex';
    document.getElementById('bjNetMenu').style.display = 'none';
    document.getElementById('bjLobby').style.display = 'none';
    document.getElementById('bjTable').style.display = 'none';
    updateUI();
}

export function cleanupBJ() {
    if (bjRoomUnsub) bjRoomUnsub();
    bjRoomUnsub = null;
    bjRoomCode = null;
    bjMySeatIdx = -1;
}

export function selectMode(mode) {
    bjMode = mode;
    document.getElementById('bjMode').style.display = 'none';
    if (mode === 'solo') {
        document.getElementById('bjTable').style.display = 'flex';
        setText('bjHostLabel', "DEALER");
        document.querySelector('.bj-pot-display').style.display = 'none';
        document.getElementById('bjSide').innerHTML = '';
        startSoloBetting();
    } else {
        document.querySelector('.bj-pot-display').style.display = 'block';
        document.getElementById('bjNetMenu').style.display = 'flex';
    }
    beep(400, 'square', 0.1);
}

function startSoloBetting() {
    bjPlayerHand = [];
    bjDealerHand = [];
    bjCurrentBet = 0;
    document.getElementById('bjPlayerHand').innerHTML = '';
    document.getElementById('bjDealerHand').innerHTML = '';
    setText('bjPlayerScore', '');
    setText('bjDealerScore', '');
    setText('bjMessage', 'PLACE BET & CLICK DECK');
    document.getElementById('bjGameBtns').style.display = 'none';
    document.getElementById('bjBetBtns').style.visibility = 'visible';
    document.querySelector('#bjDeck div:last-child').innerText = "DEAL";
    updateUI();
}

function updateUI() {
    setText('bjBetVal', bjCurrentBet);
    setText('globalBank', state.myMoney);
    saveStats();
}

// --- Deck Logic ---
function createDeck() {
    let d = [];
    for (let s of suits)
        for (let v of values) d.push({ s, v, h: false });
    return d.sort(() => Math.random() - .5);
}

function calcHand(h) {
    let s = 0, a = 0;
    h.forEach(c => {
        if (c.h) return;
        if (['J', 'Q', 'K'].includes(c.v)) s += 10;
        else if (c.v === 'A') { s += 11; a++; }
        else s += parseInt(c.v);
    });
    while (s > 21 && a > 0) { s -= 10; a--; }
    return s;
}

function renderNewCard(c, elId, hidden = false) {
    const d = document.createElement('div');
    d.className = 'bj-card' + (hidden ? ' hidden' : '');
    d.innerHTML = `<div>${c.v}</div><div>${c.s}</div><div>${c.v}</div>`;
    d.style.color = ['♥', '♦'].includes(c.s) ? 'red' : 'inherit';
    document.getElementById(elId).appendChild(d);
}

// --- Solo Logic ---
export async function handleDeckClick() {
    if (state.currentGame !== 'blackjack') return;
    if (bjMode === 'solo') {
        if (document.getElementById('bjMessage').innerText.includes('PLACE')) {
            startSoloRound();
        } else if (document.getElementById('bjMessage').innerText.includes('AGAIN')) {
            startSoloBetting();
        }
        return;
    }
    // Network logic would go here
}

async function startSoloRound() {
    if (bjCurrentBet <= 0) return beep(200, 'sawtooth', 0.5);
    state.myMoney -= bjCurrentBet; // Deduct immediately
    document.getElementById('bjBetBtns').style.visibility = 'hidden';
    bjDeck = createDeck();
    bjPlayerHand = [bjDeck.pop(), bjDeck.pop()];
    bjDealerHand = [bjDeck.pop(), bjDeck.pop()];
    
    // Render
    document.getElementById('bjPlayerHand').innerHTML = '';
    document.getElementById('bjDealerHand').innerHTML = '';
    
    bjPlayerHand.forEach(c => renderNewCard(c, 'bjPlayerHand'));
    renderNewCard(bjDealerHand[0], 'bjDealerHand');
    
    let hideDealer = !state.myInventory.includes('item_xray');
    renderNewCard(bjDealerHand[1], 'bjDealerHand', hideDealer);
    
    setText('bjPlayerScore', calcHand(bjPlayerHand));
    setText('bjDealerScore', hideDealer ? '' : calcHand(bjDealerHand));
    
    document.getElementById('bjGameBtns').style.display = 'flex';
    setText('bjMessage', "YOUR TURN");
    if (calcHand(bjPlayerHand) === 21) endSolo();
}

export function hit() {
    if(bjMode === 'solo') {
        const c = bjDeck.pop();
        bjPlayerHand.push(c);
        renderNewCard(c, 'bjPlayerHand');
        setText('bjPlayerScore', calcHand(bjPlayerHand));
        if (calcHand(bjPlayerHand) > 21) endSolo();
    }
}

export function stand() {
    if(bjMode === 'solo') {
        document.getElementById('bjGameBtns').style.display = 'none';
        // Reveal Dealer
        document.getElementById('bjDealerHand').innerHTML = '';
        bjDealerHand.forEach(c => renderNewCard(c, 'bjDealerHand'));
        
        while (calcHand(bjDealerHand) < 17) {
            let c = bjDeck.pop();
            bjDealerHand.push(c);
            renderNewCard(c, 'bjDealerHand');
        }
        setText('bjDealerScore', calcHand(bjDealerHand));
        endSolo();
    }
}

function endSolo() {
    document.getElementById('bjGameBtns').style.display = 'none';
    let ps = calcHand(bjPlayerHand), ds = calcHand(bjDealerHand);
    let msg = "", win = 0;

    if (ps > 21) { msg = "YOU BUST!"; win = 0; }
    else if (ds > 21) { msg = "DEALER BUST! WIN"; win = bjCurrentBet * 2; }
    else if (ps > ds) { msg = "YOU WIN!"; win = bjCurrentBet * 2; }
    else if (ps < ds) { msg = "YOU LOSE"; win = 0; }
    else { msg = "PUSH"; win = bjCurrentBet; }

    setText('bjMessage', msg);
    state.myMoney += win;
    updateUI();
    bjCurrentBet = 0;
    document.querySelector('#bjDeck div:last-child').innerText = "AGAIN";
}

// Chip Handler
export function handleChip(val, type) {
    if(type === 'clear') bjCurrentBet = 0;
    else if(type === 'all') bjCurrentBet = state.myMoney;
    else if(state.myMoney >= bjCurrentBet + val) bjCurrentBet += val;
    updateUI();
}
