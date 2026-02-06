// Multiplayer Tic-Tac-Toe using Firestore for shared state.
import { registerGameStop, setText, state, firebase } from "../core.js";

const { doc, setDoc, getDoc, updateDoc, onSnapshot, runTransaction } = firebase;

let tttUnsub;
// Firestore room reference helper.
function getTTTRef(code) {
  return doc(firebase.db, "gooner_terminal_rooms", code);
}

// Set the active game flag so keyboard handlers stay consistent.
export function initTTT() {
  state.currentGame = "ttt";
}

// Create a new TTT room with a random 4-digit code.
document.getElementById("btnCreateTTT").onclick = async () => {
  if (!state.myUid) return alert("Offline");
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  await setDoc(getTTTRef(code), {
    board: Array(9).fill(null),
    turn: "X",
    players: { X: state.myUid, O: null },
    names: { X: state.myName, O: "..." },
    status: "lobby",
  });
  joinTTT(code, "X");
};
// Join an existing room as O if the seat is open.
document.getElementById("btnJoinTTT").onclick = async () => {
  const code = document.getElementById("joinTTTCode").value;
  const ref = getTTTRef(code);
  const s = await getDoc(ref);
  if (!s.exists()) return alert("404");
  if (!s.data().players.O) {
    await updateDoc(ref, { ["players.O"]: state.myUid, ["names.O"]: state.myName });
    joinTTT(code, "O");
  }
};

// Subscribe to the room and update UI for lobby or gameplay.
function joinTTT(code, side) {
  document.getElementById("tttMenu").style.display = "none";
  document.getElementById("tttLobby").style.display = "flex";
  setText("tttRoomId", code);
  if (tttUnsub) tttUnsub();
  tttUnsub = onSnapshot(getTTTRef(code), (d) => {
    if (!d.exists()) return;
    const data = d.data();
    if (data.status === "lobby") {
      document.getElementById("tttPList").innerHTML = `<div>X: ${data.names.X}</div><div>O: ${data.names.O}</div>`;
      if (side === "X" && data.players.O) {
        document.getElementById("tttStartBtn").style.display = "block";
        setText("tttWait", "READY");
      } else {
        document.getElementById("tttStartBtn").style.display = "none";
        setText("tttWait", "WAITING...");
      }
    } else {
      document.getElementById("tttLobby").style.display = "none";
      document.getElementById("tttGame").style.display = "block";
      const cells = document.getElementById("tttGrid").children;
      data.board.forEach((v, i) => {
        cells[i].innerText = v || "";
        cells[i].style.color = v === "X" ? "red" : "#fff";
      });
      setText(
        "tttStatus",
        data.status === "finished"
          ? "GAME OVER"
          : data.turn === side
          ? "YOUR TURN"
          : "OPPONENT TURN"
      );
      if (data.status === "finished" && side === "X") {
        document.getElementById("tttReplay").style.display = "block";
        document.getElementById("tttReplay").onclick = async () => {
          await updateDoc(getTTTRef(code), { board: Array(9).fill(null), turn: "X", status: "playing" });
        };
      } else document.getElementById("tttReplay").style.display = "none";
    }
  });
  tttUnsub.side = side;
}

// Start the match once both players are present.
document.getElementById("tttStartBtn").onclick = async () => {
  await updateDoc(getTTTRef(document.getElementById("tttRoomId").innerText), { status: "playing" });
};

// Apply a move transactionally to prevent collisions.
document.getElementById("tttGrid").onclick = async (e) => {
  const i = e.target.dataset.i;
  if (!i) return;
  await runTransaction(firebase.db, async (t) => {
    const r = getTTTRef(document.getElementById("tttRoomId").innerText);
    const s = await t.get(r);
    if (!s.exists()) return;
    const d = s.data();
    if (d.turn !== tttUnsub.side || d.board[i] || d.status !== "playing") return;
    const nb = [...d.board];
    nb[i] = tttUnsub.side;
    let w = null;
    [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ].forEach((k) => {
      if (nb[k[0]] && nb[k[0]] === nb[k[1]] && nb[k[0]] === nb[k[2]]) {
        w = nb[k[0]];
      }
    });
    t.update(r, {
      board: nb,
      turn: tttUnsub.side === "X" ? "O" : "X",
      status: w || !nb.includes(null) ? "finished" : "playing",
    });
  });
};

// Unsubscribe when leaving the game to avoid leaking listeners.
registerGameStop(() => {
  if (tttUnsub) tttUnsub();
  tttUnsub = null;
});
