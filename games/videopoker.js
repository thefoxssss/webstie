import { state, showToast, beep, updateUI, saveStats, logTransaction, showGameOver } from "../core.js";

let betAmount = 10;
let deck = [];
let hand = [];
let held = [false, false, false, false, false];
let stage = "bet"; // "bet", "draw", "result"

const SUITS = ["♠", "♥", "♦", "♣"];
const VALUES = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

function getCardValue(val) {
    if (val === "J") return 11;
    if (val === "Q") return 12;
    if (val === "K") return 13;
    if (val === "A") return 14;
    return parseInt(val, 10);
}

function buildDeck() {
    deck = [];
    for (let s of SUITS) {
        for (let v of VALUES) {
            deck.push({ s, v, value: getCardValue(v) });
        }
    }
    deck.sort(() => Math.random() - 0.5);
}

function drawCard() {
    return deck.pop();
}

function renderHand() {
    const handDiv = document.getElementById("vpHand");
    if (!handDiv) return;
    handDiv.innerHTML = "";
    hand.forEach((card, i) => {
        const cardEl = document.createElement("div");
        cardEl.className = "bj-card";
        if (["♥", "♦"].includes(card.s)) cardEl.style.color = "#ff3d3d";

        cardEl.innerHTML = `<div>${card.v}</div><div style="font-size:24px;text-align:center">${card.s}</div><div style="text-align:right">${card.v}</div>`;

        if (held[i]) {
            cardEl.style.borderColor = "#0f0";
            cardEl.style.boxShadow = "0 0 10px #0f0";
        }

        cardEl.onclick = () => {
            if (stage !== "draw") return;
            held[i] = !held[i];
            renderHand();
            beep(400, "square", 0.05);
        };

        handDiv.appendChild(cardEl);
    });
}

function evaluateHand(handCards) {
    const counts = {};
    const suits = {};
    let isFlush = true;
    let isStraight = false;

    handCards.forEach(c => {
        counts[c.value] = (counts[c.value] || 0) + 1;
        suits[c.s] = (suits[c.s] || 0) + 1;
    });

    if (Object.keys(suits).length > 1) isFlush = false;

    const vals = handCards.map(c => c.value).sort((a,b) => a - b);

    if (vals[4] - vals[0] === 4 && new Set(vals).size === 5) {
        isStraight = true;
    } else if (vals.join(",") === "2,3,4,5,14") { // A,2,3,4,5
        isStraight = true;
    }

    const pairs = Object.values(counts).filter(c => c === 2).length;
    const threes = Object.values(counts).filter(c => c === 3).length;
    const fours = Object.values(counts).filter(c => c === 4).length;

    const hasJacksOrBetter = Object.entries(counts).some(([val, count]) => count >= 2 && parseInt(val) >= 11);

    if (isFlush && isStraight && vals[4] === 14 && vals[0] === 10) return { name: "ROYAL FLUSH", mult: 250 };
    if (isFlush && isStraight) return { name: "STRAIGHT FLUSH", mult: 50 };
    if (fours === 1) return { name: "FOUR OF A KIND", mult: 25 };
    if (threes === 1 && pairs === 1) return { name: "FULL HOUSE", mult: 9 };
    if (isFlush) return { name: "FLUSH", mult: 6 };
    if (isStraight) return { name: "STRAIGHT", mult: 4 };
    if (threes === 1) return { name: "THREE OF A KIND", mult: 3 };
    if (pairs === 2) return { name: "TWO PAIR", mult: 2 };
    if (hasJacksOrBetter) return { name: "JACKS OR BETTER", mult: 1 };

    return { name: "NOTHING", mult: 0 };
}

function updateUIState() {
    const msg = document.getElementById("vpMessage");
    const betVal = document.getElementById("vpBetVal");
    const actionBtn = document.getElementById("vpActionBtn");

    if (betVal) betVal.innerText = betAmount;

    if (stage === "bet") {
        if (msg) msg.innerText = "PLACE YOUR BET";
        if (msg) msg.className = "roulette-message";
        if (actionBtn) {
            actionBtn.innerText = "DEAL";
            actionBtn.disabled = false;
        }
        document.getElementById("vpBetBtns").style.display = "block";
    } else if (stage === "draw") {
        if (msg) msg.innerText = "SELECT CARDS TO HOLD";
        if (msg) msg.className = "roulette-message";
        if (actionBtn) {
            actionBtn.innerText = "DRAW";
            actionBtn.disabled = false;
        }
        document.getElementById("vpBetBtns").style.display = "none";
    } else if (stage === "result") {
        const res = evaluateHand(hand);
        if (msg) {
            msg.innerText = `${res.name} (x${res.mult})`;
            msg.className = res.mult > 0 ? "roulette-message win" : "roulette-message loss";
        }
        if (actionBtn) {
            actionBtn.innerText = "NEW GAME";
            actionBtn.disabled = false;
        }
        document.getElementById("vpBetBtns").style.display = "block";
    }

    document.getElementById("vpBalance").innerText = state.myMoney.toFixed(2);
}

export function vpSetBet(val) {
    if (stage !== "bet" && stage !== "result") return;
    if (state.myMoney < val) {
        showToast("INSUFFICIENT FUNDS", "⚠️");
        return;
    }
    betAmount = val;
    beep(200, "sine", 0.05);
    updateUIState();
}

export function vpChangeBet(mult) {
    if (stage !== "bet" && stage !== "result") return;
    let newBet = Math.floor(betAmount * mult);
    if (newBet < 1) newBet = 1;
    if (newBet > state.myMoney) newBet = Math.floor(state.myMoney);
    vpSetBet(newBet);
}

export function vpMaxBet() {
    if (stage !== "bet" && stage !== "result") return;
    vpSetBet(Math.floor(state.myMoney));
}

export function vpAction() {
    if (stage === "bet" || stage === "result") {
        if (state.myMoney < betAmount) {
            showToast("INSUFFICIENT FUNDS", "⚠️");
            return;
        }

        state.myMoney -= betAmount;
        logTransaction("VIDEO POKER BET", -betAmount);

        buildDeck();
        hand = [drawCard(), drawCard(), drawCard(), drawCard(), drawCard()];
        held = [false, false, false, false, false];

        stage = "draw";
        beep(300, "square", 0.1);
        renderHand();
        updateUIState();
        saveStats();
        updateUI();
    } else if (stage === "draw") {
        for (let i = 0; i < 5; i++) {
            if (!held[i]) {
                hand[i] = drawCard();
            }
        }

        stage = "result";
        renderHand();

        const res = evaluateHand(hand);
        const winAmount = betAmount * res.mult;

        if (winAmount > 0) {
            state.myMoney += betAmount + winAmount; // Return bet + win
            logTransaction(`VIDEO POKER WIN: ${res.name}`, winAmount);
            beep(600, "triangle", 0.2);
            setTimeout(() => beep(800, "triangle", 0.3), 200);
        } else {
            beep(150, "sawtooth", 0.4);
        }

        updateUIState();
        saveStats();
        updateUI();
    }
}

export function initVideoPoker() {
    stage = "bet";
    hand = [];
    held = [false, false, false, false, false];
    const handDiv = document.getElementById("vpHand");
    if (handDiv) handDiv.innerHTML = "";

    // Bind buttons
    window.vpSetBet = vpSetBet;
    window.vpChangeBet = vpChangeBet;
    window.vpMaxBet = vpMaxBet;
    window.vpAction = vpAction;

    updateUIState();
}
