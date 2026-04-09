const fs = require('fs');
let content = fs.readFileSync('games/builder.js', 'utf8');

const handleMouseDownSearch = `    function handleMouseDown(e) {
        if (!room) return;

        // Handle inventory and dragging mechanics first
        if (inventoryOpen) {`;

const handleMouseDownReplace = `    function handleMouseDown(e) {
        if (!room) return;

        // Handle inventory and dragging mechanics first
        if (inventoryOpen) {
            const isRightClick = e.button === 2;

            // Helper function to handle pickup/drop logic for slots
            const handleSlotInteraction = (slotArray, index, isArmor = false) => {
                if (draggedItemType === null) {
                    if (slotArray[index] !== undefined) {
                        if (isRightClick) {
                            // Split stack
                            const currentItem = slotArray[index];
                            if (currentItem.count > 1) {
                                const splitCount = Math.floor(currentItem.count / 2);
                                draggedItemType = { type: currentItem.type, count: splitCount };
                                currentItem.count -= splitCount;
                                dragSourceHotbarIndex = null;
                                dragSourceInventoryIndex = null;
                                dragSourceCraftingIndex = null;
                                dragSourceOutputSlot = false;
                                dragSourceArmorSlot = false;
                                saveInventoryState();
                            } else {
                                // Just pick it up if it's 1
                                draggedItemType = cloneItem(slotArray[index]);
                                dragSourceHotbarIndex = slotArray === hotbarSlots ? index : null;
                                dragSourceInventoryIndex = slotArray === inventorySlots ? index : null;
                                dragSourceArmorSlot = isArmor;
                                slotArray[index] = undefined;
                                saveInventoryState();
                            }
                        } else {
                            // Left click pickup
                            draggedItemType = cloneItem(slotArray[index]);
                            dragSourceHotbarIndex = slotArray === hotbarSlots ? index : null;
                            dragSourceInventoryIndex = slotArray === inventorySlots ? index : null;
                            dragSourceArmorSlot = isArmor;
                            slotArray[index] = undefined;
                            saveInventoryState();
                        }
                    }
                } else {
                    // We are holding an item
                    if (isRightClick) {
                        // Place 1 item
                        if (slotArray[index] === undefined) {
                            slotArray[index] = { type: draggedItemType.type, count: 1 };
                            draggedItemType.count -= 1;
                            if (draggedItemType.count <= 0) draggedItemType = null;
                            saveInventoryState();
                        } else if (slotArray[index].type === draggedItemType.type && slotArray[index].count < getMaxStack(slotArray[index].type)) {
                            slotArray[index].count += 1;
                            draggedItemType.count -= 1;
                            if (draggedItemType.count <= 0) draggedItemType = null;
                            saveInventoryState();
                        }
                    } else {
                        // Left click place
                        if (slotArray[index] === undefined) {
                            slotArray[index] = cloneItem(draggedItemType);
                            draggedItemType = null;
                            saveInventoryState();
                        } else if (slotArray[index].type === draggedItemType.type) {
                            // Merge
                            const space = getMaxStack(slotArray[index].type) - slotArray[index].count;
                            if (space > 0) {
                                const addCount = Math.min(space, draggedItemType.count);
                                slotArray[index].count += addCount;
                                draggedItemType.count -= addCount;
                                if (draggedItemType.count <= 0) draggedItemType = null;
                                saveInventoryState();
                            }
                        } else {
                            // Swap
                            const temp = cloneItem(slotArray[index]);
                            slotArray[index] = cloneItem(draggedItemType);
                            draggedItemType = temp;
                            saveInventoryState();
                        }
                    }
                }
                return true;
            };`;

if (content.includes(handleMouseDownSearch)) {
    content = content.replace(handleMouseDownSearch, handleMouseDownReplace);
    console.log("Replaced start");
}

fs.writeFileSync('games/builder.js', content);
