const fs = require('fs');
let content = fs.readFileSync('games/builder.js', 'utf8');

const importSearch = `import { myName, saveStats } from "../core.js";`;
const importReplace = `import { myName, saveStats, builderHotbar, builderInventory, builderArmor, updateBuilderInventoryState } from "../core.js";`;

if (content.includes(importSearch)) {
    content = content.replace(importSearch, importReplace);
    console.log("Replaced import");
}

const slotInitSearch = `    let selectedHotbarIndex = 0;
    // Map initial available blocks, empty for the rest
    let hotbarSlots = [1, 2, 3, 4, 7, 8, 5, 6, undefined].map(cloneItem);
    let selectedBlockType = hotbarSlots[0] || 1;
    let localPlayerId = null;
    let inventoryOpen = false;

    let inventorySlots = new Array(27).fill(undefined).map(cloneItem);
    let armorSlot = undefined;`;

const slotInitReplace = `    let selectedHotbarIndex = 0;

    // Map initial available blocks, empty for the rest
    let hotbarSlots;
    if (builderHotbar) {
        hotbarSlots = builderHotbar.map(cloneItem);
    } else {
        hotbarSlots = [1, 2, 3, 4, 7, 8, 5, 6, undefined].map(cloneItem);
    }

    let selectedBlockType = hotbarSlots[0] || 1;
    let localPlayerId = null;
    let inventoryOpen = false;

    let inventorySlots;
    if (builderInventory) {
        inventorySlots = builderInventory.map(cloneItem);
    } else {
        inventorySlots = new Array(27).fill(undefined).map(cloneItem);
    }

    let armorSlot = builderArmor ? cloneItem(builderArmor) : undefined;

    const saveInventoryState = () => {
        updateBuilderInventoryState(hotbarSlots, inventorySlots, armorSlot);
        saveStats();
    };`;

if (content.includes(slotInitSearch)) {
    content = content.replace(slotInitSearch, slotInitReplace);
    console.log("Replaced slot init");
}

fs.writeFileSync('games/builder.js', content);
