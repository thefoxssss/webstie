// Roulette mini-game styled for the terminal UI.
import { beep, registerGameStop, saveStats, setText, state, unlockAchievement } from "../core.js";

const ROULETTE_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const WHEEL_COLOR_MAP = {
  red: "#a11a1a",
  black: "#1f1f1f",
  green: "#0c8b3e",
};

let wheelEl;
let historyEl;
let messageEl;
let betInputEl;
let spinButtonEl;
let clearButtonEl;

let bets = { red: 0, black: 0, green: 0 };
let betAmount = 10;
let wheelRotation = 0;
let isSpinning = false;
let spinTimer = null;
let history = [];

function getNumberColor(number) {
  if (number === 0) return "green";
  return RED_NUMBERS.has(number) ? "red" : "black";
}

function getTotalBet() {
  return bets.red + bets.black + bets.green;
}

function buildWheelGradient() {
  const sliceAngle = 360 / ROULETTE_NUMBERS.length;
  const colorStops = ROULETTE_NUMBERS.map((number, idx) => {
    const color = getNumberColor(number);
    const start = (idx * sliceAngle).toFixed(2);
    const end = ((idx + 1) * sliceAngle).toFixed(2);
    return `${WHEEL_COLOR_MAP[color]} ${start}deg ${end}deg`;
  }).join(",\n    ");
  return `conic-gradient(\n    ${colorStops}\n  )`;
}

function updateBank() {
  setText("globalBank", Number(state.myMoney || 0).toFixed(2));
  setText("rouletteBalance", Number(state.myMoney || 0).toFixed(2));
}

function setMessage(text, tone = "neutral") {
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.classList.remove("win", "loss");
  if (tone === "win") messageEl.classList.add("win");
  if (tone === "loss") messageEl.classList.add("loss");
}

function syncBetsUi() {
  setText("rouletteBetRed", bets.red || 0);
  setText("rouletteBetBlack", bets.black || 0);
  setText("rouletteBetGreen", bets.green || 0);
  setText("rouletteTotalBet", getTotalBet());
  if (spinButtonEl) spinButtonEl.disabled = isSpinning || getTotalBet() <= 0;
  if (clearButtonEl) clearButtonEl.disabled = isSpinning || getTotalBet() <= 0;
}

function renderHistory() {
  if (!historyEl) return;
  historyEl.innerHTML = "";
  if (!history.length) {
    const empty = document.createElement("span");
    empty.className = "roulette-history-empty";
    empty.textContent = "NO SPINS YET";
    historyEl.appendChild(empty);
    return;
  }
  history.forEach((spin) => {
    const chip = document.createElement("div");
    chip.className = `roulette-history-chip ${spin.color}`;
    chip.textContent = spin.number;
    historyEl.appendChild(chip);
  });
}

function placeBet(color) {
  if (isSpinning) return;
  const stake = Math.max(1, Math.floor(Number(betInputEl?.value || betAmount || 10)));
  betAmount = stake;
  if (state.myMoney < stake) {
    setMessage("INSUFFICIENT FUNDS", "loss");
    beep(120, "sawtooth", 0.25);
    return;
  }

  state.myMoney -= stake;
  bets[color] += stake;
  updateBank();
  syncBetsUi();
  setMessage("BET LOCKED. SPIN WHEN READY.");
  beep(620, "square", 0.06);
}

function clearBets() {
  if (isSpinning) return;
  const total = getTotalBet();
  if (!total) return;
  state.myMoney += total;
  bets = { red: 0, black: 0, green: 0 };
  updateBank();
  syncBetsUi();
  setMessage("BETS CLEARED.");
  beep(360, "square", 0.05);
}

