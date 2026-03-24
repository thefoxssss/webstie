const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// I'll wrap the contents of every game overlay inside a `<div class="game-content-shell">` so they appear as windows.
// And I'll add `.menu-overlay` to them so the background is blurred/translucent like the other menus.
const gameOverlays = [
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

for (const id of gameOverlays) {
  // Add menu-overlay class so it has a blurred background, not solid black
  let regex = new RegExp(`(<div class="overlay" id="${id}">)([\\s\\S]*?)(<button class="exit-btn-fixed" onclick="window\\.closeOverlays\\(\\)">[\\s\\S]*?</button>\\s*</div>)`);
  if (!regex.test(html)) {
    // try different ending or no exit button?
    // Actually, they all end with <button class="exit-btn-fixed"...
    regex = new RegExp(`(<div class="overlay" id="${id}">)([\\s\\S]*?)(</div>\\s*<!--)`); // fallback? no
    regex = new RegExp(`(<div class="overlay" id="${id}">)([\\s\\S]*?)(<button class="exit-btn-fixed" onclick="window.closeOverlays\\(\\)">\\s*EXIT SYSTEM\\s*</button>\\s*</div>)`);
  }

  // Wait, let's just do it dynamically in DOM or script if needed? No, better edit index.html correctly.
}
