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
  adminGrantAllShopItems,
  adminClearDebtAndCooldowns,
  adminSetPortfolioSharesFromInput,
  adminMarketCrashToZero,
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
  adminApplySettingActionFromInput,
  adminSetRoleFromInput,
  adminSetStatusFromInput,
  adminGrantPermissionFromInput,
  adminRevokePermissionFromInput,
  adminAddTagFromInput,
  adminRemoveTagFromInput,
  adminSetLimitFromInput,
  adminSetPreferenceFromInput,
  adminRemoveRestrictionFromInput,
  adminLogAdminActionFromInput,
  adminScheduleTaskFromInput,
  adminClearScheduledTasksFromInput,
  adminUnlockAllAchievements,
  trackGamePlay,
  updateHighScore,
  getShopItemById,
  openGameLeaderboard,
  showToast,
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
import { initSlots } from "./games/slots.js";
import { initBonkArena } from "./games/bonkarena.js";
import { initDrift } from "./games/drift.js";
import { initCoreBreaker } from "./games/corebreaker.js";
import { initNeonDefender } from "./games/neondefender.js";
import { initVoidMiner } from "./games/voidminer.js";
import { initCoreDriller } from "./games/coredriller.js";
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
import { initSmashArena } from "./games/smasharena.js";
import { initWar } from "./games/war.js";
import { initVideoPoker } from "./games/videopoker.js";
import { initCraps } from "./games/craps.js";
import { initBaccarat } from "./games/baccarat.js";
import { initMines } from "./games/mines.js";
import { GAME_DIRECTORY_ENTRIES } from "./gameCatalog.js";

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
window.adminGrantAllShopItems = adminGrantAllShopItems;
window.adminClearDebtAndCooldowns = adminClearDebtAndCooldowns;
window.adminSetPortfolioSharesFromInput = adminSetPortfolioSharesFromInput;
window.adminMarketCrashToZero = adminMarketCrashToZero;
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
window.adminApplySettingActionFromInput = adminApplySettingActionFromInput;
window.adminSetRoleFromInput = adminSetRoleFromInput;
window.adminSetStatusFromInput = adminSetStatusFromInput;
window.adminGrantPermissionFromInput = adminGrantPermissionFromInput;
window.adminRevokePermissionFromInput = adminRevokePermissionFromInput;
window.adminAddTagFromInput = adminAddTagFromInput;
window.adminRemoveTagFromInput = adminRemoveTagFromInput;
window.adminSetLimitFromInput = adminSetLimitFromInput;
window.adminSetPreferenceFromInput = adminSetPreferenceFromInput;
window.adminRemoveRestrictionFromInput = adminRemoveRestrictionFromInput;
window.adminLogAdminActionFromInput = adminLogAdminActionFromInput;
window.adminScheduleTaskFromInput = adminScheduleTaskFromInput;
window.adminClearScheduledTasksFromInput = adminClearScheduledTasksFromInput;
window.adminUnlockAllAchievements = adminUnlockAllAchievements;
window.updateHighScore = updateHighScore;



function isCountBasedShopItem(item) {
  if (!item) return false;
  return Boolean(item.stackable || item.countBased || item.type === "consumable");
}

function renderInGameShopPanel(game, overlayId) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  overlay.querySelectorAll(".game-side-shop").forEach((panel) => panel.remove());
  overlay.classList.add("has-game-side-shop");

  const entry = GAME_DIRECTORY_ENTRIES.find((candidate) => candidate.id === game);
  const relatedItems = Array.isArray(entry?.shopItems) ? entry.shopItems : [];

  const panel = document.createElement("aside");
  panel.className = "game-side-shop";
  panel.innerHTML = '<h3>GAME SHOP</h3><p class="game-side-shop-meta">TOGGLES + QUICK BUY</p>';

  if (!relatedItems.length) {
    const empty = document.createElement("div");
    empty.className = "game-side-shop-empty";
    empty.textContent = "NO SPECIAL ITEMS FOR THIS GAME.";
    panel.appendChild(empty);
    overlay.appendChild(panel);
    return;
  }

  relatedItems.forEach((itemId) => {
    const item = getShopItemById(itemId);
    if (!item) return;
    const ownedCount = state.myInventory.filter((ownedId) => ownedId === itemId).length;
    const ownsItem = ownedCount > 0;
    const isEnabled = state.myItemToggles[itemId] !== false;
    const isCountBased = isCountBasedShopItem(item);

    const row = document.createElement("div");
    row.className = "game-side-shop-row";

    const details = document.createElement("div");
    details.className = "game-side-shop-details";
    details.innerHTML = `<strong>${item.icon || "🛒"} ${item.name}</strong><small>${item.desc}</small><small>${ownsItem ? `OWNED x${ownedCount}` : `$${item.cost}`}</small>`;

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "6px";

    const buyBtn = document.createElement("button");
    buyBtn.className = "term-btn game-side-shop-action";
    const canBuyAgain = !ownsItem || isCountBased;
    buyBtn.textContent = state.myMoney >= item.cost ? `BUY $${item.cost}` : `NEED $${item.cost}`;
    buyBtn.disabled = state.myMoney < item.cost || !canBuyAgain;
    if (!canBuyAgain) buyBtn.textContent = "OWNED";
    buyBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      buyItem(itemId);
      renderInGameShopPanel(game, overlayId);
    });

    actions.appendChild(buyBtn);

    if (ownsItem) {
      const toggleBtn = document.createElement("button");
      toggleBtn.className = "term-btn game-side-shop-action";
      toggleBtn.textContent = isEnabled ? "ON" : "OFF";
      toggleBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleItem(itemId);
        renderInGameShopPanel(game, overlayId);
      });
      actions.appendChild(toggleBtn);
    }

    row.append(details, actions);
    panel.appendChild(row);
  });

  overlay.appendChild(panel);
}

