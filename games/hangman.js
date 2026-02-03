import { registerGameStop, setText, showToast, state, firebase } from "../core.js";

const { doc, setDoc, updateDoc, onSnapshot, runTransaction } = firebase;

let hmRoomCode = null;
let hmRoomUnsub = null;
let hmIsHost = false;
const HM_MAX_PLAYERS = 4;
const HM_MAX_CHAT = 30;
const HM_ROUND_MAX = 5;

function buildScoreMap(players, existing = {}) {
  const scores = { ...existing };
  players.forEach((p) => {
    if (scores[p.uid] === undefined) scores[p.uid] = 0;
  });
  return scores;
}

function getNextGuessIndex(players, currentIndex, pickerIndex) {
  if (!players.length) return 0;
  if (players.length === 1) return pickerIndex;
  let nextIndex = currentIndex;
  for (let i = 0; i < players.length; i++) {
    nextIndex = (nextIndex + 1) % players.length;
    if (nextIndex !== pickerIndex) return nextIndex;
  }
  return pickerIndex;
}

function getHMRef(code) {
  return doc(firebase.db, "gooner_terminal_rooms", "hm_" + code);
}

function sanitizeWord(word) {
  return word.toUpperCase().replace(/[^A-Z ]/g, "").trim();
}

function maskWord(word, guesses) {
  return word
    .split("")
    .map((ch) => {
      if (ch === " ") return " ";
      return guesses.includes(ch) ? ch : "_";
    })
    .join("");
}

export function initHangman() {
  state.currentGame = "hangman";
  document.getElementById("hmMenu").style.display = "flex";
  document.getElementById("hmLobby").style.display = "none";
  document.getElementById("hmGame").style.display = "none";
  document.getElementById("hmGuessInput").value = "";
  document.getElementById("hmLobbyWordInput").value = "";
  document.getElementById("hmLobbyWordInput").type = "password";
  document.getElementById("hmShowWordBtn").innerText = "SHOW WORD";
  document.getElementById("hmGuesses").innerHTML = "";
  document.getElementById("hmChatLog").innerHTML = "";
  document.getElementById("hmSummary").style.display = "none";
  setText("hmStatus", "DECRYPTING...");
  setText("hmTurnName", "...");
  setText("hmPickerName", "...");
  setText("hmRoundInfo", `1 / ${HM_ROUND_MAX}`);
  setText("hmRoundBanner", "ROUND 1");
}

document.getElementById("btnCreateHM").onclick = async () => {
  if (!state.myUid) return alert("Offline");
  const rawWord = document.getElementById("hmWordInput").value;
  const word = sanitizeWord(rawWord);
  if (!word) return showToast("ENTER A WORD", "⚠️");
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const guesses = [];
  const masked = maskWord(word, guesses);
  const chat = [{ name: "SYSTEM", msg: "ROOM CREATED. WAITING FOR PLAYERS.", type: "system", ts: Date.now() }];
  const room = {
    hostUid: state.myUid,
    word,
    masked,
    guesses: [],
    wrong: [],
    remaining: 6,
    status: "lobby",
    turnIndex: 0,
    pickerIndex: 0,
    round: 1,
    roundMax: HM_ROUND_MAX,
    players: [{ uid: state.myUid, name: state.myName }]
  };
  room.chat = chat;
  room.scores = buildScoreMap(room.players);
  await setDoc(getHMRef(code), room);
  joinHM(code, true);
};

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
      chat.push({ name: "SYSTEM", msg: `${state.myName} JOINED THE ROOM.`, type: "system", ts: Date.now() });
      if (chat.length > HM_MAX_CHAT) chat.shift();
      const scores = buildScoreMap(players, data.scores || {});
      t.update(ref, { players, chat, scores });
    }
    joinHM(code, data.hostUid === state.myUid);
  }).catch((e) => alert(e));
};

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

