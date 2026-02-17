const state = {
  credits: 4200,
  activeGame: "pulse",
  boardFilter: "daily",
  marketTick: 0,
  portfolioCap: 0.2,
};

const gameData = {
  pulse: {
    title: "Pulse Runner",
    description: "Rhythm-reactive runner where lane swaps are tied to perfect beat windows.",
    tags: ["High APM", "Execution", "Reactive"],
    abilities: [
      { name: "Echo Step", rarity: "Rare", text: "Perfect dodges generate a one-hit shield for 3s." },
      { name: "Phase Vault", rarity: "Epic", text: "Bank combo energy into one controlled time-slow burst." },
      { name: "Apex Surge", rarity: "Legendary", text: "Single-use finisher that doubles score on flawless segment." },
    ],
  },
  rift: {
    title: "Rift Tactics",
    description: "Grid tactics duel emphasizing counterplay, terrain control, and order timing.",
    tags: ["Turn Strategy", "Prediction", "Counterplay"],
    abilities: [
      { name: "Anchor Beacon", rarity: "Rare", text: "Locks one tile and denies displacement for two rounds." },
      { name: "Mirror Feint", rarity: "Epic", text: "Copies last enemy utility with 60% potency." },
      { name: "Singularity Net", rarity: "Legendary", text: "Pull effect with strict cooldown and anti-chain rule." },
    ],
  },
  forge: {
    title: "Forge Tycoon",
    description: "Production optimization game with capped automation and heat management.",
    tags: ["Optimization", "Economy", "Macro Decisions"],
    abilities: [
      { name: "Smart Queue", rarity: "Common", text: "Auto-sorts tasks by margin-per-minute." },
      { name: "Coolant Swap", rarity: "Rare", text: "Prevents one overheat cycle penalty." },
      { name: "Quantum Draft", rarity: "Epic", text: "Converts excess stock into a temporary efficiency spike." },
    ],
  },
  cipher: {
    title: "Cipher Clash",
    description: "PvP pattern-breaker where reading opponents beats pure reaction speed.",
    tags: ["Mindgame", "PvP", "Pattern Reads"],
    abilities: [
      { name: "Trace Leak", rarity: "Rare", text: "Reveals one upcoming opponent sequence branch." },
      { name: "False Key", rarity: "Epic", text: "Injects a decoy branch once per round." },
      { name: "Null Pulse", rarity: "Legendary", text: "Hard counter to one enemy ultimate (long cooldown)." },
    ],
  },
};

const shopItems = [
  { name: "Nebula Trail", rarity: "rare", type: "VFX", price: 450 },
  { name: "Chrono Frame", rarity: "epic", type: "Profile Border", price: 920 },
  { name: "Titanium Emote Pack", rarity: "common", type: "Emote", price: 260 },
  { name: "Founder's Title: Riftborn", rarity: "legendary", type: "Title", price: 1500 },
  { name: "Drift HUD Skin", rarity: "rare", type: "Interface Skin", price: 520 },
  { name: "Victory Animation: Starlance", rarity: "epic", type: "Animation", price: 1100 },
];

const marketAssets = [
  { symbol: "ARC", name: "Arcology Metals", price: 101, trend: 0.9, volatility: 2.4 },
  { symbol: "NVA", name: "Nova Logistics", price: 86, trend: 0.4, volatility: 1.9 },
  { symbol: "QNT", name: "Quantum Grid", price: 125, trend: -0.2, volatility: 2.6 },
];

const crews = [
  { name: "Solar Lynx", members: 24, objective: "Complete 150 flawless runs", progress: 68, bonus: "+4% seasonal cosmetics drop chance" },
  { name: "Iron Comet", members: 12, objective: "Win 80 tactical duels", progress: 52, bonus: "+6% crew badge shards" },
  { name: "Vanta Bloom", members: 8, objective: "Contribute 20k market insight points", progress: 39, bonus: "Unique banner colorway unlock" },
];

const boardData = {
  daily: [
    ["Nyra", 1840, "Gold"],
    ["Vael", 1794, "Gold"],
    ["Kiro", 1688, "Silver"],
    ["Sumi", 1620, "Silver"],
  ],
  weekly: [
    ["Nyra", 9280, "Platinum"],
    ["Omen", 9070, "Platinum"],
    ["Rika", 8815, "Gold"],
    ["Kiro", 8490, "Gold"],
  ],
  all: [
    ["Omen", 63200, "Diamond"],
    ["Nyra", 62140, "Diamond"],
    ["Rika", 59450, "Platinum"],
    ["Vael", 58020, "Platinum"],
  ],
};

function formatCredits(value) {
  return value.toLocaleString("en-US");
}

function pushToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.getElementById("toastStack").append(toast);
  setTimeout(() => toast.remove(), 2800);
}

function renderHeader() {
  document.getElementById("creditsValue").textContent = formatCredits(state.credits);
}

