const fs = require('fs');
let code = fs.readFileSync('games/builder.js', 'utf8');

const tntInteractClient = `
        if (e.button === 2 && !e.shiftKey) {
            const worldX = mouse.x + camera.x;
            const worldY = mouse.y + camera.y;
            const tileX = Math.floor(worldX / TILE_SIZE);
            const tileY = Math.floor(worldY / TILE_SIZE);
            const chunkX = Math.floor(tileX / CHUNK_SIZE);
            const chunkY = Math.floor(tileY / CHUNK_SIZE);
            const chunk = room.state.chunks.get(\`\${chunkX},\${chunkY}\`);
            if (chunk) {
                const block = chunk.blocks.get(\`\${tileX},\${tileY}\`);
                if (block && block.type === 10) { // Crafting Table
                    inventoryOpen = true;
                    isCraftingTableOpen = true;
                    return;
                } else if (block && block.type === 31) { // Chest
                    room.send("interact", { x: worldX, y: worldY }); // register it
                    inventoryOpen = true;
                    isChestOpen = true;
                    currentChestId = \`\${tileX},\${tileY}\`;
                    return;
                } else if (block && block.type === 32) { // Furnace
                    room.send("interact", { x: worldX, y: worldY });
                    inventoryOpen = true;
                    isFurnaceOpen = true;
                    currentFurnaceId = \`\${tileX},\${tileY}\`;
                    return;
                } else if (block && (block.type === 33 || block.type === 34)) { // TNT/Nuke
                    room.send("interact", { x: worldX, y: worldY });
                    return;
                }
            }
        }
`;

code = code.replace(/        if \(e\.button === 2 && !e\.shiftKey\) \{[\s\S]*?room\.send\("interact", \{ x: worldX, y: worldY \}\);\n                    return;\n                \}\n            \}\n        \}/, tntInteractClient.trim());

fs.writeFileSync('games/builder.js', code);
