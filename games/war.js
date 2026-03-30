import {
  beep,
  registerGameStop,
  saveStats,
  setText,
  showGameOver,
  showToast,
  state,
  firebase,
  handleFirebaseError,
} from "../core.js";

const { doc, setDoc, getDoc, updateDoc, onSnapshot, runTransaction } = firebase;

const suits = ["♠", "♥", "♦", "♣"];
const values = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

let warMode = "solo";
let warDeck = [];
let warBet = 0;
let warRoomCode = null;
let warRoomUnsub = null;
let warMySeatIdx = -1;
let warLastPhase = "";

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function rankValue(card) {
  const map = { J: 11, Q: 12, K: 13, A: 14 };
  return map[card.v] || Number(card.v) || 0;
}

function createDeck() {
  const deck = [];
  for (const s of suits) for (const v of values) deck.push({ s, v });
  return deck.sort(() => Math.random() - 0.5);
}

function renderCard(card, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.innerHTML = "";
  if (!card) {
    el.innerHTML = '<div class="bj-card hidden"><div></div></div>';
    return;
  }
  const cardEl = document.createElement("div");
  cardEl.className = "bj-card";
  cardEl.style.color = ["♥", "♦"].includes(card.s) ? "red" : "var(--accent)";
  cardEl.innerHTML = `<div>${card.v}</div><div>${card.s}</div><div>${card.v}</div>`;
  el.appendChild(cardEl);
}

function updateWarBank() {
  setText("warBetVal", warBet);
  const globalBankText = document.getElementById("globalBank")?.textContent?.trim();
  setText("warBank", globalBankText || roundMoney(state.myMoney || 0).toFixed(2));
  saveStats();
}

function resetSoloTable() {
  document.getElementById("warGameBtns").style.display = "flex";
  document.getElementById("warBetBtns").style.visibility = "visible";
  setText("warMessage", "PLACE BET + DRAW");
  setText("warResult", "-");
  renderCard(null, "warEnemyCard");
  renderCard(null, "warMyCard");
}

function startSoloRound() {
  if (warBet <= 0) return beep(200, "sawtooth", 0.2);
  if (state.myMoney < warBet) {
    showToast("Not enough cash.");
    return;
  }

  state.myMoney = roundMoney(Number(state.myMoney || 0) - warBet);
  warDeck = warDeck.length > 10 ? warDeck : createDeck();
  const myCard = warDeck.pop();
  const enemyCard = warDeck.pop();
  renderCard(enemyCard, "warEnemyCard");
  renderCard(myCard, "warMyCard");
  document.getElementById("warBetBtns").style.visibility = "hidden";

  const myRank = rankValue(myCard);
  const enemyRank = rankValue(enemyCard);
  let msg = "";
  if (myRank > enemyRank) {
    state.myMoney = roundMoney(Number(state.myMoney || 0) + warBet * 2);
    msg = `YOU WIN +$${warBet}`;
  } else if (myRank === enemyRank) {
    state.myMoney = roundMoney(Number(state.myMoney || 0) + warBet);
    msg = "TIE - BET RETURNED";
  } else {
    msg = "YOU LOSE";
  }

  setText("warResult", `${myCard.v}${myCard.s} vs ${enemyCard.v}${enemyCard.s}`);
  setText("warMessage", msg);
  updateWarBank();
  if (state.myMoney <= 0) setTimeout(() => showGameOver("war", 0), 1200);
  setTimeout(resetSoloTable, 900);
}

function getWarRef(code) {
  return doc(firebase.db, "gooner_terminal_rooms", "war_" + code);
}

function cleanupWar() {
  if (warRoomUnsub) warRoomUnsub();
  warRoomUnsub = null;
  warRoomCode = null;
  warMySeatIdx = -1;
  warLastPhase = "";
}

function joinWar(code, seatIdx) {
  warRoomCode = code;
  warMySeatIdx = seatIdx;
  document.getElementById("warMenu").style.display = "none";
  document.getElementById("warLobby").style.display = "flex";
  setText("warRoomId", code);
  if (warRoomUnsub) warRoomUnsub();
  warRoomUnsub = onSnapshot(
    getWarRef(code),
    (snapshot) => {
      if (snapshot.exists()) handleWarUpdate(snapshot.data());
    },
    (error) => handleFirebaseError(error, "WAR SYNC", "Live sync paused.")
  );
}

