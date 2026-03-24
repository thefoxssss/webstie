const fs = require('fs');
let content = fs.readFileSync('script.js', 'utf8');

// Also update window.launchGame. Currently it renders the shop panel into SHARED_GAME_OVERLAY_ID.
// It should render it into the actual game's overlayId.
content = content.replace(
  /renderInGameShopPanel\(game, SHARED_GAME_OVERLAY_ID\);/g,
  `renderInGameShopPanel(game, overlayId);`
);

// Actually let's look at `window.launchGame`:
// window.launchGame = (game, source = "direct") => {
//   window.__goonerLastGameLaunchSource = source;
//   window.closeOverlays();
//   const overlayId = mountGameOverlayIntoGamebox(game);
//   const el = document.getElementById(overlayId);
//   if (el) el.classList.add("active");
//   renderInGameShopPanel(game, SHARED_GAME_OVERLAY_ID);
//   ...
// }

// And check how `GAME_OVERLAY_IDS` handles close buttons.
fs.writeFileSync('script.js', content);
