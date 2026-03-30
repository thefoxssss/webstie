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
  { name: "TOP", cells: [[0, 0], [0, 1], [0, 2]] },
  { name: "MID", cells: [[1, 0], [1, 1], [1, 2]] },
  { name: "BOT", cells: [[2, 0], [2, 1], [2, 2]] },
  { name: "V", cells: [[0, 0], [1, 1], [2, 2]] },
  { name: "Λ", cells: [[2, 0], [1, 1], [0, 2]] },
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
let spinTimer = null;
let history = [];
let jackpotPool = JACKPOT_SEED;
let lastBoard = null;

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
  spinButtonEl.disabled = blocked;
  clearButtonEl.disabled = isSpinning;
}

function renderBoard(board) {
  if (!Array.isArray(board)) return;
  board.forEach((row, rowIndex) => {
    row.forEach((symbol, colIndex) => {
      const cell = gridEls[rowIndex]?.[colIndex];
      if (!cell) return;
      cell.textContent = symbol.icon;
      cell.dataset.color = symbol.color;
    });
  });
  lastBoard = board;
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
    }
    if (result.jackpot && line.name === "MID") jackpotHit = true;
  });

  if (jackpotHit) {
    winTotal += Math.floor(jackpotPool);
    jackpotPool = JACKPOT_SEED;
    unlockAchievement("high_roller");
  }

  if (winTotal > 0) {
    state.myMoney += winTotal;
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
}

function spin() {
  if (isSpinning) return;
  if (state.myMoney < totalBet()) {
    setMessage("INSUFFICIENT FUNDS", "loss");
    beep(120, "sawtooth", 0.2);
    return;
  }

  state.myMoney -= totalBet();
  jackpotPool += totalBet() * 0.1;
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
    renderBoard(board);
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
  updateBank();
  updateButtons();
  setText("slotsLast", "--");
  setMessage("5 LINES ACTIVE. HIT 7️⃣7️⃣7️⃣ ON MID FOR JACKPOT.");
}

window.slotsSetBet = (amount) => {
  if (isSpinning) return;
  const next = Math.max(1, Math.floor(Number(amount) || 1));
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

registerGameStop(() => {
  if (spinTimer) {
    clearTimeout(spinTimer);
    spinTimer = null;
  }
  isSpinning = false;
  if (machineEl) machineEl.classList.remove("spinning");
  updateButtons();
});
