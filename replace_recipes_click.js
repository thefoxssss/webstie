const fs = require('fs');
let content = fs.readFileSync('games/builder.js', 'utf8');

const searchClick = `        // Handle inventory and dragging mechanics first
        if (inventoryOpen) {
            const isRightClick = e.button === 2;`;

const replaceClick = `        // Handle inventory and dragging mechanics first
        if (inventoryOpen) {
            const panel = getInventoryBounds();

            if (showRecipes) {
                // Check close button
                if (mouse.x >= panel.x + panel.width - 80 && mouse.x <= panel.x + panel.width - 20 &&
                    mouse.y >= panel.y + 10 && mouse.y <= panel.y + 30) {
                    showRecipes = false;
                }
                return; // Prevent other interactions while recipes are open
            }

            // Check Recipe Button toggle
            const craftStartX = panel.x + panel.width - 190;
            const craftStartY = panel.y + 40;
            const recipeBtnX = craftStartX + 120;
            const recipeBtnY = craftStartY - 20;
            if (mouse.x >= recipeBtnX && mouse.x <= recipeBtnX + 60 &&
                mouse.y >= recipeBtnY && mouse.y <= recipeBtnY + 16) {
                showRecipes = true;
                return;
            }

            const isRightClick = e.button === 2;`;

if (content.includes(searchClick)) {
    content = content.replace(searchClick, replaceClick);
    console.log("Replaced click");
}

fs.writeFileSync('games/builder.js', content);
