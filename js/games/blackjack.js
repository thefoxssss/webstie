import { db } from '../config.js';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { beep, setText, showToast } from '../utils.js';

let bjMode = 'solo', bjDeck = [], bjPlayerHand = [], bjDealerHand = [];
let bjCurrentBet = 0, bjRoomCode = null, bjRoomUnsub = null, bjMySeatIdx = -1;
let soloRounds = 0;
const suits = ['♠', '♥', '♦', '♣'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function initBJ(System) {
    bjCurrentBet = 0;
    document.getElementById('bjMode').style.display = 'flex';
    document.getElementById('bjNetMenu').style.display = 'none';
    document.getElementById('bjLobby').style.display = 'none';
    document.getElementById('bjTable').style.display = 'none';
    updateUI(System);
}

export function cleanupBJ() {
    if (bjRoomUnsub) bjRoomUnsub();
    bjRoomUnsub = null;
    bjRoomCode = null;
    bjMySeatIdx = -1;
}

// --- UTILS ---
function createDeck() {
    let d = [];
    for (let s of suits) for (let v of values) d.push({ s, v, h: false });
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

function updateUI(System) {
    setText('bjBetVal', bjCurrentBet);
    setText('globalBank', System.money); // Assuming System has .money getter
    
    // Trigger System save
    System.saveStats();
}

// --- SOLO MODE ---
export function selectMode(mode, System) {
    bjMode = mode;
    document.getElementById('bjMode').style.display = 'none';
    if (mode === 'solo') {
        document.getElementById('bjTable').style.display = 'flex';
        setText('bjHostLabel', "DEALER");
        document.querySelector('.bj-pot-display').style.display = 'none';
        document.getElementById('bjSide').innerHTML = '';
        startSoloBetting(System);
    } else {
        document.querySelector('.bj-pot-display').style.display = 'block';
        document.getElementById('bjNetMenu').style.display = 'flex';
    }
    beep(400, 'square', 0.1);
}

function startSoloBetting(System) {
    bjPlayerHand = []; bjDealerHand = []; bjCurrentBet = 0;
    document.getElementById('bjPlayerHand').innerHTML = '';
    document.getElementById('bjDealerHand').innerHTML = '';
    setText('bjPlayerScore', ''); setText('bjDealerScore', '');
    setText('bjMessage', 'PLACE BET & CLICK DECK');
    document.getElementById('bjGameBtns').style.display = 'none';
    document.getElementById('bjBetBtns').style.visibility = 'visible';
    document.querySelector('#bjDeck div:last-child').innerText = "DEAL";
    updateUI(System);
}

// Called by Main when Deck is clicked
export function handleDeckClick(System) {
    if (bjMode === 'solo') {
        if (document.getElementById('bjMessage').innerText.includes('PLACE')) {
            startSoloRound(System);
        } else {
            // New Round
            startSoloBetting(System);
        }
    } else {
        // Networking Deck Click Logic here
    }
}

async function startSoloRound(System) {
    if (bjCurrentBet <= 0) return beep(200, 'sawtooth', 0.5);
    
    // Deduct Money
    System.deductMoney(bjCurrentBet);
    
    document.getElementById('bjBetBtns').style.visibility = 'hidden';
    bjDeck = createDeck();
    bjPlayerHand = [bjDeck.pop(), bjDeck.pop()];
    bjDealerHand = [bjDeck.pop(), bjDeck.pop()];

    // Render Player
    bjPlayerHand.forEach(c => renderNewCard(c, 'bjPlayerHand'));
    setText('bjPlayerScore', calcHand(bjPlayerHand));

    // Render Dealer (One hidden)
    const dDiv = document.getElementById('bjDealerHand');
    dDiv.innerHTML = '';
    renderNewCard(bjDealerHand[0], 'bjDealerHand');
    
    let hideDealer = !System.inventory.includes('item_xray');
    renderNewCard(bjDealerHand[1], 'bjDealerHand', hideDealer);
    
    if(!hideDealer) setText('bjDealerScore', calcHand(bjDealerHand));

    document.getElementById('bjGameBtns').style.display = 'flex';
    setText('bjMessage', "YOUR TURN");

    if (calcHand(bjPlayerHand) === 21) endSolo(System);
}

export function handleHit(System) {
    const c = bjDeck.pop();
    bjPlayerHand.push(c);
    renderNewCard(c, 'bjPlayerHand');
    setText('bjPlayerScore', calcHand(bjPlayerHand));
    if (calcHand(bjPlayerHand) > 21) endSolo(System);
}

export async function handleStand(System) {
    document.getElementById('bjGameBtns').style.display = 'none';
    
    // Reveal Dealer
    const dDiv = document.getElementById('bjDealerHand');
    dDiv.innerHTML = '';
    bjDealerHand.forEach(c => renderNewCard(c, 'bjDealerHand'));
    setText('bjDealerScore', calcHand(bjDealerHand));

    // AI Logic
    while (calcHand(bjDealerHand) < 17) {
        await new Promise(r => setTimeout(r, 600));
        let c = bjDeck.pop();
        bjDealerHand.push(c);
        renderNewCard(c, 'bjDealerHand');
        setText('bjDealerScore', calcHand(bjDealerHand));
    }
    endSolo(System);
}

function endSolo(System) {
    document.getElementById('bjGameBtns').style.display = 'none';
    let ps = calcHand(bjPlayerHand);
    let ds = calcHand(bjDealerHand);
    let msg = "", win = 0;

    if (ps > 21) { msg = "YOU BUST!"; win = 0; }
    else if (ds > 21) { msg = "DEALER BUST! WIN"; win = bjCurrentBet * 2; }
    else if (ps > ds) { msg = "YOU WIN!"; win = bjCurrentBet * 2; }
    else if (ps < ds) { msg = "YOU LOSE"; win = 0; }
    else { msg = "PUSH"; win = bjCurrentBet; }

    setText('bjMessage', msg);
    
    if (win > 0) System.addMoney(win);
    
    if (win >= 1000) System.unlockAchievement('high_roller');
    soloRounds++;
    if (soloRounds === 10) System.unlockAchievement('lonely');

    updateUI(System);
    bjCurrentBet = 0;
    document.querySelector('#bjDeck div:last-child').innerText = "AGAIN";

    if (System.money <= 0 && win === 0) {
        setTimeout(() => System.triggerGameOver('blackjack', 0), 1500);
    }
}

export function placeBet(amount, System) {
    if(amount === 'CLEAR') bjCurrentBet = 0;
    else if(amount === 'ALL') bjCurrentBet = System.money;
    else if(System.money >= bjCurrentBet + amount) bjCurrentBet += amount;
    
    updateUI(System);
}
