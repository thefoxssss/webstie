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
  adminGrantCashFromInput,
  adminSetCashFromInput,
  adminMultiplyCashFromInput,
  adminSetDebtFromInput,
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
  adminForgiveInterest,
  adminBoostStatsFromInput,
  adminSetJobCompletionsFromInput,
  adminMarketPumpFromInput,
  adminMarketDropFromInput,
  adminMarketMultiplyFromInput,
  adminSendChatAnnouncement,
  adminSendChatSystemMessage,
  adminClearRecentChatFromInput,
  adminUnlockAllAchievements,
  trackGamePlay,
  updateHighScore,
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
import { initByteBlitz } from "./games/byteblitz.js";
import { initCipherCrack } from "./games/ciphercrack.js";
import { initAstroHop } from "./games/astrohop.js";
import { initPulseStack } from "./games/pulsestack.js";
import { initGlitchGate } from "./games/glitchgate.js";
import { initOrbWeaver } from "./games/orbweaver.js";
import { initLaserLock } from "./games/laserlock.js";
import { initMetroMaze } from "./games/metromaze.js";
import { initStackSmash } from "./games/stacksmash.js";
import { initQuantumFlip } from "./games/quantumflip.js";
import { initUltimateTTT } from "./games/ultimatettt.js";
import { GAME_DIRECTORY_ENTRIES, GAME_TAG_EMOJI } from "./gameCatalog.js";

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
window.adminGrantCashFromInput = adminGrantCashFromInput;
window.adminSetCashFromInput = adminSetCashFromInput;
window.adminMultiplyCashFromInput = adminMultiplyCashFromInput;
window.adminSetDebtFromInput = adminSetDebtFromInput;
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
window.adminForgiveInterest = adminForgiveInterest;
window.adminBoostStatsFromInput = adminBoostStatsFromInput;
window.adminSetJobCompletionsFromInput = adminSetJobCompletionsFromInput;
window.adminMarketPumpFromInput = adminMarketPumpFromInput;
window.adminMarketDropFromInput = adminMarketDropFromInput;
window.adminMarketMultiplyFromInput = adminMarketMultiplyFromInput;
window.adminSendChatAnnouncement = adminSendChatAnnouncement;
window.adminSendChatSystemMessage = adminSendChatSystemMessage;
window.adminClearRecentChatFromInput = adminClearRecentChatFromInput;
window.adminUnlockAllAchievements = adminUnlockAllAchievements;
window.updateHighScore = updateHighScore;

// Launch a game by name, activate its overlay, and kick off its init routine.
window.launchGame = (game, source = "direct") => {
  window.__goonerLastGameLaunchSource = source;
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
  if (game === "byteblitz") initByteBlitz();
  if (game === "ciphercrack") initCipherCrack();
  if (game === "astrohop") initAstroHop();
  if (game === "pulsestack") initPulseStack();
  if (game === "glitchgate") initGlitchGate();
  if (game === "orbweaver") initOrbWeaver();
  if (game === "laserlock") initLaserLock();
  if (game === "metromaze") initMetroMaze();
  if (game === "stacksmash") initStackSmash();
  if (game === "quantumflip") initQuantumFlip();
  if (game === "ultimatettt") initUltimateTTT();
  resizeAllGameCanvases();
  trackGamePlay(game);
  updateRecentGames(game);
  document.dispatchEvent(new CustomEvent("gooner:games-library-updated"));
  unlockAchievement("noob");
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
  "overlayByteblitz",
  "overlayCiphercrack",
  "overlayAstrohop",
  "overlayPulsestack",
  "overlayGlitchgate",
  "overlayOrbweaver",
  "overlayLaserlock",
  "overlayMetromaze",
  "overlayStacksmash",
  "overlayQuantumflip",
  "overlayUltimatettt",
];


const CANVAS_UI_PADDING = 230;
const GAME_LIBRARY_FAVORITES_KEY = "goonerFavoriteGames";
const GAME_LIBRARY_RECENTS_KEY = "goonerRecentGames";
const GAME_LIBRARY_RECENT_LIMIT = 6;

