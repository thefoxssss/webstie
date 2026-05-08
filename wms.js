/**
 * Window Management System (WMS) for the terminal desktop.
 * Handles window lifecycle, dragging, resizing, and taskbar integration.
 */

const SYSTEM_DESKTOP_APPS = [
  { id: "bank", title: "BANK", icon: "🏦", overlayId: "overlayBank" },
  { id: "shop", title: "SHOP", icon: "🛒", overlayId: "overlayShop" },
  { id: "inventory", title: "BAG", icon: "🎒", overlayId: "overlayInventory" },
  { id: "profile", title: "PROFILE", icon: "👤", overlayId: "overlayProfile" },
  { id: "season", title: "SEASON", icon: "🗓️", overlayId: "overlaySeason" },
  { id: "crew", title: "CREW", icon: "🏴‍☠️", overlayId: "overlayCrew" },
  { id: "chat", title: "CHAT", icon: "💬", overlayId: "globalChat" },
  { id: "config", title: "CONFIG", icon: "⚙️", overlayId: "overlayConfig" },
  { id: "games", title: "GAMES", icon: "🎮", overlayId: "overlayGamebox" },
  { id: "trending", title: "TRENDING", icon: "📈", overlayId: "overlayTrending" },
  { id: "recent", title: "RECENT", icon: "🕒", overlayId: "overlayRecentGames" },
  { id: "updates", title: "UPDATES", icon: "📜", overlayId: "overlayUpdates" },
  { id: "admin", title: "ADMIN", icon: "⚡", overlayId: "overlayAdmin", adminOnly: true },
];

const DEFAULT_WINDOW_STATE = { width: 800, height: 600, x: 100, y: 50 };

function getDesktopConfig() {
  return typeof window.getDesktopConfig === "function" ? window.getDesktopConfig() || {} : {};
}

function getConfigForApp(appId) {
  return getDesktopConfig()[appId] || {};
}

function saveDesktopAppState(appId, patch = {}) {
  if (typeof window.saveDesktopConfig === "function") {
    window.saveDesktopConfig(appId, patch);
  }
}

function getAppIdForOverlayId(overlayId) {
  const systemApp = SYSTEM_DESKTOP_APPS.find((app) => app.overlayId === overlayId);
  if (systemApp) return systemApp.id;
  if (overlayId === "globalChat") return "chat";
  if (!overlayId.startsWith("overlay")) return overlayId;
  const raw = overlayId.slice("overlay".length);
  if (raw === "TTT") return "ttt";
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}

function getFallbackAppInfo(overlayId) {
  const appId = getAppIdForOverlayId(overlayId);
  const systemApp = SYSTEM_DESKTOP_APPS.find((app) => app.id === appId || app.overlayId === overlayId);
  if (systemApp) return systemApp;
  const icon = document.querySelector(`.desktop-icon[data-overlay-id="${overlayId}"]`);
  return {
    id: appId,
    title: icon?.dataset.title || appId.toUpperCase(),
    icon: icon?.dataset.icon || "🎮",
    overlayId,
  };
}

export class AppWindow {
  constructor(id, title, contentElement, options = {}) {
    this.id = id;
    this.appId = options.appId || getAppIdForOverlayId(id);
    this.title = title;
    this.contentElement = contentElement; // This is the original overlay content
    this.contentPlaceholder = null;
    const savedWindow = getConfigForApp(this.appId).window || {};
    this.options = {
      ...DEFAULT_WINDOW_STATE,
      ...savedWindow,
      minWidth: options.minWidth || 300,
      minHeight: options.minHeight || 200,
      icon: options.icon || "🎮",
      ...options
    };

    this.isMinimized = false;
    this.isMaximized = false;
    this.zIndex = 100;

    this.elements = {};
    this.createWindowElement();
    this.setupEventListeners();
  }

