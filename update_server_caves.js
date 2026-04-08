const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

const generateChunkFuncRegex = /generateChunk\(cx, cy\) \{[\s\S]*?chunk\.blocks\.set\(`\$\{worldX\},\$\{y\}`\, b\);\n\s*\}\n\s*\}/m;

// In generateChunk, we want to replace the standard solid block generation with one that checks layered noise
const chunkGenReplacement = `generateChunk(cx, cy) {
    const key = \`\${cx},\${cy}\`;
    if (this.state.chunks.has(key)) return;

    const chunk = new Chunk();
    this.state.chunks.set(key, chunk); // Set early to avoid re-generation

    const minY = cy * CHUNK_SIZE;
    const maxY = (cy + 1) * CHUNK_SIZE;

    // 1. Generate Ground with Caves
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const worldX = cx * CHUNK_SIZE + x;
      const h = this.getSurfaceHeight(worldX);

      const startY = Math.max(minY, h);
      const endY = Math.min(maxY, h + 40);

      for (let y = startY; y < endY; y++) {
        // Cave generation using 2D noise
        // Using a combination of x and y to create organic tunnels
        // Scale needs to be relatively large for good tunnel sizes
        const caveNoise = layeredNoise(worldX, y, 3, 0.5, 0.05);

        // Let's create a threshold for caves. e.g. if the noise is between -0.2 and 0.2, it's a cave
        // Or if layeredNoise returns 0 to 1, say if it's > 0.4 it's a cave.
        // layeredNoise internally uses perlin noise which is typically -1 to 1 but here total is accumulated.
        // Let's use absolute value or sin mapping to get tunnels
        const isCave = Math.abs(caveNoise) < 0.25 && y >= h;

        if (!isCave) {
            const b = new Block();
            b.x = worldX;
            b.y = y;
            if (y === h) b.type = 1; // Grass
            else if (y < h + 4) b.type = 2; // Dirt
            else b.type = 3; // Stone
            chunk.blocks.set(\`\${worldX},\${y}\`, b);
        }
      }
    }`;

content = content.replace(generateChunkFuncRegex, chunkGenReplacement);

fs.writeFileSync('server.js', content);
