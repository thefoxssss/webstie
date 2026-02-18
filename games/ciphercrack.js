import { registerGameStop, setText, showToast, state, updateHighScore } from "../core.js";

const WIDTH = 800;
const HEIGHT = 420;
const COLS = 7;
const ROWS = 4;
const CELL = 78;
const GRID_W = COLS * CELL;
const GRID_H = ROWS * CELL;
const OFFSET_X = Math.floor((WIDTH - GRID_W) / 2);
const OFFSET_Y = 78;
const DURATION_MS = 75000;
const SYMBOLS = ["Δ", "Ω", "Ψ", "Σ", "Ξ", "Λ", "Φ", "Ж", "⊗"];

let run = null;

function stop() {
  if (!run) return;
  window.clearInterval(run.timer);
  window.cancelAnimationFrame(run.raf);
  if (run.canvas) run.canvas.onpointerdown = null;
  run = null;
}

function randomSymbol() {
  return SYMBOLS[(Math.random() * SYMBOLS.length) | 0];
}

function makeBoard() {
  return Array.from({ length: ROWS * COLS }, () => ({
    symbol: randomSymbol(),
    flash: 0,
  }));
}

function idx(col, row) {
  return row * COLS + col;
}

function neighbors(col, row) {
  const result = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dc && !dr) continue;
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      result.push({ col: nc, row: nr });
    }
  }
  return result;
}

function buildTarget(board, len) {
  const startCol = (Math.random() * COLS) | 0;
  const startRow = (Math.random() * ROWS) | 0;
  const path = [{ col: startCol, row: startRow }];

  while (path.length < len) {
    const last = path[path.length - 1];
    const seen = new Set(path.map((p) => `${p.col},${p.row}`));
    const options = neighbors(last.col, last.row).filter((n) => !seen.has(`${n.col},${n.row}`));
    if (!options.length) break;
    path.push(options[(Math.random() * options.length) | 0]);
  }

  return path.map((p) => board[idx(p.col, p.row)].symbol);
}

function hud(game) {
  setText("ciphercrackScore", `SCORE: ${Math.floor(game.score)}`);
  setText(
    "ciphercrackHud",
    `TARGET ${game.target.join(" ")} | INPUT ${game.chainSymbols.join(" ")} | ENTROPY ${Math.floor(game.entropy)}%`,
  );
}

function startRound(game) {
  game.chain.length = 0;
  game.chainSymbols.length = 0;
  const targetLen = Math.min(8, 3 + ((game.round + 1) / 2) | 0);
  game.target = buildTarget(game.board, targetLen);
  hud(game);
}

function pickCellFromPointer(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
  const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
  const col = Math.floor((x - OFFSET_X) / CELL);
  const row = Math.floor((y - OFFSET_Y) / CELL);
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return null;
  return { col, row };
}