  createWindowElement() {
    const win = document.createElement("div");
    win.id = `window-${this.id}`;
    win.className = "window";
    win.style.width = `${this.options.width}px`;
    win.style.height = `${this.options.height}px`;
    win.style.left = `${Math.max(0, Math.min(this.options.x, window.innerWidth - 120))}px`;
    win.style.top = `${Math.max(0, Math.min(this.options.y, window.innerHeight - 90))}px`;
    win.style.zIndex = this.zIndex;

    const resizer = document.createElement("div");
    resizer.className = "window-resizer";
    win.appendChild(resizer);

    const header = document.createElement("div");
    header.className = "window-header";
    header.innerHTML = `
      <div class="window-title">
        <span class="window-icon">${this.options.icon}</span>
        <span class="window-title-text">${this.title}</span>
      </div>
      <div class="window-controls">
        <button class="window-btn minimize-btn" title="Minimize">➖</button>
        <button class="window-btn maximize-btn" title="Maximize">🗖</button>
        <button class="window-btn close-btn" title="Close">✖</button>
      </div>
    `;

    const content = document.createElement("div");
    content.className = "window-content";
    if (this.id.startsWith("overlay") && !["overlayBank", "overlayShop", "overlayInventory", "overlayProfile", "overlaySeason", "overlayCrew", "overlayAdmin", "overlayConfig", "overlayGamebox", "overlayTrending", "overlayRecentGames", "overlayUpdates"].includes(this.id)) {
        content.classList.add("game-container-16-9");
    }

    // Move the original overlay node into the window so existing DOM queries by id
    // keep working while CSS neutralizes the fullscreen overlay positioning.
    if (this.contentElement) {
        this.contentPlaceholder = document.createComment(`wms-placeholder-${this.id}`);
        this.contentElement.parentNode?.insertBefore(this.contentPlaceholder, this.contentElement);
        this.contentElement.classList.remove("active");
        content.appendChild(this.contentElement);
    }

    win.appendChild(header);
    win.appendChild(content);

    document.getElementById("window-container").appendChild(win);

    this.elements = {
      window: win,
      header: header,
      content: content,
      resizer: resizer,
      minimizeBtn: header.querySelector(".minimize-btn"),
      maximizeBtn: header.querySelector(".maximize-btn"),
      closeBtn: header.querySelector(".close-btn")
    };

    // Create taskbar tab
    this.createTaskbarTab();
  }

  createTaskbarTab() {
    const tab = document.createElement("div");
    tab.className = "taskbar-tab";
    tab.id = `tab-${this.id}`;
    tab.innerHTML = `
        <span class="tab-icon">${this.options.icon}</span>
        <span class="tab-text">${this.title}</span>
        <button class="tab-close-btn" title="Close">×</button>
    `;

    tab.onclick = (e) => {
        if (e.target.classList.contains("tab-close-btn")) {
            e.stopPropagation();
            this.close();
        } else {
            this.toggleMinimize();
        }
    };

    document.getElementById("taskbar-apps").appendChild(tab);
    this.elements.tab = tab;
  }

  setupEventListeners() {
    this.elements.header.onmousedown = (e) => this.dragStart(e);
    this.elements.resizer.onmousedown = (e) => this.resizeStart(e);
    this.elements.minimizeBtn.onclick = () => this.toggleMinimize();
    this.elements.maximizeBtn.onclick = () => this.toggleMaximize();
    this.elements.closeBtn.onclick = () => this.close();
    this.elements.window.onmousedown = () => this.focus();
  }

  saveWindowState(extra = {}) {
    saveDesktopAppState(this.appId, {
      window: {
        x: this.elements.window.offsetLeft,
        y: this.elements.window.offsetTop,
        width: this.elements.window.offsetWidth,
        height: this.elements.window.offsetHeight,
        isMaximized: this.isMaximized,
        isMinimized: this.isMinimized,
        ...extra,
      },
    });
  }