function handleHMUpdate(data) {
  const players = data.players || [];
  const pickerIndex = data.pickerIndex ?? 0;
  const picker = players[pickerIndex];
  if (data.status === "lobby") {
    document.getElementById("hmLobby").style.display = "flex";
    document.getElementById("hmGame").style.display = "none";
    document.getElementById("hmPList").innerHTML = players.map((p) => `<div>${p.name}${p.uid === data.hostUid ? " (HOST)" : ""}</div>`).join("");
    setText("hmRoundInfo", `${data.round || 1} / ${data.roundMax || HM_ROUND_MAX}`);
    setText("hmPickerName", picker ? picker.name : "...");
    const wordInput = document.getElementById("hmLobbyWordInput");
    const showWordBtn = document.getElementById("hmShowWordBtn");
    const isPicker = picker && picker.uid === state.myUid;
    wordInput.disabled = !isPicker;
    showWordBtn.disabled = !isPicker;
    if (!isPicker) {
      wordInput.type = "password";
      showWordBtn.innerText = "SHOW WORD";
    }
    if (picker && picker.uid === state.myUid) {
      document.getElementById("hmStartBtn").style.display = "block";
      setText("hmWait", "PICK WORD & START");
    } else {
      document.getElementById("hmStartBtn").style.display = "none";
      setText("hmWait", "WAITING FOR WORD PICKER...");
    }
    return;
  }
  document.getElementById("hmLobby").style.display = "none";
  document.getElementById("hmGame").style.display = "flex";
  document.getElementById("hmPListLive").innerHTML = players.map((p, idx) => {
    const isTurn = idx === (data.turnIndex ?? 0);
    const isPicker = idx === pickerIndex;
    return `<div>${isTurn ? "▶ " : ""}${p.name}${isPicker ? " (PICKER)" : ""}${p.uid === data.hostUid ? " (HOST)" : ""}</div>`;
  }).join("");
  const currentPlayer = players[data.turnIndex ?? 0];
  setText("hmTurnName", currentPlayer ? currentPlayer.name : "...");
  setText("hmMasked", data.masked.split("").join(" "));
  setText("hmRemaining", data.remaining);
  setText("hmRoundBanner", `ROUND ${data.round || 1}`);
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
  const isPicker = picker && picker.uid === state.myUid;
  if (data.status === "series_done") {
    setText("hmStatus", "SESSION COMPLETE");
  } else if (data.status === "finished") {
    setText("hmStatus", data.remaining === 0 ? "TRACE FAILED" : "ACCESS GRANTED");
  } else {
    setText("hmStatus", isPicker ? "YOU ARE PICKING" : isMyTurn ? "YOUR TURN" : "AWAITING TURN");
  }
  const guessDisabled = !isMyTurn || data.status !== "playing" || isPicker;
  document.getElementById("hmGuessBtn").disabled = guessDisabled;
  document.getElementById("hmGuessInput").disabled = guessDisabled;
  const summary = document.getElementById("hmSummary");
  const summaryList = document.getElementById("hmSummaryList");
  if (data.status === "series_done") {
    const scores = data.scores || {};
    const ranked = [...players].sort((a, b) => (scores[b.uid] || 0) - (scores[a.uid] || 0));
    summaryList.innerHTML = ranked.map((p, idx) => `<div>#${idx + 1} ${p.name} — ${scores[p.uid] || 0}</div>`).join("");
    summary.style.display = "block";
  } else {
    summary.style.display = "none";
  }
  const scoreList = document.getElementById("hmScoreList");
  scoreList.innerHTML = "";
  const scores = data.scores || {};
  players.forEach((p) => {
    const row = document.createElement("div");
    row.className = "hangman-score-item";
    row.innerHTML = `<span>${p.name}</span><span>${scores[p.uid] ?? 0}</span>`;
    scoreList.appendChild(row);
  });
}

document.getElementById("hmStartBtn").onclick = async () => {
  if (!hmRoomCode) return;
  const word = sanitizeWord(document.getElementById("hmLobbyWordInput").value);
  if (!word) return showToast("ENTER A WORD", "⚠️");
  const ref = getHMRef(hmRoomCode);
  await runTransaction(firebase.db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const players = data.players || [];
    const pickerIndex = data.pickerIndex ?? 0;
    const picker = players[pickerIndex];
    if (!picker || picker.uid !== state.myUid) return;
    if (players.length < 2) {
      showToast("NEED 2+ PLAYERS", "⚠️");
      return;
    }
    const masked = maskWord(word, []);
    const chat = [{ name: "SYSTEM", msg: `ROUND ${data.round || 1} STARTED.`, type: "system", ts: Date.now() }];
    const scores = buildScoreMap(players, data.scores || {});
    const firstTurn = getNextGuessIndex(players, pickerIndex, pickerIndex);
    t.update(ref, {
      status: "playing",
      word,
      guesses: [],
      wrong: [],
      remaining: 6,
      masked,
      turnIndex: firstTurn,
      chat,
      scores
    });
  });
};

