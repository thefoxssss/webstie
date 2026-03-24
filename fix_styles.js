const fs = require('fs');

let css = fs.readFileSync('styles.css', 'utf8');

// Looking at the screenshot, the overlay does not have a background that encloses everything.
// The `.game-content-shell` is supposed to wrap everything, but the `<h1>`, `<canvas>`, `<button>` are just floating out in the overlay.
// Why did that happen? Ah! The regex replace `"$2$3"` may not have worked perfectly if there was nothing to wrap properly, or maybe we didn't add it around all elements.
// Let's check `index.html` structure.
