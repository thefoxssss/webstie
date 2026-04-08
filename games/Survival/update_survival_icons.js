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
                ctx.fillRect(size * 0.8, 0.8, 2, 2);
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

// Insert the drawItemIcon function right after the startGameLoop function, or maybe before the render loop
content = content.replace("function startGameLoop() {", drawIconCode + "\n    function startGameLoop() {");

// Replace all instances of `ctx.fillStyle = blockColors[item.type]; ctx.fillRect(...)` in UI with the new function
const fillRectRegex = /ctx\.fillStyle = blockColors\[item\.type\];\s*const inset = 6;\s*ctx\.fillRect\(slotX \+ inset, slotY \+ inset, [^,]+, [^\)]+\);/g;

content = content.replace(fillRectRegex, "const inset = 6;\n                        drawItemIcon(ctx, item.type, slotX + inset, slotY + inset, hotbarLayout.slotSize - (inset * 2));");

// Now we need to fix the specific occurrences.
fs.writeFileSync('games/survival_tmp.js', content);
