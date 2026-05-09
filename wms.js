/**
 * Window Management System (WMS) for the terminal desktop.
 * Handles window lifecycle, dragging, resizing, and taskbar integration.
 */


const FALLBACK_APP_METADATA = Object.freeze({
    overlayBank: { title: "BANK", icon: "🏦" },
    overlayShop: { title: "SHOP", icon: "🛒" },
    overlayInventory: { title: "BAG", icon: "🎒" },
    overlayProfile: { title: "PROFILE", icon: "👤" },
    overlaySeason: { title: "SEASON", icon: "🗓️" },
    overlayCrew: { title: "CREW", icon: "🏴‍☠️" },
    globalChat: { title: "CHAT", icon: "💬" },
    overlayConfig: { title: "CONFIG", icon: "⚙️" },
    overlayAdmin: { title: "ADMIN", icon: "⚡" },
    overlayGamebox: { title: "GAMES", icon: "🎮" },
    overlayTrending: { title: "TRENDING", icon: "📈" },
    overlayRecentGames: { title: "RECENT", icon: "🕒" },
    overlayUpdates: { title: "UPDATES", icon: "📜" },
});

function escapeAttributeValue(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function resolveFallbackAppMetadata(id) {
    const desktopIcon = document.querySelector(`.desktop-icon[data-overlay-id="${escapeAttributeValue(id)}"]`);
    if (desktopIcon) {
        return {
            title: desktopIcon.dataset.appTitle || FALLBACK_APP_METADATA[id]?.title || "App",
            icon: desktopIcon.dataset.appIcon || FALLBACK_APP_METADATA[id]?.icon || "🎮",
        };
    }
    return FALLBACK_APP_METADATA[id] || { title: "App", icon: "🎮" };
}

function openGameFallback(id) {
    const contentElement = document.getElementById(id);
    if (!contentElement) return;

    const { title, icon } = resolveFallbackAppMetadata(id);
    if (window.WMS) {
        window.WMS.createWindow(id, title, contentElement, { icon });
        return;
    }

    document.querySelectorAll(".overlay").forEach((overlay) => overlay.classList.remove("active"));
    contentElement.classList.add("active");
    document.body.classList.add("overlay-open");
}

export function installFallbackOpenGame() {
    if (typeof window.openGame === "function" && !window.openGame.__wmsFallback) return;
    window.openGame = openGameFallback;
    window.openGame.__wmsFallback = true;
}

export function installTaskbarFallbacks() {
    const configBtn = document.getElementById("taskbarConfigBtn");
    if (configBtn && !configBtn.onclick) {
        configBtn.onclick = () => window.openGame?.("overlayConfig");
    }

    const userMenuBtn = document.getElementById("userMenuBtn");
    const userMenuDropdown = document.getElementById("userMenuDropdown");
    if (userMenuBtn && userMenuDropdown && !userMenuBtn.onclick) {
        userMenuBtn.onclick = (event) => {
            event.stopPropagation();
            userMenuDropdown.classList.toggle("active");
        };
        userMenuDropdown.onclick = (event) => event.stopPropagation();
        document.addEventListener("click", () => userMenuDropdown.classList.remove("active"));
    }
}

export class AppWindow {
  constructor(id, title, contentElement, options = {}) {
    this.id = id;
    this.title = title;
    this.contentElement = contentElement; // This is the original overlay content
    this.options = {
      width: options.width || 800,
      height: options.height || 600,
      x: options.x || 100,
      y: options.y || 50,
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
    win.style.left = `${this.options.x}px`;
    win.style.top = `${this.options.y}px`;
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

    // Move content from original overlay to window
    if (this.contentElement) {
        // Some overlays might have multiple children, wrap them or move them all
        while (this.contentElement.firstChild) {
            content.appendChild(this.contentElement.firstChild);
        }
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
    } else {
      this.elements.window.style.display = "flex";
      this.focus();
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
    if (window.saveDesktopConfig) {
        window.saveDesktopConfig(this.id, this.elements.window.style.left, this.elements.window.style.top, { isFavorited: this.isFavorited });
    }
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
  }

  close() {
    if (typeof window.beep === "function") window.beep(200, "square", 0.05);
    // Call stopAllGames if this was a game window
    if (this.id.startsWith("overlay") && !["overlayBank", "overlayShop", "overlayInventory", "overlayProfile", "overlaySeason", "overlayCrew", "overlayAdmin", "overlayConfig", "overlayGamebox", "overlayTrending", "overlayRecentGames", "overlayUpdates"].includes(this.id)) {
        if (typeof window.stopAllGames === "function") {
            window.stopAllGames();
        }
    }

    // Move content back to its original overlay container
    if (this.contentElement) {
        while (this.elements.content.firstChild) {
            this.contentElement.appendChild(this.elements.content.firstChild);
        }
    }

    this.elements.window.remove();
    if (!this.isFavorited) {
        this.elements.tab.remove();
    } else {
        this.elements.tab.classList.remove("active");
        this.isMinimized = true;
    }

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

        const win = new AppWindow(id, title, contentElement, options);
        this.windows.set(id, win);
        win.focus();
        return win;
    }

    removeWindow(id) {
        this.windows.delete(id);
    }

    closeAll() {
        this.windows.forEach(win => win.close());
    }
}

window.WMS = new WindowManager();
installFallbackOpenGame();

export function initDesktop() {
    const desktop = document.getElementById("desktop");
    if (!desktop) return;

    // Filtered apps: removed those already in the taskbar or user menu
    const apps = [
        // { id: "bank", title: "BANK", icon: "🏦", overlayId: "overlayBank" },
        // { id: "shop", title: "SHOP", icon: "🛒", overlayId: "overlayShop" },
        // { id: "inventory", title: "BAG", icon: "🎒", overlayId: "overlayInventory" },
        // { id: "profile", title: "PROFILE", icon: "👤", overlayId: "overlayProfile" },
        // { id: "season", title: "SEASON", icon: "🗓️", overlayId: "overlaySeason" },
        // { id: "crew", title: "CREW", icon: "🏴‍☠️", overlayId: "overlayCrew" },
        // { id: "chat", title: "CHAT", icon: "💬", overlayId: "globalChat" },
        // { id: "config", title: "CONFIG", icon: "⚙️", overlayId: "overlayConfig" },
        // { id: "admin", title: "ADMIN", icon: "⚡", overlayId: "overlayAdmin", adminOnly: true },
        // { id: "games", title: "GAMES", icon: "🎮", overlayId: "overlayGamebox" },
    ];

    // Load favorite/pinned apps from desktopConfig
    if (typeof window.getDesktopConfig === "function") {
        const config = window.getDesktopConfig();
        Object.keys(config).forEach(appId => {
            if (config[appId].isFavorited) {
                // Pin logic handled by individual AppWindow instances,
                // but icons can be recreated here if they represent non-system apps.
            }
        });
    }

    apps.forEach(app => {
        createDesktopIcon(app);
    });
}

export function createDesktopIcon(app) {
    const desktop = document.getElementById("desktop");
    if (!desktop) return null;

    const existingIcon = document.getElementById(`icon-${app.id}`);
    if (existingIcon) {
        existingIcon.dataset.overlayId = app.overlayId;
        existingIcon.dataset.appTitle = app.title;
        existingIcon.dataset.appIcon = app.icon || "🎮";
        return existingIcon;
    }

    const icon = document.createElement("div");
    icon.className = "desktop-icon";
    icon.id = `icon-${app.id}`;
    icon.dataset.overlayId = app.overlayId;
    icon.dataset.appTitle = app.title;
    icon.dataset.appIcon = app.icon || "🎮";
    icon.innerHTML = `
        <div class="desktop-icon-img">${app.icon}</div>
        <div class="desktop-icon-label">${app.title}</div>
    `;

    if (app.adminOnly) {
        icon.style.display = "none";
        icon.classList.add("admin-icon");
    }

    icon.onclick = () => {
        if (icon.__suppressNextOpen) {
            icon.__suppressNextOpen = false;
            return;
        }
        if (typeof window.openGame === "function") {
            window.openGame(app.overlayId);
        }
    };

    desktop.appendChild(icon);
    setupIconDraggable(icon, app.id);
    arrangeDesktopIcons(typeof window.getDesktopConfig === "function" ? window.getDesktopConfig() : {});
    return icon;
}

const DESKTOP_ICON_GRID_X = 100;
const DESKTOP_ICON_GRID_Y = 100;
const DESKTOP_ICON_DRAG_THRESHOLD = 5;

function getDesktopMetrics() {
    const desktop = document.getElementById("desktop");
    const styles = desktop ? window.getComputedStyle(desktop) : null;
    const paddingLeft = parseFloat(styles?.paddingLeft) || 0;
    const paddingRight = parseFloat(styles?.paddingRight) || 0;
    const paddingTop = parseFloat(styles?.paddingTop) || 0;
    const paddingBottom = parseFloat(styles?.paddingBottom) || 0;

    return {
        desktop,
        rect: desktop?.getBoundingClientRect() || { left: 0, top: 0 },
        paddingLeft,
        paddingRight,
        paddingTop,
        paddingBottom,
    };
}

function parsePixelValue(value) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function getGridColumnCount() {
    const { desktop, paddingLeft, paddingRight } = getDesktopMetrics();
    if (!desktop) return 1;

    const usableWidth = desktop.clientWidth - paddingLeft - paddingRight;
    return Math.max(1, Math.floor(usableWidth / DESKTOP_ICON_GRID_X));
}

function clampToDesktop(icon, left, top, { allowVerticalOverflow = false } = {}) {
    const { desktop, paddingRight, paddingBottom } = getDesktopMetrics();
    if (!desktop) return { left, top };

    const maxLeft = Math.max(0, desktop.clientWidth - paddingRight - icon.offsetWidth);
    const maxTop = allowVerticalOverflow
        ? Math.max(top, desktop.clientHeight - paddingBottom - icon.offsetHeight)
        : Math.max(0, desktop.clientHeight - paddingBottom - icon.offsetHeight);

    return {
        left: Math.min(Math.max(left, 0), maxLeft),
        top: Math.min(Math.max(top, 0), maxTop),
    };
}

function snapToGrid(icon, left, top, options = {}) {
    const { paddingLeft, paddingTop } = getDesktopMetrics();
    const snappedLeft = paddingLeft + Math.round((left - paddingLeft) / DESKTOP_ICON_GRID_X) * DESKTOP_ICON_GRID_X;
    const snappedTop = paddingTop + Math.round((top - paddingTop) / DESKTOP_ICON_GRID_Y) * DESKTOP_ICON_GRID_Y;
    return clampToDesktop(icon, snappedLeft, snappedTop, options);
}

function gridKey(left, top) {
    const { paddingLeft, paddingTop } = getDesktopMetrics();
    const column = Math.round((left - paddingLeft) / DESKTOP_ICON_GRID_X);
    const row = Math.round((top - paddingTop) / DESKTOP_ICON_GRID_Y);
    return `${column},${row}`;
}

function findAvailableGridPosition(icon, preferredLeft, preferredTop, occupiedCells) {
    const { paddingLeft, paddingTop } = getDesktopMetrics();
    const columnCount = getGridColumnCount();
    const preferred = snapToGrid(icon, preferredLeft, preferredTop, { allowVerticalOverflow: true });
    const preferredColumn = Math.max(0, Math.round((preferred.left - paddingLeft) / DESKTOP_ICON_GRID_X));
    const preferredRow = Math.max(0, Math.round((preferred.top - paddingTop) / DESKTOP_ICON_GRID_Y));
    const startIndex = preferredRow * columnCount + Math.min(preferredColumn, columnCount - 1);
    const maxAttempts = Math.max(occupiedCells.size + columnCount + 1, 2000);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const index = startIndex + attempt;
        const column = index % columnCount;
        const row = Math.floor(index / columnCount);
        const left = paddingLeft + column * DESKTOP_ICON_GRID_X;
        const top = paddingTop + row * DESKTOP_ICON_GRID_Y;
        const snapped = clampToDesktop(icon, left, top, { allowVerticalOverflow: true });
        const key = gridKey(snapped.left, snapped.top);

        if (!occupiedCells.has(key)) {
            occupiedCells.add(key);
            return snapped;
        }
    }

    return preferred;
}

function setIconPosition(icon, left, top, options = {}) {
    const clamped = clampToDesktop(icon, left, top, options);
    icon.style.left = `${clamped.left}px`;
    icon.style.top = `${clamped.top}px`;
    icon.style.position = "absolute";
}

function positionIconOnGrid(icon, preferredLeft, preferredTop, occupiedCells) {
    const { paddingLeft, paddingTop } = getDesktopMetrics();
    const left = preferredLeft ?? (icon.offsetLeft || paddingLeft);
    const top = preferredTop ?? (icon.offsetTop || paddingTop);
    const position = findAvailableGridPosition(icon, left, top, occupiedCells);
    setIconPosition(icon, position.left, position.top, { allowVerticalOverflow: true });
    return position;
}

function getOccupiedGridCells(excludedIcon = null) {
    const desktop = document.getElementById("desktop");
    const occupiedCells = new Set();
    if (!desktop) return occupiedCells;

    desktop.querySelectorAll(".desktop-icon").forEach((icon) => {
        if (icon === excludedIcon || icon.style.display === "none") return;

        const snapped = snapToGrid(icon, icon.offsetLeft, icon.offsetTop, { allowVerticalOverflow: true });
        occupiedCells.add(gridKey(snapped.left, snapped.top));
    });

    return occupiedCells;
}

export function arrangeDesktopIcons(config = {}) {
    const desktop = document.getElementById("desktop");
    if (!desktop) return;

    const occupiedCells = new Set();
    desktop.querySelectorAll(".desktop-icon").forEach((icon) => {
        if (icon.style.display === "none") return;

        const appId = icon.id?.startsWith("icon-") ? icon.id.slice(5) : "";
        const savedConfig = config[appId] || {};
        positionIconOnGrid(
            icon,
            parsePixelValue(savedConfig.left),
            parsePixelValue(savedConfig.top),
            occupiedCells,
        );
    });
}

function setupIconDraggable(icon, appId) {
    let startX = 0, startY = 0;
    let dragOffsetX = 0, dragOffsetY = 0;
    let didDrag = false;
    let previousInlinePosition = "";
    let previousInlineLeft = "";
    let previousInlineTop = "";

    icon.onmousedown = dragMouseDown;


    function dragMouseDown(e) {
        if (e.button !== 0) return;
        e.preventDefault();

        const iconRect = icon.getBoundingClientRect();
        const { rect: desktopRect } = getDesktopMetrics();
        previousInlinePosition = icon.style.position;
        previousInlineLeft = icon.style.left;
        previousInlineTop = icon.style.top;
        dragOffsetX = e.clientX - iconRect.left;
        dragOffsetY = e.clientY - iconRect.top;
        startX = e.clientX;
        startY = e.clientY;
        didDrag = false;

        // Convert flex-positioned icons to absolute positioning before dragging so
        // the pointer keeps the same grab point instead of jumping to an edge.
        setIconPosition(icon, iconRect.left - desktopRect.left, iconRect.top - desktopRect.top);

        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;

        document.querySelectorAll(".desktop-icon").forEach(i => i.classList.remove("selected"));
        icon.classList.add("selected", "dragging");
    }

    function elementDrag(e) {
        e.preventDefault();

        const { rect: desktopRect } = getDesktopMetrics();
        const nextLeft = e.clientX - desktopRect.left - dragOffsetX;
        const nextTop = e.clientY - desktopRect.top - dragOffsetY;

        if (Math.hypot(e.clientX - startX, e.clientY - startY) > DESKTOP_ICON_DRAG_THRESHOLD) {
            didDrag = true;
            icon.__suppressNextOpen = true;
        }

        setIconPosition(icon, nextLeft, nextTop);
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        icon.classList.remove("dragging");

        if (!didDrag) {
            icon.style.position = previousInlinePosition;
            icon.style.left = previousInlineLeft;
            icon.style.top = previousInlineTop;
            return;
        }

        const snapped = findAvailableGridPosition(
            icon,
            icon.offsetLeft,
            icon.offsetTop,
            getOccupiedGridCells(icon),
        );
        setIconPosition(icon, snapped.left, snapped.top);

        // Save snapped position to state
        if (window.saveDesktopConfig) {
            window.saveDesktopConfig(appId, icon.style.left, icon.style.top);
        }
    }
}