function handleWarUpdate(data) {
  const me = data.seats[warMySeatIdx];
  const oppIdx = warMySeatIdx === 0 ? 1 : 0;
  const opp = data.seats[oppIdx];

  if (data.phase === "lobby") {
    document.getElementById("warLobby").style.display = "flex";
    document.getElementById("warTable").style.display = "none";
    document.getElementById("warPList").innerHTML = data.seats
      .map((seat, index) => (seat ? `<div>${seat.name}${index === 0 ? " (HOST)" : ""}</div>` : ""))
      .join("");
    document.getElementById("warStartBtn").style.display = warMySeatIdx === 0 ? "block" : "none";
    setText("warWait", warMySeatIdx === 0 ? "START WHEN READY" : "WAITING FOR HOST");
    return;
  }

  document.getElementById("warLobby").style.display = "none";
  document.getElementById("warTable").style.display = "flex";
  setText("warOpponentName", opp?.name || "OPPONENT");
  setText("warPot", data.pot || 0);
  setText("warMyScore", me?.score || 0);
  setText("warOppScore", opp?.score || 0);

  renderCard(data.phase === "reveal" ? opp?.card : null, "warEnemyCard");
  renderCard(data.phase === "reveal" ? me?.card : null, "warMyCard");

  if (data.phase === "betting") {
    document.getElementById("warBetBtns").style.visibility = me?.ready ? "hidden" : "visible";
    document.getElementById("warGameBtns").style.display = "flex";
    setText("warMessage", me?.ready ? "WAITING FOR OPPONENT..." : "SET BET + LOCK");
    setText("warResult", "-");
  } else if (data.phase === "reveal") {
    document.getElementById("warBetBtns").style.visibility = "hidden";
    document.getElementById("warGameBtns").style.display = "flex";
    const myRank = me?.card ? rankValue(me.card) : 0;
    const oppRank = opp?.card ? rankValue(opp.card) : 0;
    const outcome = myRank > oppRank ? "YOU WIN" : myRank < oppRank ? "YOU LOSE" : "TIE";
    setText("warMessage", outcome);
    setText("warResult", `${me?.card?.v || "?"}${me?.card?.s || ""} vs ${opp?.card?.v || "?"}${opp?.card?.s || ""}`);

    if (warLastPhase !== "reveal") {
      if (outcome === "YOU WIN") state.myMoney = roundMoney(Number(state.myMoney || 0) + (data.pot || 0));
      if (outcome === "TIE") state.myMoney = roundMoney(Number(state.myMoney || 0) + Number(me?.bet || 0));
      updateWarBank();
    }
  }

  warLastPhase = data.phase;
}

export function initWar() {
  state.currentGame = "war";
  warMode = "solo";
  warBet = 0;
  document.getElementById("warMenu").style.display = "flex";
  document.getElementById("warLobby").style.display = "none";
  document.getElementById("warTable").style.display = "none";
  setText("warMessage", "SELECT MODE");
  updateWarBank();
}

window.warSelect = (mode) => {
  warMode = mode;
  document.getElementById("warMenu").style.display = "none";
  document.getElementById("warTable").style.display = "flex";
  document.getElementById("warGameBtns").style.display = "flex";
  resetSoloTable();
  if (mode === "solo") {
    setText("warOpponentName", "DEALER");
    setText("warMyScore", 0);
    setText("warOppScore", 0);
  }
  beep(400, "square", 0.08);
};

let warHandlersBound = false;

