const fs = require('fs');
const filepath = 'games/builder.js';
let content = fs.readFileSync(filepath, 'utf8');

// Find drawItemIcon
const funcRegex = /function drawItemIcon\(ctx, type, x, y, size\) \{([\s\S]*?)\}/;
const match = content.match(funcRegex);

if (match) {
    let body = match[1];
    if (!body.includes('// Sword')) {
        let newBody = `
    const margin = size * 0.1;
    const drawSize = size - margin * 2;
    const drawX = x + margin;
    const drawY = y + margin;

    if (type === 11) {
        // Sword icon (diagonal drawing)
        ctx.fillStyle = "#888"; // Blade
        ctx.fillRect(drawX + drawSize * 0.3, drawY, drawSize * 0.4, drawSize * 0.7);
        ctx.fillStyle = "#5c4033"; // Hilt
        ctx.fillRect(drawX + drawSize * 0.4, drawY + drawSize * 0.7, drawSize * 0.2, drawSize * 0.3);
        ctx.fillStyle = "#444"; // Crossguard
        ctx.fillRect(drawX + drawSize * 0.2, drawY + drawSize * 0.6, drawSize * 0.6, drawSize * 0.1);
        return;
    }

    // Default block rendering
    const colors = {
        0: '#87CEEB', // Sky
        1: '#8B4513', // Dirt
        2: '#654321', // Dark Dirt
        3: '#808080', // Stone
        4: '#D2B48C', // Sand
        5: '#5C4033', // Wood
        6: '#228B22', // Leaves
        7: '#FFFFFF', // Cloud
        8: '#B22222', // Brick
        9: '#0000FF', // Water
        10: '#228B22' // Grass
    };

    ctx.fillStyle = colors[type] || '#000';
    ctx.fillRect(drawX, drawY, drawSize, drawSize);

    // Add simple outline or inner detail to make it look like an icon
    if (type !== 0 && type !== 7 && type !== 9) { // Don't outline sky, cloud, water
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 1;
        ctx.strokeRect(drawX, drawY, drawSize, drawSize);
    }
`;
        content = content.replace(match[0], "function drawItemIcon(ctx, type, x, y, size) {" + newBody + "}");
        fs.writeFileSync(filepath, content);
        console.log("Updated drawItemIcon");
    } else {
        console.log("drawItemIcon already has sword logic");
    }
}
