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
  trackGamePlay,
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

// Expose select helpers globally for inline HTML event handlers.
Object.assign(window, {
  openGame,
  closeOverlays,
  showGameOver,
  buyItem,
  toggleItem,
  tradeMoney,
  startJob,
  submitJob,
  initTypeGame,
  setPongDiff,
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
});

const GAME_INITIALIZERS = {
  pong: initPong,
  snake: initSnake,
  runner: initRunner,
  geo: initGeometry,
  type: initTypeGame,
  blackjack: initBJ,
  ttt: initTTT,
  hangman: initHangman,
  flappy: initFlappy,
  dodge: initDodge,
  roulette: initRoulette,
  bonk: initBonkArena,
  drift: initDrift,
  corebreaker: initCoreBreaker,
  neondefender: initNeonDefender,
  voidminer: initVoidMiner,
  emulator: initEmulator,
};

const GAME_OVERLAY_BY_KEY = {
  geo: "overlayGeo",
  type: "overlayType",
  pong: "overlayPong",
  snake: "overlaySnake",
  runner: "overlayRunner",
  corebreaker: "overlayCorebreaker",
  neondefender: "overlayNeondefender",
  voidminer: "overlayVoidminer",
  shadowassassin: "overlayShadowassassin",
  dodge: "overlayDodge",
  roulette: "overlayRoulette",
  ttt: "overlayTTT",
  hangman: "overlayHangman",
  blackjack: "overlayBlackjack",
  bonk: "overlayBonk",
  flappy: "overlayFlappy",
  drift: "overlayDrift",
  emulator: "overlayEmulator",
};

const GAME_OVERLAY_IDS = Object.values(GAME_OVERLAY_BY_KEY);

function showOverlay(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) overlay.classList.add("active");
}

function startGame(game) {
  const initGame = GAME_INITIALIZERS[game];
  if (initGame) initGame();
}

// Launch a game by name, activate its overlay, and kick off its init routine.
window.launchGame = (game) => {
  window.closeOverlays();
  showOverlay(GAME_OVERLAY_BY_KEY[game]);
  startGame(game);
  resizeAllGameCanvases();
  trackGamePlay(game);
  unlockAchievement("noob");
};


const CANVAS_UI_PADDING = 230;

function sizeCanvasToViewport(canvas) {
  if (!canvas) return;
  const intrinsicW = Number(canvas.getAttribute("width")) || canvas.width || 800;
  const intrinsicH = Number(canvas.getAttribute("height")) || canvas.height || 450;
  const isFullscreen = document.fullscreenElement === canvas;
  const availW = (isFullscreen ? window.innerWidth : window.innerWidth * 0.95);
  const availH = Math.max(120, (isFullscreen ? window.innerHeight : window.innerHeight - CANVAS_UI_PADDING));
  const scale = Math.max(0.1, Math.min(availW / intrinsicW, availH / intrinsicH));
  canvas.style.width = `${Math.round(intrinsicW * scale)}px`;
  canvas.style.height = `${Math.round(intrinsicH * scale)}px`;
}

function resizeAllGameCanvases() {
  GAME_OVERLAY_IDS.forEach((id) => {
    const overlay = document.getElementById(id);
    const canvas = overlay?.querySelector("canvas");
    if (!canvas) return;
    sizeCanvasToViewport(canvas);
  });
}

function initGameCanvasSizing() {
  resizeAllGameCanvases();
  window.addEventListener("resize", resizeAllGameCanvases);
  document.addEventListener("fullscreenchange", resizeAllGameCanvases);
}

function pauseGamesWhenHidden() {
  const activeGameOverlay = GAME_OVERLAY_IDS.some((id) => document.getElementById(id)?.classList.contains("active"));
  if (!activeGameOverlay) return;
  if (document.hidden) {
    stopAllGames();
    GAME_OVERLAY_IDS.forEach((id) => document.getElementById(id)?.classList.remove("active"));
  }
}

function initGameVisibilityGuards() {
  document.addEventListener("visibilitychange", pauseGamesWhenHidden);
  window.addEventListener("blur", pauseGamesWhenHidden);
}

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
initGameCanvasSizing();
initGameVisibilityGuards();

// Restart the last game from the game-over modal.
document.getElementById("goRestart").onclick = () => {
  document.getElementById("modalGameOver").classList.remove("active");
  clearRestartListener();
  if (state.currentGame !== "blackjack") startGame(state.currentGame);
  if (state.currentGame === "roulette") {
    showOverlay(GAME_OVERLAY_BY_KEY.roulette);
  }
  if (state.currentGame === "blackjack") {
    state.myMoney = 1000;
    initBJ();
    showOverlay(GAME_OVERLAY_BY_KEY.blackjack);
  }
};

// Exit the current game and close all overlays.
document.getElementById("goExit").onclick = () => {
  stopAllGames();
  closeOverlays();
  document.getElementById("modalGameOver").classList.remove("active");
};
