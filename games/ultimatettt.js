import { registerGameStop, setText, showToast, state, updateHighScore, firebase } from "../core.js";

const { doc, setDoc, updateDoc, onSnapshot, runTransaction } = firebase;
const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const ROOM_PREFIX = "uttt_";

let game = null;
let roomCode = null;
let side = null;
let unsub = null;
let aiMode = false;

function roomRef(code) { return doc(firebase.db, "gooner_terminal_rooms", ROOM_PREFIX + code); }
function randomCode() { return Math.floor(1000 + Math.random() * 9000).toString(); }
function checkWinner(board) { for (const [a,b,c] of WIN_LINES) if (board[a] && board[a]===board[b] && board[a]===board[c]) return board[a]; return null; }

function availableBoards(localBoards, localWinners, targetBoard) {
  if (targetBoard !== -1 && !localWinners[targetBoard] && localBoards[targetBoard].includes(null)) return [targetBoard];
  const out = [];
  for (let i=0;i<9;i+=1) if (!localWinners[i] && localBoards[i].includes(null)) out.push(i);
  return out;
}

function setModeUi(mode) {
  document.getElementById("utttMenu").style.display = mode === "menu" ? "flex" : "none";
  document.getElementById("utttLobby").style.display = mode === "lobby" ? "flex" : "none";
  document.getElementById("utttGame").style.display = mode === "game" ? "flex" : "none";
}

function render() {
  if (!game) return;
  const boardEl = document.getElementById("ultimatetttGrid");
  const allowed = new Set(availableBoards(game.localBoards, game.localWinners, game.targetBoard));

  for (let bi=0; bi<9; bi+=1) {
    const mini = boardEl.children[bi];
    const won = game.localWinners[bi];
    mini.dataset.winner = won || "";
    mini.classList.toggle("is-allowed", !game.winner && allowed.has(bi));
    mini.classList.toggle("is-locked", !game.winner && !allowed.has(bi));
    for (let ci=0; ci<9; ci+=1) {
      const c = mini.children[ci];
      const v = game.localBoards[bi][ci];
      c.textContent = v || "";
      c.classList.toggle("is-playable", !game.winner && allowed.has(bi) && !v && !won);
    }
  }

  document.querySelectorAll(".uttt-meta-cell").forEach((el) => {
    const i = Number(el.dataset.i);
    const v = game.localWinners[i];
    el.textContent = v === "draw" ? "=" : v || "·";
    el.classList.toggle("x", v === "X");
    el.classList.toggle("o", v === "O");
  });

  if (game.winner) {
    setText("ultimatetttStatus", game.winner === "draw" ? "DRAW" : `${game.winner} WINS`);
    setText("ultimatetttTurn", "PRESS PLAY AGAIN OR RETURN TO MENU");
    document.getElementById("ultimatetttReset").style.display = "inline-block";
  } else {
    const allow = availableBoards(game.localBoards, game.localWinners, game.targetBoard);
    const legal = allow.length===1 ? `BOARD ${allow[0]+1} ONLY` : "ANY OPEN BOARD";
    setText("ultimatetttStatus", `TURN: ${game.turn} • LEGAL: ${legal}`);
    if (aiMode) setText("ultimatetttTurn", game.turn === side ? "YOUR TURN" : "AI THINKING...");
    else setText("ultimatetttTurn", game.turn === side ? "YOUR TURN" : "OPPONENT TURN");
    document.getElementById("ultimatetttReset").style.display = "none";
  }
}

function reduceStateAfterMove(next) {
  const meta = next.localWinners.map((w) => (w === "X" || w === "O" ? w : null));
  const metaWinner = checkWinner(meta);
  if (metaWinner) next.winner = metaWinner;
  else if (next.localWinners.every((w) => w !== null)) next.winner = "draw";
  return next;
}

function tryApplyMove(base, bi, ci, mark) {
  if (base.winner) return null;
  const legal = availableBoards(base.localBoards, base.localWinners, base.targetBoard);
  if (!legal.includes(bi) || base.localWinners[bi] || base.localBoards[bi][ci]) return null;
  const next = structuredClone(base);
  next.localBoards[bi][ci] = mark;
  const local = checkWinner(next.localBoards[bi]);
  if (local) next.localWinners[bi] = local;
  else if (!next.localBoards[bi].includes(null)) next.localWinners[bi] = "draw";
  next.targetBoard = ci;
  next.turn = mark === "X" ? "O" : "X";
  return reduceStateAfterMove(next);
}

function aiPlay() {
  if (!aiMode || !game || game.winner || game.turn === side) return;
  const legalBoards = availableBoards(game.localBoards, game.localWinners, game.targetBoard);
  const moves = [];
  legalBoards.forEach((bi) => game.localBoards[bi].forEach((v, ci) => { if (!v) moves.push([bi, ci]); }));
  if (!moves.length) return;
  const [bi, ci] = moves[Math.floor(Math.random() * moves.length)];
  const next = tryApplyMove(game, bi, ci, game.turn);
  if (!next) return;
  game = next;
  if (game.winner === "X") updateHighScore("ultimatettt", side === "X" ? 1 : 0);
  render();
}

