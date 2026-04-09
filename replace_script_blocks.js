const fs = require('fs');
let content = fs.readFileSync('games/builder.js', 'utf8');

const drawBlockSearch = `        // Draw blocks (chunked)
        room.state.chunks.forEach((chunk) => {
          chunk.blocks.forEach((block) => {
            ctx.fillStyle = blockColors[block.type] || "#ffffff";
            ctx.fillRect(block.x * TILE_SIZE, block.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          });
        });`;

const drawBlockReplace = `        // Draw blocks (chunked)
        room.state.chunks.forEach((chunk) => {
          chunk.blocks.forEach((block) => {
            if (assetsLoaded && blockImages[block.type]) {
                ctx.drawImage(blockImages[block.type], block.x * TILE_SIZE, block.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            } else {
                ctx.fillStyle = blockColors[block.type] || "#ffffff";
                ctx.fillRect(block.x * TILE_SIZE, block.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
          });
        });`;

if (content.includes(drawBlockSearch)) {
    content = content.replace(drawBlockSearch, drawBlockReplace);
    console.log("Replaced blocks draw.");
} else {
    console.log("Draw block search not found.");
}

fs.writeFileSync('games/builder.js', content);
