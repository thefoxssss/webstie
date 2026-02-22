import { state, updateHighScore, setText, showToast } from "../core.js";

const TRIALS = {
  byteblitz: {
    title: "BYTE BLITZ",
    actionLabel: "COLLECT BYTE",
    minGain: 6,
    maxGain: 18,
    burstChance: 0.2,
    burstBonus: 22,
    durationMs: 18000,
  },
  ciphercrack: {
    title: "CIPHER CRACK",
    actionLabel: "DECODE TOKEN",
    minGain: 5,
    maxGain: 16,
    burstChance: 0.25,
    burstBonus: 25,
    durationMs: 20000,
  },
  astrohop: {
    title: "ASTRO HOP",
    actionLabel: "BOOST JET",
    minGain: 7,
    maxGain: 14,
    burstChance: 0.22,
    burstBonus: 20,
    durationMs: 17000,
  },
  pulsestack: {
    title: "PULSE STACK",
    actionLabel: "STACK PULSE",
    minGain: 4,
    maxGain: 20,
    burstChance: 0.18,
    burstBonus: 28,
    durationMs: 19000,
  },
  glitchgate: {
    title: "GLITCH GATE",
    actionLabel: "PATCH GLITCH",
    minGain: 6,
    maxGain: 17,
    burstChance: 0.24,
    burstBonus: 24,
    durationMs: 18000,
  },
  orbweaver: {
    title: "ORB WEAVER",
    actionLabel: "WEAVE ORB",
    minGain: 5,
    maxGain: 15,
    burstChance: 0.26,
    burstBonus: 26,
    durationMs: 21000,
  },
  laserlock: {
    title: "LASER LOCK",
    actionLabel: "LOCK TARGET",
    minGain: 7,
    maxGain: 16,
    burstChance: 0.21,
    burstBonus: 23,
    durationMs: 18000,
  },
  metromaze: {
    title: "METRO MAZE",
    actionLabel: "ADVANCE NODE",
    minGain: 5,
    maxGain: 17,
    burstChance: 0.23,
    burstBonus: 24,
    durationMs: 20000,
  },
  stacksmash: {
    title: "STACK SMASH",
    actionLabel: "SMASH STACK",
    minGain: 6,
    maxGain: 19,
    burstChance: 0.19,
    burstBonus: 27,
    durationMs: 17000,
  },
  quantumflip: {
    title: "QUANTUM FLIP",
    actionLabel: "FLIP STATE",
    minGain: 4,
    maxGain: 21,
    burstChance: 0.2,
    burstBonus: 30,
    durationMs: 21000,
  },
};

const runtime = new Map();

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clearTrial(id) {
  const trial = runtime.get(id);
  if (!trial) return;
  window.clearInterval(trial.tick);
  runtime.delete(id);
}

function initTrial(id) {
  const config = TRIALS[id];
  if (!config) return;
  clearTrial(id);
  state.currentGame = id;

  const actionBtn = document.getElementById(`${id}Action`);
  if (!actionBtn) return;

  const scoreId = `${id}Score`;
  const timerId = `${id}Timer`;

  let score = 0;
  let remainingMs = config.durationMs;
  let started = false;
  setText(scoreId, `SCORE: ${score}`);
  setText(timerId, `TIME: ${(remainingMs / 1000).toFixed(1)}s`);
  actionBtn.textContent = config.actionLabel;
  actionBtn.disabled = false;

  const tick = window.setInterval(() => {
    if (!started) return;
    remainingMs -= 100;
    const remaining = Math.max(0, remainingMs);
    setText(timerId, `TIME: ${(remaining / 1000).toFixed(1)}s`);
    if (remaining > 0) return;
    window.clearInterval(tick);
    runtime.delete(id);
    actionBtn.disabled = true;
    actionBtn.textContent = "ROUND COMPLETE";
    updateHighScore(id, score);
    showToast(`${config.title}: ${score} PTS`);
  }, 100);

  actionBtn.onclick = () => {
    started = true;
    if (remainingMs <= 0) return;
    const gain = randomInt(config.minGain, config.maxGain);
    const burst = Math.random() < config.burstChance ? config.burstBonus : 0;
    score += gain + burst;
    setText(scoreId, `SCORE: ${score}`);
    updateHighScore(id, score);
  };

  runtime.set(id, { tick });
}

export const initByteBlitz = () => initTrial("byteblitz");
export const initCipherCrack = () => initTrial("ciphercrack");
export const initAstroHop = () => initTrial("astrohop");
export const initPulseStack = () => initTrial("pulsestack");
export const initGlitchGate = () => initTrial("glitchgate");
export const initOrbWeaver = () => initTrial("orbweaver");
export const initLaserLock = () => initTrial("laserlock");
export const initMetroMaze = () => initTrial("metromaze");
export const initStackSmash = () => initTrial("stacksmash");
export const initQuantumFlip = () => initTrial("quantumflip");
