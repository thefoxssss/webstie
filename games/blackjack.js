// Blackjack game with solo and multiplayer modes (Firestore-backed lobby).
import {
  beep,
  registerGameStop,
  saveStats,
  setText,
  showGameOver,
  showToast,
  unlockAchievement,
  state,
  hasActiveItem,
  firebase,
  handleFirebaseError,
} from "../core.js";

const { doc, setDoc, getDoc, updateDoc, onSnapshot, runTransaction } = firebase;

let bjMode = "solo";
let bjDeck = [];
let bjPlayerHand = [];
let bjDealerHand = [];
let bjCurrentBet = 0;
let bjRoomCode = null;
let bjRoomUnsub = null;
let bjMySeatIdx = -1;
let bjLastPhase = "";
let soloRounds = 0;
const suits = ["♠", "♥", "♦", "♣"];
const values = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

// Initialize Blackjack overlay into mode select.
export function initBJ() {
  state.currentGame = "blackjack";
  bjCurrentBet = 0;
  document.getElementById("bjMode").style.display = "flex";
  document.getElementById("bjNetMenu").style.display = "none";
  document.getElementById("bjLobby").style.display = "none";
  document.getElementById("bjTable").style.display = "none";
  updBJ();
}

// Reset local multiplayer state and unsubscribe from Firestore.
function cleanupBJ() {
  if (bjRoomUnsub) bjRoomUnsub();
  bjRoomUnsub = null;
  bjRoomCode = null;
  bjMySeatIdx = -1;
  bjLastPhase = "";
}

// Select solo or multiplayer mode from the UI.
window.bjSelect = (mode) => {
  bjMode = mode;
  document.getElementById("bjMode").style.display = "none";
  if (mode === "solo") {
    document.getElementById("bjTable").style.display = "flex";
    setText("bjHostLabel", "DEALER");
    document.querySelector(".bj-pot-display").style.display = "none";
    document.getElementById("bjSide").innerHTML = "";
    startSoloBetting();
  } else {
    document.querySelector(".bj-pot-display").style.display = "block";
    document.getElementById("bjNetMenu").style.display = "flex";
  }
  beep(400, "square", 0.1);
};

// Update bank display and persist stats.
function updBJ() {
  setText("bjBetVal", bjCurrentBet);
  setText("globalBank", state.myMoney);
  saveStats();
  if (state.myMoney >= 5000) unlockAchievement("diamond_hands");
  if (state.myMoney === 0) unlockAchievement("rug_pulled");
}

// Reset solo table and prompt for a new bet.
function startSoloBetting() {
  bjPlayerHand = [];
  bjDealerHand = [];
  bjCurrentBet = 0;
  document.getElementById("bjPlayerHand").innerHTML = "";
  document.getElementById("bjDealerHand").innerHTML = "";
  setText("bjPlayerScore", "");
  setText("bjDealerScore", "");
  setText("bjMessage", "PLACE BET & CLICK DECK");
  document.getElementById("bjGameBtns").style.display = "none";
  document.getElementById("bjBetBtns").style.visibility = "visible";
  document.querySelector("#bjDeck div:last-child").innerText = "DEAL";
  updBJ();
}

// Start a solo round: deal cards, hide dealer, and show action buttons.
async function startSoloRound() {
  if (bjCurrentBet <= 0) return beep(200, "sawtooth", 0.5);
  if (state.myMoney < bjCurrentBet) {
    showToast("Not enough cash for that bet.");
    return;
  }
  state.myMoney -= bjCurrentBet;
  updBJ();
  document.getElementById("bjBetBtns").style.visibility = "hidden";
  bjDeck = createDeck();
  bjPlayerHand = [bjDeck.pop(), bjDeck.pop()];
  bjDealerHand = [bjDeck.pop(), bjDeck.pop()];
  renderHand(bjPlayerHand, "bjPlayerHand");
  renderScore("bjPlayerScore", bjPlayerHand);
  const dDiv = document.getElementById("bjDealerHand");
  dDiv.innerHTML = "";
  renderNewCard(bjDealerHand[0], "bjDealerHand");
  const hideDealer = !hasActiveItem("item_xray");
  renderNewCard(bjDealerHand[1], "bjDealerHand", hideDealer);
  setText("bjDealerScore", hideDealer ? "" : calcHand(bjDealerHand));
  document.getElementById("bjGameBtns").style.display = "flex";
  setText("bjMessage", "YOUR TURN");
  if (calcHand(bjPlayerHand) === 21) endSolo();
}

