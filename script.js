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


function renderInGameShopPanel(game, overlayId) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  overlay.querySelectorAll(".game-side-shop").forEach((panel) => panel.remove());
  overlay.classList.remove("has-game-side-shop");

  const entry = GAME_DIRECTORY_ENTRIES.find((candidate) => candidate.id === game);
  const relatedItems = Array.isArray(entry?.shopItems) ? entry.shopItems : [];
  if (!relatedItems.length) return;
  overlay.classList.add("has-game-side-shop");

  const panel = document.createElement("aside");
  panel.className = "game-side-shop";
  panel.innerHTML = '<h3>GAME SHOP</h3><p class="game-side-shop-meta">TOGGLES + QUICK BUY</p>';

  relatedItems.forEach((itemId) => {
    const item = getShopItemById(itemId);
    if (!item) return;
    const ownsItem = state.myInventory.includes(itemId);
    const isEnabled = state.myItemToggles[itemId] !== false;

    const row = document.createElement("div");
    row.className = "game-side-shop-row";

    const details = document.createElement("div");
    details.className = "game-side-shop-details";
    details.innerHTML = `<strong>${item.icon || "🛒"} ${item.name}</strong><small>${item.desc}</small><small>${ownsItem ? "OWNED" : `$${item.cost}`}</small>`;

    const action = document.createElement("button");
    action.className = "term-btn game-side-shop-action";
    if (ownsItem) {
      action.textContent = isEnabled ? "ON" : "OFF";
      action.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleItem(itemId);
        renderInGameShopPanel(game, overlayId);
      });
    } else {
      action.textContent = state.myMoney >= item.cost ? `BUY $${item.cost}` : `NEED $${item.cost}`;
      if (state.myMoney < item.cost) action.disabled = true;
      action.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        buyItem(itemId);
        renderInGameShopPanel(game, overlayId);
      });
    }

    row.append(details, action);
    panel.appendChild(row);
  });

  overlay.appendChild(panel);
}

function getOverlayIdForGame(gameId) {
  if (!gameId) return "";
  return `overlay${gameId === "ttt" ? gameId.toUpperCase() : gameId.charAt(0).toUpperCase() + gameId.slice(1)}`;
}

// Launch a game by name, activate its overlay, and kick off its init routine.
window.launchGame = (game, source = "direct") => {
  window.__goonerLastGameLaunchSource = source;
  window.closeOverlays();
  const overlayId = getOverlayIdForGame(game);
  const el = document.getElementById(overlayId);
  if (el) el.classList.add("active");
  renderInGameShopPanel(game, overlayId);
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
  if (typeof window.__updateGameSwitcherState === "function") window.__updateGameSwitcherState(game);
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
  // Keep the active game visible/stateful when switching browser tabs.
  // We only stop active games when explicitly launching a different overlay/game.
  if (document.hidden) return;
}

function initGameVisibilityGuards() {
  document.addEventListener("visibilitychange", pauseGamesWhenHidden);
  window.addEventListener("blur", pauseGamesWhenHidden);
}

