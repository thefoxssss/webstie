const fs = require('fs');

let fileContent = fs.readFileSync('script.js', 'utf8');

// We need to modify window.launchGame and mountGameOverlayIntoGamebox
// Actually, let's just make mountGameOverlayIntoGamebox return the actual target overlay ID
// and not move the DOM node.

fileContent = fileContent.replace(
  /function mountGameOverlayIntoGamebox\(gameId\) \{[\s\S]*?return SHARED_GAME_OVERLAY_ID;\n\}/g,
  `function mountGameOverlayIntoGamebox(gameId) {
  const targetOverlayId = getOverlayIdForGame(gameId);
  return targetOverlayId;
}`
);

fs.writeFileSync('script.js', fileContent);
console.log("Patched mountGameOverlayIntoGamebox");