// Hit action for solo mode.
function soloHit() {
  const c = bjDeck.pop();
  bjPlayerHand.push(c);
  renderNewCard(c, "bjPlayerHand");
  renderScore("bjPlayerScore", bjPlayerHand);
  if (calcHand(bjPlayerHand) > 21) endSolo();
}

// Stand action for solo mode (dealer plays out hand).
async function soloStand() {
  document.getElementById("bjGameBtns").style.display = "none";
  const dDiv = document.getElementById("bjDealerHand");
  dDiv.innerHTML = "";
  renderNewCard(bjDealerHand[0], "bjDealerHand");
  renderNewCard(bjDealerHand[1], "bjDealerHand");
  renderScore("bjDealerScore", bjDealerHand);
  while (calcHand(bjDealerHand) < 17) {
    await new Promise((r) => setTimeout(r, 600));
    const c = bjDeck.pop();
    bjDealerHand.push(c);
    renderNewCard(c, "bjDealerHand");
    renderScore("bjDealerScore", bjDealerHand);
  }
  endSolo();
}

// Resolve a solo round and payout winnings.
async function endSolo() {
  document.getElementById("bjGameBtns").style.display = "none";
  const dDiv = document.getElementById("bjDealerHand");
  if (dDiv.querySelector(".hidden")) {
    dDiv.innerHTML = "";
    bjDealerHand.forEach((c) => renderNewCard(c, "bjDealerHand"));
    renderScore("bjDealerScore", bjDealerHand);
  }
  const ps = calcHand(bjPlayerHand);
  const ds = calcHand(bjDealerHand);
  let msg = "";
  let win = 0;
  if (ps > 21) {
    msg = "YOU BUST!";
    win = 0;
  } else if (ds > 21) {
    msg = "DEALER BUST! YOU WIN";
    win = bjCurrentBet * 2;
  } else if (ps > ds) {
    msg = "YOU WIN!";
    win = bjCurrentBet * 2;
  } else if (ps < ds) {
    msg = "YOU LOSE";
    win = 0;
  } else {
    msg = "PUSH";
    win = bjCurrentBet;
  }
  if (msg.includes("WIN") && bjCurrentBet >= 500) unlockAchievement("high_roller");
  soloRounds++;
  if (soloRounds === 10) unlockAchievement("lonely");
  setText("bjMessage", msg);
  state.myMoney += win;
  updBJ();
  bjCurrentBet = 0;
  document.querySelector("#bjDeck div:last-child").innerText = "AGAIN";
  if (win === 0 && state.myMoney <= 0) {
    setTimeout(() => showGameOver("blackjack", 0), 1500);
  }
  else
    setTimeout(
      () =>
        document.getElementById("bjDeck").addEventListener(
          "click",
          () => {
            if (state.currentGame === "blackjack" && bjMode === "solo") startSoloBetting();
          },
          { once: true }
        ),
      500
    );
}

// Firestore room reference helper for Blackjack rooms.
function getBJRef(code) {
  return doc(firebase.db, "gooner_terminal_rooms", "bj_" + code);
}

// Create a new multiplayer Blackjack room as seat 0.
document.getElementById("btnCreateBJ").onclick = async () => {
  if (!state.myUid) return showToast("OFFLINE", "⚠️", "Connect to Firebase to play online.");
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const seats = [
    { uid: state.myUid, name: state.myName, hand: [], status: "waiting", bet: 0, ready: false },
    null,
    null,
    null,
  ];
  await setDoc(getBJRef(code), { seats: seats, deck: [], phase: "lobby", activeSeat: 0, pot: 0 });
  joinBJ(code, 0);
};

