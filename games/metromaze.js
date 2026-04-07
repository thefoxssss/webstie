import { registerGameStop, setText, showToast, state, updateHighScore, isInputFocused } from "../core.js";

const WIDTH = 800;
const HEIGHT = 420;
const MAZE_COLS = 17;
const MAZE_ROWS = 11;
const CELL_SIZE = 34;
const OFFSET_X = Math.floor((WIDTH - MAZE_COLS * CELL_SIZE) * 0.5);
const OFFSET_Y = Math.floor((HEIGHT - MAZE_ROWS * CELL_SIZE) * 0.5);
const BASE_TIME_MS = 70000;

let run = null;

function stop() {
  if (!run) return;
  window.clearInterval(run.timer);
  window.cancelAnimationFrame(run.raf);
  if (run.canvas) run.canvas.onpointerdown = null;
  document.removeEventListener("keydown", run.onKeyDown);
  run = null;
}

function makeCell() {
  return {
    walls: [1, 1, 1, 1],
    visited: false,
  };
}

function cellIndex(col, row) {
  return row * MAZE_COLS + col;
}

function carveMaze() {
  const cells = Array.from({ length: MAZE_COLS * MAZE_ROWS }, makeCell);
  const stack = [{ col: 0, row: 0 }];
  cells[0].visited = true;

  const dirs = [
    { dc: 0, dr: -1, wall: 0, opposite: 2 },
    { dc: 1, dr: 0, wall: 1, opposite: 3 },
    { dc: 0, dr: 1, wall: 2, opposite: 0 },
    { dc: -1, dr: 0, wall: 3, opposite: 1 },
  ];

  while (stack.length) {
    const current = stack[stack.length - 1];
    const options = [];
    for (const dir of dirs) {
      const nextCol = current.col + dir.dc;
      const nextRow = current.row + dir.dr;
      if (nextCol < 0 || nextRow < 0 || nextCol >= MAZE_COLS || nextRow >= MAZE_ROWS) continue;
      const next = cells[cellIndex(nextCol, nextRow)];
      if (next.visited) continue;
      options.push({ ...dir, nextCol, nextRow });
    }

    if (!options.length) {
      stack.pop();
      continue;
    }

    const pick = options[(Math.random() * options.length) | 0];
    const now = cells[cellIndex(current.col, current.row)];
    const next = cells[cellIndex(pick.nextCol, pick.nextRow)];
    now.walls[pick.wall] = 0;
    next.walls[pick.opposite] = 0;
    next.visited = true;
    stack.push({ col: pick.nextCol, row: pick.nextRow });
  }

  for (const cell of cells) cell.visited = false;
  return cells;
}

function canMove(cells, col, row, dir) {
  if (col < 0 || row < 0 || col >= MAZE_COLS || row >= MAZE_ROWS) return false;
  const cell = cells[cellIndex(col, row)];
  return !cell.walls[dir];
}

function spawnRelics(cells, level) {
  const relics = [];
  const used = new Set(["0,0", `${MAZE_COLS - 1},${MAZE_ROWS - 1}`]);
  const target = Math.min(14, 5 + level);

  while (relics.length < target) {
    const col = (Math.random() * MAZE_COLS) | 0;
    const row = (Math.random() * MAZE_ROWS) | 0;
    const key = `${col},${row}`;
    if (used.has(key)) continue;
    used.add(key);
    relics.push({ col, row, taken: false, pulse: Math.random() * Math.PI * 2 });
  }

  return relics;
}

function spawnSentinels(cells, level) {
  const sentinels = [];
  const count = Math.min(5, 1 + ((level + 1) / 2) | 0);

  for (let i = 0; i < count; i++) {
    let col = 1;
    let row = 1;
    for (let attempts = 0; attempts < 40; attempts++) {
      col = (Math.random() * MAZE_COLS) | 0;
      row = (Math.random() * MAZE_ROWS) | 0;
      if (col + row < 4) continue;
      if (col === MAZE_COLS - 1 && row === MAZE_ROWS - 1) continue;
      break;
    }

    const speed = 2.6 + Math.random() * 0.9 + level * 0.12;
    sentinels.push({
      col,
      row,
      tx: col,
      ty: row,
      px: col,
      py: row,
      speed,
      cooldown: 0,
    });
  }

  return sentinels;
}

function chooseSentinelTarget(cells, sentinel) {
  const dirs = [
    { dc: 0, dr: -1, wall: 0 },
    { dc: 1, dr: 0, wall: 1 },
    { dc: 0, dr: 1, wall: 2 },
    { dc: -1, dr: 0, wall: 3 },
  ];

  const options = dirs
    .filter((dir) => canMove(cells, sentinel.col, sentinel.row, dir.wall))
    .map((dir) => ({ col: sentinel.col + dir.dc, row: sentinel.row + dir.dr }));

  if (!options.length) return;
  const pick = options[(Math.random() * options.length) | 0];
  sentinel.tx = pick.col;
  sentinel.ty = pick.row;
}

