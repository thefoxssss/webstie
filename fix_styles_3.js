const fs = require('fs');
let css = fs.readFileSync('styles.css', 'utf8');

// The reason it might not be centered perfectly or looking right is that
// `.overlay` needs `z-index` and relative layout.
// Actually, `overlay` is `display: flex; flex-direction: column; align-items: center; justify-content: flex-start;`.
// The `.has-game-side-shop` sets `padding-left`.
// This shifts the `game-content-shell` to the right, which is correct.
// The `game-content-shell` is centered inside the remaining space.

// Let's modify `.game-content-shell` to have `position: relative; z-index: 2;`
css = css.replace(
  /\.game-content-shell \{\s*width: min\(95vw, 1200px\);/g,
  `.game-content-shell {\n  position: relative;\n  z-index: 2;\n  width: min(95vw, 1200px);`
);

// Also, the background color of .game-content-shell might be transparent if there's a typo in CSS
// "background: rgba(0, 0, 0, 0.86);" is valid.

// We should also check the "GAME SHOP" in `.game-side-shop`.
// .game-side-shop { position: absolute; left: 14px; top: 74px; }
// Wait, `overlay` is a flex container, and `game-side-shop` is `position: absolute;` inside it.
// This is perfectly fine, it puts it on the left.

// Oh, I see the issue. When the game was embedded in `#overlayGamebox`, it had `.gamebox-shell`.
// Now we've given them `.game-content-shell`.
// But look at `game-side-shop`. In `styles.css`:
// .overlay.has-game-side-shop { padding-left: calc(var(--game-side-shop-width) + 24px); }
// .game-side-shop { position: absolute; left: 14px; top: 74px; width: ... }

// Wait, the "GOONER" text behind the game is visible.
// Because the `.game-content-shell` is semi-transparent (`rgba(0, 0, 0, 0.86)`), and the `.overlay` is also semi-transparent (`rgba(0, 0, 0, 0.2)`).
// To look more like an app window, we want a solid look, or at least solid enough.
// `background: rgba(0, 0, 0, 0.95);` for `.game-content-shell`
css = css.replace(
  /background: rgba\(0, 0, 0, 0\.86\);/g,
  `background: rgba(0, 0, 0, 0.95);`
);

fs.writeFileSync('styles.css', css);
