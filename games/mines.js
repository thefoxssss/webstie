import { state, showToast, beep, updateUI, saveStats, logTransaction } from "../core.js";

let betAmount = 10;
let mineCount = 3;
let stage = "bet"; // "bet", "play", "result"
let grid = [];
let revealed = [];
let safeClicks = 0;

const GRID_SIZE = 25; // 5x5

export function minesSetBet(val) {
    if (stage !== "bet" && stage !== "result") return;
    if (state.myMoney < val) {
        showToast("INSUFFICIENT FUNDS", "⚠️");
        return;
    }
    betAmount = val;
    beep(200, "sine", 0.05);
    updateUIState();
}

export function minesChangeBet(mult) {
    if (stage !== "bet" && stage !== "result") return;
    let newBet = Math.floor(betAmount * mult);
    if (newBet < 1) newBet = 1;
    if (newBet > state.myMoney) newBet = Math.floor(state.myMoney);
    minesSetBet(newBet);
}

export function minesMaxBet() {
    if (stage !== "bet" && stage !== "result") return;
    minesSetBet(Math.floor(state.myMoney));
}

export function minesSetMines(count) {
    if (stage !== "bet" && stage !== "result") return;
    mineCount = count;
    updateUIState();
    beep(300, "square", 0.05);
}

function calculateMultiplier(safeFound, totalMines) {
    // Basic combination formula for odds
    let mult = 1;
    let remainingSafe = GRID_SIZE - totalMines;
    let remainingTotal = GRID_SIZE;

    for (let i = 0; i < safeFound; i++) {
        mult *= remainingTotal / remainingSafe;
        remainingSafe--;
        remainingTotal--;
    }

    // House edge ~5%
    return (mult * 0.95).toFixed(2);
}

export function minesAction() {
    if (stage === "bet" || stage === "result") {
        if (state.myMoney < betAmount) {
            showToast("INSUFFICIENT FUNDS", "⚠️");
            return;
        }

        state.myMoney -= betAmount;
        logTransaction(`MINES BET (${mineCount} MINES)`, -betAmount);

        // Build grid
        grid = new Array(GRID_SIZE).fill(false);
        revealed = new Array(GRID_SIZE).fill(false);
        safeClicks = 0;

        let minesPlaced = 0;
        while (minesPlaced < mineCount) {
            let idx = Math.floor(Math.random() * GRID_SIZE);
            if (!grid[idx]) {
                grid[idx] = true;
                minesPlaced++;
            }
        }

        stage = "play";
        beep(300, "square", 0.1);
        renderGrid();
        updateUIState();
        saveStats();
        updateUI();
    } else if (stage === "play") {
        // Cash out
        if (safeClicks === 0) return;

        const mult = calculateMultiplier(safeClicks, mineCount);
        const winAmount = Math.floor(betAmount * parseFloat(mult));

        state.myMoney += winAmount;
        logTransaction(`MINES CASH OUT`, winAmount);
        beep(600, "triangle", 0.2);
        setTimeout(() => beep(800, "triangle", 0.3), 200);

        document.getElementById("minesMessage").innerText = `CASHED OUT: $${winAmount} (x${mult})`;
        document.getElementById("minesMessage").className = "roulette-message win";

        stage = "result";
        renderGrid(true); // Reveal all
        updateUIState();
        saveStats();
        updateUI();
    }
}

function clickCell(idx) {
    if (stage !== "play") return;
    if (revealed[idx]) return;

    revealed[idx] = true;

    if (grid[idx]) { // Hit a mine
        document.getElementById("minesMessage").innerText = "BOOM! YOU LOSE";
        document.getElementById("minesMessage").className = "roulette-message loss";
        beep(150, "sawtooth", 0.4);
        stage = "result";
        renderGrid(true);
        updateUIState();
    } else {
        safeClicks++;
        beep(500 + (safeClicks * 50), "sine", 0.1);

        if (safeClicks === GRID_SIZE - mineCount) { // Won all safe spots
            minesAction(); // Auto cash out
            return;
        }

        renderGrid();
        updateUIState();
    }
}

window.minesClickCell = clickCell;

function renderGrid(revealAll = false) {
    const gridDiv = document.getElementById("minesGrid");
    if (!gridDiv) return;

    gridDiv.innerHTML = "";
    for (let i = 0; i < GRID_SIZE; i++) {
        const cell = document.createElement("button");
        cell.className = "mines-cell";

        if (revealed[i] || revealAll) {
            cell.classList.add("revealed");
            if (grid[i]) {
                cell.innerText = "💣";
                cell.style.background = "#ff3d3d";
                cell.style.color = "#fff";
                if (revealed[i]) cell.style.boxShadow = "0 0 15px #ff3d3d"; // The one they clicked
            } else {
                cell.innerText = "💎";
                cell.style.background = "#0f0";
                cell.style.color = "#000";
            }
        } else {
            cell.innerText = "";
            cell.onclick = () => clickCell(i);
        }

        gridDiv.appendChild(cell);
    }
}

function updateUIState() {
    const betVal = document.getElementById("minesBetVal");
    if (betVal) betVal.innerText = betAmount;

    document.getElementById("minesCountText").innerText = mineCount;

    if (stage === "bet") {
        document.getElementById("minesMessage").innerText = "PLACE YOUR BET";
        document.getElementById("minesMessage").className = "roulette-message";
        document.getElementById("minesActionBtn").innerText = "START GAME";
        document.getElementById("minesActionBtn").disabled = false;
        document.getElementById("minesBetBtns").style.display = "block";
        document.getElementById("minesCountBtns").style.display = "flex";
        document.getElementById("minesNextWin").innerText = "-";
        document.getElementById("minesTotalWin").innerText = "-";
    } else if (stage === "play") {
        document.getElementById("minesMessage").innerText = "PICK A TILE";
        document.getElementById("minesMessage").className = "roulette-message";

        const nextMult = calculateMultiplier(safeClicks + 1, mineCount);
        const currMult = calculateMultiplier(safeClicks, mineCount);

        document.getElementById("minesActionBtn").innerText = safeClicks > 0 ? `CASH OUT $${Math.floor(betAmount * parseFloat(currMult))}` : "START GAME";
        document.getElementById("minesActionBtn").disabled = safeClicks === 0; // Can't cash out on 0 clicks

        document.getElementById("minesNextWin").innerText = `$${Math.floor(betAmount * parseFloat(nextMult))} (x${nextMult})`;
        document.getElementById("minesTotalWin").innerText = `$${Math.floor(betAmount * parseFloat(currMult))} (x${currMult})`;

        document.getElementById("minesBetBtns").style.display = "none";
        document.getElementById("minesCountBtns").style.display = "none";
    } else if (stage === "result") {
        document.getElementById("minesActionBtn").innerText = "NEW GAME";
        document.getElementById("minesActionBtn").disabled = false;
        document.getElementById("minesBetBtns").style.display = "block";
        document.getElementById("minesCountBtns").style.display = "flex";
    }

    document.getElementById("minesBalance").innerText = state.myMoney.toFixed(2);
}

export function initMines() {
    stage = "bet";
    safeClicks = 0;
    revealed = new Array(GRID_SIZE).fill(false);
    grid = new Array(GRID_SIZE).fill(false);

    window.minesSetBet = minesSetBet;
    window.minesChangeBet = minesChangeBet;
    window.minesMaxBet = minesMaxBet;
    window.minesSetMines = minesSetMines;
    window.minesAction = minesAction;

    renderGrid();
    updateUIState();
}