export function initCipherCrack() {
  stop();
  state.currentGame = "ciphercrack";

  const canvas = document.getElementById("ciphercrackCanvas");
  const action = document.getElementById("ciphercrackAction");
  if (!canvas || !action) return;
  const ctx = canvas.getContext("2d");

  const game = {
    score: 0,
    remainingMs: DURATION_MS,
    board: makeBoard(),
    target: [],
    chain: [],
    chainSymbols: [],
    entropy: 0,
    round: 1,
  };

  startRound(game);
  setText("ciphercrackTimer", `TIME: ${(DURATION_MS / 1000).toFixed(1)}s`);

  action.disabled = true;
  action.textContent = "RUNNING";

  canvas.onpointerdown = (event) => {
    const hit = pickCellFromPointer(event, canvas);
    if (!hit) return;

    const key = `${hit.col},${hit.row}`;
    if (game.chain.includes(key)) {
      game.entropy = Math.min(100, game.entropy + 7);
      return;
    }

    if (game.chain.length) {
      const prev = game.chain[game.chain.length - 1].split(",").map(Number);
      const adjacent = Math.abs(prev[0] - hit.col) <= 1 && Math.abs(prev[1] - hit.row) <= 1;
      if (!adjacent) {
        game.entropy = Math.min(100, game.entropy + 12);
        game.chain.length = 0;
        game.chainSymbols.length = 0;
        hud(game);
        return;
      }
    }

    game.chain.push(key);
    const symbol = game.board[idx(hit.col, hit.row)].symbol;
    game.chainSymbols.push(symbol);
    game.board[idx(hit.col, hit.row)].flash = 0.22;

    for (let i = 0; i < game.chainSymbols.length; i++) {
      if (game.chainSymbols[i] !== game.target[i]) {
        game.score = Math.max(0, game.score - 10);
        game.entropy = Math.min(100, game.entropy + 14);
        game.chain.length = 0;
        game.chainSymbols.length = 0;
        showToast("BAD DECODE", "❌");
        updateHighScore("ciphercrack", Math.floor(game.score));
        hud(game);
        return;
      }
    }

    if (game.chainSymbols.length === game.target.length) {
      const gain = 30 + game.target.length * 12 + Math.max(0, 30 - game.entropy) * 0.6;
      game.score += gain;
      game.entropy = Math.max(0, game.entropy - 18);
      game.remainingMs = Math.min(DURATION_MS, game.remainingMs + 2500);
      game.round += 1;
      for (let i = 0; i < game.board.length; i++) game.board[i].symbol = randomSymbol();
      startRound(game);
      updateHighScore("ciphercrack", Math.floor(game.score));
      showToast("SEQUENCE DECRYPTED — MATRIX RESHUFFLED", "🔐");
      return;
    }

    hud(game);
  };

  const timer = window.setInterval(() => {
    game.remainingMs -= 100;

    game.entropy = Math.max(0, game.entropy - 0.3);

    if (game.entropy >= 100) {
      game.entropy = 55;
      game.remainingMs = Math.max(0, game.remainingMs - 4500);
      game.chain.length = 0;
      game.chainSymbols.length = 0;
      showToast("ENTROPY SPIKE", "⚠️");
    }

    setText("ciphercrackTimer", `TIME: ${(Math.max(0, game.remainingMs) / 1000).toFixed(1)}s`);
    hud(game);

    if (game.remainingMs <= 0) {
      const finalScore = Math.floor(game.score + game.round * 20);
      stop();
      updateHighScore("ciphercrack", finalScore);
      showToast(`CIPHER CRACK: ${finalScore} PTS`, "🔐");
      action.disabled = false;
      action.textContent = "PLAY AGAIN";
      action.onclick = initCipherCrack;
    }
  }, 100);

  let last = performance.now();
  function frame(now) {
    if (!run) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    for (const cell of game.board) cell.flash = Math.max(0, cell.flash - dt);

    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, "#14091c");
    bg.addColorStop(1, "#2f1246");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (let i = 0; i < 60; i++) {
      const x = (i * 141) % WIDTH;
      const y = ((i * 83 + now * 0.05) % HEIGHT + HEIGHT) % HEIGHT;
      ctx.fillStyle = "rgba(255,170,240,0.1)";
      ctx.fillRect(x, y, 2, 2);
    }

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const i = idx(col, row);
        const x = OFFSET_X + col * CELL;
        const y = OFFSET_Y + row * CELL;
        const key = `${col},${row}`;
        const selected = game.chain.includes(key);

        ctx.fillStyle = selected ? "rgba(255, 132, 214, 0.34)" : "rgba(42, 16, 66, 0.9)";
        ctx.fillRect(x + 4, y + 4, CELL - 8, CELL - 8);

        ctx.strokeStyle = selected ? "#ffd0ef" : "rgba(255, 95, 192, 0.45)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 4, y + 4, CELL - 8, CELL - 8);

        if (game.board[i].flash > 0) {
          ctx.fillStyle = `rgba(255,255,255,${game.board[i].flash * 0.8})`;
          ctx.fillRect(x + 6, y + 6, CELL - 12, CELL - 12);
        }

        ctx.fillStyle = "#ffe8ff";
        ctx.font = "bold 30px monospace";
        ctx.textAlign = "center";
        ctx.fillText(game.board[i].symbol, x + CELL / 2, y + CELL / 2 + 11);
      }
    }

    for (let i = 1; i < game.chain.length; i++) {
      const [ac, ar] = game.chain[i - 1].split(",").map(Number);
      const [bc, br] = game.chain[i].split(",").map(Number);
      const ax = OFFSET_X + ac * CELL + CELL / 2;
      const ay = OFFSET_Y + ar * CELL + CELL / 2;
      const bx = OFFSET_X + bc * CELL + CELL / 2;
      const by = OFFSET_Y + br * CELL + CELL / 2;
      ctx.strokeStyle = "#fff37a";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }

    const entropyW = (game.entropy / 100) * 220;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(18, 16, 224, 14);
    ctx.fillStyle = game.entropy < 65 ? "#75ffd6" : "#ff847a";
    ctx.fillRect(20, 18, entropyW, 10);

    ctx.fillStyle = "#ffd0f8";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`ROUND ${game.round}`, WIDTH - 116, 26);

    run.raf = window.requestAnimationFrame(frame);
  }

  run = { timer, raf: 0, canvas };
  run.raf = window.requestAnimationFrame(frame);
  registerGameStop(stop);
}