  resizeStart(e) {
    e.preventDefault();
    e.stopPropagation();
    this.focus();

    const startWidth = parseInt(document.defaultView.getComputedStyle(this.elements.window).width, 10);
    const startHeight = parseInt(document.defaultView.getComputedStyle(this.elements.window).height, 10);
    const startX = e.clientX;
    const startY = e.clientY;

    const doResize = (e) => {
        let newWidth = startWidth + e.clientX - startX;
        let newHeight = startHeight + e.clientY - startY;

        if (newWidth > this.options.minWidth) {
            this.elements.window.style.width = newWidth + 'px';
        }
        if (newHeight > this.options.minHeight) {
            this.elements.window.style.height = newHeight + 'px';
        }
    };

    const stopResize = () => {
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);
        this.saveWindowState();
    };

    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
  }

  dragStart(e) {
    if (this.isMaximized) return;
    if (e.target.closest(".window-controls")) return;

    this.focus();

    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    pos3 = e.clientX;
    pos4 = e.clientY;

    const elementDrag = (e) => {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;

      let top = this.elements.window.offsetTop - pos2;
      let left = this.elements.window.offsetLeft - pos1;

      // Snap to edges
      const snapThreshold = 20;
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight - 50; // Taskbar height

      if (left < snapThreshold) left = 0;
      if (top < snapThreshold) top = 0;
      if (screenWidth - (left + this.elements.window.offsetWidth) < snapThreshold) {
          left = screenWidth - this.elements.window.offsetWidth;
      }
      if (screenHeight - (top + this.elements.window.offsetHeight) < snapThreshold) {
          top = screenHeight - this.elements.window.offsetHeight;
      }

      // Top-middle snap logic
      if (top === 0 && Math.abs(left + this.elements.window.offsetWidth / 2 - screenWidth / 2) < snapThreshold * 2) {
          if (!this.isMaximized) {
              this.toggleMaximize();
              return;
          }
      }

      // Prevent overlapping by snapping to sides
      if (window.WMS) {
          window.WMS.windows.forEach((win, id) => {
              if (id === this.id || win.isMinimized) return;
              const otherWin = win.elements.window;
              const rect1 = this.elements.window.getBoundingClientRect();
              const rect2 = otherWin.getBoundingClientRect();

              const buffer = 10;
              const isOverlapping = !(rect1.right < rect2.left - buffer ||
                                     rect1.left > rect2.right + buffer ||
                                     rect1.bottom < rect2.top - buffer ||
                                     rect1.top > rect2.bottom + buffer);

              if (isOverlapping) {
                  // Find nearest non-overlapping side
                  const dists = [
                      { side: 'left', d: Math.abs(rect1.right - rect2.left) },
                      { side: 'right', d: Math.abs(rect1.left - rect2.right) },
                      { side: 'top', d: Math.abs(rect1.bottom - rect2.top) },
                      { side: 'bottom', d: Math.abs(rect1.top - rect2.bottom) }
                  ];
                  const nearest = dists.sort((a, b) => a.d - b.d)[0];

                  if (nearest.side === 'left') left = rect2.left - this.elements.window.offsetWidth;
                  if (nearest.side === 'right') left = rect2.right;
                  if (nearest.side === 'top') top = rect2.top - this.elements.window.offsetHeight;
                  if (nearest.side === 'bottom') top = rect2.bottom;
              }
          });
      }

      this.elements.window.style.top = top + "px";
      this.elements.window.style.left = left + "px";
    };

    const closeDragElement = () => {
      document.onmouseup = null;
      document.onmousemove = null;
      this.saveWindowState();
    };

    document.onmousemove = elementDrag;
    document.onmouseup = closeDragElement;
  }

  focus() {
    const allWindows = document.querySelectorAll(".window");
    let maxZ = 100;
    allWindows.forEach(w => {
      const z = parseInt(w.style.zIndex);
      if (z > maxZ) maxZ = z;
      w.classList.remove("active-window");
    });

    this.zIndex = maxZ + 1;
    this.elements.window.style.zIndex = this.zIndex;
    this.elements.window.classList.add("active-window");

    document.querySelectorAll(".taskbar-tab").forEach(t => t.classList.remove("active"));
    this.elements.tab.classList.add("active");
  }

  toggleMinimize() {
    if (typeof window.beep === "function") window.beep(300, "square", 0.05);
    this.isMinimized = !this.isMinimized;
    if (this.isMinimized) {
      this.elements.window.style.display = "none";
      this.elements.tab.classList.remove("active");
      this.saveWindowState({ isMinimized: true });
    } else {
      this.elements.window.style.display = "flex";
      this.focus();
      this.saveWindowState({ isMinimized: false });
    }
  }

  showContextMenu(e) {
    e.preventDefault();
    let existing = document.querySelector(".context-menu");
    if (existing) existing.remove();

    const menu = document.createElement("div");
    menu.className = "context-menu";
    menu.style.left = e.clientX + "px";
    menu.style.top = (e.clientY - 60) + "px";
    menu.style.display = "flex";

    const favoriteBtn = document.createElement("button");
    favoriteBtn.textContent = this.isFavorited ? "Unfavorite" : "Favorite";
    favoriteBtn.onclick = () => {
      this.toggleFavorite();
      menu.remove();
    };

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.onclick = () => {
      this.close();
      menu.remove();
    };

    menu.appendChild(favoriteBtn);
    menu.appendChild(closeBtn);
    document.body.appendChild(menu);

    const removeMenu = () => {
      menu.remove();
      document.removeEventListener("click", removeMenu);
    };
    setTimeout(() => document.addEventListener("click", removeMenu), 10);
  }

  toggleFavorite() {
    this.isFavorited = !this.isFavorited;
    this.elements.tab.classList.toggle("favorited", this.isFavorited);
    saveDesktopAppState(this.appId, { isFavorited: this.isFavorited });
  }

  toggleMaximize() {
    if (typeof window.beep === "function") window.beep(500, "square", 0.05);
    this.isMaximized = !this.isMaximized;
    this.elements.window.classList.toggle("maximized", this.isMaximized);
    if (this.isMaximized) {
      this.elements.maximizeBtn.textContent = "🗗";
    } else {
      this.elements.maximizeBtn.textContent = "🗖";
    }
    this.saveWindowState();
  }

  close() {
    if (typeof window.beep === "function") window.beep(200, "square", 0.05);
    // Call stopAllGames if this was a game window
    if (this.id.startsWith("overlay") && !["overlayBank", "overlayShop", "overlayInventory", "overlayProfile", "overlaySeason", "overlayCrew", "overlayAdmin", "overlayConfig", "overlayGamebox", "overlayTrending", "overlayRecentGames", "overlayUpdates"].includes(this.id)) {
        if (typeof window.stopAllGames === "function") {
            window.stopAllGames();
        }
    }

    // Move the original overlay node back where it came from.
    if (this.contentElement && this.contentPlaceholder?.parentNode) {
        this.contentElement.classList.remove("active");
        this.contentPlaceholder.parentNode.insertBefore(this.contentElement, this.contentPlaceholder);
        this.contentPlaceholder.remove();
        this.contentPlaceholder = null;
    }

    this.elements.window.remove();
    if (!this.isFavorited) {
        this.elements.tab.remove();
    } else {
        this.elements.tab.classList.remove("active");
        this.isMinimized = true;
    }

    saveDesktopAppState(this.appId, { isOpen: false, window: { isMinimized: false } });

    // Notify WMS manager
    if (window.WMS) {
        window.WMS.removeWindow(this.id);
    }
  }
}

