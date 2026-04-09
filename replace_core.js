const fs = require('fs');
let content = fs.readFileSync('core.js', 'utf8');

// Adding builder inventory properties to core.js state
let searchVars = `export let myAchievements = [];
export let myInventory = [];
export let myItemToggles = {};`;

let replaceVars = `export let myAchievements = [];
export let myInventory = [];
export let myItemToggles = {};
export let builderInventory = null;
export let builderHotbar = null;
export let builderArmor = null;`;

if (content.includes(searchVars)) {
    content = content.replace(searchVars, replaceVars);
    console.log("Replaced vars.");
}

let searchLoad = `    myInventory = docSnap.data().inventory || [];
    myItemToggles = docSnap.data().itemToggles || {};`;

let replaceLoad = `    myInventory = docSnap.data().inventory || [];
    myItemToggles = docSnap.data().itemToggles || {};
    builderInventory = docSnap.data().builderInventory || null;
    builderHotbar = docSnap.data().builderHotbar || null;
    builderArmor = docSnap.data().builderArmor || null;`;

if (content.includes(searchLoad)) {
    content = content.replace(searchLoad, replaceLoad);
    console.log("Replaced load.");
}

let searchSave = `        inventory: myInventory,
        itemToggles: myItemToggles,`;

let replaceSave = `        inventory: myInventory,
        itemToggles: myItemToggles,
        builderInventory: builderInventory,
        builderHotbar: builderHotbar,
        builderArmor: builderArmor,`;

if (content.includes(searchSave)) {
    content = content.replace(searchSave, replaceSave);
    console.log("Replaced save.");
}

let searchSnapshot = `    inventory: myInventory,
    itemToggles: myItemToggles,`;

let replaceSnapshot = `    inventory: myInventory,
    itemToggles: myItemToggles,
    builderInventory,
    builderHotbar,
    builderArmor,`;

if (content.includes(searchSnapshot)) {
    content = content.replace(searchSnapshot, replaceSnapshot);
    console.log("Replaced snapshot.");
}

fs.writeFileSync('core.js', content);
