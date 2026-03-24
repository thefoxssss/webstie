const fs = require('fs');
let css = fs.readFileSync('styles.css', 'utf8');

// Standalone game overlays have padding applied when `.has-game-side-shop` is active to make room for it on the left side.
// .overlay.has-game-side-shop { padding-left: calc(var(--game-side-shop-width) + 24px); }
//
// In index.html, we placed <div class="game-content-shell"> around the contents.
// So the shop panel (which is appended to the `.overlay` directly via `overlay.appendChild(panel)`)
// will be `position: absolute; left: 14px;` in `.game-side-shop`.
// This matches standard standalone layout.
//
// But wait, the `renderInGameShopPanel` appends it to `overlay`. So that works fine!
// Let's quickly verify we don't have broken layout by running python http server and checking page.