class WindowManager {
    constructor() {
        this.windows = new Map();
    }

    createWindow(id, title, contentElement, options) {
        if (this.windows.has(id)) {
            const win = this.windows.get(id);
            if (win.isMinimized) win.toggleMinimize();
            win.focus();
            return win;
        }

        const appId = options?.appId || getAppIdForOverlayId(id);
        const win = new AppWindow(id, title, contentElement, { ...options, appId });
        this.windows.set(id, win);
        saveDesktopAppState(appId, { isOpen: true });
        const savedWindow = getConfigForApp(appId).window || {};
        if (savedWindow.isMaximized) win.toggleMaximize();
        if (savedWindow.isMinimized) win.toggleMinimize();
        if (!win.isMinimized) win.focus();
        return win;
    }

    removeWindow(id) {
        this.windows.delete(id);
    }

    closeAll() {
        this.windows.forEach(win => win.close());
    }
}

window.WMS = window.WMS || new WindowManager();

export function openDesktopApp(overlayId) {
    const contentElement = document.getElementById(overlayId);
    if (!contentElement || !window.WMS) return null;
    const app = getFallbackAppInfo(overlayId);
    return window.WMS.createWindow(overlayId, app.title, contentElement, { icon: app.icon, appId: app.id });
}

if (typeof window.openGame !== "function") {
    window.openGame = openDesktopApp;
}