function readStoredGameList(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

function writeStoredGameList(key, list) {
  localStorage.setItem(key, JSON.stringify(Array.from(new Set(list)).slice(0, GAME_LIBRARY_RECENT_LIMIT)));
}

function updateRecentGames(game) {
  if (!game) return;
  const recents = readStoredGameList(GAME_LIBRARY_RECENTS_KEY).filter((item) => item !== game);
  recents.unshift(game);
  writeStoredGameList(GAME_LIBRARY_RECENTS_KEY, recents);
}


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

function initGamesLibraryDiscovery() {
  const overlay = document.getElementById("overlayGames");
  const grid = overlay?.querySelector(".games-grid");
  const search = document.getElementById("gamesSearch");
  const filter = document.getElementById("gamesFilter");
  const sort = document.getElementById("gamesSort");
  const clearBtn = document.getElementById("gamesClearFilters");
  const meta = document.getElementById("gamesResultsMeta");
  if (!overlay || !grid || !search || !filter || !sort || !clearBtn || !meta) return;

  grid.innerHTML = "";
  GAME_DIRECTORY_ENTRIES.forEach((entry) => {
    const card = document.createElement("button");
    card.className = "game-card";
    card.dataset.game = entry.id;
    card.dataset.tags = entry.tags.join(" ");
    card.innerHTML = `<span class="game-icon">${entry.icon}</span><strong>${entry.title}</strong><small>${entry.description}</small>`;
    if (entry.hidden) {
      card.id = "btnFlappy";
      card.style.display = "none";
    }
    grid.appendChild(card);
  });

  const cards = Array.from(grid.querySelectorAll(".game-card"));
  cards.forEach((card) => {
    const name = (card.querySelector("strong")?.textContent || "").trim();
    const description = (card.querySelector("small")?.textContent || "").trim();
    const tags = (card.dataset.tags || "")
      .split(/\s+/)
      .map((tag) => tag.trim())
      .filter(Boolean);

    card.dataset.name = name;
    card.dataset.search = `${name} ${description} ${(card.dataset.tags || "")}`.toLowerCase();

    let tagsRow = card.querySelector(".game-tags");
    if (!tagsRow) {
      tagsRow = document.createElement("div");
      tagsRow.className = "game-tags";
      card.appendChild(tagsRow);
    }
    tagsRow.innerHTML = tags
      .map((tag) => {
        const emoji = GAME_TAG_EMOJI[tag] || "🏷️";
        const label = tag.toUpperCase();
        return `<span class="game-tag" data-tag-label="${label}" aria-label="${label}" role="img" tabindex="0">${emoji}</span>`;
      })
      .join("");

    if (card.id === "btnFlappy" && card.style.display === "none") card.dataset.locked = "1";
    card.title = "CLICK TO LAUNCH • SHIFT+CLICK OR RIGHT-CLICK TO FAVORITE";

    card.addEventListener("click", (event) => {
      if (event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(card.dataset.game || "");
        return;
      }
      window.launchGame(card.dataset.game || "", "directory");
    });

    card.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      toggleFavorite(card.dataset.game || "");
    });
  });

  function getFavorites() {
    return readStoredGameList(GAME_LIBRARY_FAVORITES_KEY);
  }

  function setFavorites(games) {
    localStorage.setItem(GAME_LIBRARY_FAVORITES_KEY, JSON.stringify(Array.from(new Set(games))));
  }

  function toggleFavorite(game) {
    if (!game) return;
    const favorites = getFavorites();
    const updated = favorites.includes(game)
      ? favorites.filter((item) => item !== game)
      : [...favorites, game];
    setFavorites(updated);
    applyLibraryView();
  }

  function sortCards(visibleCards) {
    const sortMode = sort.value;
    const favorites = getFavorites();
    const recents = readStoredGameList(GAME_LIBRARY_RECENTS_KEY);
    const recentIndex = new Map(recents.map((name, idx) => [name, idx]));
    const favoriteSet = new Set(favorites);

    visibleCards.sort((a, b) => {
      const nameA = (a.dataset.name || "").toLowerCase();
      const nameB = (b.dataset.name || "").toLowerCase();
      if (sortMode === "za") return nameB.localeCompare(nameA);
      if (sortMode === "recent") {
        const idxA = recentIndex.has(a.dataset.game || "") ? recentIndex.get(a.dataset.game || "") : 999;
        const idxB = recentIndex.has(b.dataset.game || "") ? recentIndex.get(b.dataset.game || "") : 999;
        if (idxA !== idxB) return idxA - idxB;
        return nameA.localeCompare(nameB);
      }
      if (sortMode === "favorite") {
        const favA = favoriteSet.has(a.dataset.game || "") ? 0 : 1;
        const favB = favoriteSet.has(b.dataset.game || "") ? 0 : 1;
        if (favA !== favB) return favA - favB;
        return nameA.localeCompare(nameB);
      }
      return nameA.localeCompare(nameB);
    });
  }

  function applyLibraryView() {
    const query = search.value.trim().toLowerCase();
    const filterMode = filter.value;
    const favoriteSet = new Set(getFavorites());
    const visibleCards = [];

    cards.forEach((card) => {
      const game = card.dataset.game || "";
      const isFavorite = favoriteSet.has(game);
      const isLocked = card.dataset.locked === "1" && card.style.display === "none";
      card.classList.toggle("is-favorite", isFavorite);
      card.dataset.badge = isFavorite ? "★" : "";

      if (isLocked) {
        card.style.display = "none";
        return;
      }

      const matchesQuery = !query || (card.dataset.search || "").includes(query);
      const tags = (card.dataset.tags || "").split(/\s+/).filter(Boolean);
      const matchesFilter =
        filterMode === "all" ||
        (filterMode === "favorites" ? isFavorite : tags.includes(filterMode));

      const show = matchesQuery && matchesFilter;
      card.style.display = show ? "flex" : "none";
      if (show) visibleCards.push(card);
    });

    sortCards(visibleCards);
    visibleCards.forEach((card) => grid.appendChild(card));
    meta.textContent = `SHOWING ${visibleCards.length}/${cards.length} GAMES • FAVORITES: ${favoriteSet.size} • RECENTS TRACKED: ${readStoredGameList(GAME_LIBRARY_RECENTS_KEY).length}`;
  }

  [search, filter, sort].forEach((el) => el.addEventListener("input", applyLibraryView));
  clearBtn.addEventListener("click", () => {
    search.value = "";
    filter.value = "all";
    sort.value = "az";
    applyLibraryView();
  });

  const observer = new MutationObserver(() => {
    if (overlay.classList.contains("active")) applyLibraryView();
  });
  observer.observe(overlay, { attributes: true, attributeFilter: ["class"] });
  document.addEventListener("gooner:games-library-updated", applyLibraryView);
  applyLibraryView();
}

