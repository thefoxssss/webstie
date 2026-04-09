const fs = require('fs');
let c = fs.readFileSync('games/builder.js', 'utf8');
console.log(c.indexOf('ctx.fillText(isCraftingTableOpen ? "Crafting Table" : "Crafting", craftStartX, craftStartY - 10);'));