function initGameSwitcher() {
  const orderedGames = GAME_DIRECTORY_ENTRIES
    .map((entry) => ({ id: entry.id, title: entry.title, overlayId: getOverlayIdForGame(entry.id) }))
    .filter((entry) => document.getElementById(entry.overlayId));
  if (!orderedGames.length) return;

  const gameIndexById = new Map(orderedGames.map((entry, index) => [entry.id, index]));

  function wrapGameIndex(index) {
    const total = orderedGames.length;
    if (!total) return 0;
    return ((index % total) + total) % total;
  }

  function renderSwitcherAtIndex(switcher, centerIndex, dragOffset = 0) {
    const titleButtons = Array.from(switcher.querySelectorAll(".game-switcher-title"));
    if (!titleButtons.length) return;

    titleButtons.forEach((button) => {
      const pos = Number(button.dataset.pos || 0);
      const game = orderedGames[wrapGameIndex(centerIndex + pos)] || null;
      button.dataset.pos = String(pos);
      button.dataset.game = game?.id || "";
      button.textContent = game?.title || "";
      button.disabled = false;
      button.classList.remove("is-empty");
      button.classList.toggle("is-center", pos === 0);
    });

    switcher.style.setProperty("--switcher-drag-offset", `${dragOffset}px`);
  }

  function launchFromIndex(index) {
    const game = orderedGames[wrapGameIndex(index)];
    if (!game) return;
    window.launchGame(game.id, "game-switcher");
  }

  orderedGames.forEach((game) => {
    const overlay = document.getElementById(game.overlayId);
    const heading = overlay?.querySelector("h1");
    if (!overlay || !heading) return;

    const switcher = document.createElement("div");
    switcher.className = "game-switcher-header";
    switcher.dataset.activeGame = game.id;
    switcher.innerHTML = `
      <div class="game-switcher-track" aria-label="Game switcher">
        <button class="game-switcher-title" type="button" data-pos="-2"></button>
        <span class="game-switcher-arrow" aria-hidden="true">→</span>
        <button class="game-switcher-title" type="button" data-pos="-1"></button>
        <span class="game-switcher-arrow" aria-hidden="true">→</span>
        <button class="game-switcher-title" type="button" data-pos="0"></button>
        <span class="game-switcher-arrow" aria-hidden="true">→</span>
        <button class="game-switcher-title" type="button" data-pos="1"></button>
        <span class="game-switcher-arrow" aria-hidden="true">→</span>
        <button class="game-switcher-title" type="button" data-pos="2"></button>
      </div>
    `;
    heading.replaceWith(switcher);

    const startIndex = gameIndexById.get(game.id) || 0;
    renderSwitcherAtIndex(switcher, startIndex, 0);

    switcher.querySelectorAll(".game-switcher-title").forEach((button) => {
      button.addEventListener("click", () => {
        const targetGame = button.dataset.game;
        if (!targetGame) return;
        window.launchGame(targetGame, "game-switcher-click");
      });
    });

    let dragStartX = null;
    let activeIndex = startIndex;
    let previewIndex = startIndex;
    const DRAG_STEP = 130;

    switcher.addEventListener("pointerdown", (event) => {
      dragStartX = event.clientX;
      activeIndex = gameIndexById.get(switcher.dataset.activeGame || game.id) || startIndex;
      previewIndex = activeIndex;
      switcher.classList.add("is-dragging");
      switcher.setPointerCapture?.(event.pointerId);
    });

    switcher.addEventListener("pointermove", (event) => {
      if (dragStartX === null) return;
      const deltaX = event.clientX - dragStartX;
      const shifted = Math.round(-deltaX / DRAG_STEP);
      previewIndex = wrapGameIndex(activeIndex + shifted);
      renderSwitcherAtIndex(switcher, activeIndex, deltaX);
    });

    function commitDrag() {
      if (dragStartX === null) return;
      dragStartX = null;
      switcher.classList.remove("is-dragging");
      const currentIndex = gameIndexById.get(switcher.dataset.activeGame || game.id) || startIndex;
      renderSwitcherAtIndex(switcher, previewIndex, 0);
      if (previewIndex !== currentIndex) launchFromIndex(previewIndex);
    }

    switcher.addEventListener("pointerup", commitDrag);
    switcher.addEventListener("pointercancel", () => {
      if (dragStartX === null) return;
      dragStartX = null;
      switcher.classList.remove("is-dragging");
      const resetIndex = gameIndexById.get(switcher.dataset.activeGame || game.id) || startIndex;
      previewIndex = resetIndex;
      renderSwitcherAtIndex(switcher, resetIndex, 0);
    });
  });

  function updateSwitcherState(activeGameId) {
    if (!activeGameId) return;
    const overlayId = getOverlayIdForGame(activeGameId);
    const header = document.querySelector(`#${overlayId} .game-switcher-header`);
    if (!header) return;
    header.dataset.activeGame = activeGameId;
    const activeIndex = gameIndexById.get(activeGameId);
    if (typeof activeIndex !== "number") return;
    renderSwitcherAtIndex(header, activeIndex, 0);
  }

  window.__updateGameSwitcherState = updateSwitcherState;
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
    const card = document.createElement("div");
    card.className = "game-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
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

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        window.launchGame(card.dataset.game || "", "directory");
      }
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


function initMainSiteSearch() {
  const form = document.getElementById("siteSearchForm");
  const input = document.getElementById("siteSearchInput");
  const meta = document.getElementById("siteSearchMeta");
  const dropdown = document.getElementById("siteSearchDropdown");
  const gamesSearch = document.getElementById("gamesSearch");
  const gamesFilter = document.getElementById("gamesFilter");
  if (!form || !input || !meta || !dropdown) return;

  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("spellcheck", "false");

  const QUICK_ROUTES = [
    { aliases: ["games", "game", "directory"], action: () => openGame("overlayGames"), label: "OPENED GAMES DIRECTORY", overlayId: "overlayGames" },
    { aliases: ["trending", "trend"], action: () => openGame("overlayTrending"), label: "OPENED TRENDING GAMES", overlayId: "overlayTrending" },
    { aliases: ["updates", "update", "log", "update log", "patch notes"], action: () => openGame("overlayUpdates"), label: "OPENED UPDATE LOG", overlayId: "overlayUpdates" },
    { aliases: ["bank", "money"], action: () => openGame("overlayBank"), label: "OPENED BANK PANEL", overlayId: "overlayBank" },
    { aliases: ["shop", "store", "black market"], action: () => openGame("overlayShop"), label: "OPENED SHOP PANEL", overlayId: "overlayShop" },
    { aliases: ["profile", "account", "stats"], action: () => openGame("overlayProfile"), label: "OPENED PROFILE PANEL", overlayId: "overlayProfile" },
    { aliases: ["scores", "leaderboard", "ranks"], action: () => openGame("overlayScores"), label: "OPENED SCORES PANEL", overlayId: "overlayScores" },
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

    if (gamesSearch) {
      openGame("overlayGames");
      gamesSearch.value = query;
      if (gamesFilter) gamesFilter.value = "all";
      gamesSearch.dispatchEvent(new Event("input", { bubbles: true }));
      meta.textContent = `NO DIRECT MATCH. OPENED DIRECTORY SEARCH FOR "${query.toUpperCase()}".`;
      return;
    }

    meta.textContent = `NO MATCH FOR "${query.toUpperCase()}".`;
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
    overlayTrending: "menuToggle",
    overlayUpdates: "menuToggle",
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
      if (activeOverlay && activeOverlay.id === "overlayConfig" && typeof window.closeConfigOverlay === "function") {
        window.closeConfigOverlay();
      } else if (activeOverlay && GAME_OVERLAY_IDS.includes(activeOverlay.id)) {
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

  const getActiveOverlay = () => overlays.slice().reverse().find((overlay) => overlay.classList.contains("active")) || null;
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
initGameSwitcher();
initGamesLibraryDiscovery();
initMainSiteSearch();

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
