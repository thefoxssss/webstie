// Central game launcher wiring for the UI buttons and overlays.
// This file acts as the "glue" between the DOM and each game module.
import {
  buyItem,
  clearRestartListener,
  closeOverlays,
  openGame,
  showGameOver,
  stopAllGames,
  unlockAchievement,
  state,
} from "./core.js";
import { initGeometry } from "./games/geo.js";
import { initFlappy } from "./games/flappy.js";
import { initTypeGame } from "./games/type.js";
import { initPong, setPongDiff } from "./games/pong.js";
import { initSnake } from "./games/snake.js";
import { initRunner } from "./games/runner.js";
import { initBJ } from "./games/blackjack.js";
import { initTTT } from "./games/ttt.js";
import { initHangman } from "./games/hangman.js";
import { initVoiceChat } from "./voice.js";

// Expose select helpers globally for inline HTML event handlers.
window.openGame = openGame;
window.closeOverlays = closeOverlays;
window.showGameOver = showGameOver;
window.buyItem = buyItem;
window.initTypeGame = initTypeGame;
window.setPongDiff = setPongDiff;

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

// Normalize version strings (semver, commit sha, or "dev") for display.
const formatVersionValue = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/^v/i, "");
  if (normalized.toLowerCase() === "dev") return "dev";
  if (/^[0-9a-f]{7,40}$/i.test(normalized)) return normalized.slice(0, 7);
  return normalized;
};

// Pull version metadata from globals and <meta> tags, then render to the UI.
const setVersionIndicator = () => {
  const indicator = document.getElementById("versionIndicator");
  if (!indicator) return;

  const metaAppVersion = document.querySelector('meta[name="app-version"]')?.content;
  const metaCommit = document.querySelector('meta[name="git-commit"]')?.content;
  const candidates = [
    window.APP_COMMIT,
    window.COMMIT_SHA,
    metaCommit,
    window.APP_VERSION,
    metaAppVersion,
  ];

  const resolved = candidates.map(formatVersionValue).find(Boolean) || "dev";
  indicator.textContent = `VERSION: ${resolved}`;
};

// Initialize the version indicator on load.
setVersionIndicator();

const toggleVoiceDock = (forceOpen = null) => {
  const dock = document.getElementById("voiceDock");
  if (!dock) return;
  const shouldCollapse =
    forceOpen === null ? !dock.classList.contains("collapsed") : !forceOpen;
  dock.classList.toggle("collapsed", shouldCollapse);
  const toggleBtn = document.getElementById("voiceDockCollapse");
  if (toggleBtn) toggleBtn.textContent = shouldCollapse ? "+" : "–";
};

document.getElementById("voiceDockToggle")?.addEventListener("click", () => {
  toggleVoiceDock(true);
});
document.getElementById("voiceDockToggleMenu")?.addEventListener("click", () => {
  toggleVoiceDock(true);
});
document.getElementById("voiceDockCollapse")?.addEventListener("click", () => {
  toggleVoiceDock();
});

initVoiceChat();
