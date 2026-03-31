import { beep, registerGameStop, saveStats, setText, state, unlockAchievement } from "../core.js";

const SYMBOLS = Object.freeze([
  { icon: "🔴", key: "red", color: "red", weight: 18 },
  { icon: "⚫", key: "black", color: "black", weight: 18 },
  { icon: "🟢", key: "green", color: "green", weight: 14 },
  { icon: "🍒", key: "cherry", color: "red", weight: 14 },
  { icon: "🪙", key: "coin", color: "gold", weight: 12 },
  { icon: "💎", key: "diamond", color: "green", weight: 8 },
  { icon: "7️⃣", key: "seven", color: "gold", weight: 6 },
]);

const JACKPOT_SEED = 5000;
const LINE_PATTERNS = Object.freeze([
  { name: "TOP", cells: [[0, 0], [0, 1], [0, 2]], id: "slotsLineTOP" },
  { name: "MID", cells: [[1, 0], [1, 1], [1, 2]], id: "slotsLineMID" },
  { name: "BOT", cells: [[2, 0], [2, 1], [2, 2]], id: "slotsLineBOT" },
  { name: "V", cells: [[0, 0], [1, 1], [2, 2]], id: "slotsLineV" },
  { name: "Λ", cells: [[2, 0], [1, 1], [0, 2]], id: "slotsLineINV_V" },
]);

const TRIPLE_MULTIPLIERS = Object.freeze({
  seven: 50,
  diamond: 25,
  green: 12,
  red: 8,
  black: 8,
  cherry: 6,
  coin: 5,
});

let gridEls = [];
let historyEl;
let messageEl;
let betInputEl;
let spinButtonEl;
let jackpotEl;
let clearButtonEl;
let machineEl;

let betAmount = 10;
let isSpinning = false;
let autoSpinMode = false;
let autoSpinTimer = null;
let spinTimer = null;
let history = [];
let jackpotPool = JACKPOT_SEED;
let lastBoard = null;

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function weightedRandomSymbol() {
  const total = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
  let cursor = Math.random() * total;
  for (let index = 0; index < SYMBOLS.length; index += 1) {
    cursor -= SYMBOLS[index].weight;
    if (cursor <= 0) return SYMBOLS[index];
  }
  return SYMBOLS[0];
}

function createBoard() {
  return Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => weightedRandomSymbol()));
}

function totalBet() {
  return betAmount * LINE_PATTERNS.length;
}

function updateBank() {
  setText("globalBank", Number(state.myMoney || 0).toFixed(2));
  setText("slotsBalance", Number(state.myMoney || 0).toFixed(2));
  setText("slotsLineBet", betAmount);
  setText("slotsTotalBet", totalBet());
  setText("slotsJackpot", Math.floor(jackpotPool));
}

function setMessage(text, tone = "neutral") {
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.classList.remove("win", "loss");
  if (tone === "win") messageEl.classList.add("win");
  if (tone === "loss") messageEl.classList.add("loss");
}

function updateButtons() {
  if (!spinButtonEl || !clearButtonEl) return;
  const blocked = isSpinning || state.myMoney < totalBet();
  spinButtonEl.disabled = blocked && !autoSpinMode;
  clearButtonEl.disabled = isSpinning || autoSpinMode;
  const autoBtn = document.getElementById("slotsAutoBtn");
  if (autoBtn) {
    if (autoSpinMode) {
      autoBtn.style.background = "var(--accent)";
      autoBtn.style.color = "#000";
      autoBtn.textContent = "STOP AUTO";
    } else {
      autoBtn.style.background = "transparent";
      autoBtn.style.color = "#0f0";
      autoBtn.textContent = "AUTO SPIN";
    }
  }
}

function renderBoard(board, revealStep = false) {
  if (!Array.isArray(board)) return;
  board.forEach((row, rowIndex) => {
    row.forEach((symbol, colIndex) => {
      const cell = gridEls[rowIndex]?.[colIndex];
      if (!cell) return;

      const inner = cell.querySelector('.slots-cell-inner');
      if (inner) {
        if (revealStep) {
          // Add a simple vertical shift animation during spin
          inner.style.transform = `translateY(${Math.random() > 0.5 ? '10px' : '-10px'})`;
          setTimeout(() => {
            inner.textContent = symbol.icon;
            inner.style.transform = 'translateY(0)';
          }, 30);
        } else {
          inner.textContent = symbol.icon;
          inner.style.transform = 'translateY(0)';
        }
      } else {
        cell.textContent = symbol.icon;
      }
      cell.dataset.color = symbol.color;
    });
  });
  lastBoard = board;
}

