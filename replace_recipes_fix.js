const fs = require('fs');
let content = fs.readFileSync('games/builder.js', 'utf8');
content = content.replace('ctx.restore(); return; // Skip drawing rest of inventory if recipes open', 'return; // Skip drawing rest of inventory if recipes open');
fs.writeFileSync('games/builder.js', content);
