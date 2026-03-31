import { state, showToast, beep, updateUI, saveStats, logTransaction } from "../core.js";

let betAmount = 10;
let point = null;
let stage = "come_out"; // "come_out", "point"

export function crapsSetBet(val) {
    if (stage !== "come_out") {
        showToast("BET ONLY ON COME OUT ROLL", "⚠️");
        return;
    }
    if (state.myMoney < val) {
        showToast("INSUFFICIENT FUNDS", "⚠️");
        return;
    }
    betAmount = val;
    beep(200, "sine", 0.05);
    updateUIState();
}

export function crapsChangeBet(mult) {
    if (stage !== "come_out") return;
    let newBet = Math.floor(betAmount * mult);
    if (newBet < 1) newBet = 1;
    if (newBet > state.myMoney) newBet = Math.floor(state.myMoney);
    crapsSetBet(newBet);
}

export function crapsMaxBet() {
    if (stage !== "come_out") return;
    crapsSetBet(Math.floor(state.myMoney));
}

function rollDice() {
    return Math.floor(Math.random() * 6) + 1;
}

export function crapsAction() {
    if (stage === "come_out") {
        if (state.myMoney < betAmount) {
            showToast("INSUFFICIENT FUNDS", "⚠️");
            return;
        }
        state.myMoney -= betAmount;
        logTransaction("CRAPS PASS LINE BET", -betAmount);
    }

    const d1 = rollDice();
    const d2 = rollDice();
    const total = d1 + d2;

    document.getElementById("crapsDice1").innerText = d1;
    document.getElementById("crapsDice2").innerText = d2;

    const msg = document.getElementById("crapsMessage");
    let resultText = "";
    let winAmount = 0;

    if (stage === "come_out") {
        if (total === 7 || total === 11) {
            winAmount = betAmount * 2;
            resultText = `ROLLED ${total} - NATURAL! YOU WIN`;
            stage = "come_out";
        } else if (total === 2 || total === 3 || total === 12) {
            resultText = `ROLLED ${total} - CRAPS! YOU LOSE`;
            stage = "come_out";
        } else {
            point = total;
            resultText = `POINT ESTABLISHED: ${point}`;
            stage = "point";
            document.getElementById("crapsPointText").innerText = point;
        }
    } else if (stage === "point") {
        if (total === point) {
            winAmount = betAmount * 2;
            resultText = `HIT POINT ${point}! YOU WIN`;
            stage = "come_out";
            point = null;
            document.getElementById("crapsPointText").innerText = "OFF";
        } else if (total === 7) {
            resultText = `SEVEN OUT! YOU LOSE`;
            stage = "come_out";
            point = null;
            document.getElementById("crapsPointText").innerText = "OFF";
        } else {
            resultText = `ROLLED ${total} - ROLL AGAIN`;
        }
    }

    if (msg) {
        msg.innerText = resultText;
        msg.className = winAmount > 0 ? "roulette-message win" : (resultText.includes("LOSE") ? "roulette-message loss" : "roulette-message");
    }

    if (winAmount > 0) {
        state.myMoney += winAmount;
        logTransaction(`CRAPS WIN: ${total}`, winAmount);
        beep(600, "triangle", 0.2);
        setTimeout(() => beep(800, "triangle", 0.3), 200);
    } else if (resultText.includes("LOSE")) {
        beep(150, "sawtooth", 0.4);
    } else {
        beep(300, "square", 0.1);
    }

    updateUIState();
    saveStats();
    updateUI();
}

function updateUIState() {
    const betVal = document.getElementById("crapsBetVal");
    const actionBtn = document.getElementById("crapsActionBtn");
    const betBtns = document.getElementById("crapsBetBtns");

    if (betVal) betVal.innerText = betAmount;

    if (stage === "come_out") {
        if (actionBtn) actionBtn.innerText = "COME OUT ROLL";
        if (betBtns) betBtns.style.opacity = "1";
        if (betBtns) betBtns.style.pointerEvents = "auto";
    } else if (stage === "point") {
        if (actionBtn) actionBtn.innerText = "ROLL DICE";
        if (betBtns) betBtns.style.opacity = "0.5";
        if (betBtns) betBtns.style.pointerEvents = "none";
    }

    document.getElementById("crapsBalance").innerText = state.myMoney.toFixed(2);
}

export function initCraps() {
    stage = "come_out";
    point = null;
    document.getElementById("crapsDice1").innerText = "?";
    document.getElementById("crapsDice2").innerText = "?";
    document.getElementById("crapsPointText").innerText = "OFF";

    window.crapsSetBet = crapsSetBet;
    window.crapsChangeBet = crapsChangeBet;
    window.crapsMaxBet = crapsMaxBet;
    window.crapsAction = crapsAction;

    updateUIState();
}
