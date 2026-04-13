const fs = require('fs');
let code = fs.readFileSync('games/builder.js', 'utf8');

// Replace furnace interaction coordinates
const interactionSearch = `            } else if (isFurnaceOpen && currentFurnaceId && room.state.furnaces && room.state.furnaces.has(currentFurnaceId)) {
                const furnace = room.state.furnaces.get(currentFurnaceId);
                const { startX, startY } = getInventoryMetrics(panel);
                const furY = startY - 120;
                const furX = canvas.width / 2;`;

const interactionReplace = `            } else if (isFurnaceOpen && currentFurnaceId && room.state.furnaces && room.state.furnaces.has(currentFurnaceId)) {
                const furnace = room.state.furnaces.get(currentFurnaceId);
                const craftStartX = panel.x + panel.width - inventoryLayout.padding - 110;
                const craftStartY = panel.y + 45;
                const furX = craftStartX + 55;
                const furY = craftStartY + 45;`;

code = code.replace(interactionSearch, interactionReplace);

// Replace furnace rendering coordinates and hide crafting table
const renderSearch = `            if (!isChestOpen && !isFurnaceOpen && !showRecipes) {
                // Crafting Area
                const craftStartX = panel.x + panel.width - inventoryLayout.padding - 110;
                const craftStartY = panel.y + 45;
                ctx.fillStyle = "#3f3f3f";
                ctx.font = "8px 'Press Start 2P', monospace";
                ctx.textAlign = "center";
                ctx.fillText("Crafting", craftStartX + 55, craftStartY - 10);`;

const renderReplace = `            if (!isChestOpen && !isFurnaceOpen && !showRecipes) {
                // Crafting Area
                const craftStartX = panel.x + panel.width - inventoryLayout.padding - 110;
                const craftStartY = panel.y + 45;
                ctx.fillStyle = "#3f3f3f";
                ctx.font = "8px 'Press Start 2P', monospace";
                ctx.textAlign = "center";
                ctx.fillText("Crafting", craftStartX + 55, craftStartY - 10);`;

const furnaceRenderSearch = `            } else if (isFurnaceOpen && currentFurnaceId && room.state.furnaces && room.state.furnaces.has(currentFurnaceId)) {
                // Render Furnace UI
                const furnace = room.state.furnaces.get(currentFurnaceId);
                const furY = startY - 120;
                const furX = canvas.width / 2;

                ctx.fillStyle = "#c6c6c6"; // Panel color
                ctx.fillRect(furX - 100, furY - 10, 200, 100);

                ctx.fillStyle = "#3f3f3f";
                ctx.font = "8px 'Press Start 2P', monospace";
                ctx.textAlign = "center";
                ctx.fillText("Furnace", furX, furY + 5);`;

const furnaceRenderReplace = `            } else if (isFurnaceOpen && currentFurnaceId && room.state.furnaces && room.state.furnaces.has(currentFurnaceId)) {
                // Render Furnace UI
                const furnace = room.state.furnaces.get(currentFurnaceId);
                const craftStartX = panel.x + panel.width - inventoryLayout.padding - 110;
                const craftStartY = panel.y + 45;
                const furX = craftStartX + 55;
                const furY = craftStartY + 45;

                ctx.fillStyle = "#3f3f3f";
                ctx.font = "8px 'Press Start 2P', monospace";
                ctx.textAlign = "center";
                ctx.fillText("Furnace", furX, craftStartY - 10);`;

code = code.replace(furnaceRenderSearch, furnaceRenderReplace);

fs.writeFileSync('games/builder.js', code);
console.log("Done");