function bindWarHandlers() {
  if (warHandlersBound) return;

  const soloBtn = document.getElementById("btnWarSolo");
  const createBtn = document.getElementById("btnCreateWar");
  const joinBtn = document.getElementById("btnJoinWar");
  const startBtn = document.getElementById("warStartBtn");
  const drawBtn = document.getElementById("warDrawBtn");

  if (!soloBtn || !createBtn || !joinBtn || !startBtn || !drawBtn) {
    console.warn("WAR UI missing required buttons; handlers not bound.");
    return;
  }

  soloBtn.onclick = () => window.warSelect("solo");

  createBtn.onclick = async () => {
    warMode = "multi";
    if (!state.myUid) return showToast("OFFLINE", "⚠️", "Connect to Firebase to play online.");
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const seats = [
      { uid: state.myUid, name: state.myName, bet: 0, ready: false, card: null, score: 0 },
      null,
    ];
    try {
      await setDoc(getWarRef(code), { seats, deck: createDeck(), phase: "lobby", pot: 0, round: 1 });
      joinWar(code, 0);
    } catch (error) {
      if (!handleFirebaseError(error, "WAR CREATE", "Could not create room.")) showToast("FAILED TO CREATE");
    }
  };

  joinBtn.onclick = async () => {
    warMode = "multi";
    if (!state.myUid) return showToast("OFFLINE", "⚠️", "Connect to Firebase to play online.");
    const code = (document.getElementById("joinWarCode")?.value || "").trim();
    await runTransaction(firebase.db, async (tx) => {
      const ref = getWarRef(code);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw "404";
      const data = snap.data();
      if (data.seats[1]) throw "Full";
      const seats = [...data.seats];
      seats[1] = { uid: state.myUid, name: state.myName, bet: 0, ready: false, card: null, score: 0 };
      tx.update(ref, { seats });
      joinWar(code, 1);
    }).catch((error) => {
      if (!handleFirebaseError(error, "WAR JOIN", "Could not join room.")) showToast("FAILED TO JOIN");
    });
  };

  startBtn.onclick = async () => {
    if (!warRoomCode) return;
    const ref = getWarRef(warRoomCode);
    await runTransaction(firebase.db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw "404";
      const data = snap.data();
      if (!data?.seats?.[0] || !data?.seats?.[1]) throw "Need 2 players";
      tx.update(ref, { phase: "betting", pot: 0 });
    }).catch((error) => {
      if (error === "Need 2 players") {
        showToast("Need 2 players to start.");
        return;
      }
      handleFirebaseError(error, "WAR START", "Could not start match.");
    });
  };

  drawBtn.onclick = async () => {
    if (state.currentGame !== "war") return;
    if (warMode === "solo") {
      startSoloRound();
      return;
    }
    if (!warRoomCode) return;
    const ref = getWarRef(warRoomCode);
    const snap = await getDoc(ref);
    const data = snap.data();
    if (!data) return;

    if (data.phase === "betting") {
      if (warBet <= 0) return;
      if (state.myMoney < warBet) return showToast("Not enough cash.");
      const locked = await runTransaction(firebase.db, async (tx) => {
        const freshSnap = await tx.get(ref);
        if (!freshSnap.exists()) throw "404";
        const fresh = freshSnap.data();
        if (fresh.phase !== "betting") throw "Not betting";
        const me = fresh.seats?.[warMySeatIdx];
        if (!me) throw "Seat missing";
        if (me.ready) throw "Already ready";

        const seats = [...fresh.seats];
        seats[warMySeatIdx] = { ...seats[warMySeatIdx], bet: warBet, ready: true };
        const nextPot = Number(fresh.pot || 0) + warBet;
        const updates = { seats, pot: nextPot };

        const everyoneReady = seats.every((seat) => seat && seat.ready);
        if (everyoneReady) {
          const deck = fresh.deck && fresh.deck.length >= 2 ? [...fresh.deck] : createDeck();
          const nextSeats = seats.map((seat) => ({ ...seat, card: deck.pop() }));
          const myRank = rankValue(nextSeats[0].card);
          const oppRank = rankValue(nextSeats[1].card);
          if (myRank > oppRank) nextSeats[0].score = Number(nextSeats[0].score || 0) + 1;
          else if (oppRank > myRank) nextSeats[1].score = Number(nextSeats[1].score || 0) + 1;
          updates.seats = nextSeats;
          updates.deck = deck;
          updates.phase = "reveal";
        }

        tx.update(ref, updates);
        return true;
      }).catch((error) => {
        if (error === "Already ready") return false;
        if (!handleFirebaseError(error, "WAR BET", "Could not lock bet.")) showToast("BET FAILED");
        return false;
      });

      if (!locked) return;
      state.myMoney = roundMoney(Number(state.myMoney || 0) - warBet);
      updateWarBank();
    } else if (data.phase === "reveal" && warMySeatIdx === 0) {
      const seats = data.seats.map((seat) => ({ ...seat, bet: 0, ready: false, card: null }));
      await updateDoc(ref, { seats, phase: "betting", pot: 0, round: Number(data.round || 1) + 1 });
    }
  };

  document.querySelectorAll(".war-chip").forEach((chip) => {
    chip.onclick = () => {
      if (state.currentGame !== "war") return;
      const value = parseInt(chip.dataset.v) || 0;
      if (chip.id === "warClear") warBet = 0;
      else if (chip.id === "warAllIn") warBet = Math.max(0, Math.floor(Number(state.myMoney || 0)));
      else if (Number(state.myMoney || 0) >= warBet + value) warBet += value;
      updateWarBank();
    };
  });

  warHandlersBound = true;
}

bindWarHandlers();

registerGameStop(() => {
  cleanupWar();
});