function getOverlayIdForGame(gameId) {
  if (!gameId) return "";
  return `overlay${gameId === "ttt" ? gameId.toUpperCase() : gameId.charAt(0).toUpperCase() + gameId.slice(1)}`;
}

const SHARED_GAME_OVERLAY_ID = "overlayGamebox";
let mountedGameOverlayId = "";

function updateSharedGameboxHeader(_gameId) {}

function mountGameOverlayIntoGamebox(gameId) {
  const targetOverlayId = getOverlayIdForGame(gameId);
  const gameboxContent = document.getElementById("gameboxContent");
  const templatesRoot = document.getElementById("gameOverlayTemplates");
  const sharedOverlay = document.getElementById(SHARED_GAME_OVERLAY_ID);
  if (!gameboxContent || !templatesRoot || !sharedOverlay) return targetOverlayId;

  if (mountedGameOverlayId && mountedGameOverlayId !== targetOverlayId) {
    const previousOverlay = document.getElementById(mountedGameOverlayId);
    if (previousOverlay) {
      previousOverlay.classList.remove("active", "gamebox-mounted");
      templatesRoot.appendChild(previousOverlay);
    }
  }

  const nextOverlay = document.getElementById(targetOverlayId);
  if (!nextOverlay) return targetOverlayId;
  nextOverlay.classList.remove("active");
  nextOverlay.classList.add("gamebox-mounted");
  gameboxContent.innerHTML = "";
  gameboxContent.appendChild(nextOverlay);
  gameboxContent.scrollTop = 0;
  nextOverlay.scrollTop = 0;
  sharedOverlay.scrollTop = 0;
  mountedGameOverlayId = targetOverlayId;
  updateSharedGameboxHeader(gameId);
  return SHARED_GAME_OVERLAY_ID;
}

function initSharedGamebox() {
  const templatesRoot = document.getElementById("gameOverlayTemplates");
  if (!templatesRoot) return;
  GAME_TEMPLATE_OVERLAY_IDS.forEach((overlayId) => {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    overlay.classList.remove("active");
    // Ensure we keep overlays top-level so they can take over the screen.
    // Moving them to templatesRoot causes them to be hidden permanently unless mounted.
    if (overlay.parentElement === templatesRoot) {
      document.body.appendChild(overlay);
    }
  });
}

// Launch a game by name, activate its overlay, and kick off its init routine.
window.launchGame = (game, source = "direct") => {
  window.__goonerLastGameLaunchSource = source;
  window.closeOverlays();

  // We bypass mountGameOverlayIntoGamebox so the game takes over the screen
  // with its own full-page overlay instead of opening in a sub-frame.
  const overlayId = getOverlayIdForGame(game);
  const el = document.getElementById(overlayId);
  if (el) {
    el.classList.remove("gamebox-mounted");
    el.classList.add("active");
  }

  renderInGameShopPanel(game, overlayId);
  if (game === "pong") initPong();
  if (game === "snake") initSnake();
  if (game === "runner") initRunner();
  if (game === "geo") {
    // Show the menu first instead of launching straight into the game
    window.showGeoMenu();
  }
  if (game === "type") initTypeGame();
  if (game === "blackjack") initBJ();
  if (game === "ttt") initTTT();
  if (game === "hangman") initHangman();
  if (game === "flappy") initFlappy();
  if (game === "dodge") initDodge();
  if (game === "roulette") initRoulette();
  if (game === "slots") initSlots();
  if (game === "bonk") initBonkArena();
  if (game === "drift") initDrift();
  if (game === "corebreaker") initCoreBreaker();
  if (game === "neondefender") initNeonDefender();
  if (game === "voidminer") initVoidMiner();
  if (game === "coredriller") initCoreDriller();
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
  if (game === "smasharena") initSmashArena();
  if (game === "war") initWar();
  if (game === "videopoker") initVideoPoker();
  if (game === "craps") initCraps();
  if (game === "baccarat") initBaccarat();
  if (game === "mines") initMines();
  if (typeof window.__updateGameSwitcherState === "function") window.__updateGameSwitcherState(game);
  resizeAllGameCanvases();
  trackGamePlay(game);
  updateRecentGames(game);
  document.dispatchEvent(new CustomEvent("gooner:games-library-updated"));
  unlockAchievement("noob");
};


