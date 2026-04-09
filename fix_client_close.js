const fs = require('fs');
let code = fs.readFileSync('games/builder.js', 'utf8');

const keyClose = `
        if (e.key === "e" || e.key === "E" || e.key === "i" || e.key === "I") {
            inventoryOpen = !inventoryOpen;

            // If opening inventory, make sure we show 2x2 grid not 3x3 table
            if (inventoryOpen) {
                isCraftingTableOpen = false;
                // isChestOpen and isFurnaceOpen handles separately via interaction
            } else {
                returnCraftingItems();
                isChestOpen = false;
                isFurnaceOpen = false;
            }

            // Cancel drag if we close inventory while dragging
            if (!inventoryOpen && draggedItemType !== null) {
                if (dragSourceHotbarIndex !== null) {
                    hotbarSlots[dragSourceHotbarIndex] = cloneItem(draggedItemType);
                } else if (dragSourceInventoryIndex !== null) {
                    inventorySlots[dragSourceInventoryIndex] = cloneItem(draggedItemType);
                }
                draggedItemType = null;
            }
        }
        if (e.key === "Escape") {
            inventoryOpen = false;
            isCraftingTableOpen = false;
            isChestOpen = false;
            isFurnaceOpen = false;
            returnCraftingItems();
            if (draggedItemType !== null) {
                if (dragSourceHotbarIndex !== null) {
                    hotbarSlots[dragSourceHotbarIndex] = cloneItem(draggedItemType);
                } else if (dragSourceInventoryIndex !== null) {
                    inventorySlots[dragSourceInventoryIndex] = cloneItem(draggedItemType);
                }
                draggedItemType = null;
            }
        }
`;

code = code.replace(/        if \(e\.key === "i" \|\| e\.key === "I"\) \{[\s\S]*?draggedItemType = null;\n            \}\n        \}/, keyClose.trim());

fs.writeFileSync('games/builder.js', code);
