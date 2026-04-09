const fs = require('fs');
let content = fs.readFileSync('games/builder.js', 'utf8');

const oldLogicSearch = `    function handleMouseUp() {
        if (inventoryOpen && draggedItemType !== null) {
            setTimeout(() => saveInventoryState(), 10);`;

const oldLogicReplace = `    function handleMouseUp() {
        mouse.isDown = false;
        clearBuildHoldTimers();
        if (inventoryOpen && draggedItemType !== null) {
            setTimeout(() => saveInventoryState(), 10);
            const hotbarPanel = getHotbarBounds();
            const hotbarIndex = getHotbarIndexAt(mouse.x, mouse.y, hotbarPanel);

            const inventoryPanel = getInventoryBounds();
            const inventoryIndex = getInventorySlotAt(mouse.x, mouse.y, inventoryPanel);

            // If we are dropping the item outside all panels
            if (hotbarIndex === null && inventoryIndex === null &&
                !(mouse.x >= inventoryPanel.x && mouse.x <= inventoryPanel.x + inventoryPanel.width &&
                  mouse.y >= inventoryPanel.y && mouse.y <= inventoryPanel.y + inventoryPanel.height) &&
                !(mouse.x >= hotbarPanel.x && mouse.x <= hotbarPanel.x + hotbarPanel.width &&
                  mouse.y >= hotbarPanel.y && mouse.y <= hotbarPanel.y + hotbarPanel.height)) {

                // Drop on ground
                room.send("spawn_drops", { items: [{ type: draggedItemType.type, count: draggedItemType.count }] });
                draggedItemType = null;
                saveInventoryState();
                return;
            }`;

if (content.includes(oldLogicSearch)) {
    content = content.replace(oldLogicSearch, oldLogicReplace);
    fs.writeFileSync('games/builder.js', content);
    console.log("Replaced handleMouseUp");
} else {
    console.log("Search not found.");
}
