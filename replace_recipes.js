const fs = require('fs');
let content = fs.readFileSync('games/builder.js', 'utf8');

const searchVars = `    let dragSourceOutputSlot = false;
    let dragSourceArmorSlot = false;`;

const replaceVars = `    let dragSourceOutputSlot = false;
    let dragSourceArmorSlot = false;
    let showRecipes = false;`;

if (content.includes(searchVars)) {
    content = content.replace(searchVars, replaceVars);
    console.log("Replaced vars");
}

const searchRender = `            ctx.fillStyle = "#3f3f3f";
            ctx.font = "10px 'Press Start 2P', monospace";
            ctx.fillText(isCraftingTableOpen ? "Crafting Table" : "Crafting", craftStartX, craftStartY - 10);

            const size = isCraftingTableOpen ? 3 : 2;`;

const replaceRender = `            ctx.fillStyle = "#3f3f3f";
            ctx.font = "10px 'Press Start 2P', monospace";
            ctx.fillText(isCraftingTableOpen ? "Crafting Table" : "Crafting", craftStartX, craftStartY - 10);

            // Draw Recipe Book Toggle Button
            const recipeBtnX = craftStartX + 120;
            const recipeBtnY = craftStartY - 20;
            ctx.fillStyle = showRecipes ? "#4CAF50" : "#8b8b8b";
            ctx.fillRect(recipeBtnX, recipeBtnY, 60, 16);
            ctx.fillStyle = "#fff";
            ctx.font = "8px 'Press Start 2P', monospace";
            ctx.textAlign = "center";
            ctx.fillText("RECIPES", recipeBtnX + 30, recipeBtnY + 12);
            ctx.textAlign = "left";

            if (showRecipes) {
                // Draw Recipe Book Overlay
                ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
                ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
                ctx.fillStyle = "#fff";
                ctx.font = "10px 'Press Start 2P', monospace";
                ctx.fillText("Recipe Book", panel.x + 20, panel.y + 30);

                const recipes = [
                    { out: 9, in: [4] }, // Planks from Wood
                    { out: 10, in: [9, 9, 9, 9] }, // Crafting Table
                    { out: 11, in: [3, 3, 9] }, // Stone Sword
                    { out: 28, in: [13] }, // Copper Ammo
                    { out: 18, in: [13, 13, 13, 13, 13, 13] }, // Copper Armor
                    { out: 23, in: [13, 13, 13, 13, 13] } // Copper Gun
                ];

                for (let i = 0; i < recipes.length; i++) {
                    const rx = panel.x + 20 + Math.floor(i / 3) * 160;
                    const ry = panel.y + 60 + (i % 3) * 50;

                    // Out
                    drawItemIcon(ctx, recipes[i].out, rx, ry, 24);
                    ctx.fillText("=", rx + 30, ry + 16);

                    // In
                    for (let j = 0; j < recipes[i].in.length; j++) {
                        drawItemIcon(ctx, recipes[i].in[j], rx + 50 + (j * 14), ry + 4, 16);
                    }
                }

                // Draw close button
                ctx.fillStyle = "#f44336";
                ctx.fillRect(panel.x + panel.width - 80, panel.y + 10, 60, 20);
                ctx.fillStyle = "#fff";
                ctx.fillText("CLOSE", panel.x + panel.width - 70, panel.y + 24);

                return; // Skip drawing rest of inventory if recipes open
            }

            const size = isCraftingTableOpen ? 3 : 2;`;

if (content.includes(searchRender)) {
    content = content.replace(searchRender, replaceRender);
    console.log("Replaced render");
}

fs.writeFileSync('games/builder.js', content);
