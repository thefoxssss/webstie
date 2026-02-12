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
  unlockAchievement("noob");
};

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