function enterGame(data) {
  game = data;
  setModeUi("game");
  render();
  if (aiMode && game.turn !== side && !game.winner) setTimeout(aiPlay, 260);
}

async function createRoom() {
  aiMode = false;
  if (!state.myUid) return showToast("OFFLINE", "📡");
  const code = randomCode();
  await setDoc(roomRef(code), {
    code,
    status: "lobby",
    turn: "X",
    targetBoard: -1,
    localBoards: Array.from({ length: 9 }, () => Array(9).fill(null)),
    localWinners: Array(9).fill(null),
    winner: null,
    players: { X: state.myUid, O: null },
    names: { X: state.myName, O: "..." },
  });
  joinRoom(code, "X");
}

async function joinRoomByCode() {
  aiMode = false;
  const code = String(document.getElementById("joinUTTTCode").value || "").trim();
  if (!code) return;
  try {
    const seat = await runTransaction(firebase.db, async (t) => {
      const ref = roomRef(code);
      const snap = await t.get(ref);
      if (!snap.exists()) throw new Error("ROOM_404");
      const d = snap.data();
      if (!d.players.X) { t.update(ref, { ["players.X"]: state.myUid, ["names.X"]: state.myName }); return "X"; }
      if (!d.players.O) { t.update(ref, { ["players.O"]: state.myUid, ["names.O"]: state.myName }); return "O"; }
      throw new Error("ROOM_FULL");
    });
    joinRoom(code, seat);
  } catch (e) {
    showToast(String(e?.message || "JOIN FAILED"), "⚠️");
  }
}

function joinRoom(code, mySide) {
  side = mySide;
  roomCode = code;
  setModeUi("lobby");
  setText("utttRoomId", code);
  if (unsub) unsub();
  unsub = onSnapshot(roomRef(code), (snap) => {
    if (!snap.exists()) return;
    const d = snap.data();
    if (d.status === "lobby") {
      document.getElementById("utttPList").innerHTML = `<div>X: ${d.names.X}</div><div>O: ${d.names.O}</div>`;
      const canStart = side === "X" && d.players.O;
      document.getElementById("utttStartBtn").style.display = canStart ? "inline-block" : "none";
      setText("utttWait", canStart ? "READY" : "WAITING...");
      return;
    }
    enterGame(d);
  });
}

function startAI() {
  aiMode = true;
  side = "X";
  setModeUi("game");
  enterGame({
    turn: "X",
    targetBoard: -1,
    localBoards: Array.from({ length: 9 }, () => Array(9).fill(null)),
    localWinners: Array(9).fill(null),
    winner: null,
  });
}

async function startOnlineGame() {
  if (!roomCode) return;
  await updateDoc(roomRef(roomCode), { status: "playing" });
}

async function resetOnlineGame() {
  if (aiMode) return startAI();
  if (!roomCode) return;
  await updateDoc(roomRef(roomCode), {
    status: "playing",
    turn: "X",
    targetBoard: -1,
    localBoards: Array.from({ length: 9 }, () => Array(9).fill(null)),
    localWinners: Array(9).fill(null),
    winner: null,
  });
}

async function onGridClick(event) {
  const cell = event.target.closest(".uttt-cell");
  if (!cell || !game || game.winner) return;
  const bi = Number(cell.dataset.board);
  const ci = Number(cell.dataset.cell);

  if (aiMode) {
    if (game.turn !== side) return;
    const next = tryApplyMove(game, bi, ci, side);
    if (!next) return;
    game = next;
    if (game.winner === side) updateHighScore("ultimatettt", 1);
    render();
    if (!game.winner) setTimeout(aiPlay, 260);
    return;
  }

  if (game.turn !== side) return;
  await runTransaction(firebase.db, async (t) => {
    const ref = roomRef(roomCode);
    const snap = await t.get(ref);
    if (!snap.exists()) return;
    const d = snap.data();
    if (d.status !== "playing" || d.turn !== side || d.winner) return;
    const next = tryApplyMove(d, bi, ci, side);
    if (!next) return;
    t.update(ref, {
      localBoards: next.localBoards,
      localWinners: next.localWinners,
      targetBoard: next.targetBoard,
      turn: next.turn,
      winner: next.winner || null,
      status: next.winner ? "finished" : "playing",
    });
  });
}

function stop() {
  if (unsub) unsub();
  unsub = null;
  game = null;
  roomCode = null;
  side = null;
  aiMode = false;
}

export function initUltimateTTT() {
  stop();
  state.currentGame = "ultimatettt";
  setModeUi("menu");
  setText("ultimatetttScore", "ONLINE + AI");
}

document.getElementById("btnCreateUTTT").onclick = createRoom;
document.getElementById("btnJoinUTTT").onclick = joinRoomByCode;
document.getElementById("btnUTTTAI").onclick = startAI;
document.getElementById("utttStartBtn").onclick = startOnlineGame;
document.getElementById("ultimatetttReset").onclick = resetOnlineGame;
document.getElementById("ultimatetttGrid").onclick = onGridClick;

registerGameStop(stop);
