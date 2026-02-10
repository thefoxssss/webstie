// Multiplayer hangman mode with lobby, turn order, and chat.
import { registerGameStop, setText, showToast, state, firebase } from "../core.js";

const { doc, setDoc, updateDoc, onSnapshot, runTransaction } = firebase;

let hmRoomCode = null;
let hmRoomUnsub = null;
let hmIsHost = false;
const HM_MAX_PLAYERS = 4;
const HM_MAX_CHAT = 30;

// Firestore room reference helper.
function getHMRef(code) {
  return doc(firebase.db, "gooner_terminal_rooms", "hm_" + code);
}

// Normalize a guess/word into uppercase A-Z plus spaces.
function sanitizeWord(word) {
  return word.toUpperCase().replace(/[^A-Z ]/g, "").trim();
}

// Normalize spaces so full-word guesses match consistently.
function normalizePhrase(word) {
  return sanitizeWord(word).replace(/\s+/g, " ");
}

// Render a masked word based on the guesses so far.
function maskWord(word, guesses) {
  return word
    .split("")
    .map((ch) => {
      if (ch === " ") return " ";
      return guesses.includes(ch) ? ch : "_";
    })
    .join("");
}

// Reset the hangman UI to the main menu state.
export function initHangman() {
  state.currentGame = "hangman";
  document.getElementById("hmMenu").style.display = "flex";
  document.getElementById("hmLobby").style.display = "none";
  document.getElementById("hmGame").style.display = "none";
  document.getElementById("hmGuessInput").value = "";
  document.getElementById("hmGuesses").innerHTML = "";
  document.getElementById("hmChatLog").innerHTML = "";
  setText("hmStatus", "DECRYPTING...");
  setText("hmTurnName", "...");
}

// Create a new hangman room and become the host.
document.getElementById("btnCreateHM").onclick = async () => {
  if (!state.myUid) return alert("Offline");
  const rawWord = document.getElementById("hmWordInput").value;
  const word = sanitizeWord(rawWord);
  if (!word) return showToast("ENTER A WORD", "⚠️");
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const guesses = [];
  const masked = maskWord(word, guesses);
  const chat = [
    {
      name: "SYSTEM",
      msg: "ROOM CREATED. WAITING FOR PLAYERS.",
      type: "system",
      ts: Date.now(),
    },
  ];
  const room = {
    hostUid: state.myUid,
    word,
    masked,
    guesses: [],
    wrong: [],
    wrongWords: [],
    remaining: 6,
    status: "lobby",
    turnIndex: 0,
    players: [{ uid: state.myUid, name: state.myName }],
  };
  room.chat = chat;
  await setDoc(getHMRef(code), room);
  joinHM(code, true);
};

// Join a room if there is space available.
document.getElementById("btnJoinHM").onclick = async () => {
  const code = document.getElementById("joinHMCode").value;
  if (!code) return;
  const ref = getHMRef(code);
  await runTransaction(firebase.db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) throw "404";
    const data = snap.data();
    const players = data.players || [];
    if (players.length >= HM_MAX_PLAYERS) throw "ROOM FULL";
    if (!players.find((p) => p.uid === state.myUid)) {
      players.push({ uid: state.myUid, name: state.myName });
      const chat = data.chat || [];
      chat.push({
        name: "SYSTEM",
        msg: `${state.myName} JOINED THE ROOM.`,
        type: "system",
        ts: Date.now(),
      });
      if (chat.length > HM_MAX_CHAT) chat.shift();
      t.update(ref, { players, chat });
    }
    joinHM(code, data.hostUid === state.myUid);
  }).catch((e) => alert(e));
};

// Subscribe to room updates and toggle lobby/game UI.
function joinHM(code, isHost) {
  hmRoomCode = code;
  hmIsHost = isHost;
  document.getElementById("hmMenu").style.display = "none";
  document.getElementById("hmLobby").style.display = "flex";
  setText("hmRoomId", code);
  if (hmRoomUnsub) hmRoomUnsub();
  hmRoomUnsub = onSnapshot(getHMRef(code), (snap) => {
    if (snap.exists()) handleHMUpdate(snap.data());
  });
}