function clearLines() {
  LINE_PATTERNS.forEach(line => {
    const el = document.getElementById(line.id);
    if (el) el.classList.remove("active");
  });
  gridEls.flat().forEach(cell => {
    if (cell) cell.classList.remove("win-pulse");
  });
}

function highlightLine(line) {
  const el = document.getElementById(line.id);
  if (el) el.classList.add("active");
  line.cells.forEach(([r, c]) => {
    const cell = gridEls[r]?.[c];
    if (cell) cell.classList.add("win-pulse");
  });
}

function renderHistory() {
  if (!historyEl) return;
  historyEl.innerHTML = "";
  if (!history.length) {
    const empty = document.createElement("span");
    empty.className = "slots-history-empty";
    empty.textContent = "NO SPINS YET";
    historyEl.appendChild(empty);
    return;
  }

  history.forEach((entry) => {
    const chip = document.createElement("div");
    chip.className = `slots-history-chip ${entry.tone}`;
    chip.textContent = `${entry.label} +$${entry.win}`;
    historyEl.appendChild(chip);
  });
}

function lineSymbols(board, line) {
  return line.cells.map(([row, col]) => board[row][col]);
}

function evaluateLine(symbols, lineBet) {
  const [a, b, c] = symbols;
  const sameKey = a.key === b.key && b.key === c.key;
  if (sameKey) {
    const multiplier = TRIPLE_MULTIPLIERS[a.key] || 4;
    const isJackpot = a.key === "seven";
    return {
      win: lineBet * multiplier,
      label: `${a.icon}${a.icon}${a.icon}`,
      jackpot: isJackpot,
      tone: isJackpot ? "jackpot" : a.color,
    };
  }

  const colors = symbols.map((symbol) => symbol.color);
  if (colors.every((color) => color === "red" || color === "black" || color === "green")) {
    const uniqueColors = new Set(colors);
    if (uniqueColors.size === 1) {
      return { win: lineBet * 4, label: `${colors[0].toUpperCase()} LINE`, jackpot: false, tone: colors[0] };
    }
    if (uniqueColors.size === 3) {
      return { win: lineBet * 7, label: "ROULETTE MIX", jackpot: false, tone: "mix" };
    }
  }

  if (a.key === b.key || b.key === c.key || a.key === c.key) {
    return { win: lineBet * 2, label: "PAIR", jackpot: false, tone: "neutral" };
  }

  return { win: 0, label: "MISS", jackpot: false, tone: "neutral" };
}

function settleRound(board) {
  const lineBet = betAmount;
  let winTotal = 0;
  let jackpotHit = false;
  const labels = [];

  LINE_PATTERNS.forEach((line) => {
    const result = evaluateLine(lineSymbols(board, line), lineBet);
    if (result.win > 0) {
      winTotal += result.win;
      labels.push(`${line.name}:${result.label}`);
      highlightLine(line);
    }
    if (result.jackpot && line.name === "MID") jackpotHit = true;
  });

  if (jackpotHit) {
    winTotal += Math.floor(jackpotPool);
    jackpotPool = JACKPOT_SEED;
    unlockAchievement("high_roller");
  }

  if (winTotal > 0) {
    state.myMoney = roundMoney(Number(state.myMoney || 0) + winTotal);
    setMessage(jackpotHit ? `JACKPOT! +$${winTotal}` : `WIN +$${winTotal}`, "win");
    beep(jackpotHit ? 1200 : 920, "square", jackpotHit ? 0.18 : 0.1);
  } else {
    setMessage("NO PAYLINE HIT. SPIN AGAIN.", "loss");
    beep(130, "sawtooth", 0.24);
  }

  setText("slotsLast", labels.length ? labels.join(" • ") : "MISS");
  history = [
    {
      label: labels[0] || "MISS",
      win: winTotal,
      tone: jackpotHit ? "jackpot" : winTotal > 0 ? "green" : "neutral",
    },
    ...history,
  ].slice(0, 10);

  isSpinning = false;
  renderHistory();
  updateBank();
  updateButtons();
  saveStats();

  if (autoSpinMode && state.myMoney >= totalBet()) {
    autoSpinTimer = setTimeout(spin, 1200);
  } else if (autoSpinMode) {
    autoSpinMode = false;
    setMessage("AUTO SPIN HALTED: INSUFFICIENT FUNDS", "loss");
    updateButtons();
  }
}

