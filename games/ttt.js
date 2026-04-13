// Multiplayer Tic-Tac-Toe using Firestore for shared state + local AI mode.
import { registerGameStop, setText, state, firebase, showToast, escapeHtml } from "../core.js";

const { doc, setDoc, getDoc, updateDoc, onSnapshot, runTransaction } = firebase;

let tttUnsub;
let aiMode = null;

function getTTTRef(code) {
  return doc(firebase.db, "gooner_terminal_rooms", code);
}

const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function winner(board){for(const [a,b,c] of WIN_LINES){if(board[a]&&board[a]===board[b]&&board[a]===board[c]) return board[a];}return null;}

export function initTTT() {
  state.currentGame = "ttt";
  document.getElementById("tttMenu").style.display = "flex";
  document.getElementById("tttLobby").style.display = "none";
  document.getElementById("tttGame").style.display = "none";
}

function renderAi(){
  const cells=document.getElementById("tttGrid").children;
  aiMode.board.forEach((v,i)=>{cells[i].innerText=v||""; cells[i].style.color=v==="X"?"red":"#fff";});
  if (aiMode.win) setText("tttStatus", aiMode.win==="draw"?"DRAW":"GAME OVER");
  else setText("tttStatus", aiMode.turn==="X"?"YOUR TURN":"AI TURN");
  document.getElementById("tttReplay").style.display = "block";
  document.getElementById("tttReplay").onclick = startTTTAI;
}

function aiMove(){
  if(!aiMode||aiMode.turn!=="O"||aiMode.win) return;
  const open=[]; aiMode.board.forEach((v,i)=>{if(!v) open.push(i);});
  const pick=open[Math.floor(Math.random()*open.length)];
  aiMode.board[pick]="O";
  const w=winner(aiMode.board);
  if (w) aiMode.win=w; else if(!aiMode.board.includes(null)) aiMode.win="draw"; else aiMode.turn="X";
  renderAi();
}

function startTTTAI(){
  if (tttUnsub) tttUnsub(); tttUnsub=null;
  aiMode={board:Array(9).fill(null),turn:"X",win:null};
  document.getElementById("tttMenu").style.display="none";
  document.getElementById("tttLobby").style.display="none";
  document.getElementById("tttGame").style.display="block";
  renderAi();
}

document.getElementById("btnTTTAI").onclick = startTTTAI;

document.getElementById("btnCreateTTT").onclick = async () => {
  aiMode = null;
  if (!state.myUid) return showToast("OFFLINE", "📡", "Connect before creating a room.");
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  await setDoc(getTTTRef(code), { board: Array(9).fill(null), turn: "X", players: { X: state.myUid, O: null }, names: { X: state.myName, O: "..." }, status: "lobby" });
  joinTTT(code, "X");
};

document.getElementById("btnJoinTTT").onclick = async () => {
  aiMode = null;
  const code = document.getElementById("joinTTTCode").value;
  const ref = getTTTRef(code);
  try {
    const seat = await runTransaction(firebase.db, async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error("ROOM_404");
      const data = snap.data();
      if (!data.players.X) { transaction.update(ref, { ["players.X"]: state.myUid, ["names.X"]: state.myName }); return "X"; }
      if (!data.players.O) { transaction.update(ref, { ["players.O"]: state.myUid, ["names.O"]: state.myName }); return "O"; }
      throw new Error("ROOM_FULL");
    });
    joinTTT(code, seat);
  } catch (error) {
    const reason = String(error?.message || "");
    if (reason === "ROOM_404") showToast("ROOM NOT FOUND", "⚠️");
    else if (reason === "ROOM_FULL") showToast("ROOM FULL", "⚠️");
    else showToast("JOIN FAILED", "⚠️", "Retry in a moment.");
  }
};

function joinTTT(code, side) {
  document.getElementById("tttMenu").style.display = "none";
  document.getElementById("tttLobby").style.display = "flex";
  document.getElementById("tttGame").style.display = "none";
  setText("tttRoomId", code);
  if (tttUnsub) tttUnsub();
  tttUnsub = onSnapshot(getTTTRef(code), (d) => {
    if (!d.exists()) return;
    const data = d.data();
    if (data.status === "lobby") {
      document.getElementById("tttPList").innerHTML = `<div>X: ${escapeHtml(data.names.X)}</div><div>O: ${escapeHtml(data.names.O)}</div>`;
      if (side === "X" && data.players.O) { document.getElementById("tttStartBtn").style.display = "block"; setText("tttWait", "READY"); }
      else { document.getElementById("tttStartBtn").style.display = "none"; setText("tttWait", "WAITING..."); }
    } else {
      document.getElementById("tttLobby").style.display = "none";
      document.getElementById("tttGame").style.display = "block";
      const cells = document.getElementById("tttGrid").children;
      data.board.forEach((v, i) => { cells[i].innerText = v || ""; cells[i].style.color = v === "X" ? "red" : "#fff"; });
      setText("tttStatus", data.status === "finished" ? "GAME OVER" : data.turn === side ? "YOUR TURN" : "OPPONENT TURN");
      if (data.status === "finished" && side === "X") {
        document.getElementById("tttReplay").style.display = "block";
        document.getElementById("tttReplay").onclick = async () => { await updateDoc(getTTTRef(code), { board: Array(9).fill(null), turn: "X", status: "playing" }); };
      } else document.getElementById("tttReplay").style.display = "none";
    }
  });
  tttUnsub.side = side;
}

document.getElementById("tttStartBtn").onclick = async () => {
  await updateDoc(getTTTRef(document.getElementById("tttRoomId").innerText), { status: "playing" });
};

document.getElementById("tttGrid").onclick = async (e) => {
  const i = e.target.dataset.i;
  if (i === undefined) return;

  if (aiMode) {
    if (aiMode.turn !== "X" || aiMode.win || aiMode.board[i]) return;
    aiMode.board[i] = "X";
    const w = winner(aiMode.board);
    if (w) aiMode.win = w;
    else if (!aiMode.board.includes(null)) aiMode.win = "draw";
    else aiMode.turn = "O";
    renderAi();
    if (!aiMode.win) setTimeout(aiMove, 260);
    return;
  }

  await runTransaction(firebase.db, async (t) => {
    const r = getTTTRef(document.getElementById("tttRoomId").innerText);
    const s = await t.get(r);
    if (!s.exists()) return;
    const d = s.data();
    if (d.turn !== tttUnsub.side || d.board[i] || d.status !== "playing") return;
    const nb = [...d.board];
    nb[i] = tttUnsub.side;
    let w = null;
    WIN_LINES.forEach((k) => { if (nb[k[0]] && nb[k[0]] === nb[k[1]] && nb[k[0]] === nb[k[2]]) w = nb[k[0]]; });
    t.update(r, { board: nb, turn: tttUnsub.side === "X" ? "O" : "X", status: w || !nb.includes(null) ? "finished" : "playing" });
  });
};

registerGameStop(() => {
  if (tttUnsub) tttUnsub();
  tttUnsub = null;
  aiMode = null;
});
