const fs = require('fs');
let content = fs.readFileSync('core.js', 'utf8');

// Adding builder inventory properties to core.js state
let searchVars = `let myInventory = [];
let myItemToggles = {};`;

let replaceVars = `let myInventory = [];
let myItemToggles = {};
let builderInventory = null;
let builderHotbar = null;
let builderArmor = null;`;

if (content.includes(searchVars)) {
    content = content.replace(searchVars, replaceVars);
    console.log("Replaced vars.");
}

let searchGetSet = `  get myInventory() {
    return myInventory;
  },
  set myInventory(value) {
    myInventory = value;
  },`;

let replaceGetSet = `  get myInventory() {
    return myInventory;
  },
  set myInventory(value) {
    myInventory = value;
  },
  get builderInventory() { return builderInventory; },
  set builderInventory(v) { builderInventory = v; },
  get builderHotbar() { return builderHotbar; },
  set builderHotbar(v) { builderHotbar = v; },
  get builderArmor() { return builderArmor; },
  set builderArmor(v) { builderArmor = v; },`;

if (content.includes(searchGetSet)) {
    content = content.replace(searchGetSet, replaceGetSet);
    console.log("Replaced GetSet.");
}

let searchLoad = `  myInventory = data.inventory || [];
  myItemToggles = data.itemToggles || {};`;

let replaceLoad = `  myInventory = data.inventory || [];
  myItemToggles = data.itemToggles || {};
  builderInventory = data.builderInventory || null;
  builderHotbar = data.builderHotbar || null;
  builderArmor = data.builderArmor || null;`;

if (content.includes(searchLoad)) {
    content = content.replace(searchLoad, replaceLoad);
    console.log("Replaced load.");
}

fs.writeFileSync('core.js', content);