// Handle UI updates for lobby state, turn display, and chat.
function handleHMUpdate(data) {
  const players = data.players || [];
  if (data.status === "lobby") {
    document.getElementById("hmLobby").style.display = "flex";
    document.getElementById("hmGame").style.display = "none";
    document.getElementById("hmPList").innerHTML = players
      .map((p) => `<div>${p.name}${p.uid === data.hostUid ? " (HOST)" : ""}</div>`)
      .join("");
    if (hmIsHost) {
      document.getElementById("hmStartBtn").style.display = "block";
      setText("hmWait", "SET WORD & START");
    } else {
      document.getElementById("hmStartBtn").style.display = "none";
      setText("hmWait", "WAITING FOR HOST...");
    }
    return;
  }
  document.getElementById("hmLobby").style.display = "none";
  document.getElementById("hmGame").style.display = "flex";
  document.getElementById("hmPListLive").innerHTML = players
    .map((p, idx) => {
      const isTurn = idx === (data.turnIndex ?? 0);
      return `<div>${isTurn ? "▶ " : ""}${p.name}${p.uid === data.hostUid ? " (HOST)" : ""}</div>`;
    })
    .join("");
  const currentPlayer = players[data.turnIndex ?? 0];
  setText("hmTurnName", currentPlayer ? currentPlayer.name : "...");
  setText("hmMasked", data.masked.split("").join(" "));
  setText("hmRemaining", data.remaining);
  const wrongCount = Math.min(6, Math.max(0, 6 - data.remaining));
  document.getElementById("hmFigure").dataset.stage = String(wrongCount);
  const guessContainer = document.getElementById("hmGuesses");
  guessContainer.innerHTML = "";
  const allGuesses = [...(data.guesses || []), ...(data.wrong || [])];
  allGuesses.forEach((g) => {
    const span = document.createElement("span");
    span.innerText = g;
    span.style.borderColor = data.wrong.includes(g) ? "#f00" : "var(--accent)";
    guessContainer.appendChild(span);
  });
  const chatLog = document.getElementById("hmChatLog");
  chatLog.innerHTML = "";
  (data.chat || []).forEach((entry) => {
    const line = document.createElement("div");
    line.className = "hangman-chat-line";
    line.innerHTML = `<div class="hangman-chat-name">${entry.name}</div><div class="hangman-chat-text ${entry.type || ""}">${entry.msg}</div>`;
    chatLog.appendChild(line);
  });
  chatLog.scrollTop = chatLog.scrollHeight;
  const isMyTurn = currentPlayer && currentPlayer.uid === state.myUid;
  if (data.status === "finished") {
    setText("hmStatus", data.remaining === 0 ? `TRACE FAILED — WORD: ${data.word}` : "ACCESS GRANTED");
  } else {
    setText("hmStatus", isMyTurn ? "YOUR TURN" : "AWAITING TURN");
  }
  document.getElementById("hmGuessBtn").disabled = !isMyTurn || data.status === "finished";
  document.getElementById("hmGuessInput").disabled = !isMyTurn || data.status === "finished";
}

// Start the game from the lobby (host only).
document.getElementById("hmStartBtn").onclick = async () => {
  if (!hmIsHost || !hmRoomCode) return;
  const ref = getHMRef(hmRoomCode);
  await runTransaction(firebase.db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const masked = maskWord(data.word || "", []);
    const chat = [
      {
        name: "SYSTEM",
        msg: "GAME STARTED. FIRST TURN ACTIVE.",
        type: "system",
        ts: Date.now(),
      },
    ];
    t.update(ref, {
      status: "playing",
      guesses: [],
      wrong: [],
      wrongWords: [],
      remaining: 6,
      masked,
      turnIndex: 0,
      chat,
    });
  });
};

