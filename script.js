import { buyItem, clearRestartListener, closeOverlays, openGame, showGameOver, stopAllGames, unlockAchievement, state } from "./core.js";
import { initGeometry } from "./games/geo.js";
import { initFlappy } from "./games/flappy.js";
import { initTypeGame } from "./games/type.js";
import { initPong, setPongDiff } from "./games/pong.js";
import { initSnake } from "./games/snake.js";
import { initRunner } from "./games/runner.js";
import { initBJ } from "./games/blackjack.js";
import { initTTT } from "./games/ttt.js";
import { initHangman } from "./games/hangman.js";

window.openGame = openGame;
window.closeOverlays = closeOverlays;
window.showGameOver = showGameOver;
window.buyItem = buyItem;
window.initTypeGame = initTypeGame;
window.setPongDiff = setPongDiff;

const overlayMap = {
  geo: "overlayGeo",
  ttt: "overlayTTT",
  hangman: "overlayHangman"
};

window.launchGame = (game) => {
  window.closeOverlays();
  const overlayId = overlayMap[game] || `overlay${game.charAt(0).toUpperCase()}${game.slice(1)}`;
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

document.getElementById("goExit").onclick = () => {
  stopAllGames();
  closeOverlays();
  document.getElementById("modalGameOver").classList.remove("active");
};