export function initTaskbarFallbacks() {
    const configBtn = document.getElementById("taskbarConfigBtn");
    if (configBtn && configBtn.dataset.desktopFallbackReady !== "1") {
        configBtn.dataset.desktopFallbackReady = "1";
        configBtn.onclick = () => window.openGame?.("overlayConfig");
    }

    const userMenuBtn = document.getElementById("userMenuBtn");
    const userMenuDropdown = document.getElementById("userMenuDropdown");
    if (userMenuBtn && userMenuDropdown && userMenuBtn.dataset.desktopFallbackReady !== "1") {
        userMenuBtn.dataset.desktopFallbackReady = "1";
        userMenuBtn.onclick = (event) => {
            event.stopPropagation();
            userMenuDropdown.classList.toggle("active");
        };
        document.addEventListener("click", () => userMenuDropdown.classList.remove("active"));
    }
}

export function initDesktop() {
    const desktop = document.getElementById("desktop");
    if (!desktop) return;

    SYSTEM_DESKTOP_APPS.forEach(app => {
        createDesktopIcon(app);
    });
    applyDesktopConfig();
}

export function createDesktopIcon(app) {
    const desktop = document.getElementById("desktop");
    if (!desktop || document.getElementById(`icon-${app.id}`)) return;
    const icon = document.createElement("div");
    icon.className = "desktop-icon";
    icon.id = `icon-${app.id}`;
    icon.dataset.overlayId = app.overlayId;
    icon.dataset.title = app.title;
    icon.dataset.icon = app.icon || "🎮";
    icon.innerHTML = `
        <div class="desktop-icon-img">${app.icon}</div>
        <div class="desktop-icon-label">${app.title}</div>
    `;

    if (app.adminOnly) {
        icon.style.display = "none";
        icon.classList.add("admin-icon");
    }

    const openApp = () => {
        if (typeof window.openGame === "function") {
            window.openGame(app.overlayId);
        } else {
            openDesktopApp(app.overlayId);
        }
    };

    icon.ondblclick = openApp;
    icon.onclick = () => {
        if (icon.dataset.dragged === "1") {
            icon.dataset.dragged = "0";
            return;
        }
        openApp();
    };

    const saved = getConfigForApp(app.id);
    if (saved.left && saved.top) {
        icon.style.left = saved.left;
        icon.style.top = saved.top;
        icon.style.position = "absolute";
    }

    desktop.appendChild(icon);
    setupIconDraggable(icon, app.id);
}

function setupIconDraggable(icon, appId) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let didDrag = false;

    icon.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        didDrag = false;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;

        document.querySelectorAll(".desktop-icon").forEach(i => i.classList.remove("selected"));
        icon.classList.add("selected");
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        didDrag = true;
        icon.dataset.dragged = "1";
        icon.style.top = (icon.offsetTop - pos2) + "px";
        icon.style.left = (icon.offsetLeft - pos1) + "px";
        icon.style.position = "absolute";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;

        // Save position to state
        if (didDrag && window.saveDesktopConfig) {
            window.saveDesktopConfig(appId, { left: icon.style.left, top: icon.style.top });
        }
    }
}


export function applyDesktopConfig() {
    const config = getDesktopConfig();
    Object.keys(config).forEach(appId => {
        const icon = document.getElementById(`icon-${appId}`);
        const appConfig = config[appId] || {};
        if (icon && appConfig.left && appConfig.top) {
            icon.style.left = appConfig.left;
            icon.style.top = appConfig.top;
            icon.style.position = "absolute";
        }
    });
}

export function restoreOpenDesktopApps() {
    const config = getDesktopConfig();
    Object.keys(config).forEach(appId => {
        const appConfig = config[appId] || {};
        if (!appConfig.isOpen) return;
        const icon = document.getElementById(`icon-${appId}`);
        const overlayId = icon?.dataset.overlayId || SYSTEM_DESKTOP_APPS.find((app) => app.id === appId)?.overlayId;
        if (overlayId && typeof window.openGame === "function") {
            window.openGame(overlayId);
        }
    });
}

window.applyDesktopConfig = applyDesktopConfig;
window.restoreOpenDesktopApps = restoreOpenDesktopApps;