// Join an existing Blackjack room if a seat is open.
document.getElementById("btnJoinBJ").onclick = async () => {
  const code = document.getElementById("joinBJCode").value;
  const ref = getBJRef(code);
  await runTransaction(firebase.db, async (t) => {
    const s = await t.get(ref);
    if (!s.exists()) throw "404";
    const d = s.data();
    let idx = -1;
    for (let i = 1; i < 4; i++) if (d.seats[i] === null) {
      idx = i;
      break;
    }
    if (idx === -1) throw "Full";
    const ns = [...d.seats];
    ns[idx] = {
      uid: state.myUid,
      name: state.myName,
      hand: [],
      status: "waiting",
      bet: 0,
      ready: false,
    };
    t.update(ref, { seats: ns });
    joinBJ(code, idx);
  }).catch((e) => {
    if (!handleFirebaseError(e, "BLACKJACK JOIN", "Could not join room.")) alert("FAILED TO JOIN ROOM");
  });
};

// Join a room and subscribe to live updates.
function joinBJ(code, idx) {
  bjRoomCode = code;
  bjMySeatIdx = idx;
  document.getElementById("bjNetMenu").style.display = "none";
  document.getElementById("bjLobby").style.display = "flex";
  setText("bjRoomId", code);
  if (bjRoomUnsub) bjRoomUnsub();
  bjRoomUnsub = onSnapshot(
    getBJRef(code),
    (s) => {
      if (s.exists()) handleBJUpdate(s.data());
    },
    (e) => handleFirebaseError(e, "BLACKJACK SYNC", "Live sync paused.")
  );
}

// Render lobby/table state based on current phase.
function handleBJUpdate(d) {
  const deckLabel = document.querySelector("#bjDeck div:last-child");
  if (d.phase === "lobby") {
    document.getElementById("bjLobby").style.display = "flex";
    document.getElementById("bjTable").style.display = "none";
    document.getElementById("bjPList").innerHTML = d.seats
      .map((s, i) => (s ? `<div>${s.name} ${i === 0 ? "(HOST)" : ""}</div>` : ""))
      .join("");
    if (bjMySeatIdx === 0) {
      document.getElementById("bjStartBtn").style.display = "block";
      setText("bjWait", "CLICK START");
    } else {
      document.getElementById("bjStartBtn").style.display = "none";
      setText("bjWait", "WAITING FOR HOST...");
    }
    return;
  }
  document.getElementById("bjLobby").style.display = "none";
  document.getElementById("bjTable").style.display = "flex";
  setText("bjPot", d.pot || 0);
  let opponentIdx = -1;
  if (bjMySeatIdx === 0) {
    if (d.seats[1]) opponentIdx = 1;
    else if (d.seats[2]) opponentIdx = 2;
    else if (d.seats[3]) opponentIdx = 3;
  } else {
    opponentIdx = 0;
  }
  const topSeat = opponentIdx !== -1 ? d.seats[opponentIdx] : null;
  setText("bjHostLabel", topSeat ? topSeat.name : "WAITING...");
  const sideDiv = document.getElementById("bjSide");
  sideDiv.innerHTML = "";
  d.seats.forEach((s, i) => {
    if (i === bjMySeatIdx || i === opponentIdx || !s) return;
    const div = document.createElement("div");
    div.className = "bj-small-seat";
    if (d.activeSeat === i && d.phase === "playing") div.classList.add("active-seat");
    div.innerHTML = `<div style="font-size:8px">${s.name}</div><div class="bj-small-hand"></div>`;
    const hd = div.querySelector(".bj-small-hand");
    s.hand.forEach((c, cIdx) => {
      const cd = document.createElement("div");
      const isHidden = d.phase === "playing" && cIdx >= 2;
      if (isHidden) {
        cd.className = "bj-card mini hidden";
        cd.innerHTML = "<div></div><div></div>";
      } else {
        cd.className = "bj-card mini";
        cd.innerHTML = `<div>${c.v}</div><div>${c.s}</div>`;
        cd.style.color = ["♥", "♦"].includes(c.s) ? "red" : "inherit";
      }
      hd.appendChild(cd);
    });
    sideDiv.appendChild(div);
  });
  const dDiv = document.getElementById("bjDealerHand");
  if (topSeat) {
    dDiv.innerHTML = "";
    topSeat.hand.forEach((c, cIdx) => {
      let isHidden = false;
      if (d.phase === "playing" && cIdx >= 2) isHidden = true;
      if (d.phase === "resolution") isHidden = false;
      renderNewCard(c, "bjDealerHand", isHidden);
    });
    setText("bjDealerScore", d.phase === "resolution" ? calcHand(topSeat.hand) : "");
  } else {
    dDiv.innerHTML = "";
    setText("bjDealerScore", "");
  }
  const me = d.seats[bjMySeatIdx];
  if (me) {
    const pDiv = document.getElementById("bjPlayerHand");
    if (pDiv.childElementCount !== me.hand.length) {
      pDiv.innerHTML = "";
      me.hand.forEach((c) => renderNewCard(c, "bjPlayerHand"));
      renderScore("bjPlayerScore", me.hand);
    }
  }
  if (d.phase === "betting") {
    if (!me.ready) {
      document.getElementById("bjBetBtns").style.visibility = "visible";
      setText("bjMessage", "BET & LOCK IN");
      deckLabel.innerText = "LOCK";
    } else {
      document.getElementById("bjBetBtns").style.visibility = "hidden";
      setText("bjMessage", "WAITING...");
      deckLabel.innerText = "WAIT";
      if (bjMySeatIdx === 0 && d.seats.every((s, i) => i === 0 || !s || s.ready)) {
        setText("bjMessage", "ALL READY");
        deckLabel.innerText = "DEAL";
      }
    }
  } else if (d.phase === "playing") {
    document.getElementById("bjBetBtns").style.visibility = "hidden";
    deckLabel.innerText = "PLAY";
    if (d.activeSeat === bjMySeatIdx) {
      document.getElementById("bjGameBtns").style.display = "flex";
      setText("bjMessage", "YOUR TURN");
    } else {
      document.getElementById("bjGameBtns").style.display = "none";
      setText("bjMessage", "OPPONENT TURN");
    }
  } else if (d.phase === "resolution") {
    document.getElementById("bjGameBtns").style.display = "none";
    document.getElementById("bjBetBtns").style.visibility = "hidden";
    if (bjLastPhase !== "resolution") {
      if (me.status === "win") {
        state.myMoney += d.pot;
        updBJ();
      } else if (me.status === "push") {
        state.myMoney += me.bet;
        updBJ();
      }
      bjCurrentBet = 0;
      if (state.myMoney <= 0) setTimeout(() => showGameOver("blackjack", 0), 2000);
    }
    let msg = "ROUND OVER";
    if (me.status === "win") msg = `WON $${d.pot}!`;
    else if (me.status === "push") msg = "PUSH";
    else msg = "LOST";
    setText("bjMessage", msg);
    deckLabel.innerText = bjMySeatIdx === 0 ? "NEXT" : "WAIT";
  }
  bjLastPhase = d.phase;
}