function initTopBarOverlayControls() {
  const overlays = Array.from(document.querySelectorAll(".overlay"));
  const fsBtn = document.getElementById("topFullscreenBtn");
  const closeBtn = document.getElementById("topCloseBtn");
  if (!overlays.length || !fsBtn) return;

  const OVERLAY_TAB_MAP = {
    overlayConfig: "tabConfig",
    overlayBank: "tabBank",
    overlayShop: "tabShop",
    overlayProfile: "tabProfile",
    overlayScores: "tabScores",
    overlaySeason: "tabSeason",
    overlayCrew: "tabCrew",
    overlayAdmin: "tabAdmin",
    overlayGames: "menuToggle",
    overlayTrending: "",
    overlayUpdates: "",
  };

  const topTabs = ["tabConfig", "tabBank", "tabShop", "tabProfile", "tabScores", "tabSeason", "tabCrew", "tabAdmin", "menuToggle"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  topTabs.forEach((button) => {
    button.dataset.defaultLabel = button.textContent.trim();
    button.addEventListener("click", (event) => {
      if (button.dataset.exitMode !== "1") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const activeOverlay = getActiveOverlay();
      if (activeOverlay && GAME_OVERLAY_IDS.includes(activeOverlay.id)) {
        if (window.__goonerLastGameLaunchSource === "directory") {
          openGame("overlayGames");
        } else {
          closeOverlays();
        }
      } else {
        closeOverlays();
      }
      updateControls();
    }, true);
  });

  const getActiveOverlay = () => overlays.find((overlay) => overlay.classList.contains("active")) || null;
  const isFullscreenApplicable = (overlay) => Boolean(overlay && GAME_OVERLAY_IDS.includes(overlay.id) && getFullscreenTarget(overlay));

  function getExitTabButton(overlay) {
    if (!overlay) return null;
    if (GAME_OVERLAY_IDS.includes(overlay.id)) return document.getElementById("menuToggle");
    return document.getElementById(OVERLAY_TAB_MAP[overlay.id] || "") || null;
  }

  fsBtn.addEventListener("click", async () => {
    const activeOverlay = getActiveOverlay();
    if (!isFullscreenApplicable(activeOverlay)) return;
    try {
      await toggleGameFullscreen(activeOverlay, fsBtn);
    } catch (error) {
      console.warn("Fullscreen toggle failed", error);
    }
    updateControls();
  });

  function updateControls() {
    const activeOverlay = getActiveOverlay();
    const canFullscreen = isFullscreenApplicable(activeOverlay);
    const exitTab = getExitTabButton(activeOverlay);

    topTabs.forEach((button) => {
      button.dataset.exitMode = "0";
      button.textContent = button.dataset.defaultLabel || button.textContent;
    });

    if (exitTab && activeOverlay && activeOverlay.id !== "overlayLogin") {
      exitTab.dataset.exitMode = "1";
      exitTab.textContent = "EXIT";
    }

    fsBtn.style.display = canFullscreen ? "inline-flex" : "none";
    fsBtn.textContent = document.fullscreenElement ? "EXIT FULLSCREEN" : "FULLSCREEN";
    if (closeBtn) {
      const shouldShowClose = Boolean(activeOverlay && activeOverlay.id !== "overlayLogin" && !exitTab);
      closeBtn.style.display = shouldShowClose ? "inline-flex" : "none";
      closeBtn.textContent = "EXIT";
      closeBtn.onclick = () => {
        closeOverlays();
        updateControls();
      };
    }
  }

  const observer = new MutationObserver(updateControls);
  overlays.forEach((overlay) => observer.observe(overlay, { attributes: true, attributeFilter: ["class"] }));
  document.addEventListener("fullscreenchange", updateControls);
  updateControls();
}

initTopBarOverlayControls();
initGameCanvasSizing();
initGameVisibilityGuards();
initGamesLibraryDiscovery();

function hideGameOverModal() {
  document.getElementById("modalGameOver").classList.remove("active");
  document.querySelectorAll(".game-over-host").forEach((el) => el.classList.remove("game-over-host"));
}

// Restart the last game from the game-over modal.
document.getElementById("goRestart").onclick = () => {
  hideGameOverModal();
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
  if (state.currentGame === "byteblitz") initByteBlitz();
  if (state.currentGame === "ciphercrack") initCipherCrack();
  if (state.currentGame === "astrohop") initAstroHop();
  if (state.currentGame === "pulsestack") initPulseStack();
  if (state.currentGame === "glitchgate") initGlitchGate();
  if (state.currentGame === "orbweaver") initOrbWeaver();
  if (state.currentGame === "laserlock") initLaserLock();
  if (state.currentGame === "metromaze") initMetroMaze();
  if (state.currentGame === "stacksmash") initStackSmash();
  if (state.currentGame === "quantumflip") initQuantumFlip();
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
  hideGameOverModal();
};
