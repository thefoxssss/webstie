const fs = require('fs');
let content = fs.readFileSync('games/builder.js', 'utf8');

const search = `        }
        mouse.isDown = false;
        clearBuildHoldTimers();

        // Handle dropping a dragged item
        if (inventoryOpen && draggedItemType !== null) {
            const hotbarPanel = getHotbarBounds();
            const hotbarIndex = getHotbarIndexAt(mouse.x, mouse.y, hotbarPanel);

            const inventoryPanel = getInventoryBounds();
            const inventoryIndex = getInventorySlotAt(mouse.x, mouse.y, inventoryPanel);`;
const replace = ``;

if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync('games/builder.js', content);
    console.log("Replaced extra clear");
}