// Host starts the betting phase.
document.getElementById("bjStartBtn").onclick = async () => {
  await updateDoc(getBJRef(bjRoomCode), { phase: "betting" });
};

// Deck click handler for both solo and multiplayer flows.
document.getElementById("bjDeck").onclick = async () => {
  if (state.currentGame !== "blackjack") return;
  if (bjMode === "solo") {
    if (document.getElementById("bjMessage").innerText.includes("PLACE")) {
      startSoloRound();
    }
    return;
  }
  const ref = getBJRef(bjRoomCode);
  const snap = await getDoc(ref);
  const d = snap.data();
  if (d.phase === "betting") {
    if (!d.seats[bjMySeatIdx].ready) {
      if (bjCurrentBet <= 0) return beep(200, "sawtooth", 0.5);
      state.myMoney -= bjCurrentBet;
      updBJ();
      const ns = [...d.seats];
      ns[bjMySeatIdx].bet = bjCurrentBet;
      ns[bjMySeatIdx].ready = true;
      ns[bjMySeatIdx].status = "playing";
      await updateDoc(ref, { seats: ns, pot: d.pot + bjCurrentBet });
    } else if (bjMySeatIdx === 0) {
      if (d.seats.some((s, i) => i > 0 && s && !s.ready)) return;
      const deck = createDeck();
      const ns = [...d.seats];
      ns.forEach((s) => {
        if (s) {
          s.hand = [deck.pop(), deck.pop()];
          if (s.uid === state.myUid) s.hand[1].h = true;
        }
      });
      await updateDoc(ref, { seats: ns, deck: deck, phase: "playing", activeSeat: 0 });
    }
  } else if (d.phase === "resolution" && bjMySeatIdx === 0) {
    const ns = d.seats.map((s) => {
      if (!s) return null;
      return { ...s, hand: [], bet: 0, ready: false, status: "waiting" };
    });
    await updateDoc(ref, { seats: ns, pot: 0, phase: "betting" });
  }
};