function settleRound(number, color) {
  let winnings = 0;
  if (color === "red" && bets.red > 0) winnings += bets.red * 2;
  if (color === "black" && bets.black > 0) winnings += bets.black * 2;
  if (color === "green" && bets.green > 0) winnings += bets.green * 14;

  if (winnings > 0) {
    state.myMoney += winnings;
    setMessage(`WIN +$${winnings}`, "win");
    beep(900, "square", 0.1);
    if (winnings >= 1000) unlockAchievement("high_roller");
  } else {
    setMessage(`NO HIT. ${number} ${color.toUpperCase()}.`, "loss");
    beep(130, "sawtooth", 0.25);
  }

  setText("rouletteLast", `${number} / ${color.toUpperCase()}`);
  history = [{ number, color }, ...history].slice(0, 10);
  renderHistory();
  bets = { red: 0, black: 0, green: 0 };
  isSpinning = false;
  syncBetsUi();
  updateBank();
  saveStats();
}

function spin() {
  if (isSpinning || getTotalBet() <= 0) return;
  isSpinning = true;
  syncBetsUi();
  setMessage("SPINNING...");

  const winningIndex = Math.floor(Math.random() * ROULETTE_NUMBERS.length);
  const winningNumber = ROULETTE_NUMBERS[winningIndex];
  const winningColor = getNumberColor(winningNumber);
  const sliceAngle = 360 / ROULETTE_NUMBERS.length;
  const targetAngle = -(winningIndex * sliceAngle);
  const currentBase = Math.floor(wheelRotation / 360) * 360;
  wheelRotation = currentBase - 1800 + targetAngle;

  if (wheelEl) {
    wheelEl.style.transitionDuration = "4000ms";
    wheelEl.style.transform = `rotate(${wheelRotation}deg)`;
  }

  spinTimer = setTimeout(() => {
    settleRound(winningNumber, winningColor);
    spinTimer = null;
  }, 4000);
}

function bindWheelNumbers() {
  const ring = document.getElementById("rouletteWheelNumbers");
  if (!ring) return;
  ring.innerHTML = "";
  ROULETTE_NUMBERS.forEach((num, idx) => {
    const marker = document.createElement("div");
    marker.className = "roulette-marker";
    marker.style.transform = `rotate(${(idx * 360) / ROULETTE_NUMBERS.length}deg)`;
    const color = getNumberColor(num);
    marker.innerHTML = `<span class="${color}">${num}</span>`;
    ring.appendChild(marker);
  });
}

export function initRoulette() {
  state.currentGame = "roulette";
  wheelEl = document.getElementById("rouletteWheel");
  historyEl = document.getElementById("rouletteHistory");
  messageEl = document.getElementById("rouletteMessage");
  betInputEl = document.getElementById("rouletteBetInput");
  spinButtonEl = document.getElementById("rouletteSpinBtn");
  clearButtonEl = document.getElementById("rouletteClearBtn");

  if (!wheelEl || !historyEl || !messageEl || !betInputEl || !spinButtonEl || !clearButtonEl) return;

  bindWheelNumbers();
  wheelEl.style.background = buildWheelGradient();
  wheelEl.style.transitionDuration = "0ms";
  wheelEl.style.transform = `rotate(${wheelRotation}deg)`;
  betInputEl.value = betAmount;
  setText("rouletteLast", "--");

  updateBank();
  syncBetsUi();
  renderHistory();
  setMessage("PLACE YOUR BETS.");
}

window.rouletteSetBet = (amount) => {
  if (isSpinning) return;
  const next = Math.max(1, Math.floor(Number(amount) || 1));
  betAmount = next;
  if (betInputEl) betInputEl.value = next;
  beep(450, "square", 0.04);
};

window.rouletteChangeBet = (multiplier) => {
  if (isSpinning) return;
  const current = Math.max(1, Math.floor(Number(betInputEl?.value || betAmount || 1)));
  const next = Math.max(1, Math.floor(current * Number(multiplier || 1)));
  window.rouletteSetBet(next);
};

window.rouletteMaxBet = () => {
  if (isSpinning) return;
  window.rouletteSetBet(Math.max(1, Math.floor(state.myMoney || 1)));
};

window.roulettePlace = placeBet;
window.rouletteClear = clearBets;
window.rouletteSpin = spin;

registerGameStop(() => {
  if (spinTimer) {
    clearTimeout(spinTimer);
    spinTimer = null;
  }
  isSpinning = false;
  syncBetsUi();
});
