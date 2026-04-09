const fs = require('fs');
let code = fs.readFileSync('games/builder.js', 'utf8');

const uiRenderClient = `
        if (inventoryOpen) {
            const panel = getInventoryBounds();
            const { rows, startX, startY } = getInventoryMetrics(panel);

            ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Chest or Furnace rendering logic
            if (isChestOpen && currentChestId && room.state.chests && room.state.chests.has(currentChestId)) {
                // Render Chest UI
                const chest = room.state.chests.get(currentChestId);
                const chestY = startY - 140;

                ctx.fillStyle = "#c6c6c6"; // Panel color
                ctx.fillRect(panel.x, chestY - 10, panel.width, 130);

                ctx.fillStyle = "#3f3f3f";
                ctx.font = "8px 'Press Start 2P', monospace";
                ctx.textAlign = "left";
                ctx.fillText("Chest", panel.x + 10, chestY + 5);

                for (let i = 0; i < 27; i++) {
                    const col = i % 9;
                    const row = Math.floor(i / 9);
                    const slotX = startX + col * (32 + 4);
                    const slotY = chestY + 15 + row * (32 + 4);

                    ctx.fillStyle = "#8b8b8b";
                    ctx.fillRect(slotX, slotY, 32, 32);
                    ctx.strokeStyle = "#373737"; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(slotX, slotY + 32); ctx.lineTo(slotX, slotY); ctx.lineTo(slotX + 32, slotY); ctx.stroke();
                    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(slotX, slotY + 32); ctx.lineTo(slotX + 32, slotY + 32); ctx.lineTo(slotX + 32, slotY); ctx.stroke();

                    const item = chest.items.get(i.toString());
                    if (item) {
                        drawItemIcon(ctx, item.type, slotX + 6, slotY + 6, 20);
                        ctx.fillStyle = "#ffffff";
                        ctx.font = "8px 'Press Start 2P', monospace";
                        ctx.textAlign = "right";
                        ctx.fillText(\`\${item.count}\`, slotX + 30, slotY + 28);
                    }
                }
            } else if (isFurnaceOpen && currentFurnaceId && room.state.furnaces && room.state.furnaces.has(currentFurnaceId)) {
                // Render Furnace UI
                const furnace = room.state.furnaces.get(currentFurnaceId);
                const furY = startY - 120;
                const furX = canvas.width / 2;

                ctx.fillStyle = "#c6c6c6"; // Panel color
                ctx.fillRect(furX - 100, furY - 10, 200, 100);

                ctx.fillStyle = "#3f3f3f";
                ctx.font = "8px 'Press Start 2P', monospace";
                ctx.textAlign = "center";
                ctx.fillText("Furnace", furX, furY + 5);

                const drawSlot = (x, y, itemType, itemCount) => {
                    ctx.fillStyle = "#8b8b8b";
                    ctx.fillRect(x, y, 32, 32);
                    ctx.strokeStyle = "#373737"; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(x, y + 32); ctx.lineTo(x, y); ctx.lineTo(x + 32, y); ctx.stroke();
                    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(x, y + 32); ctx.lineTo(x + 32, y + 32); ctx.lineTo(x + 32, y); ctx.stroke();
                    if (itemCount > 0) {
                        drawItemIcon(ctx, itemType, x + 6, y + 6, 20);
                        ctx.fillStyle = "#ffffff";
                        ctx.font = "8px 'Press Start 2P', monospace";
                        ctx.textAlign = "right";
                        ctx.fillText(\`\${itemCount}\`, x + 30, y + 28);
                    }
                };

                drawSlot(furX - 60, furY + 15, furnace.inputItem, furnace.inputCount);
                drawSlot(furX - 60, furY + 55, furnace.fuelItem, furnace.fuelCount);
                drawSlot(furX + 30, furY + 35, furnace.outputItem, furnace.outputCount);

                // Progress
                ctx.fillStyle = "#333";
                ctx.fillRect(furX - 15, furY + 42, 30, 10);
                ctx.fillStyle = "#ff6600";
                ctx.fillRect(furX - 15, furY + 42, (furnace.progress / 100) * 30, 10);
            }

            // Minecraft inventory panel style
`;

code = code.replace(/        if \(inventoryOpen\) \{\n            const panel = getInventoryBounds\(\);\n            const \{ rows, startX, startY \} = getInventoryMetrics\(panel\);\n\n            ctx\.fillStyle = "rgba\(0, 0, 0, 0\.45\)";\n            ctx\.fillRect\(0, 0, canvas\.width, canvas\.height\);\n\n            \/\/ Minecraft inventory panel style/, uiRenderClient.trim());

fs.writeFileSync('games/builder.js', code);