function updateHud(level, relicsLeft, runData) {
  setText(
    "metromazeHud",
    `LEVEL ${level} | RELICS: ${relicsLeft} | EXIT UNLOCKS WHEN ALL RELICS ARE SECURED`,
  );
  setText("metromazeScore", `SCORE: ${Math.floor(runData.score)}`);
}

function loadLevel(level, runData) {
  runData.cells = carveMaze();
  runData.player.col = 0;
  runData.player.row = 0;
  runData.player.x = 0;
  runData.player.y = 0;
  runData.relics = spawnRelics(runData.cells, level);
  runData.sentinels = spawnSentinels(runData.cells, level);
  runData.level = level;
  runData.moveCooldown = 0;
  updateHud(level, runData.relics.length, runData);
}

function tryMovePlayer(runData, dc, dr, wallDir) {
  if (runData.moveCooldown > 0) return;
  const { player, cells } = runData;
  if (!canMove(cells, player.col, player.row, wallDir)) return;
  player.col += dc;
  player.row += dr;
  runData.moveCooldown = 0.09;

  for (const relic of runData.relics) {
    if (relic.taken) continue;
    if (relic.col === player.col && relic.row === player.row) {
      relic.taken = true;
      runData.score += 35;
      showToast("RELIC SECURED", "💠");
      break;
    }
  }

  const remaining = runData.relics.filter((item) => !item.taken).length;
  if (!remaining && player.col === MAZE_COLS - 1 && player.row === MAZE_ROWS - 1) {
    runData.score += 140 + runData.level * 30;
    runData.remainingMs = Math.min(BASE_TIME_MS, runData.remainingMs + 6000);
    loadLevel(runData.level + 1, runData);
    showToast(`LEVEL ${runData.level}`, "🚇");
    return;
  }

  updateHud(runData.level, remaining, runData);
  updateHighScore("metromaze", Math.floor(runData.score));
}

function handlePointerMove(event, canvas, runData) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
  const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
  const playerCenterX = OFFSET_X + runData.player.x * CELL_SIZE + CELL_SIZE / 2;
  const playerCenterY = OFFSET_Y + runData.player.y * CELL_SIZE + CELL_SIZE / 2;
  const dx = x - playerCenterX;
  const dy = y - playerCenterY;

  if (Math.abs(dx) > Math.abs(dy)) {
    tryMovePlayer(runData, dx > 0 ? 1 : -1, 0, dx > 0 ? 1 : 3);
  } else {
    tryMovePlayer(runData, 0, dy > 0 ? 1 : -1, dy > 0 ? 2 : 0);
  }
}

