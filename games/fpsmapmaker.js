const TILE_SIZE = 24;
const GRID_W = 30;
const GRID_H = 18;

const TOOL_DEFS = [
  { id: "wall", label: "WALL" },
  { id: "spawn", label: "SPAWN" },
  { id: "health", label: "HEALTH" },
  { id: "ammo", label: "AMMO" },
  { id: "cover", label: "COVER" },
  { id: "light", label: "LIGHT" },
  { id: "erase", label: "ERASE" },
  { id: "fill", label: "FILL" },
  { id: "rect", label: "RECT" },
  { id: "select", label: "SELECT" },
];

const COLORS = {
  empty: "#151515",
  wall: "#9a9a9a",
  spawn: "#3ddf6d",
  health: "#e84545",
  ammo: "#4da3ff",
  cover: "#e0ad42",
  light: "#d997ff",
};

const state = {
  mapName: "fps_custom_map",
  grid: Array.from({ length: GRID_H }, () => Array.from({ length: GRID_W }, () => "empty")),
  tool: "wall",
  selected: null,
  dragStart: null,
  isDown: false,
};

function getEl(id) { return document.getElementById(id); }

function toolValue(tool) { return tool === "erase" ? "empty" : tool; }

function drawGrid() {
  const canvas = getEl("fpsMapMakerCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      const v = state.grid[y][x];
      ctx.fillStyle = COLORS[v] || COLORS.empty;
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE - 1);
    }
  }
  if (state.selected) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(state.selected.x * TILE_SIZE + 1, state.selected.y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
  }
}

function posToCell(e) {
  const canvas = getEl("fpsMapMakerCanvas");
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
  const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return null;
  return { x, y };
}

function paintCell(cell) {
  if (!cell) return;
  if (state.tool === "select") {
    state.selected = cell;
  } else if (state.tool !== "rect" && state.tool !== "fill") {
    state.grid[cell.y][cell.x] = toolValue(state.tool);
  }
  drawGrid();
}

function fillAll() {
  const value = toolValue(state.tool);
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) state.grid[y][x] = value;
  }
}

function applyRect(from, to) {
  if (!from || !to) return;
  const minX = Math.min(from.x, to.x);
  const maxX = Math.max(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  const maxY = Math.max(from.y, to.y);
  const value = toolValue(state.tool);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) state.grid[y][x] = value;
  }
}

function refreshToolUi() {
  const panel = getEl("fpsMapMakerTools");
  if (!panel) return;
  panel.innerHTML = "";
  TOOL_DEFS.forEach((tool) => {
    const btn = document.createElement("button");
    btn.className = `menu-btn${state.tool === tool.id ? " active" : ""}`;
    btn.textContent = tool.label;
    btn.onclick = () => { state.tool = tool.id; refreshToolUi(); };
    panel.appendChild(btn);
  });
}

function objectList() {
  const objects = [];
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      const type = state.grid[y][x];
      if (type !== "empty") objects.push({ type, x, y });
    }
  }
  return objects;
}

function exportMap() {
  state.mapName = String(getEl("fpsMapMakerName")?.value || "fps_custom_map").trim() || "fps_custom_map";
  const payload = {
    version: 1,
    game: "fps",
    name: state.mapName,
    width: GRID_W,
    height: GRID_H,
    tileSize: TILE_SIZE,
    objects: objectList(),
  };
  const pretty = JSON.stringify(payload, null, 2);
  const blob = new Blob([pretty], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${state.mapName.replace(/[^a-z0-9_-]+/gi, "_")}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  const output = getEl("fpsMapMakerOutput");
  if (output) output.value = pretty;
}

export function initFpsMapMaker() {
  const canvas = getEl("fpsMapMakerCanvas");
  if (!canvas) return;
  refreshToolUi();
  drawGrid();

  canvas.onmousedown = (e) => {
    state.isDown = true;
    const cell = posToCell(e);
    state.dragStart = cell;
    if (state.tool === "fill") {
      fillAll();
      drawGrid();
      return;
    }
    if (state.tool !== "rect") paintCell(cell);
  };
  canvas.onmousemove = (e) => {
    if (!state.isDown) return;
    if (state.tool === "rect" || state.tool === "select") return;
    paintCell(posToCell(e));
  };
  canvas.onmouseup = (e) => {
    if (!state.isDown) return;
    state.isDown = false;
    if (state.tool === "rect") {
      applyRect(state.dragStart, posToCell(e));
      drawGrid();
    }
  };
  getEl("fpsMapMakerClear").onclick = () => {
    state.grid = Array.from({ length: GRID_H }, () => Array.from({ length: GRID_W }, () => "empty"));
    drawGrid();
  };
  getEl("fpsMapMakerExport").onclick = exportMap;
}