function spin() {
  if (isSpinning) return;
  if (state.myMoney < totalBet()) {
    setMessage("INSUFFICIENT FUNDS", "loss");
    beep(120, "sawtooth", 0.2);
    autoSpinMode = false;
    updateButtons();
    return;
  }

  clearLines();
  state.myMoney = roundMoney(Number(state.myMoney || 0) - totalBet());
  jackpotPool = roundMoney(jackpotPool + totalBet() * 0.1);
  isSpinning = true;
  setMessage("SPINNING REELS...");
  updateBank();
  updateButtons();

  const finalBoard = createBoard();
  const revealSteps = 9;
  let step = 0;
  if (machineEl) machineEl.classList.add("spinning");

  const animateStep = () => {
    step += 1;
    const board = step >= revealSteps ? finalBoard : createBoard();
    renderBoard(board, step < revealSteps);
    if (step >= revealSteps) {
      spinTimer = null;
      if (machineEl) machineEl.classList.remove("spinning");
      settleRound(finalBoard);
      return;
    }
    spinTimer = setTimeout(animateStep, 90 + step * 5);
  };

  animateStep();
}

function toggleAutoSpin() {
  if (autoSpinMode) {
    autoSpinMode = false;
    if (autoSpinTimer) clearTimeout(autoSpinTimer);
    updateButtons();
  } else {
    autoSpinMode = true;
    updateButtons();
    if (!isSpinning) spin();
  }
}

function clearBet() {
  if (isSpinning) return;
  betAmount = 10;
  if (betInputEl) betInputEl.value = betAmount;
  updateBank();
  updateButtons();
  setMessage("BET RESET TO 10.");
  beep(320, "square", 0.05);
}

export function initSlots() {
  state.currentGame = "slots";
  gridEls = [0, 1, 2].map((row) => [0, 1, 2].map((col) => document.getElementById(`slotsCell${row}${col}`)));
  historyEl = document.getElementById("slotsHistory");
  messageEl = document.getElementById("slotsMessage");
  betInputEl = document.getElementById("slotsBetInput");
  spinButtonEl = document.getElementById("slotsSpinBtn");
  jackpotEl = document.getElementById("slotsJackpot");
  clearButtonEl = document.getElementById("slotsClearBtn");
  machineEl = document.querySelector("#overlaySlots .slots-machine");

  if (gridEls.flat().some((el) => !el) || !historyEl || !messageEl || !betInputEl || !spinButtonEl || !clearButtonEl || !jackpotEl) {
    return;
  }

  const parsedBet = Math.max(1, Math.floor(Number(betInputEl.value || betAmount || 10)));
  betAmount = Number.isFinite(parsedBet) ? parsedBet : 10;
  betInputEl.value = betAmount;

  if (!lastBoard) lastBoard = createBoard();
  renderBoard(lastBoard);
  renderHistory();
  clearLines();
  updateBank();
  updateButtons();
  setText("slotsLast", "--");
  setMessage("5 LINES ACTIVE. HIT 7️⃣7️⃣7️⃣ ON MID FOR JACKPOT.");
}

window.slotsSetBet = (amount) => {
  if (isSpinning) return;
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount)) return;
  const next = Math.max(1, Math.floor(parsedAmount));
  betAmount = next;
  if (betInputEl) betInputEl.value = next;
  updateBank();
  updateButtons();
  beep(440, "square", 0.04);
};

window.slotsChangeBet = (multiplier) => {
  if (isSpinning) return;
  const current = Math.max(1, Math.floor(Number(betInputEl?.value || betAmount || 1)));
  const next = Math.max(1, Math.floor(current * Number(multiplier || 1)));
  window.slotsSetBet(next);
};

window.slotsMaxBet = () => {
  if (isSpinning) return;
  const affordableLine = Math.max(1, Math.floor((state.myMoney || 1) / LINE_PATTERNS.length));
  window.slotsSetBet(affordableLine);
};

window.slotsInputBet = () => {
  if (isSpinning) return;
  const next = Math.max(1, Math.floor(Number(betInputEl?.value || betAmount || 1)));
  window.slotsSetBet(next);
};

window.slotsClear = clearBet;
window.slotsSpin = spin;
window.slotsToggleAuto = toggleAutoSpin;

registerGameStop(() => {
  if (spinTimer) {
    clearTimeout(spinTimer);
    spinTimer = null;
  }
  if (autoSpinTimer) {
    clearTimeout(autoSpinTimer);
    autoSpinTimer = null;
  }
  isSpinning = false;
  autoSpinMode = false;
  if (machineEl) machineEl.classList.remove("spinning");
  updateButtons();
});
