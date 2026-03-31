import { state, showToast, beep, updateUI, saveStats, logTransaction } from "../core.js";

let betAmount = 10;
let betType = "player"; // "player", "banker", "tie"
let stage = "bet"; // "bet", "result"
let deck = [];

const SUITS = ["♠", "♥", "♦", "♣"];
const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function getCardValue(val) {
    if (["10", "J", "Q", "K"].includes(val)) return 0;
    if (val === "A") return 1;
    return parseInt(val, 10);
}

function buildDeck() {
    deck = [];
    for (let i = 0; i < 8; i++) { // 8 decks standard
        for (let s of SUITS) {
            for (let v of VALUES) {
                deck.push({ s, v, value: getCardValue(v) });
            }
        }
    }
    deck.sort(() => Math.random() - 0.5);
}

function drawCard() {
    if (deck.length < 10) buildDeck();
    return deck.pop();
}

function renderHand(hand, containerId) {
    const handDiv = document.getElementById(containerId);
    if (!handDiv) return;
    handDiv.innerHTML = "";
    hand.forEach((card) => {
        const cardEl = document.createElement("div");
        cardEl.className = "bj-card deal-anim";
        if (["♥", "♦"].includes(card.s)) cardEl.style.color = "#ff3d3d";
        cardEl.innerHTML = `<div>${card.v}</div><div style="font-size:24px;text-align:center">${card.s}</div><div style="text-align:right">${card.v}</div>`;
        handDiv.appendChild(cardEl);
    });
}

function calculateScore(hand) {
    const total = hand.reduce((sum, card) => sum + card.value, 0);
    return total % 10;
}

export function baccaratSetBet(val) {
    if (stage !== "bet" && stage !== "result") return;
    if (state.myMoney < val) {
        showToast("INSUFFICIENT FUNDS", "⚠️");
        return;
    }
    betAmount = val;
    beep(200, "sine", 0.05);
    updateUIState();
}

export function baccaratChangeBet(mult) {
    if (stage !== "bet" && stage !== "result") return;
    let newBet = Math.floor(betAmount * mult);
    if (newBet < 1) newBet = 1;
    if (newBet > state.myMoney) newBet = Math.floor(state.myMoney);
    baccaratSetBet(newBet);
}

export function baccaratMaxBet() {
    if (stage !== "bet" && stage !== "result") return;
    baccaratSetBet(Math.floor(state.myMoney));
}

export function baccaratSetType(type) {
    if (stage !== "bet" && stage !== "result") return;
    betType = type;
    updateUIState();
    beep(300, "square", 0.05);
}

export function baccaratAction() {
    if (stage === "bet" || stage === "result") {
        if (state.myMoney < betAmount) {
            showToast("INSUFFICIENT FUNDS", "⚠️");
            return;
        }

        state.myMoney -= betAmount;
        logTransaction(`BACCARAT BET ON ${betType.toUpperCase()}`, -betAmount);

        const playerHand = [drawCard(), drawCard()];
        const bankerHand = [drawCard(), drawCard()];

        let pScore = calculateScore(playerHand);
        let bScore = calculateScore(bankerHand);

        // Third card drawing rules (simplified slightly for quick play, but generally standard)
        let playerDrew = false;
        let pThirdCardValue = -1;

        if (pScore <= 5 && bScore < 8) {
            const newCard = drawCard();
            playerHand.push(newCard);
            pScore = calculateScore(playerHand);
            playerDrew = true;
            pThirdCardValue = newCard.value;
        }

        if (bScore < 8 && pScore < 8) { // Neither has a natural 8 or 9
             let bankerDraws = false;
             if (!playerDrew) {
                 if (bScore <= 5) bankerDraws = true;
             } else {
                 if (bScore <= 2) bankerDraws = true;
                 else if (bScore === 3 && pThirdCardValue !== 8) bankerDraws = true;
                 else if (bScore === 4 && pThirdCardValue >= 2 && pThirdCardValue <= 7) bankerDraws = true;
                 else if (bScore === 5 && pThirdCardValue >= 4 && pThirdCardValue <= 7) bankerDraws = true;
                 else if (bScore === 6 && pThirdCardValue >= 6 && pThirdCardValue <= 7) bankerDraws = true;
             }

             if (bankerDraws) {
                 bankerHand.push(drawCard());
                 bScore = calculateScore(bankerHand);
             }
        }

        renderHand(playerHand, "bacPlayerHand");
        renderHand(bankerHand, "bacBankerHand");

        document.getElementById("bacPlayerScore").innerText = pScore;
        document.getElementById("bacBankerScore").innerText = bScore;

        let result = "tie";
        if (pScore > bScore) result = "player";
        else if (bScore > pScore) result = "banker";

        let winAmount = 0;
        let resultText = "";

        if (result === betType) {
            if (betType === "player") winAmount = betAmount * 2;
            else if (betType === "banker") winAmount = Math.floor(betAmount * 1.95); // 5% commission
            else if (betType === "tie") winAmount = betAmount * 9; // 8:1 payout

            resultText = `${result.toUpperCase()} WINS! YOU WIN`;
            state.myMoney += winAmount;
            logTransaction(`BACCARAT WIN`, winAmount);
            beep(600, "triangle", 0.2);
            setTimeout(() => beep(800, "triangle", 0.3), 200);
        } else if (result === "tie" && betType !== "tie") {
            // Push
            winAmount = betAmount;
            state.myMoney += betAmount;
            resultText = "TIE! PUSH";
            beep(300, "square", 0.1);
        } else {
            resultText = `${result.toUpperCase()} WINS! YOU LOSE`;
            beep(150, "sawtooth", 0.4);
        }

        const msg = document.getElementById("bacMessage");
        if (msg) {
            msg.innerText = resultText;
            msg.className = winAmount > betAmount ? "roulette-message win" : (winAmount === betAmount ? "roulette-message" : "roulette-message loss");
        }

        stage = "result";
        updateUIState();
        saveStats();
        updateUI();
    }
}

function updateUIState() {
    const betVal = document.getElementById("bacBetVal");

    if (betVal) betVal.innerText = betAmount;

    ["player", "banker", "tie"].forEach(type => {
        const btn = document.getElementById(`bacType_${type}`);
        if (btn) {
            btn.style.borderColor = betType === type ? "#0f0" : "var(--accent)";
            btn.style.color = betType === type ? "#0f0" : "var(--accent)";
        }
    });

    if (stage === "bet") {
        document.getElementById("bacMessage").innerText = "PLACE YOUR BET";
        document.getElementById("bacMessage").className = "roulette-message";
        document.getElementById("bacActionBtn").innerText = "DEAL";
    } else {
        document.getElementById("bacActionBtn").innerText = "PLAY AGAIN";
    }

    document.getElementById("bacBalance").innerText = state.myMoney.toFixed(2);
}

export function initBaccarat() {
    stage = "bet";
    betType = "player";
    buildDeck();

    document.getElementById("bacPlayerHand").innerHTML = "";
    document.getElementById("bacBankerHand").innerHTML = "";
    document.getElementById("bacPlayerScore").innerText = "-";
    document.getElementById("bacBankerScore").innerText = "-";

    window.baccaratSetBet = baccaratSetBet;
    window.baccaratChangeBet = baccaratChangeBet;
    window.baccaratMaxBet = baccaratMaxBet;
    window.baccaratSetType = baccaratSetType;
    window.baccaratAction = baccaratAction;

    updateUIState();
}
