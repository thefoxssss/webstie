// Central game launcher wiring for the UI buttons and overlays.
// This file acts as the "glue" between the DOM and each game module.
import {
  buyItem,
  toggleItem,
  tradeMoney,
  clearRestartListener,
  closeOverlays,
  openGame,
  showGameOver,
  stopAllGames,
  unlockAchievement,
  startJob,
  submitJob,
  state,
  adminGrantCash,
  adminInjectJackpot,
  adminSetMaxCash,
  adminGrantAllShopItems,
  adminClearDebtAndCooldowns,
  adminBoostStats,
  adminMaxPortfolio,
  adminMarketMoonshot,
  adminMarketMeltdown,
  adminMarketCrashToZero,
  adminMarketTimesThousand,
  adminPrestigePack,
  adminRefreshTargetUsers,
  adminGrantCashToUser,
  adminForgiveInterestForUser,
  adminUnlockAllAchievements,
} from "./core.js";
import { initGeometry } from "./games/geo.js";
import { initFlappy } from "./games/flappy.js";
import { initTypeGame } from "./games/type.js";
import { initPong, setPongDiff } from "./games/pong.js";
import { initSnake } from "./games/snake.js";
import { initRunner } from "./games/runner.js";
import { initDodge } from "./games/dodge.js";
import { initBJ } from "./games/blackjack.js";
import { initTTT } from "./games/ttt.js";
import { initHangman } from "./games/hangman.js";
import { initRoulette } from "./games/roulette.js";
import { initBonkArena } from "./games/bonkarena.js";
import { initDrift } from "./games/drift.js";
import { initCoreBreaker } from "./games/corebreaker.js";
import { initNeonDefender } from "./games/neondefender.js";
import { initVoidMiner } from "./games/voidminer.js";
import { initEmulator } from "./games/emulator.js";


const TRENDING_STORAGE_KEY = "goonerGamePlayHistory";
const TRENDING_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_HISTORY_EVENTS = 500;

const GAME_NAMES = Object.freeze({
  geo: "GEO DASH",
  type: "TYPE RUNNER",
  pong: "PONG",
  snake: "SNAKE",
  runner: "RUNNER V2",
  corebreaker: "CORE BREAKER",
  neondefender: "NEON DEFENDER",
  voidminer: "VOID MINER",
  shadowassassin: "SHADOW ASSASSIN",
  dodge: "DODGE GRID",
  roulette: "ROULETTE",
  blackjack: "BLACKJACK (PVP)",
  ttt: "TIC TAC TOE",
  hangman: "HANGMAN (PVP)",
  bonk: "BONK ARENA (PVP)",
  drift: "NEON DRIFT (PVP)",
  emulator: "CPU EMULATOR",
  flappy: "FLAPPY GOON",
});