async function submitGuess() {
  if (!hmRoomCode) return;
  const rawGuess = document.getElementById("hmGuessInput").value;
  const guess = sanitizeWord(rawGuess).slice(0, 1);
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
    const pickerIndex = data.pickerIndex ?? 0;
    const currentPlayer = players[turnIndex];
    const picker = players[pickerIndex];
    if (!currentPlayer || currentPlayer.uid !== state.myUid || (picker && picker.uid === currentPlayer.uid)) {
      showToast("WAIT YOUR TURN", "⏳");
      return;
    }
    const guesses = data.guesses || [];
    const wrong = data.wrong || [];
    if (guesses.includes(guess) || wrong.includes(guess)) return;
    const newGuesses = [...guesses];
    const newWrong = [...wrong];
    let remaining = data.remaining ?? 6;
    const chat = data.chat || [];
    const scores = buildScoreMap(players, data.scores || {});
    if (data.word.includes(guess)) {
      newGuesses.push(guess);
      scores[currentPlayer.uid] = (scores[currentPlayer.uid] || 0) + 1;
      chat.push({ name: currentPlayer.name, msg: `guessed "${guess}"`, type: "good", ts: Date.now() });
    } else {
      newWrong.push(guess);
      remaining = Math.max(0, remaining - 1);
      chat.push({ name: currentPlayer.name, msg: `missed "${guess}"`, type: "bad", ts: Date.now() });
    }
    const masked = maskWord(data.word, newGuesses);
    let status = data.status;
    let round = data.round || 1;
    let pickerIndexNext = pickerIndex;
    let turnIndexNext = turnIndex;
    if (!masked.includes("_")) {
      status = "finished";
      scores[currentPlayer.uid] = (scores[currentPlayer.uid] || 0) + 2;
      chat.push({ name: "SYSTEM", msg: "ACCESS GRANTED.", type: "system", ts: Date.now() });
    }
    if (remaining === 0) {
      status = "finished";
      if (picker) scores[picker.uid] = (scores[picker.uid] || 0) + 2;
      chat.push({ name: "SYSTEM", msg: "TRACE FAILED.", type: "system", ts: Date.now() });
    }
    if (status === "finished") {
      if (round >= (data.roundMax || HM_ROUND_MAX)) {
        status = "series_done";
        chat.push({ name: "SYSTEM", msg: "SESSION COMPLETE. FINAL SCORES LOCKED.", type: "system", ts: Date.now() });
      } else {
        round += 1;
        pickerIndexNext = players.length > 0 ? (pickerIndex + 1) % players.length : pickerIndex;
        turnIndexNext = getNextGuessIndex(players, pickerIndexNext, pickerIndexNext);
        status = "lobby";
        chat.push({ name: "SYSTEM", msg: `ROUND ${round} READY. WORD PICKER SETS NEXT WORD.`, type: "system", ts: Date.now() });
      }
    } else {
      turnIndexNext = getNextGuessIndex(players, turnIndex, pickerIndex);
    }
    if (chat.length > HM_MAX_CHAT) chat.splice(0, chat.length - HM_MAX_CHAT);
    t.update(ref, {
      guesses: newGuesses,
      wrong: newWrong,
      masked,
      remaining,
      status,
      turnIndex: turnIndexNext,
      pickerIndex: pickerIndexNext,
      round,
      chat,
      scores
    });
  });
}

document.getElementById("hmGuessBtn").onclick = submitGuess;
document.getElementById("hmGuessInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitGuess();
});
document.getElementById("hmShowWordBtn").onclick = () => {
  const wordInput = document.getElementById("hmLobbyWordInput");
  const btn = document.getElementById("hmShowWordBtn");
  if (wordInput.disabled) return;
  if (wordInput.type === "password") {
    wordInput.type = "text";
    btn.innerText = "HIDE WORD";
  } else {
    wordInput.type = "password";
    btn.innerText = "SHOW WORD";
  }
};

registerGameStop(() => {
  if (hmRoomUnsub) hmRoomUnsub();
  hmRoomUnsub = null;
  hmRoomCode = null;
  hmIsHost = false;
});