const GAME_TEMPLATE_OVERLAY_IDS = [
  "overlayGeo",
  "overlayType",
  "overlayPong",
  "overlaySnake",
  "overlayRunner",
  "overlayCorebreaker",
  "overlayNeondefender",
  "overlayVoidminer",
  "overlayCoredriller",
  "overlayShadowassassin",
  "overlayDodge",
  "overlayRoulette",
  "overlaySlots",
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
  "overlaySmasharena",
  "overlayVideopoker",
  "overlayCraps",
  "overlayBaccarat",
  "overlayMines",
];

const GAME_OVERLAY_IDS = [
  ...GAME_TEMPLATE_OVERLAY_IDS,
  SHARED_GAME_OVERLAY_ID,
];



function disableInGameExitButtons() {
  GAME_OVERLAY_IDS.forEach((overlayId) => {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    overlay.querySelectorAll(".exit-btn-fixed").forEach((button) => {
      button.style.display = "none";
    });
  });
}

function initPerGameFullscreenButtons() {
  GAME_TEMPLATE_OVERLAY_IDS.forEach((overlayId) => {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;

    const existingFullscreenBtn = overlay.querySelector(".fullscreen-btn-fixed, #voidMinerFullscreenBtn");
    if (existingFullscreenBtn) {
      existingFullscreenBtn.classList.add("fullscreen-btn-fixed");
      return;
    }

    if (!getFullscreenTarget(overlay)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fullscreen-btn-fixed";
    button.textContent = "FULLSCREEN";
    button.addEventListener("click", async () => {
      try {
        await toggleGameFullscreen(overlay, button);
      } catch (error) {
        console.warn("Game fullscreen toggle failed", error);
      }
    });
    overlay.appendChild(button);
  });

  document.addEventListener("fullscreenchange", () => {
    document.querySelectorAll(".fullscreen-btn-fixed").forEach((button) => {
      button.textContent = document.fullscreenElement ? "EXIT FULLSCREEN" : "FULLSCREEN";
    });
  });
}

const CANVAS_UI_PADDING = 230;
const GAMEBOX_UI_PADDING = 130;
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
  const unique = Array.from(new Set(list));
  const capped = key === GAME_LIBRARY_RECENTS_KEY ? unique.slice(0, GAME_LIBRARY_RECENT_LIMIT) : unique;
  localStorage.setItem(key, JSON.stringify(capped));
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
  const gameboxContent = canvas.closest("#overlayGamebox .gamebox-content");
  const gameboxActive = Boolean(document.getElementById("overlayGamebox")?.classList.contains("active"));
  const availW = isFullscreen
    ? window.innerWidth
    : gameboxContent && gameboxActive
      ? Math.max(180, gameboxContent.clientWidth - 20)
      : window.innerWidth * 0.95;
  const availH = isFullscreen
    ? window.innerHeight
    : gameboxContent && gameboxActive
      ? Math.max(120, gameboxContent.clientHeight - GAMEBOX_UI_PADDING)
      : Math.max(120, window.innerHeight - CANVAS_UI_PADDING);
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
  // Keep the active game visible/stateful when switching browser tabs.
  // We only stop active games when explicitly launching a different overlay/game.
  if (document.hidden) return;
}

function initGameVisibilityGuards() {
  document.addEventListener("visibilitychange", pauseGamesWhenHidden);
  window.addEventListener("blur", pauseGamesWhenHidden);
}

