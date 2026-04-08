const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

// The noise test shows caves are WAY too frequent with the parameters `< 0.25`
// and the fact that perlin noise is clustered around 0.
// Let's modify the cave threshold.
// Usually for "Minecraft like worms", Perlin noise absolute value < threshold creates worms.
// Let's change the scale to be larger (tighter features) and lower the threshold so it's only small tunnels.

content = content.replace(
    'const caveNoise = layeredNoise(worldX, y, 3, 0.5, 0.05);',
    'const caveNoise = layeredNoise(worldX, y, 3, 0.5, 0.1);' // Higher frequency for tunnels
);

content = content.replace(
    'const isCave = Math.abs(caveNoise) < 0.25 && y >= h;',
    'const isCave = Math.abs(caveNoise) < 0.08 && y >= h;' // Lower threshold = thinner, rarer tunnels
);

fs.writeFileSync('server.js', content);