export function initMetroMaze() {
  stop();
  state.currentGame = "metromaze";

  const canvas = document.getElementById("metromazeCanvas");
  const action = document.getElementById("metromazeAction");
  if (!canvas || !action) return;
  const ctx = canvas.getContext("2d");
  let started = false;

  const runData = {
    score: 0,
    level: 1,
    remainingMs: BASE_TIME_MS,
    moveCooldown: 0,
    player: { col: 0, row: 0, x: 0, y: 0 },
    cells: [],
    relics: [],
    sentinels: [],
  };

  loadLevel(1, runData);
  setText("metromazeTimer", `TIME: ${(BASE_TIME_MS / 1000).toFixed(1)}s`);
  action.disabled = true;
  action.textContent = "RUNNING";

  const onKeyDown = (event) => {
    if (isInputFocused(event)) return;
    started = true;
    if (!run) return;
    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
      event.preventDefault();
      tryMovePlayer(runData, 0, -1, 0);
    } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      event.preventDefault();
      tryMovePlayer(runData, 1, 0, 1);
    } else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
      event.preventDefault();
      tryMovePlayer(runData, 0, 1, 2);
    } else if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      event.preventDefault();
      tryMovePlayer(runData, -1, 0, 3);
    }
  };

  document.addEventListener("keydown", onKeyDown);
  canvas.onpointerdown = (event) => {
    started = true;
    handlePointerMove(event, canvas, runData);
  };

  const timer = window.setInterval(() => {
    if (!started) return;
    runData.remainingMs -= 100;
    setText("metromazeTimer", `TIME: ${(Math.max(0, runData.remainingMs) / 1000).toFixed(1)}s`);

    if (runData.remainingMs <= 0) {
      const finalScore = Math.floor(runData.score + runData.level * 25);
      stop();
      updateHighScore("metromaze", finalScore);
      showToast(`MAZE RUN COMPLETE: ${finalScore}`, "🚇");
      action.disabled = false;
      action.textContent = "PLAY AGAIN";
      action.onclick = initMetroMaze;
    }
  }, 100);

  let last = performance.now();
  function frame(now) {
    if (!run) return;
    const dt = started ? Math.min(0.045, (now - last) / 1000) : 0;
    last = now;

    runData.moveCooldown = Math.max(0, runData.moveCooldown - dt);

    runData.player.x += (runData.player.col - runData.player.x) * Math.min(1, dt * 18);
    runData.player.y += (runData.player.row - runData.player.y) * Math.min(1, dt * 18);

    for (const sentinel of runData.sentinels) {
      sentinel.cooldown -= dt;
      if (sentinel.col === sentinel.tx && sentinel.row === sentinel.ty && sentinel.cooldown <= 0) {
        chooseSentinelTarget(runData.cells, sentinel);
        sentinel.cooldown = 0.05;
      }
      const dx = sentinel.tx - sentinel.px;
      const dy = sentinel.ty - sentinel.py;
      const distance = Math.hypot(dx, dy);
      if (distance > 0.01) {
        const step = Math.min(1, sentinel.speed * dt);
        sentinel.px += (dx / distance) * step;
        sentinel.py += (dy / distance) * step;
        if (Math.hypot(sentinel.tx - sentinel.px, sentinel.ty - sentinel.py) < 0.08) {
          sentinel.px = sentinel.tx;
          sentinel.py = sentinel.ty;
          sentinel.col = sentinel.tx;
          sentinel.row = sentinel.ty;
        }
      }

      const hitPlayer = Math.hypot(sentinel.px - runData.player.x, sentinel.py - runData.player.y) < 0.34;
      if (hitPlayer) {
        runData.player.col = 0;
        runData.player.row = 0;
        runData.score = Math.max(0, runData.score - 70);
        runData.remainingMs = Math.max(0, runData.remainingMs - 2500);
        updateHud(runData.level, runData.relics.filter((item) => !item.taken).length, runData);
        showToast("SENTINEL HIT", "☠️");
      }
    }

    ctx.fillStyle = "#060d13";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "rgba(79, 126, 153, 0.12)";
    for (let r = 0; r < MAZE_ROWS; r++) {
      for (let c = 0; c < MAZE_COLS; c++) {
        ctx.fillRect(OFFSET_X + c * CELL_SIZE + 1, OFFSET_Y + r * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      }
    }

    ctx.strokeStyle = "#8ce8ff";
    ctx.lineWidth = 2;
    for (let r = 0; r < MAZE_ROWS; r++) {
      for (let c = 0; c < MAZE_COLS; c++) {
        const x = OFFSET_X + c * CELL_SIZE;
        const y = OFFSET_Y + r * CELL_SIZE;
        const cell = runData.cells[cellIndex(c, r)];
        if (cell.walls[0]) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + CELL_SIZE, y);
          ctx.stroke();
        }
        if (cell.walls[1]) {
          ctx.beginPath();
          ctx.moveTo(x + CELL_SIZE, y);
          ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE);
          ctx.stroke();
        }
        if (cell.walls[2]) {
          ctx.beginPath();
          ctx.moveTo(x, y + CELL_SIZE);
          ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE);
          ctx.stroke();
        }
        if (cell.walls[3]) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + CELL_SIZE);
          ctx.stroke();
        }
      }
    }

    const relicsLeft = runData.relics.filter((item) => !item.taken).length;
    for (const relic of runData.relics) {
      if (relic.taken) continue;
      relic.pulse += dt * 4;
      const scale = 0.72 + Math.sin(relic.pulse) * 0.16;
      const rx = OFFSET_X + relic.col * CELL_SIZE + CELL_SIZE / 2;
      const ry = OFFSET_Y + relic.row * CELL_SIZE + CELL_SIZE / 2;
      ctx.fillStyle = "#6df2d8";
      ctx.beginPath();
      ctx.moveTo(rx, ry - 8 * scale);
      ctx.lineTo(rx + 8 * scale, ry);
      ctx.lineTo(rx, ry + 8 * scale);
      ctx.lineTo(rx - 8 * scale, ry);
      ctx.closePath();
      ctx.fill();
    }

    const exitX = OFFSET_X + (MAZE_COLS - 1) * CELL_SIZE;
    const exitY = OFFSET_Y + (MAZE_ROWS - 1) * CELL_SIZE;
    ctx.fillStyle = relicsLeft ? "rgba(255, 70, 70, 0.35)" : "rgba(120, 255, 130, 0.45)";
    ctx.fillRect(exitX + 5, exitY + 5, CELL_SIZE - 10, CELL_SIZE - 10);
    ctx.fillStyle = "#eaf6ff";
    ctx.font = "bold 12px 'Roboto Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(relicsLeft ? "LOCK" : "EXIT", exitX + CELL_SIZE / 2, exitY + CELL_SIZE / 2 + 4);

    for (const sentinel of runData.sentinels) {
      const x = OFFSET_X + sentinel.px * CELL_SIZE + CELL_SIZE / 2;
      const y = OFFSET_Y + sentinel.py * CELL_SIZE + CELL_SIZE / 2;
      ctx.fillStyle = "#ff3d73";
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 61, 115, 0.35)";
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    const px = OFFSET_X + runData.player.x * CELL_SIZE + CELL_SIZE / 2;
    const py = OFFSET_Y + runData.player.y * CELL_SIZE + CELL_SIZE / 2;
    ctx.fillStyle = "#ffd15c";
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();

    run.raf = window.requestAnimationFrame(frame);
  }

  run = { timer, raf: 0, canvas, onKeyDown };
  run.raf = window.requestAnimationFrame(frame);
  registerGameStop(stop);
}
