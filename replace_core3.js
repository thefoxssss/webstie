const fs = require('fs');
let content = fs.readFileSync('core.js', 'utf8');

// Adding builder inventory properties to core.js state
let searchVars = `let myAchievements = [];
let myInventory = [];
let myJoined = 0;
let myItemToggles = {};`;

let replaceVars = `let myAchievements = [];
let myInventory = [];
let myJoined = 0;
let myItemToggles = {};
let builderInventory = null;
let builderHotbar = null;
let builderArmor = null;`;

if (content.includes(searchVars)) {
    content = content.replace(searchVars, replaceVars);
    console.log("Replaced vars.");
}

let searchLoad = `  myInventory = data.inventory || [];
  myJoined = data.joined || Date.now();
  myItemToggles = data.itemToggles || {};`;

let replaceLoad = `  myInventory = data.inventory || [];
  myJoined = data.joined || Date.now();
  myItemToggles = data.itemToggles || {};
  builderInventory = data.builderInventory || null;
  builderHotbar = data.builderHotbar || null;
  builderArmor = data.builderArmor || null;`;

if (content.includes(searchLoad)) {
    content = content.replace(searchLoad, replaceLoad);
    console.log("Replaced load.");
}

fs.writeFileSync('core.js', content);
