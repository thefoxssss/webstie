const fs = require('fs');
let content = fs.readFileSync('games/builder.js', 'utf8');

content = content.replace(/inventorySlots\[(.*?)\] = undefined;/g, "inventorySlots[$1] = undefined; saveInventoryState();");
content = content.replace(/hotbarSlots\[(.*?)\] = undefined;/g, "hotbarSlots[$1] = undefined; saveInventoryState();");
content = content.replace(/inventorySlots\[(.*?)\] = \{/g, "inventorySlots[$1] = {");

fs.writeFileSync('games/builder.js', content);
