const fs = require('fs');
let content = fs.readFileSync('core.js', 'utf8');

let searchLoad = `  myInventory = data.inventory || [];
  myJoined = data.joined || 0;`;

let replaceLoad = `  myInventory = data.inventory || [];
  myJoined = data.joined || 0;
  builderInventory = data.builderInventory || null;
  builderHotbar = data.builderHotbar || null;
  builderArmor = data.builderArmor || null;`;

if (content.includes(searchLoad)) {
    content = content.replace(searchLoad, replaceLoad);
    console.log("Replaced load.");
}

fs.writeFileSync('core.js', content);
