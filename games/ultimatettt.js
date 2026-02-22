import { registerGameStop, setText, showToast, state, updateHighScore } from "../core.js";

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

let game = null;

function checkWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function availableBoards() {
  if (game.targetBoard !== -1 && !game.localWinners[game.targetBoard] && game.localBoards[game.targetBoard].includes(null)) {
    return [game.targetBoard];
  }
  const list = [];
  for (let i = 0; i < 9; i += 1) {
    if (!game.localWinners[i] && game.localBoards[i].includes(null)) list.push(i);
  }
  return list;
}

function updateStatus() {
  if (!game) return;
  if (game.winner) {
    if (game.winner === "draw") {
      setText("ultimatetttStatus", "DRAW: ALL BOARDS RESOLVED");
    } else {
      setText("ultimatetttStatus", `${game.winner} WINS THE ULTIMATE GRID`);
    }
    setText("ultimatetttTurn", "PRESS RESET TO PLAY AGAIN");
    return;
  }

  const allowed = availableBoards();
  const boardLabel =
    allowed.length === 1
      ? `BOARD ${allowed[0] + 1} ONLY`
      : "ANY OPEN BOARD";
  setText("ultimatetttStatus", `TURN: ${game.turn} • LEGAL: ${boardLabel}`);

  setText(
    "ultimatetttTurn",
    "Rule: Your move sends your opponent to the matching small board. If it's full or won, they may play anywhere.",
  );
}

function render() {
  if (!game) return;
  const boardEl = document.getElementById("ultimatetttGrid");
  if (!boardEl) return;

  const allowedBoards = new Set(availableBoards());

  for (let bi = 0; bi < 9; bi += 1) {
    const mini = boardEl.children[bi];
    if (!mini) continue;
    mini.classList.toggle("is-allowed", !game.winner && allowedBoards.has(bi));
    mini.classList.toggle("is-locked", !game.winner && !allowedBoards.has(bi));

    const localWinner = game.localWinners[bi];
    mini.dataset.winner = localWinner || "";

    for (let ci = 0; ci < 9; ci += 1) {
      const cell = mini.children[ci];
      const value = game.localBoards[bi][ci];
      cell.textContent = value || "";
      cell.classList.toggle("is-playable", !game.winner && allowedBoards.has(bi) && !value && !localWinner);
    }
  }

  document.querySelectorAll(".uttt-meta-cell").forEach((el) => {
    const i = Number(el.dataset.i);
    const value = game.localWinners[i];
    el.textContent = value === "draw" ? "=" : value || "·";
    el.classList.toggle("x", value === "X");
    el.classList.toggle("o", value === "O");
  });

  updateStatus();
}

function commitMove(boardIndex, cellIndex) {
  if (!game || game.winner) return;

  const legalBoards = availableBoards();
  if (!legalBoards.includes(boardIndex)) return;
  if (game.localWinners[boardIndex]) return;
  if (game.localBoards[boardIndex][cellIndex]) return;

  game.localBoards[boardIndex][cellIndex] = game.turn;

  const localWinner = checkWinner(game.localBoards[boardIndex]);
  if (localWinner) {
    game.localWinners[boardIndex] = localWinner;
  } else if (!game.localBoards[boardIndex].includes(null)) {
    game.localWinners[boardIndex] = "draw";
  }

  const metaBoard = game.localWinners.map((w) => (w === "X" || w === "O" ? w : null));
  const metaWinner = checkWinner(metaBoard);
  if (metaWinner) {
    game.winner = metaWinner;
  } else if (game.localWinners.every((w) => w !== null)) {
    game.winner = "draw";
  }

  game.targetBoard = cellIndex;
  game.turn = game.turn === "X" ? "O" : "X";

  if (!game.winner) {
    const forced = availableBoards();
    if (forced.length === 0) game.winner = "draw";
  }

  if (game.winner === "X") {
    game.score.X += 1;
    updateHighScore("ultimatettt", game.score.X);
    showToast("X CLAIMS THE ULTIMATE BOARD", "❎");
  } else if (game.winner === "O") {
    game.score.O += 1;
    showToast("O CLAIMS THE ULTIMATE BOARD", "⭕");
  } else if (game.winner === "draw") {
    showToast("ULTIMATE GRID ENDED IN A DRAW", "🤝");
  }

  setText("ultimatetttScore", `X:${game.score.X} | O:${game.score.O}`);
  render();
}

function stop() {
  if (!game) return;
  const boardEl = document.getElementById("ultimatetttGrid");
  if (boardEl) boardEl.onclick = null;
  const resetBtn = document.getElementById("ultimatetttReset");
  if (resetBtn) resetBtn.onclick = null;
  game = null;
}

export function initUltimateTTT() {
  stop();
  state.currentGame = "ultimatettt";

  const boardEl = document.getElementById("ultimatetttGrid");
  if (!boardEl) return;

  game = {
    localBoards: Array.from({ length: 9 }, () => Array(9).fill(null)),
    localWinners: Array(9).fill(null),
    turn: "X",
    targetBoard: -1,
    winner: null,
    score: { X: 0, O: 0 },
  };

  boardEl.onclick = (event) => {
    const cell = event.target.closest(".uttt-cell");
    if (!cell || !game) return;
    const boardIndex = Number(cell.dataset.board);
    const cellIndex = Number(cell.dataset.cell);
    commitMove(boardIndex, cellIndex);
  };

  const resetBtn = document.getElementById("ultimatetttReset");
  if (resetBtn) {
    resetBtn.onclick = () => initUltimateTTT();
  }

  setText("ultimatetttScore", "X:0 | O:0");
  render();
}

registerGameStop(stop);
