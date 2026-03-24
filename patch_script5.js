const fs = require('fs');
let content = fs.readFileSync('script.js', 'utf8');

// I also need to verify what happens when launchGame calls `window.closeOverlays()`.
// `closeOverlays()` closes all overlays, including `overlayGamebox`.
// So `overlayGamebox` will be closed. Then we activate the target game overlay.
// That should mean the target overlay displays perfectly.

content = content.replace(
  /window.launchGame = \(game, source = "direct"\) => \{[\s\S]*?renderInGameShopPanel\(game, overlayId\);/g,
  `window.launchGame = (game, source = "direct") => {
  window.__goonerLastGameLaunchSource = source;
  window.closeOverlays();
  const overlayId = mountGameOverlayIntoGamebox(game);
  const el = document.getElementById(overlayId);
  if (el) el.classList.add("active");
  renderInGameShopPanel(game, overlayId);`
);

fs.writeFileSync('script.js', content);
