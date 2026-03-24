const fs = require('fs');
let css = fs.readFileSync('styles.css', 'utf8');

// I should make sure the `.game-content-shell` doesn't have `display: flex` hidden or something weird.
// It is styled as:
// .game-content-shell {
//   width: min(95vw, 1200px);
//   border: 2px solid var(--accent);
//   background: rgba(0, 0, 0, 0.86);
//   box-shadow: 0 0 20px var(--accent-dim);
//   min-height: unset;
//   padding: 10px 14px 12px;
//   display: flex;
//   flex-direction: column;
//   align-items: center;
//   gap: 8px;
// }
//
// That seems perfect for a "window".
// We also need to fix exit buttons since they were hidden with `.exit-btn-fixed { display: none; }`
// The user wants it to look like an app, meaning it needs an exit/close button.
// Let's modify styles.css so `.exit-btn-fixed` is not display: none.

css = css.replace(/\.exit-btn-fixed \{\s*display: none;\s*\}/g, `.exit-btn-fixed { display: block; margin-top: 10px; width: 100%; border: 1px solid var(--accent); background: transparent; color: var(--accent); padding: 12px; font-family: inherit; font-weight: bold; cursor: pointer; text-transform: uppercase; }`);

fs.writeFileSync('styles.css', css);