document.getElementById("bjHit").onclick = () => {
  if (bjMode === "solo") soloHit();
  else doNetAct("hit");
};
document.getElementById("bjStand").onclick = () => {
  if (bjMode === "solo") soloStand();
  else doNetAct("stand");
};

// Apply a multiplayer action (hit/stand) and sync to Firestore.
async function doNetAct(act) {
  const ref = getBJRef(bjRoomCode);
  const snap = await getDoc(ref);
  const d = snap.data();
  if (d.activeSeat !== bjMySeatIdx) return;
  const deck = [...d.deck];
  const ns = [...d.seats];
  const me = ns[bjMySeatIdx];
  if (act === "hit") {
    me.hand.push(deck.pop());
    if (calcHand(me.hand) > 21) {
      me.status = "bust";
      passTurn(ref, d.activeSeat, ns, deck);
    } else {
      await updateDoc(ref, { seats: ns, deck: deck });
    }
  } else {
    me.status = "stand";
    passTurn(ref, d.activeSeat, ns, deck);
  }
}

// Advance the turn, resolve the hand if all seats have acted.
async function passTurn(ref, curr, seats, deck) {
  let next = curr + 1;
  while (next < 4 && seats[next] === null) next++;
  if (next >= 4) {
    seats[0].hand[1].h = false;
    let best = 0;
    seats.forEach((s) => {
      if (s && s.status !== "bust") {
        const sc = calcHand(s.hand);
        if (sc > best) best = sc;
      }
    });
    seats.forEach((s) => {
      if (!s || s.status === "bust") return;
      const sc = calcHand(s.hand);
      s.status = sc === best && best > 0 ? "win" : "lose";
    });
    await updateDoc(ref, { seats: seats, deck: deck, phase: "resolution", activeSeat: -1 });
  } else await updateDoc(ref, { seats: seats, deck: deck, activeSeat: next });
}

// Betting chip click handlers for adjusting current bet.
document.querySelectorAll(".bj-chip").forEach((c) => {
  c.onclick = () => {
    if (state.currentGame !== "blackjack") return;
    const v = parseInt(c.dataset.v) || 0;
    if (c.id === "bjClear") bjCurrentBet = 0;
    else if (c.id === "bjAllIn") bjCurrentBet = state.myMoney;
    else if (state.myMoney >= bjCurrentBet + v) bjCurrentBet += v;
    updBJ();
  };
});

// Build and shuffle a standard 52-card deck.
function createDeck() {
  const d = [];
  for (const s of suits) for (const v of values) d.push({ s, v, h: false });
  return d.sort(() => Math.random() - 0.5);
}
// Calculate a hand's score with Ace handling.
function calcHand(h) {
  let s = 0;
  let a = 0;
  h.forEach((c) => {
    if (["J", "Q", "K"].includes(c.v)) s += 10;
    else if (c.v === "A") {
      s += 11;
      a++;
    } else s += parseInt(c.v);
  });
  while (s > 21 && a > 0) {
    s -= 10;
    a--;
  }
  return s;
}
// Render a single card into the specified hand element.
function renderNewCard(c, elId, hidden = false) {
  const d = document.createElement("div");
  d.className = "bj-card" + (hidden ? " hidden" : "");
  d.innerHTML = `<div>${c.v}</div><div>${c.s}</div><div>${c.v}</div>`;
  d.style.color = ["♥", "♦"].includes(c.s) ? "red" : "inherit";
  document.getElementById(elId).appendChild(d);
}
// Render a full hand of cards.
function renderHand(hand, elId) {
  document.getElementById(elId).innerHTML = "";
  hand.forEach((c) => renderNewCard(c, elId, c.h));
}
// Render the current hand score into the UI.
function renderScore(id, hand) {
  setText(id, calcHand(hand));
}

// Cleanup the multiplayer listener and local state on exit.
registerGameStop(() => {
  cleanupBJ();
});
