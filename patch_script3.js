const fs = require('fs');
let content = fs.readFileSync('script.js', 'utf8');

// We need to disable initSharedGamebox since it was moving the game templates into #gameOverlayTemplates container
content = content.replace(
  /function initSharedGamebox\(\) \{[\s\S]*?\}\n/g,
  `function initSharedGamebox() {
  // disabled since games are now standalone overlays
}
`
);

fs.writeFileSync('script.js', content);
