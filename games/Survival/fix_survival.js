const fs = require('fs');

let content = fs.readFileSync('games/Survival/survival.js', 'utf8');

const drawIconCode = `
    function drawItemIcon(ctx, type, x, y, size) {
        ctx.save();
        ctx.translate(x, y);

        if (type === 11) { // Sword
            // Draw sword diagonally
            ctx.translate(size/2, size/2);
            ctx.rotate(-Math.PI / 4);

            // Blade
            ctx.fillStyle = "#808080";
            ctx.fillRect(-2, -size/2 + 2, 4, size * 0.6);

            // Handle
            ctx.fillStyle = "#8b5a2b";
            ctx.fillRect(-2, size/2 - size * 0.4 + 2, 4, size * 0.3);

            // Crossguard
            ctx.fillStyle = "#000";
            ctx.fillRect(-6, size/2 - size * 0.4 + 2, 12, 3);

        } else {
            // Standard block base
            ctx.fillStyle = blockColors[type] || "#ffffff";
            ctx.fillRect(0, 0, size, size);

            // Texture details based on type
            ctx.fillStyle = "rgba(0,0,0,0.2)";
            if (type === 1) { // Grass: green top, dirt bottom
                ctx.fillStyle = blockColors[2]; // Dirt color
                ctx.fillRect(0, size * 0.3, size, size * 0.7);
            } else if (type === 3) { // Stone: speckles
                ctx.fillRect(size * 0.2, size * 0.2, size * 0.2, size * 0.2);
                ctx.fillRect(size * 0.6, size * 0.5, size * 0.2, size * 0.2);
                ctx.fillRect(size * 0.3, size * 0.7, size * 0.2, size * 0.2);
            } else if (type === 4 || type === 7 || type === 9) { // Wood variants: lines
                ctx.fillRect(size * 0.2, 0, 2, size);
                ctx.fillRect(size * 0.6, 0, 2, size);
            } else if (type === 5) { // Glass: shine
                ctx.fillStyle = "rgba(255,255,255,0.5)";
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(size * 0.5, 0);
                ctx.lineTo(0, size * 0.5);
                ctx.fill();
            } else if (type === 6) { // Brick: mortar lines
                ctx.fillStyle = "rgba(200,200,200,0.5)";
                ctx.fillRect(0, size * 0.4, size, 2);
                ctx.fillRect(size * 0.5, 0, 2, size * 0.4);
                ctx.fillRect(size * 0.2, size * 0.4, 2, size * 0.6);
            } else if (type === 8) { // Leaves: dots
                ctx.fillRect(size * 0.2, size * 0.2, 2, 2);
                ctx.fillRect(size * 0.7, size * 0.3, 2, 2);
                ctx.fillRect(size * 0.4, size * 0.6, 2, 2);
                ctx.fillRect(size * 0.8, size * 0.8, 2, 2);
            } else if (type === 10) { // Crafting table
                ctx.fillStyle = "#5c3a21";
                ctx.fillRect(0, 0, size, size * 0.2); // Top rim
                ctx.fillStyle = "#000";
                ctx.fillRect(size * 0.2, 0, 2, size * 0.2); // Grid lines on top
                ctx.fillRect(size * 0.6, 0, 2, size * 0.2);
            }

            // Outline
            ctx.strokeStyle = "rgba(0,0,0,0.5)";
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, size, size);
        }

        ctx.restore();
    }
`;

if (!content.includes('function drawItemIcon')) {
    content = content.replace('function startGameLoop() {', drawIconCode + '\n    function startGameLoop() {');
}

// Replace hotbar drawing
content = content.replace(/ctx\.fillStyle = blockColors\[item\.type\];\s*const inset = 6;\s*ctx\.fillRect\(slotX \+ inset, slotY \+ inset, hotbarLayout\.slotSize - \(inset \* 2\), hotbarLayout\.slotSize - \(inset \* 2\)\);/g,
    'const inset = 6;\n                drawItemIcon(ctx, item.type, slotX + inset, slotY + inset, hotbarLayout.slotSize - (inset * 2));');

// Replace grid drawing
content = content.replace(/ctx\.fillStyle = blockColors\[item\.type\];\s*const inset = 6;\s*ctx\.fillRect\(slotX \+ inset, slotY \+ inset, inventoryLayout\.slotSize - \(inset \* 2\), inventoryLayout\.slotSize - \(inset \* 2\)\);/g,
    'const inset = 6;\n                        drawItemIcon(ctx, item.type, slotX + inset, slotY + inset, inventoryLayout.slotSize - (inset * 2));');

// Replace output slot drawing
content = content.replace(/ctx\.fillStyle = blockColors\[craftingOutputSlot\.type\];\s*const inset = 6;\s*ctx\.fillRect\(outX \+ inset, outY \+ inset, inventoryLayout\.slotSize - \(inset \* 2\), inventoryLayout\.slotSize - \(inset \* 2\)\);/g,
    'const inset = 6;\n                drawItemIcon(ctx, craftingOutputSlot.type, outX + inset, outY + inset, inventoryLayout.slotSize - (inset * 2));');

// Replace drag cursor drawing
content = content.replace(/ctx\.fillStyle = blockColors\[draggedItemType\.type\] \|\| "#ffffff";\s*\/\/ Center the block on the mouse cursor\s*ctx\.fillRect\(mouse\.x - drawSize \/ 2, mouse\.y - drawSize \/ 2, drawSize, drawSize\);/g,
    '// Center the block on the mouse cursor\n                drawItemIcon(ctx, draggedItemType.type, mouse.x - drawSize / 2, mouse.y - drawSize / 2, drawSize);');


// Fix max stack to 1 for sword, 99 for others
// Look for where hotbarSlots[i].count < 99 and replace with dynamic max stack
content = content.replace(/const getMaxStack = \(type\) => type === 11 \? 1 : 99;/g, ""); // Remove if already exists
content = content.replace(/const getMergedInventoryType = \(type\) => type;/g, "const getMergedInventoryType = (type) => type;\n    const getMaxStack = (type) => type === 11 ? 1 : 99;");


content = content.replace(/hotbarSlots\[i\]\.count < 99/g, "hotbarSlots[i].count < getMaxStack(mergedType)");
content = content.replace(/99 - hotbarSlots\[i\]\.count/g, "getMaxStack(mergedType) - hotbarSlots[i].count");

content = content.replace(/inventorySlots\[i\]\.count < 99/g, "inventorySlots[i].count < getMaxStack(mergedType)");
content = content.replace(/99 - inventorySlots\[i\]\.count/g, "getMaxStack(mergedType) - inventorySlots[i].count");

// Also check any other direct 99 references
content = content.replace(/count < 99/g, "count < getMaxStack(mergedType)");

fs.writeFileSync('games/Survival/survival.js', content);
