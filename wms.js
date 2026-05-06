/**
 * Window Management System (WMS) for the terminal desktop.
 * Handles window lifecycle, dragging, resizing, and taskbar integration.
 */

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
    const tab = document.createElement("button");
    tab.className = "taskbar-tab";
    tab.id = `tab-${this.id}`;
    tab.innerHTML = `<span class="tab-icon">${this.options.icon}</span> <span class="tab-text">${this.title}</span>`;
    tab.onclick = () => this.toggleMinimize();

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

      // Basic boundary check
      const desktop = document.getElementById("desktop");
      if (top < 0) top = 0;
      if (left < 0) left = 0;

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
    this.isMinimized = !this.isMinimized;
    if (this.isMinimized) {
      this.elements.window.style.display = "none";
      this.elements.tab.classList.remove("active");
    } else {
      this.elements.window.style.display = "flex";
      this.focus();
    }
  }

  toggleMaximize() {
    this.isMaximized = !this.isMaximized;
    this.elements.window.classList.toggle("maximized", this.isMaximized);
    if (this.isMaximized) {
      this.elements.maximizeBtn.textContent = "🗗";
    } else {
      this.elements.maximizeBtn.textContent = "🗖";
    }
  }

  close() {
    // Move content back to its original overlay container
    if (this.contentElement) {
        while (this.elements.content.firstChild) {
            this.contentElement.appendChild(this.elements.content.firstChild);
        }
    }

    this.elements.window.remove();
    this.elements.tab.remove();

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

export function initDesktop() {
    const desktop = document.getElementById("desktop");
    if (!desktop) return;

    // Default desktop apps
    const apps = [
        { id: "bank", title: "BANK", icon: "🏦", overlayId: "overlayBank" },
        { id: "shop", title: "SHOP", icon: "🛒", overlayId: "overlayShop" },
        { id: "inventory", title: "BAG", icon: "🎒", overlayId: "overlayInventory" },
        { id: "profile", title: "PROFILE", icon: "👤", overlayId: "overlayProfile" },
        { id: "season", title: "SEASON", icon: "🗓️", overlayId: "overlaySeason" },
        { id: "crew", title: "CREW", icon: "🏴‍☠️", overlayId: "overlayCrew" },
        { id: "chat", title: "CHAT", icon: "💬", overlayId: "globalChat" },
        { id: "config", title: "CONFIG", icon: "⚙️", overlayId: "overlayConfig" },
        { id: "admin", title: "ADMIN", icon: "⚡", overlayId: "overlayAdmin", adminOnly: true },
        { id: "games", title: "GAMES", icon: "🎮", overlayId: "overlayGamebox" },
    ];

    // Add games from catalog
    // Note: This requires importing GAME_DIRECTORY_ENTRIES, which we can do via window global if needed
    // or just rely on the script.js to call a method.

    apps.forEach(app => {
        createDesktopIcon(app);
    });
}

export function createDesktopIcon(app) {
    const desktop = document.getElementById("desktop");
    const icon = document.createElement("div");
    icon.className = "desktop-icon";
    icon.id = `icon-${app.id}`;
    icon.innerHTML = `
        <div class="desktop-icon-img">${app.icon}</div>
        <div class="desktop-icon-label">${app.title}</div>
    `;

    if (app.adminOnly) {
        icon.style.display = "none";
        icon.classList.add("admin-icon");
    }

    icon.ondblclick = () => {
        if (typeof window.openGame === "function") {
            window.openGame(app.overlayId);
        }
    };

    // Support single click for mobile
    icon.onclick = (e) => {
        if (window.innerWidth <= 768) {
            if (typeof window.openGame === "function") {
                window.openGame(app.overlayId);
            }
        }
    };

    desktop.appendChild(icon);
    setupIconDraggable(icon, app.id);
}

function setupIconDraggable(icon, appId) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    icon.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
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
        icon.style.top = (icon.offsetTop - pos2) + "px";
        icon.style.left = (icon.offsetLeft - pos1) + "px";
        icon.style.position = "absolute";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;

        // Save position to state
        if (window.saveDesktopConfig) {
            window.saveDesktopConfig(appId, icon.style.left, icon.style.top);
        }
    }
}
