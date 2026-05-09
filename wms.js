/**
 * Window Management System (WMS) for the terminal desktop.
 * Handles window lifecycle, dragging, resizing, and taskbar integration.
 */

const SCALABLE_APP_WINDOW_IDS = new Set([
    "overlayBank",
    "overlayShop",
    "overlayInventory",
    "overlayProfile",
    "overlaySeason",
    "overlayCrew",
    "globalChat",
    "overlayAdmin",
    "overlayGamebox",
    "overlayTrending",
    "overlayRecentGames",
    "overlayUpdates",
    "overlayConfig",
]);

const SCALABLE_APP_DESIGN_WIDTHS = Object.freeze({
    overlayAdmin: 1000,
    overlayBank: 1000,
    overlayShop: 1000,
    overlaySeason: 1000,
    overlayCrew: 1000,
    overlayGamebox: 1000,
    overlayTrending: 980,
    overlayUpdates: 980,
    overlayRecentGames: 760,
    overlayInventory: 760,
    overlayProfile: 760,
    globalChat: 760,
    overlayConfig: 760,
});

function isScalableAppWindow(id) {
    return SCALABLE_APP_WINDOW_IDS.has(id);
}

function getScalableAppDesignWidth(id, fallbackWidth) {
    return SCALABLE_APP_DESIGN_WIDTHS[id] || fallbackWidth || 800;
}

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
    this.isScalableApp = isScalableAppWindow(id);
    this.scaleObserver = null;
    this.scaleRaf = 0;

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
    if (this.isScalableApp) {
        content.classList.add("scalable-window-content");
    }
    if (this.id.startsWith("overlay") && !["overlayBank", "overlayShop", "overlayInventory", "overlayProfile", "overlaySeason", "overlayCrew", "overlayAdmin", "overlayConfig", "overlayGamebox", "overlayTrending", "overlayRecentGames", "overlayUpdates"].includes(this.id)) {
        content.classList.add("game-container-16-9");
    }

    const scaleFrame = this.isScalableApp ? document.createElement("div") : null;
    const scaleSurface = this.isScalableApp ? document.createElement("div") : null;
    if (scaleFrame && scaleSurface) {
        scaleFrame.className = "window-scale-frame";
        scaleSurface.className = "window-scale-surface";
        scaleSurface.style.setProperty("--window-scale-design-width", `${getScalableAppDesignWidth(this.id, this.options.width)}px`);
        scaleFrame.appendChild(scaleSurface);
        content.appendChild(scaleFrame);
    }

    const contentHost = scaleSurface || content;

    // Move content from original overlay to window
    if (this.contentElement) {
        // Some overlays might have multiple children, wrap them or move them all
        while (this.contentElement.firstChild) {
            contentHost.appendChild(this.contentElement.firstChild);
        }
    }

    win.appendChild(header);
    win.appendChild(content);

    document.getElementById("window-container").appendChild(win);

    this.elements = {
      window: win,
      header: header,
      content: content,
      scaleFrame: scaleFrame,
      scaleSurface: scaleSurface,
      resizer: resizer,
      minimizeBtn: header.querySelector(".minimize-btn"),
      maximizeBtn: header.querySelector(".maximize-btn"),
      closeBtn: header.querySelector(".close-btn")
    };

    // Create taskbar tab
    this.createTaskbarTab();

    if (this.isScalableApp) {
      this.setupContentScaling();
    }
  }

  setupContentScaling() {
    if (!this.elements.content || !this.elements.scaleSurface || !this.elements.scaleFrame) return;

    const scheduleScaleUpdate = () => {
      if (this.scaleRaf) return;
      this.scaleRaf = requestAnimationFrame(() => {
        this.scaleRaf = 0;
        this.updateContentScale();
      });
    };

    this.scheduleScaleUpdate = scheduleScaleUpdate;

    if (typeof ResizeObserver === "function") {
      this.scaleObserver = new ResizeObserver(scheduleScaleUpdate);
      this.scaleObserver.observe(this.elements.content);
      this.scaleObserver.observe(this.elements.scaleSurface);
    }

    window.addEventListener("resize", scheduleScaleUpdate);
    this.removeScaleResizeListener = () => window.removeEventListener("resize", scheduleScaleUpdate);
    scheduleScaleUpdate();
  }

  updateContentScale() {
    const { content, scaleFrame, scaleSurface } = this.elements;
    if (!content || !scaleFrame || !scaleSurface) return;

    const contentWidth = Math.max(1, content.clientWidth);
    const previousTransform = scaleSurface.style.transform;
    scaleSurface.style.transform = "scale(1)";

    const designWidth = getScalableAppDesignWidth(this.id, this.options.width);
    const naturalWidth = Math.max(designWidth, scaleSurface.scrollWidth, scaleSurface.offsetWidth, 1);
    const naturalHeight = Math.max(scaleSurface.scrollHeight, scaleSurface.offsetHeight, 1);
    const scale = Math.min(1, contentWidth / naturalWidth);

    scaleSurface.style.transform = previousTransform;
    scaleSurface.style.setProperty("--window-app-scale", String(scale));
    scaleSurface.style.transform = `scale(${scale})`;
    scaleFrame.style.width = `${Math.ceil(naturalWidth * scale)}px`;
    scaleFrame.style.height = `${Math.ceil(naturalHeight * scale)}px`;
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
        this.scheduleScaleUpdate?.();
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
      this.scheduleScaleUpdate?.();
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
    this.scheduleScaleUpdate?.();
  }

  close() {
    if (typeof window.beep === "function") window.beep(200, "square", 0.05);
    // Call stopAllGames if this was a game window
    if (this.id.startsWith("overlay") && !["overlayBank", "overlayShop", "overlayInventory", "overlayProfile", "overlaySeason", "overlayCrew", "overlayAdmin", "overlayConfig", "overlayGamebox", "overlayTrending", "overlayRecentGames", "overlayUpdates"].includes(this.id)) {
        if (typeof window.stopAllGames === "function") {
            window.stopAllGames();
        }
    }

    if (this.scaleObserver) {
        this.scaleObserver.disconnect();
        this.scaleObserver = null;
    }
    this.removeScaleResizeListener?.();
    if (this.scaleRaf) {
        cancelAnimationFrame(this.scaleRaf);
        this.scaleRaf = 0;
    }

    // Move content back to its original overlay container
    if (this.contentElement) {
        const contentHost = this.elements.scaleSurface || this.elements.content;
        while (contentHost.firstChild) {
            this.contentElement.appendChild(contentHost.firstChild);
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
    return icon;
}

function setupIconDraggable(icon, appId) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let startX = 0, startY = 0;
    let didDrag = false;

    icon.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        startX = e.clientX;
        startY = e.clientY;
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
        if (Math.hypot(e.clientX - startX, e.clientY - startY) > 5) {
            didDrag = true;
            icon.__suppressNextOpen = true;
        }
        icon.style.top = (icon.offsetTop - pos2) + "px";
        icon.style.left = (icon.offsetLeft - pos1) + "px";
        icon.style.position = "absolute";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;

        if (!didDrag) return;

        // Save position to state
        if (window.saveDesktopConfig) {
            window.saveDesktopConfig(appId, icon.style.left, icon.style.top);
        }
    }
}