function renderGame() {
  const data = gameData[state.activeGame];
  document.getElementById("gameTitle").textContent = data.title;
  document.getElementById("gameDesc").textContent = data.description;

  const tagRoot = document.getElementById("gameTags");
  tagRoot.innerHTML = data.tags.map((tag) => `<span class="tag">${tag}</span>`).join("");

  const abilityRoot = document.getElementById("abilityGrid");
  abilityRoot.innerHTML = data.abilities
    .map(
      (ability) => `
        <article class="ability-card">
          <small>${ability.rarity}</small>
          <h4>${ability.name}</h4>
          <p>${ability.text}</p>
        </article>`,
    )
    .join("");
}

function renderShop() {
  const root = document.getElementById("shopGrid");
  root.innerHTML = shopItems
    .map(
      (item) => `
      <article class="shop-item">
        <span class="rarity ${item.rarity}">${item.rarity}</span>
        <h4>${item.name}</h4>
        <p>${item.type}</p>
        <div class="button-row">
          <strong>${formatCredits(item.price)} cr</strong>
          <button class="btn btn-secondary" data-buy="${item.name}">Purchase</button>
        </div>
      </article>`,
    )
    .join("");
}

function advanceMarketTick() {
  state.marketTick += 1;
  marketAssets.forEach((asset) => {
    const cycle = Math.sin((state.marketTick + asset.price) / 3.5) * asset.volatility;
    const directional = asset.trend + cycle;
    const cappedMove = Math.max(-4.5, Math.min(4.5, directional));
    asset.price = Math.max(20, Number((asset.price + cappedMove).toFixed(2)));
    asset.delta = cappedMove;
  });
  renderMarket();
}

function renderMarket() {
  const root = document.getElementById("marketList");
  root.innerHTML = marketAssets
    .map((asset) => {
      const delta = asset.delta ?? 0;
      const deltaClass = delta >= 0 ? "up" : "down";
      return `
      <article class="market-row">
        <div>
          <strong>${asset.symbol}</strong>
          <p>${asset.name}</p>
        </div>
        <strong>${asset.price.toFixed(2)} cr</strong>
        <span class="delta ${deltaClass}">${delta >= 0 ? "+" : ""}${delta.toFixed(2)}%</span>
      </article>`;
    })
    .join("");
}

function renderCrews() {
  const root = document.getElementById("crewGrid");
  root.innerHTML = crews
    .map(
      (crew) => `
      <article class="crew-card">
        <h4>${crew.name}</h4>
        <p>${crew.members} members · ${crew.objective}</p>
        <p>Progress: ${crew.progress}%</p>
        <p><strong>Reward:</strong> ${crew.bonus}</p>
      </article>`,
    )
    .join("");
}

function renderBoard() {
  const rows = boardData[state.boardFilter];
  document.getElementById("boardTable").innerHTML = rows
    .map(
      (row, idx) => `
      <article class="board-row">
        <strong>#${idx + 1}</strong>
        <span>${row[0]}</span>
        <strong>${formatCredits(row[1])}</strong>
        <span class="tier">${row[2]}</span>
      </article>`,
    )
    .join("");
}

function simulateRankedRun() {
  const skillScore = Math.floor(540 + Math.random() * 620);
  const normalized = Math.floor(skillScore * 0.85);
  const reward = Math.floor(120 + normalized * 0.08);
  state.credits += reward;
  renderHeader();
  pushToast(`Ranked run complete: ${normalized} normalized score, +${reward} credits.`);
}

function claimDailyReward() {
  const reward = 180;
  state.credits += reward;
  renderHeader();
  pushToast(`Daily objective completed. +${reward} credits (non-stacking cap).`);
}

function setupInteractions() {
  document.body.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const nextGame = target.dataset.game;
    if (nextGame) {
      state.activeGame = nextGame;
      document.querySelectorAll(".btn-tab").forEach((button) => button.classList.toggle("active", button.dataset.game === nextGame));
      renderGame();
    }

    const nextFilter = target.dataset.boardFilter;
    if (nextFilter) {
      state.boardFilter = nextFilter;
      document.querySelectorAll(".btn-chip").forEach((button) => button.classList.toggle("active", button.dataset.boardFilter === nextFilter));
      renderBoard();
    }

    const itemName = target.dataset.buy;
    if (itemName) {
      const item = shopItems.find((entry) => entry.name === itemName);
      if (!item) return;
      if (state.credits < item.price) {
        pushToast("Not enough credits.");
        return;
      }
      state.credits -= item.price;
      renderHeader();
      pushToast(`${itemName} purchased. Cosmetic inventory updated.`);
    }

    const modalId = target.dataset.openModal;
    if (modalId) document.getElementById(modalId)?.showModal();

    const closeId = target.dataset.closeModal;
    if (closeId) document.getElementById(closeId)?.close();

    const scrollId = target.dataset.scroll;
    if (scrollId) document.getElementById(scrollId)?.scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("simulateRunBtn").addEventListener("click", simulateRankedRun);
  document.getElementById("claimRewardBtn").addEventListener("click", claimDailyReward);
  document.getElementById("tickMarketBtn").addEventListener("click", () => {
    advanceMarketTick();
    pushToast("Market tick advanced. Circuit-breaker checks passed.");
  });
}

function init() {
  renderHeader();
  renderGame();
  renderShop();
  renderMarket();
  renderCrews();
  renderBoard();
  setupInteractions();
}

init();