function getGamePlayHistory() {
  try {
    const raw = localStorage.getItem(TRENDING_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to load trending history", error);
    return [];
  }
}

function saveGamePlayHistory(events) {
  localStorage.setItem(TRENDING_STORAGE_KEY, JSON.stringify(events));
}

function recordGamePlay(game) {
  const now = Date.now();
  const cutoff = now - TRENDING_WINDOW_MS;
  const normalized = getGamePlayHistory().filter(
    (event) => event && typeof event.game === "string" && Number(event.playedAt) >= cutoff
  );
  normalized.push({ game, playedAt: now });
  saveGamePlayHistory(normalized.slice(-MAX_HISTORY_EVENTS));
}

function renderTrendingGames() {
  const list = document.getElementById("trendingGamesList");
  const meta = document.getElementById("trendingGamesMeta");
  if (!list || !meta) return;

  const now = Date.now();
  const cutoff = now - TRENDING_WINDOW_MS;
  const counts = new Map();

  const recent = getGamePlayHistory().filter(
    (event) => event && typeof event.game === "string" && Number(event.playedAt) >= cutoff
  );

  saveGamePlayHistory(recent.slice(-MAX_HISTORY_EVENTS));

  recent.forEach((event) => {
    const key = event.game;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (!ranked.length) {
    list.textContent = "No plays tracked yet.";
    return;
  }

  list.innerHTML = ranked
    .map(
      ([game, plays], index) =>
        `<button class="trending-game-item trending-game-btn" onclick="window.launchGame('${game}')"><span>${index + 1}. ${GAME_NAMES[game] || game.toUpperCase()}</span><strong>${plays} PLAY${plays === 1 ? "" : "S"}</strong></button>`
    )
    .join("");

  meta.textContent = `Most played in the last ${Math.round(TRENDING_WINDOW_MS / (60 * 60 * 1000))} hours.`;
}

// Expose select helpers globally for inline HTML event handlers.
window.openGame = openGame;
window.closeOverlays = closeOverlays;
window.showGameOver = showGameOver;
window.buyItem = buyItem;
window.toggleItem = toggleItem;
window.tradeMoney = tradeMoney;
window.startJob = startJob;
window.submitJob = submitJob;
window.initTypeGame = initTypeGame;
window.setPongDiff = setPongDiff;
window.adminGrantCash = adminGrantCash;
window.adminInjectJackpot = adminInjectJackpot;
window.adminSetMaxCash = adminSetMaxCash;
window.adminGrantAllShopItems = adminGrantAllShopItems;
window.adminClearDebtAndCooldowns = adminClearDebtAndCooldowns;
window.adminBoostStats = adminBoostStats;
window.adminMaxPortfolio = adminMaxPortfolio;
window.adminMarketMoonshot = adminMarketMoonshot;
window.adminMarketMeltdown = adminMarketMeltdown;
window.adminMarketCrashToZero = adminMarketCrashToZero;
window.adminMarketTimesThousand = adminMarketTimesThousand;
window.adminPrestigePack = adminPrestigePack;
window.adminRefreshTargetUsers = adminRefreshTargetUsers;
window.adminGrantCashToUser = adminGrantCashToUser;
window.adminForgiveInterestForUser = adminForgiveInterestForUser;
window.adminUnlockAllAchievements = adminUnlockAllAchievements;

// Launch a game by name, activate its overlay, and kick off its init routine.
window.launchGame = (game) => {
  window.closeOverlays();
  const overlayId =
    "overlay" +
    (game === "ttt"
      ? game.toUpperCase()
      : game.charAt(0).toUpperCase() + game.slice(1));
  const el = document.getElementById(overlayId);
  if (el) el.classList.add("active");
  if (game === "pong") initPong();
  if (game === "snake") initSnake();
  if (game === "runner") initRunner();
  if (game === "geo") initGeometry();
  if (game === "type") initTypeGame();
  if (game === "blackjack") initBJ();
  if (game === "ttt") initTTT();
  if (game === "hangman") initHangman();
  if (game === "flappy") initFlappy();
  if (game === "dodge") initDodge();
  if (game === "roulette") initRoulette();
  if (game === "bonk") initBonkArena();
  if (game === "drift") initDrift();
  if (game === "corebreaker") initCoreBreaker();
  if (game === "neondefender") initNeonDefender();
  if (game === "voidminer") initVoidMiner();
  if (game === "emulator") initEmulator();
  unlockAchievement("noob");
  recordGamePlay(game);
  renderTrendingGames();
};


const GAME_OVERLAY_IDS = [
  "overlayGeo",
  "overlayType",
  "overlayPong",
  "overlaySnake",
  "overlayRunner",
  "overlayCorebreaker",
  "overlayNeondefender",
  "overlayVoidminer",
  "overlayShadowassassin",
  "overlayDodge",
  "overlayRoulette",
  "overlayTTT",
  "overlayHangman",
  "overlayBlackjack",
  "overlayBonk",
  "overlayFlappy",
  "overlayDrift",
  "overlayEmulator",
];

function getFullscreenTarget(overlay) {
  return overlay.querySelector("canvas, iframe") || overlay;
}

async function toggleGameFullscreen(overlay, button) {
  const target = getFullscreenTarget(overlay);
  if (!document.fullscreenElement) {
    await target.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
  button.textContent = document.fullscreenElement ? "EXIT FULLSCREEN" : "FULLSCREEN";
}

function initGameFullscreenControls() {
  const overlays = GAME_OVERLAY_IDS
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  overlays.forEach((overlay) => {
    const exitBtn = overlay.querySelector(".exit-btn-fixed");
    if (!exitBtn || overlay.querySelector(".fullscreen-btn-fixed")) return;

    const fsButton = document.createElement("button");
    fsButton.className = "fullscreen-btn-fixed";
    fsButton.type = "button";
    fsButton.textContent = "FULLSCREEN";
    fsButton.addEventListener("click", async () => {
      try {
        await toggleGameFullscreen(overlay, fsButton);
      } catch (error) {
        console.warn("Fullscreen toggle failed", error);
      }
    });
    exitBtn.insertAdjacentElement("beforebegin", fsButton);
  });

  document.addEventListener("fullscreenchange", () => {
    const isFullscreen = Boolean(document.fullscreenElement);
    document.querySelectorAll(".fullscreen-btn-fixed").forEach((button) => {
      button.textContent = isFullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN";
    });
  });
}

initGameFullscreenControls();
renderTrendingGames();

// Restart the last game from the game-over modal.
document.getElementById("goRestart").onclick = () => {
  document.getElementById("modalGameOver").classList.remove("active");
  clearRestartListener();
  if (state.currentGame === "snake") initSnake();
  if (state.currentGame === "pong") initPong();
  if (state.currentGame === "runner") initRunner();
  if (state.currentGame === "geo") initGeometry();
  if (state.currentGame === "flappy") initFlappy();
  if (state.currentGame === "dodge") initDodge();
  if (state.currentGame === "corebreaker") initCoreBreaker();
  if (state.currentGame === "neondefender") initNeonDefender();
  if (state.currentGame === "voidminer") initVoidMiner();
  if (state.currentGame === "roulette") {
    initRoulette();
    document.getElementById("overlayRoulette").classList.add("active");
  }
  if (state.currentGame === "blackjack") {
    state.myMoney = 1000;
    initBJ();
    document.getElementById("overlayBlackjack").classList.add("active");
  }
};

// Exit the current game and close all overlays.
document.getElementById("goExit").onclick = () => {
  stopAllGames();
  closeOverlays();
  document.getElementById("modalGameOver").classList.remove("active");
};