function initGameScroller() {
  const orderedGames = GAME_DIRECTORY_ENTRIES
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      icon: entry.icon,
      description: entry.description,
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      overlayId: getOverlayIdForGame(entry.id),
      searchText: `${entry.id} ${entry.title} ${entry.description || ""} ${(entry.tags || []).join(" ")}`.toUpperCase(),
    }))
    .filter((entry) => document.getElementById(entry.overlayId));
  if (!orderedGames.length) return;

  const strip = document.getElementById("gameboxGameStrip");
  const filterToggle = document.getElementById("gameboxFilterToggle");
  const searchToggle = document.getElementById("gameboxSearchToggle");
  const searchInput = document.getElementById("gameboxSearchInput");
  const switchBtn = document.getElementById("gameboxSwitchBtn");
  if (!strip || !filterToggle || !searchToggle || !searchInput || !switchBtn) return;

  let gameSearchQuery = "";
  let selectedGameId = "";
  let centerOnGameId = "";
  const FILTER_MODES = ["az", "za", "trending", "favorites"];
  let currentFilterIndex = 0;
  let suppressClickUntil = 0;

  const getFavorites = () => {
    const valid = new Set(orderedGames.map((entry) => entry.id));
    return readStoredGameList(GAME_LIBRARY_FAVORITES_KEY).filter((gameId) => valid.has(gameId));
  };

  const toggleFavorite = (gameId) => {
    if (!gameId) return;
    const favorites = getFavorites();
    const nextFavorites = favorites.includes(gameId)
      ? favorites.filter((item) => item !== gameId)
      : [gameId, ...favorites];
    writeStoredGameList(GAME_LIBRARY_FAVORITES_KEY, nextFavorites);
  };

  const centerCardInStrip = (cardEl) => {
    if (!cardEl) return;
    const left = Math.max(0, cardEl.offsetLeft - (strip.clientWidth - cardEl.clientWidth) / 2);
    strip.scrollTo({ left, behavior: "smooth" });
  };

  const getVisibleGames = () => {
    const query = String(gameSearchQuery || "").trim().toUpperCase();
    const favorites = new Set(getFavorites());
    const recents = readStoredGameList(GAME_LIBRARY_RECENTS_KEY);
    const recentRank = new Map(recents.map((gameId, idx) => [gameId, idx]));
    const mode = FILTER_MODES[currentFilterIndex] || "az";
    const filtered = orderedGames.filter((game) => {
      if (!query) return true;
      return game.searchText.includes(query);
    });

    if (mode === "favorites") {
      return filtered
        .filter((game) => favorites.has(game.id))
        .sort((a, b) => a.title.localeCompare(b.title));
    }

    if (mode === "za") {
      return filtered.slice().sort((a, b) => b.title.localeCompare(a.title));
    }

    if (mode === "trending") {
      return filtered.slice().sort((a, b) => {
        const aRank = recentRank.has(a.id) ? recentRank.get(a.id) : Number.POSITIVE_INFINITY;
        const bRank = recentRank.has(b.id) ? recentRank.get(b.id) : Number.POSITIVE_INFINITY;
        if (aRank !== bRank) return aRank - bRank;
        return a.title.localeCompare(b.title);
      });
    }

    return filtered.slice().sort((a, b) => a.title.localeCompare(b.title));
  };

  const renderStrip = () => {
    strip.innerHTML = "";
    const mode = FILTER_MODES[currentFilterIndex] || "az";
    filterToggle.classList.toggle("active", mode === "favorites" || mode === "trending");
    const filterLabels = {
      az: "FILTER: A-Z",
      za: "FILTER: Z-A",
      trending: "FILTER: TRENDING",
      favorites: "FILTER: FAVORITES",
    };
    filterToggle.textContent = filterLabels[mode] || "FILTER: A-Z";
    const favoriteSet = new Set(getFavorites());
    const visibleGames = getVisibleGames();
    if (!visibleGames.length) {
      strip.innerHTML = '<div class="score-item">NO GAMES MATCH SEARCH</div>';
      return;
    }

    visibleGames.forEach((game) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `leaderboard-game-card${selectedGameId === game.id ? " active" : ""}${favoriteSet.has(game.id) ? " is-favorite" : ""}`;
      btn.dataset.game = game.id;
      btn.innerHTML = `<span class="game-strip-icon-row"><span>${game.icon || "🎮"}</span></span><strong>${game.title}</strong><small>${game.description || ""}</small><small class="game-picker-hint">CLICK TO PLAY</small>`;
      btn.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        toggleFavorite(game.id);
        renderStrip();
      });
      btn.addEventListener("click", (event) => {
        if (Date.now() < suppressClickUntil) return;
        if (event.shiftKey) {
          toggleFavorite(game.id);
          renderStrip();
          return;
        }
        selectedGameId = game.id;
        centerOnGameId = game.id;
        window.launchGame(game.id, "directory");
      });
      strip.appendChild(btn);
    });

    if (centerOnGameId) {
      const selectedCard = strip.querySelector(`[data-game="${centerOnGameId}"]`);
      if (selectedCard) requestAnimationFrame(() => centerCardInStrip(selectedCard));
      centerOnGameId = "";
    }
  };

  filterToggle.addEventListener("click", () => {
    currentFilterIndex = (currentFilterIndex + 1) % FILTER_MODES.length;
    renderStrip();
  });

  searchToggle.addEventListener("click", () => {
    const opening = searchInput.style.display === "none";
    searchInput.style.display = opening ? "block" : "none";
    if (opening) searchInput.focus();
    else {
      searchInput.value = "";
      gameSearchQuery = "";
      renderStrip();
    }
  });

  searchInput.addEventListener("input", () => {
    gameSearchQuery = String(searchInput.value || "");
    if (typeof window.__setLeaderboardSearchQuery === "function") {
      window.__setLeaderboardSearchQuery(gameSearchQuery, { deferLoad: true });
    }
    renderStrip();
  });

  const headingTitle = document.getElementById("gameboxHeadingTitle");
  const leaderboardPanel = document.getElementById("gameboxLeaderboardPanel");
  const gameFrame = document.querySelector("#overlayGamebox .gamebox-frame");

  const setGameboxView = (view) => {
    const normalized = view === "leaderboard" ? "leaderboard" : "games";
    const inLeaderboard = normalized === "leaderboard";
    if (headingTitle) headingTitle.textContent = inLeaderboard ? "LEADERBOARD" : "GAMES";
    switchBtn.textContent = inLeaderboard ? "GAMES" : "LEADERBOARD";
    filterToggle.style.display = inLeaderboard ? "none" : "inline-flex";
    strip.style.display = inLeaderboard ? "none" : "grid";
    if (gameFrame) gameFrame.style.display = "none";
    if (leaderboardPanel) leaderboardPanel.style.display = inLeaderboard ? "grid" : "none";
    const sharedOverlay = document.getElementById(SHARED_GAME_OVERLAY_ID);
    if (sharedOverlay) {
      sharedOverlay.querySelectorAll(".game-side-shop").forEach((panel) => panel.remove());
      sharedOverlay.classList.add("has-game-side-shop");
    }
    if (!inLeaderboard && selectedGameId) {
      renderInGameShopPanel(selectedGameId, SHARED_GAME_OVERLAY_ID);
    }
    if (inLeaderboard && typeof window.loadLeaderboard === "function") {
      window.loadLeaderboard();
      requestAnimationFrame(renderLeaderboardModesInShopPanel);
    }
  };

  const renderLeaderboardModesInShopPanel = () => {
    const overlay = document.getElementById(SHARED_GAME_OVERLAY_ID);
    const modeList = document.getElementById("leaderboardModeList");
    if (!overlay || !modeList) return;
    overlay.querySelectorAll(".game-side-shop").forEach((panel) => panel.remove());

    const panel = document.createElement("aside");
    panel.className = "game-side-shop";
    panel.innerHTML = '<h3>GAME MODES</h3><p class="game-side-shop-meta">SELECT DIFFICULTY / MODE</p>';

    const modeButtons = Array.from(modeList.querySelectorAll("button"));
    if (!modeButtons.length) {
      const empty = document.createElement("p");
      empty.className = "game-side-shop-empty";
      empty.textContent = "NO MODES AVAILABLE";
      panel.appendChild(empty);
    } else {
      modeButtons.forEach((modeButton) => {
        const row = document.createElement("div");
        row.className = "game-side-shop-row";
        const action = document.createElement("button");
        action.className = `term-btn game-side-shop-action${modeButton.classList.contains("active") ? " active" : ""}`;
        action.textContent = modeButton.textContent || "MODE";
        action.addEventListener("click", () => {
          modeButton.click();
          requestAnimationFrame(renderLeaderboardModesInShopPanel);
        });
        row.appendChild(action);
        panel.appendChild(row);
      });
    }

    overlay.appendChild(panel);
  };

  const modeList = document.getElementById("leaderboardModeList");
  if (modeList) {
    const modeObserver = new MutationObserver(() => {
      if (switchBtn.textContent === "GAMES") renderLeaderboardModesInShopPanel();
    });
    modeObserver.observe(modeList, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  switchBtn.addEventListener("click", () => {
    const isLeaderboard = switchBtn.textContent === "GAMES";
    if (isLeaderboard) {
      setGameboxView("games");
      return;
    }
    const targetGame = selectedGameId || String(state.currentGame || "").toLowerCase();
    if (targetGame && typeof openGameLeaderboard === "function") {
      openGameLeaderboard(targetGame);
      return;
    }
    setGameboxView("leaderboard");
  });

  window.__updateGameSwitcherState = (activeGameId) => {
    if (!activeGameId) return;
    selectedGameId = activeGameId;
    strip.dataset.selectedGame = activeGameId;
    centerOnGameId = activeGameId;
    renderStrip();
  };

  window.__setGameScrollerSearchQuery = (query) => {
    gameSearchQuery = String(query || "");
    searchInput.value = gameSearchQuery;
    renderStrip();
  };

  window.__getSelectedGameScrollerId = () => String(selectedGameId || strip.dataset.selectedGame || "");


  window.__setGameboxView = (view) => setGameboxView(view);
  window.__isGameboxLeaderboardVisible = () => Boolean(leaderboardPanel && leaderboardPanel.style.display !== "none");

  window.__ensureGameboxHasGame = () => {
    setGameboxView("games");
  };

  renderStrip();
  setGameboxView("games");
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



function initMainSiteSearch() {
  const form = document.getElementById("siteSearchForm");
  const input = document.getElementById("siteSearchInput");
  const meta = document.getElementById("siteSearchMeta");
  const dropdown = document.getElementById("siteSearchDropdown");
  if (!form || !input || !meta || !dropdown) return;

  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("spellcheck", "false");

  const QUICK_ROUTES = [
    { aliases: ["games", "game", "directory"], action: () => openGame("overlayGamebox"), label: "OPENED GAMES PANEL", overlayId: "overlayGamebox" },
    { aliases: ["trending", "trend"], action: () => openGame("overlayTrending"), label: "OPENED TRENDING GAMES", overlayId: "overlayTrending" },
    { aliases: ["updates", "update", "log", "update log", "patch notes"], action: () => openGame("overlayUpdates"), label: "OPENED UPDATE LOG", overlayId: "overlayUpdates" },
    { aliases: ["bank", "money"], action: () => openGame("overlayBank"), label: "OPENED BANK PANEL", overlayId: "overlayBank" },
    { aliases: ["shop", "store", "black market"], action: () => openGame("overlayShop"), label: "OPENED SHOP PANEL", overlayId: "overlayShop" },
    { aliases: ["profile", "account", "stats"], action: () => openGame("overlayProfile"), label: "OPENED PROFILE PANEL", overlayId: "overlayProfile" },
    { aliases: ["scores", "leaderboard", "ranks"], action: () => { openGame("overlayGamebox"); if (typeof window.__setGameboxView === "function") window.__setGameboxView("leaderboard"); }, label: "OPENED LEADERBOARD PANEL", overlayId: "overlayGamebox" },
    { aliases: ["season", "battle pass"], action: () => openGame("overlaySeason"), label: "OPENED SEASON PANEL", overlayId: "overlaySeason" },
    { aliases: ["crew", "clan", "guild"], action: () => openGame("overlayCrew"), label: "OPENED CREW PANEL", overlayId: "overlayCrew" },
    { aliases: ["config", "settings"], action: () => openGame("overlayConfig"), label: "OPENED CONFIG PANEL", overlayId: "overlayConfig" },
  ];

  let activeSuggestions = [];
  let activeSuggestionIndex = -1;

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function tokenize(value) {
    return normalize(value).split(" ").filter(Boolean);
  }

  function getRouteSearchCorpus(route) {
    const overlay = route.overlayId ? document.getElementById(route.overlayId) : null;
    const overlayText = overlay ? normalize(overlay.textContent) : "";
    const aliasText = normalize(route.aliases.join(" "));
    return { aliasText, overlayText };
  }

  function scoreRouteMatch(route, query) {
    const { aliasText, overlayText } = getRouteSearchCorpus(route);
    const aliasParts = route.aliases.map((alias) => normalize(alias));

    let score = 99;
    aliasParts.forEach((alias) => {
      if (alias === query) score = Math.min(score, 0);
      else if (alias.startsWith(query)) score = Math.min(score, 1);
      else if (alias.includes(query)) score = Math.min(score, 2);
      else if (query.startsWith(alias)) score = Math.min(score, 3);
    });

    if (score < 99) return score;
    if (aliasText && aliasText.includes(query)) return 4;
    if (overlayText && overlayText.includes(query)) return 20;
    return 99;
  }

  function findBestGameMatch(query) {
    return GAME_DIRECTORY_ENTRIES
      .filter((entry) => !entry.hidden)
      .map((entry) => ({ entry, score: scoreGameSuggestion(entry, query) }))
      .filter((item) => item.score < 99)
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return a.entry.title.localeCompare(b.entry.title);
      })[0] || null;
  }

  function scoreGameSuggestion(entry, query) {
    const title = normalize(entry.title);
    const gameId = normalize(entry.id);
    const tags = tokenize(normalize(entry.tags.join(" ")));
    const descriptionTokens = tokenize(normalize(entry.description));
    const queryTokens = tokenize(query);

    if (title === query) return 0;
    if (title.startsWith(query)) return 1;
    if (title.includes(query)) return 2;
    if (gameId === query) return 3;
    if (gameId.startsWith(query)) return 4;
    if (gameId.includes(query)) return 5;

    const tagMatch = queryTokens.every((token) => tags.some((tag) => tag.includes(token)));
    if (tagMatch) return 6;

    const descriptionMatch = queryTokens.every((token) => descriptionTokens.some((word) => word.includes(token)));
    if (descriptionMatch) return 7;

    return 99;
  }

  function buildSuggestions(rawQuery) {
    const query = normalize(rawQuery);
    if (!query) return [];

    const gameSuggestions = GAME_DIRECTORY_ENTRIES
      .filter((entry) => !entry.hidden)
      .map((entry) => ({ entry, score: scoreGameSuggestion(entry, query) }))
      .filter((item) => item.score < 99)
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return a.entry.title.localeCompare(b.entry.title);
      })
      .slice(0, 6)
      .map((item) => ({
        type: "game",
        value: item.entry.title,
        subtitle: item.entry.description,
      }));

    const routeSuggestions = QUICK_ROUTES
      .map((route) => ({ route, bestScore: scoreRouteMatch(route, query) }))
      .filter((item) => item.bestScore < 99)
      .sort((a, b) => a.bestScore - b.bestScore)
      .slice(0, 3)
      .map((item) => ({
        type: "route",
        value: item.route.aliases[0].toUpperCase(),
        subtitle: item.route.label,
      }));

    return [...gameSuggestions, ...routeSuggestions].slice(0, 7);
  }

  function hideSuggestions() {
    dropdown.classList.remove("active");
    dropdown.innerHTML = "";
    activeSuggestions = [];
    activeSuggestionIndex = -1;
  }

  function renderSuggestions(rawQuery) {
    if (document.activeElement !== input) {
      hideSuggestions();
      return;
    }
    activeSuggestions = buildSuggestions(rawQuery);
    activeSuggestionIndex = -1;
    if (!activeSuggestions.length) {
      hideSuggestions();
      return;
    }

    dropdown.innerHTML = activeSuggestions
      .map((suggestion, index) => `<button class="site-search-option" type="button" data-suggest-index="${index}"><strong>${suggestion.value}</strong><small>${suggestion.subtitle}</small></button>`)
      .join("");
    dropdown.classList.add("active");
  }

  function setActiveSuggestion(index) {
    const options = Array.from(dropdown.querySelectorAll(".site-search-option"));
    options.forEach((option, optionIndex) => option.classList.toggle("active", optionIndex === index));
    activeSuggestionIndex = index;
  }

  function executeSearch(rawInput) {
    const query = normalize(rawInput);
    if (!query) {
      meta.textContent = "ENTER A SEARCH TERM TO JUMP THROUGH THE TERMINAL.";
      return;
    }

    const bestRoute = QUICK_ROUTES
      .map((route) => ({ route, score: scoreRouteMatch(route, query) }))
      .filter((item) => item.score < 99)
      .sort((a, b) => a.score - b.score)[0] || null;

    const bestGame = findBestGameMatch(query);

    if (bestGame && bestGame.score <= 2) {
      window.launchGame(bestGame.entry.id, "site-search");
      meta.textContent = `LAUNCHED ${bestGame.entry.title.toUpperCase()} // MATCHED "${query.toUpperCase()}"`;
      return;
    }

    if (bestRoute && bestRoute.score <= 4) {
      bestRoute.route.action();
      meta.textContent = `${bestRoute.route.label} // SEARCH: ${query.toUpperCase()}`;
      return;
    }

    if (bestGame) {
      window.launchGame(bestGame.entry.id, "site-search");
      meta.textContent = `LAUNCHED ${bestGame.entry.title.toUpperCase()} // MATCHED "${query.toUpperCase()}"`;
      return;
    }

    if (bestRoute) {
      bestRoute.route.action();
      meta.textContent = `${bestRoute.route.label} // SEARCH: ${query.toUpperCase()}`;
      return;
    }

    openGame("overlayGamebox");
    if (typeof window.__setGameScrollerSearchQuery === "function") {
      window.__setGameScrollerSearchQuery(query);
    }
    meta.textContent = `NO DIRECT MATCH. OPENED GAMES SEARCH FOR "${query.toUpperCase()}".`;
    return;

  }

  input.addEventListener("focus", () => renderSuggestions(input.value));
  input.addEventListener("input", () => renderSuggestions(input.value));
  input.addEventListener("keydown", (event) => {
    if (!activeSuggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = activeSuggestionIndex < activeSuggestions.length - 1 ? activeSuggestionIndex + 1 : 0;
      setActiveSuggestion(next);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = activeSuggestionIndex > 0 ? activeSuggestionIndex - 1 : activeSuggestions.length - 1;
      setActiveSuggestion(prev);
      return;
    }
    if (event.key === "Escape") {
      hideSuggestions();
      return;
    }
    if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      const selected = activeSuggestions[activeSuggestionIndex];
      input.value = selected.value;
      hideSuggestions();
      form.requestSubmit();
    }
  });

  input.addEventListener("blur", () => {
    setTimeout(() => {
      if (!dropdown.matches(":hover")) hideSuggestions();
    }, 120);
  });

  dropdown.addEventListener("mousedown", (event) => {
    const option = event.target.closest(".site-search-option");
    if (!option) return;
    event.preventDefault();
    const index = Number(option.dataset.suggestIndex || -1);
    const selected = activeSuggestions[index];
    if (!selected) return;
    input.value = selected.value;
    hideSuggestions();
    form.requestSubmit();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    hideSuggestions();
    executeSearch(input.value);
  });
}

