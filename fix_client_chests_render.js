const fs = require('fs');
let code = fs.readFileSync('games/builder.js', 'utf8');

const uiRenderClient = `
            if (isChestOpen && currentChestId && room.state.chests.has(currentChestId)) {
                // Render Chest UI above inventory
                const chest = room.state.chests.get(currentChestId);
                const chestY = startY - totalHeight - 40;

                ctx.fillStyle = "#ffffff";
                ctx.font = "10px 'Press Start 2P', monospace";
                ctx.textAlign = "center";
                ctx.fillText("CHEST", canvas.width / 2, chestY - 10);

                for (let i = 0; i < 27; i++) {
                    const col = i % 9;
                    const row = Math.floor(i / 9);
                    const slotX = startX + col * (inventoryLayout.slotSize + inventoryLayout.gap);
                    const slotY = chestY + row * (inventoryLayout.slotSize + inventoryLayout.gap);

                    ctx.fillStyle = "#8b8b8b";
                    ctx.fillRect(slotX, slotY, inventoryLayout.slotSize, inventoryLayout.slotSize);

                    const item = chest.items.get(i.toString());
                    if (item) {
                        const inset = 6;
                        drawItemIcon(ctx, item.type, slotX + inset, slotY + inset, inventoryLayout.slotSize - (inset * 2));

                        ctx.fillStyle = "#ffffff";
                        ctx.font = "8px 'Press Start 2P', monospace";
                        ctx.textAlign = "right";
                        ctx.fillText(\`\${item.count}\`, slotX + inventoryLayout.slotSize - 2, slotY + inventoryLayout.slotSize - 4);
                    }
                }
            } else if (isFurnaceOpen && currentFurnaceId && room.state.furnaces.has(currentFurnaceId)) {
                // Render Furnace UI
                const furnace = room.state.furnaces.get(currentFurnaceId);
                const furY = startY - 120;
                const furX = canvas.width / 2;

                ctx.fillStyle = "#ffffff";
                ctx.font = "10px 'Press Start 2P', monospace";
                ctx.textAlign = "center";
                ctx.fillText("FURNACE", furX, furY - 10);

                // Input slot
                ctx.fillStyle = "#8b8b8b";
                ctx.fillRect(furX - 60, furY, 32, 32);
                if (furnace.inputCount > 0) drawItemIcon(ctx, furnace.inputItem, furX - 60 + 6, furY + 6, 20);

                // Fuel slot
                ctx.fillStyle = "#8b8b8b";
                ctx.fillRect(furX - 60, furY + 40, 32, 32);
                if (furnace.fuelCount > 0) drawItemIcon(ctx, furnace.fuelItem, furX - 60 + 6, furY + 40 + 6, 20);

                // Output slot
                ctx.fillStyle = "#8b8b8b";
                ctx.fillRect(furX + 30, furY + 20, 32, 32);
                if (furnace.outputCount > 0) drawItemIcon(ctx, furnace.outputItem, furX + 30 + 6, furY + 20 + 6, 20);

                // Progress bar
                ctx.fillStyle = "#333";
                ctx.fillRect(furX - 20, furY + 28, 40, 16);
                ctx.fillStyle = "#ff6600";
                ctx.fillRect(furX - 20, furY + 28, (furnace.progress / 100) * 40, 16);
            } else {
                // Render Crafting UI
                const size = isCraftingTableOpen ? 3 : 2;
                const craftStartX = (canvas.width - (size * (inventoryLayout.slotSize + inventoryLayout.gap))) / 2;
                const craftStartY = startY - (size * (inventoryLayout.slotSize + inventoryLayout.gap)) - 40;
`;

if (!code.includes('isChestOpen && currentChestId')) {
    code = code.replace(/            const startY = canvas\.height - totalHeight - 60; \/\/ Just above hotbar[\s\S]*?const craftStartX = \(canvas\.width - \(size \* \(inventoryLayout\.slotSize \+ inventoryLayout\.gap\)\)\) \/ 2;[\s\S]*?const craftStartY = startY - \(size \* \(inventoryLayout\.slotSize \+ inventoryLayout\.gap\)\) - 40;/, `            const startY = canvas.height - totalHeight - 60; // Just above hotbar\n\n${uiRenderClient.trim()}`);
}

fs.writeFileSync('games/builder.js', code);