// Submit a guess for the current player's turn.
async function submitGuess() {
  if (!hmRoomCode) return;
  const rawGuess = document.getElementById("hmGuessInput").value;
  const guess = normalizePhrase(rawGuess);
  document.getElementById("hmGuessInput").value = "";
  if (!guess) return;
  const ref = getHMRef(hmRoomCode);
  await runTransaction(firebase.db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status !== "playing") return;
    const players = data.players || [];
    const turnIndex = data.turnIndex ?? 0;
    const currentPlayer = players[turnIndex];
    if (!currentPlayer || currentPlayer.uid !== state.myUid) {
      showToast("WAIT YOUR TURN", "⏳");
      return;
    }
    const guesses = data.guesses || [];
    const wrong = data.wrong || [];
    const wrongWords = data.wrongWords || [];
    const newGuesses = [...guesses];
    const newWrong = [...wrong];
    const newWrongWords = [...wrongWords];
    let remaining = data.remaining ?? 6;
    const chat = data.chat || [];
    const targetWord = normalizePhrase(data.word || "");
    const isWordAttempt = guess.length > 1;

    if (isWordAttempt) {
      if (newWrongWords.includes(guess)) {
        showToast("WORD ALREADY TRIED", "⚠️");
        return;
      }
      if (guess === targetWord) {
        newGuesses.splice(0, newGuesses.length, ...Array.from(new Set(targetWord.replace(/ /g, "").split(""))));
        chat.push({
          name: currentPlayer.name,
          msg: `cracked the word "${targetWord}"`,
          type: "good",
          ts: Date.now(),
        });
      } else {
        newWrongWords.push(guess);
        remaining = Math.max(0, remaining - 1);
        chat.push({
          name: currentPlayer.name,
          msg: `wrong word "${guess}"`,
          type: "bad",
          ts: Date.now(),
        });
      }
    } else {
      if (guesses.includes(guess) || wrong.includes(guess)) {
        showToast("LETTER ALREADY USED", "⚠️");
        return;
      }
      if (targetWord.includes(guess)) {
        newGuesses.push(guess);
        chat.push({
          name: currentPlayer.name,
          msg: `guessed "${guess}"`,
          type: "good",
          ts: Date.now(),
        });
      } else {
        newWrong.push(guess);
        remaining = Math.max(0, remaining - 1);
        chat.push({
          name: currentPlayer.name,
          msg: `missed "${guess}"`,
          type: "bad",
          ts: Date.now(),
        });
      }
    }
    const masked = maskWord(targetWord, newGuesses);
    let status = data.status;
    if (!masked.includes("_")) {
      status = "finished";
      chat.push({ name: "SYSTEM", msg: "ACCESS GRANTED.", type: "system", ts: Date.now() });
    }
    if (remaining === 0) {
      status = "finished";
      chat.push({ name: "SYSTEM", msg: "TRACE FAILED.", type: "system", ts: Date.now() });
    }
    const nextTurn = players.length > 0 ? (turnIndex + 1) % players.length : 0;
    if (chat.length > HM_MAX_CHAT) chat.splice(0, chat.length - HM_MAX_CHAT);
    t.update(ref, {
      guesses: newGuesses,
      wrong: newWrong,
      wrongWords: newWrongWords,
      masked,
      remaining,
      status,
      turnIndex: status === "finished" ? turnIndex : nextTurn,
      chat,
    });
  });
}

// Guess input handlers (button click + Enter).
document.getElementById("hmGuessBtn").onclick = submitGuess;
document.getElementById("hmGuessInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitGuess();
});

// Cleanup listener when leaving the game.
registerGameStop(() => {
  if (hmRoomUnsub) hmRoomUnsub();
  hmRoomUnsub = null;
  hmRoomCode = null;
  hmIsHost = false;
});