function initAdminTabs() {
  const tabs = document.querySelectorAll('#adminTabs .score-tab');
  const contents = document.querySelectorAll('.admin-tab-content');
  if (!tabs.length || !contents.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.adminTab;
      tabs.forEach((t) => t.classList.remove('active'));
      contents.forEach((c) => {
        c.style.display = 'none';
        c.classList.remove('active');
      });
      tab.classList.add('active');
      const targetContent = document.getElementById('adminTab' + targetId.charAt(0).toUpperCase() + targetId.slice(1));
      if (targetContent) {
        targetContent.style.display = 'block';
        targetContent.classList.add('active');
      }
    });
  });
}

function initTopBarOverlayControls() {
  const overlays = Array.from(document.querySelectorAll(".overlay"));
  const fsBtn = document.getElementById("topFullscreenBtn");
  if (!overlays.length || !fsBtn) return;

  const OVERLAY_TAB_MAP = {
    overlayConfig: "tabConfig",
    overlayBank: "tabBank",
    overlayShop: "tabShop",
    overlayInventory: "tabInventory",
    overlayProfile: "tabProfile",
    overlaySeason: "tabSeason",
    overlayCrew: "tabCrew",
    overlayAdmin: "tabAdmin",
    overlayGamebox: "menuToggle",
    overlayTrending: "menuToggle",
    overlayUpdates: "menuToggle",
  };

  const topTabs = ["tabConfig", "tabBank", "tabShop", "tabInventory", "tabProfile", "tabSeason", "tabCrew", "tabAdmin", "menuToggle"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  topTabs.forEach((button) => {
    button.dataset.defaultLabel = button.textContent.trim();
    button.addEventListener("click", (event) => {
      if (button.dataset.exitMode !== "1") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const activeOverlay = getActiveOverlay();
      if (activeOverlay && TOP_PANEL_OVERLAY_IDS.includes(activeOverlay.id) && typeof window.toggleTopPanelOverlay === "function") {
        window.toggleTopPanelOverlay(activeOverlay.id);
      } else if (activeOverlay && GAME_OVERLAY_IDS.includes(activeOverlay.id)) {
        if (window.__goonerLastGameLaunchSource === "directory") {
          openGame("overlayGamebox");
        } else {
          closeOverlays();
        }
      } else {
        closeOverlays();
      }
      updateControls();
    }, true);
  });

  const TOP_PANEL_OVERLAY_IDS = [
    "overlayConfig",
    "overlayBank",
    "overlayShop",
    "overlayInventory",
    "overlayProfile",
    "overlaySeason",
    "overlayCrew",
    "overlayAdmin",
    "overlayGamebox",
  ];

  const getActiveOverlay = () => {
    for (const overlayId of TOP_PANEL_OVERLAY_IDS) {
      const overlay = document.getElementById(overlayId);
      if (overlay?.classList.contains("active")) return overlay;
    }
    return overlays.slice().reverse().find((overlay) => overlay.classList.contains("active")) || null;
  };
  const isFullscreenApplicable = (overlay) => Boolean(overlay && GAME_OVERLAY_IDS.includes(overlay.id) && getFullscreenTarget(overlay));

  function getExitTabButton(overlay) {
    if (!overlay) return null;
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
  }

  const observer = new MutationObserver(updateControls);
  overlays.forEach((overlay) => observer.observe(overlay, { attributes: true, attributeFilter: ["class"] }));
  document.addEventListener("fullscreenchange", updateControls);
  updateControls();
}

function initOverlayBackdropExit() {
  document.querySelectorAll(".overlay").forEach((overlay) => {
    overlay.addEventListener("click", (event) => {
      if (!overlay.classList.contains("active")) return;
      if (event.target !== overlay) return;
      if (overlay.id === "overlayLogin") return;
      closeOverlays();
    });
  });
}

function initAprilFoolsMode() {
  const now = new Date();
  const isAprilFoolsDay = now.getMonth() === 3 && now.getDate() === 1;
  if (!isAprilFoolsDay) return;

  document.body.classList.add("rainbow-mode");
  const banner = document.getElementById("aprilFoolsBanner");
  if (banner) banner.hidden = false;

  setTimeout(() => {
    showToast("APRIL FOOLS MODE", "🤡", "This visual event auto-disables on April 2.");
  }, 600);
}

initSharedGamebox();
disableInGameExitButtons();
initPerGameFullscreenButtons();
initTopBarOverlayControls();
initOverlayBackdropExit();
initAdminTabs();
initGameCanvasSizing();
initGameVisibilityGuards();
initGameScroller();
initMainSiteSearch();
initAprilFoolsMode();

function hideGameOverModal() {
  const modal = document.getElementById("modalGameOver");
  modal.classList.remove("active");
  document.querySelectorAll(".game-over-host").forEach((el) => el.classList.remove("game-over-host"));
  document.body.appendChild(modal);
}

// Restart the last game from the game-over modal.
document.getElementById("goRestart").onclick = () => {
  hideGameOverModal();
  clearRestartListener();
  if (state.currentGame === "snake") initSnake();
  if (state.currentGame === "pong") initPong();
  if (state.currentGame === "runner") initRunner();
  if (state.currentGame === "geo") {
    document.getElementById("overlayGeo").classList.add("active");
    window.showGeoMenu();
  }
  if (state.currentGame === "flappy") initFlappy();
  if (state.currentGame === "dodge") initDodge();
  if (state.currentGame === "corebreaker") initCoreBreaker();
  if (state.currentGame === "neondefender") initNeonDefender();
  if (state.currentGame === "voidminer") initVoidMiner();
  if (state.currentGame === "coredriller") initCoreDriller();
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
  if (state.currentGame === "smasharena") initSmashArena();
  if (state.currentGame === "mines") {
    initMines();
    document.getElementById("overlayMines").classList.add("active");
  }
  if (state.currentGame === "baccarat") {
    initBaccarat();
    document.getElementById("overlayBaccarat").classList.add("active");
  }
  if (state.currentGame === "craps") {
    initCraps();
    document.getElementById("overlayCraps").classList.add("active");
  }
  if (state.currentGame === "videopoker") {
    initVideoPoker();
    document.getElementById("overlayVideopoker").classList.add("active");
  }
  if (state.currentGame === "roulette") {
    initRoulette();
    document.getElementById("overlayRoulette").classList.add("active");
  }
  if (state.currentGame === "slots") {
    initSlots();
    document.getElementById("overlaySlots").classList.add("active");
  }
  if (state.currentGame === "blackjack") {
    state.myMoney = 1000;
    initBJ();
    document.getElementById("overlayBlackjack").classList.add("active");
  }
  if (state.currentGame === "war") {
    initWar();
    document.getElementById("overlayWar").classList.add("active");
  }
};

// Exit the current game and close all overlays.
document.getElementById("goExit").onclick = () => {
  stopAllGames();
  closeOverlays();
  hideGameOverModal();
};
