const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');
const GAME_TEMPLATE_OVERLAY_IDS = [
  "overlayGeo",
  "overlayType",
  "overlayPong",
  "overlaySnake",
  "overlayRunner",
  "overlayCorebreaker",
  "overlayNeondefender",
  "overlayVoidminer",
  "overlayCoredriller",
  "overlayShadowassassin",
  "overlayDodge",
  "overlayRoulette",
  "overlayTTT",
  "overlayHangman",
  "overlayBlackjack",
  "overlayBonk",
  "overlayFlappy",
  "overlayDrift",
  "overlayEmulator",
  "overlayByteblitz",
  "overlayCiphercrack",
  "overlayAstrohop",
  "overlayPulsestack",
  "overlayGlitchgate",
  "overlayOrbweaver",
  "overlayLaserlock",
  "overlayMetromaze",
  "overlayStacksmash",
  "overlayQuantumflip",
  "overlayUltimatettt"
];

for (const id of GAME_TEMPLATE_OVERLAY_IDS) {
    const rx = new RegExp(`(<div class="overlay" id="${id}">)([\\s\\S]*?)(<button class="exit-btn-fixed"[\\s\\S]*?</button>\\s*</div>)`);
    html = html.replace(rx, `<div class="overlay menu-overlay game-overlay" id="${id}">
      <div class="game-content-shell">$2$3
    </div>`);
}

fs.writeFileSync('index.html', html);
console.log("Patched index.html");
