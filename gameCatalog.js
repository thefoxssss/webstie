export const GAME_DIRECTORY_ENTRIES = Object.freeze([
  { id: "geo", title: "GEO DASH", description: "Dodge spikes and survive speed ramps.", icon: "🟨", tags: ["arcade", "skill", "platformer", "reflex"] },
  { id: "type", title: "TYPE RUNNER", description: "Type fast to outrun incoming threats.", icon: "⌨️", tags: ["arcade", "skill", "typing", "reflex"] },
  { id: "pong", title: "PONG", description: "Retro paddle battle with adjustable difficulty.", icon: "🏓", tags: ["arcade", "pvp", "retro", "duel"] },
  { id: "snake", title: "SNAKE", description: "Grow longer while avoiding walls and yourself.", icon: "🐍", tags: ["arcade", "skill"] },
  { id: "runner", title: "RUNNER V2", description: "Endless sprint with jump timing focus.", icon: "🏃", tags: ["arcade", "skill"] },
  { id: "corebreaker", title: "CORE BREAKER", description: "Break glowing blocks and protect your core.", icon: "🧱", tags: ["arcade", "skill"] },
  { id: "neondefender", title: "NEON DEFENDER", description: "Aim, auto-fire, and hold the line.", icon: "🎯", tags: ["arcade", "skill"] },
  { id: "voidminer", title: "VOID MINER", description: "Thrust through deep space for score.", icon: "🚀", tags: ["arcade", "skill"] },
  { id: "shadowassassin", title: "SHADOW ASSASSIN", description: "Castle infiltration with boss encounters.", icon: "🗡️", tags: ["arcade", "skill"] },
  { id: "dodge", title: "DODGE GRID", description: "Stay alive in a high-speed hazard field.", icon: "⚡", tags: ["arcade", "skill"] },
  { id: "roulette", title: "ROULETTE", description: "Bet, spin, and chase streaks.", icon: "🎡", tags: ["casino", "luck", "table"] },
  { id: "blackjack", title: "BLACKJACK", description: "Card table duels with live opponents.", icon: "🂡", tags: ["casino", "pvp", "cards", "table"] },
  { id: "ttt", title: "TIC TAC TOE", description: "Classic 3x3 tactical showdown.", icon: "❎", tags: ["pvp", "skill"] },
  { id: "ultimatettt", title: "ULTIMATE TIC-TAC-TOE", description: "Nested 3×3 boards where each move dictates your opponent's next board.", icon: "🧠", tags: ["pvp", "skill"] },
  { id: "hangman", title: "HANGMAN", description: "Guess words before the timer expires.", icon: "🧠", tags: ["pvp", "skill"] },
  { id: "bonk", title: "BONK ARENA", description: "Fast arena knockouts and dodges.", icon: "🥊", tags: ["pvp", "arcade"] },
  { id: "drift", title: "NEON DRIFT", description: "Slide corners and chain clean laps.", icon: "🏎️", tags: ["pvp", "arcade", "skill"] },
  { id: "emulator", title: "CPU EMULATOR", description: "Program-like puzzle sandbox challenge.", icon: "🖥️", tags: ["skill", "puzzle", "logic"] },
  { id: "byteblitz", title: "BYTE BLITZ", description: "Defend the buffer with ship controls, waves, and powerups.", icon: "💾", tags: ["arcade", "skill"] },
  { id: "ciphercrack", title: "CIPHER CRACK", description: "Decrypt shifting ciphers before time runs out.", icon: "🔐", tags: ["skill", "puzzle", "logic"] },
  { id: "astrohop", title: "ASTRO HOP", description: "Leap castle gaps, dash hazards, and race the clock.", icon: "👟", tags: ["arcade", "platformer", "timing"] },
  { id: "pulsestack", title: "PULSE STACK", description: "Click rapid targets to build combos and multiplier chains.", icon: "🎛️", tags: ["arcade", "timing", "reflex"] },
  { id: "glitchgate", title: "GLITCH GATE", description: "Seal breach points quickly before integrity collapses.", icon: "🌀", tags: ["arcade", "reflex", "defense"] },
  { id: "orbweaver", title: "ORB WEAVER", description: "Trigger orb chain reactions for massive payouts.", icon: "🫧", tags: ["arcade", "strategy", "timing"] },
  { id: "laserlock", title: "LASER LOCK", description: "Precision target snapping in a high-pressure timer mode.", icon: "🔴", tags: ["arcade", "precision", "reflex"] },
  { id: "metromaze", title: "METRO MAZE", description: "Procedural mazes with relics, sentinels, and level exits.", icon: "🚇", tags: ["skill", "maze", "puzzle", "strategy"] },
  { id: "stacksmash", title: "STACK SMASH", description: "Break layered stacks for big spike payouts.", icon: "🪨", tags: ["arcade", "timing", "reflex"] },
  { id: "quantumflip", title: "QUANTUM FLIP", description: "Pilot a phase core: chain matching orbs and survive hunter waves.", icon: "⚛️", tags: ["skill", "strategy", "survival"] },
  { id: "flappy", title: "FLAPPY GOON", description: "Secret bonus mode: tap to survive.", icon: "🐤", tags: ["arcade", "skill"], hidden: true },
]);

export const LEADERBOARD_GAME_COLUMNS = Object.freeze(
  GAME_DIRECTORY_ENTRIES.map((entry) => ({
    ...entry,
    leaderboardModes: (() => {
      if (entry.id === "pong") return ["easy", "hard", "single"];
      if ((entry.tags || []).includes("pvp")) return ["multiplayer"];
      return ["single"];
    })(),
  }))
);

export const GAME_TAG_EMOJI = Object.freeze({
  arcade: "🕹️",
  skill: "🎯",
  pvp: "⚔️",
  casino: "🎰",
  platformer: "🦘",
  reflex: "⚡",
  typing: "⌨️",
  retro: "📼",
  duel: "🥊",
  luck: "🍀",
  table: "🃏",
  cards: "🂡",
  puzzle: "🧩",
  logic: "🧠",
  timing: "⏱️",
  defense: "🛡️",
  strategy: "♟️",
  precision: "🎯",
  maze: "🧭",
  survival: "🫀",
});
