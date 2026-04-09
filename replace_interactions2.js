const fs = require('fs');
let content = fs.readFileSync('games/builder.js', 'utf8');

const oldLogicSearch = `            const hotbarPanel = getHotbarBounds();
            const hotbarIndex = getHotbarIndexAt(mouse.x, mouse.y, hotbarPanel);

            if (hotbarIndex !== null) {
                if (hotbarSlots[hotbarIndex] !== undefined) {
                    // Pick up from hotbar
                    draggedItemType = cloneItem(hotbarSlots[hotbarIndex]);
                    dragSourceHotbarIndex = hotbarIndex;
                    dragSourceInventoryIndex = null;
                    dragSourceCraftingIndex = null;
                    dragSourceOutputSlot = false;
                    dragSourceArmorSlot = false;
                    hotbarSlots[hotbarIndex] = undefined; saveInventoryState();
                }
                return;
            }

            const panel = getInventoryBounds();
            const inventoryIndex = getInventorySlotAt(mouse.x, mouse.y, panel);
            if (inventoryIndex !== null) {
                if (inventorySlots[inventoryIndex] !== undefined) {
                    // Pick up from inventory
                    draggedItemType = cloneItem(inventorySlots[inventoryIndex]);
                    dragSourceHotbarIndex = null;
                    dragSourceInventoryIndex = inventoryIndex;
                    dragSourceCraftingIndex = null;
                    dragSourceOutputSlot = false;
                    dragSourceArmorSlot = false;
                    inventorySlots[inventoryIndex] = undefined; saveInventoryState();
                }
                return;
            }

            // Armor Slot Check
            const armorSlotX = panel.x + inventoryLayout.padding;
            const armorSlotY = panel.y + 40;
            if (mouse.x >= armorSlotX && mouse.x <= armorSlotX + inventoryLayout.slotSize &&
                mouse.y >= armorSlotY && mouse.y <= armorSlotY + inventoryLayout.slotSize) {
                if (armorSlot !== undefined) {
                    draggedItemType = cloneItem(armorSlot);
                    dragSourceHotbarIndex = null;
                    dragSourceInventoryIndex = null;
                    dragSourceCraftingIndex = null;
                    dragSourceOutputSlot = false;
                    dragSourceArmorSlot = true;
                    armorSlot = undefined;
                    room.send("equip_armor", { type: 0 }); // unequip
                }
                return;
            }`;

const oldLogicReplace = `            const hotbarPanel = getHotbarBounds();
            const hotbarIndex = getHotbarIndexAt(mouse.x, mouse.y, hotbarPanel);

            if (hotbarIndex !== null) {
                if (handleSlotInteraction(hotbarSlots, hotbarIndex)) return;
            }

            const panel = getInventoryBounds();
            const inventoryIndex = getInventorySlotAt(mouse.x, mouse.y, panel);
            if (inventoryIndex !== null) {
                if (handleSlotInteraction(inventorySlots, inventoryIndex)) return;
            }

            // Armor Slot Check
            const armorSlotX = panel.x + inventoryLayout.padding;
            const armorSlotY = panel.y + 40;
            if (mouse.x >= armorSlotX && mouse.x <= armorSlotX + inventoryLayout.slotSize &&
                mouse.y >= armorSlotY && mouse.y <= armorSlotY + inventoryLayout.slotSize) {

                // Hacky way to use handleSlotInteraction for armor (since it expects an array)
                let tempArr = [armorSlot];
                if (handleSlotInteraction(tempArr, 0, true)) {
                    armorSlot = tempArr[0];
                    if (armorSlot === undefined) {
                        room.send("equip_armor", { type: 0 });
                    }
                    return;
                }
            }`;

if (content.includes(oldLogicSearch)) {
    content = content.replace(oldLogicSearch, oldLogicReplace);
    fs.writeFileSync('games/builder.js', content);
    console.log("Replaced interaction logic");
} else {
    console.log("Search string not found.");
}
