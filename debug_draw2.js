const fs = require('fs');
const code = fs.readFileSync('games/shadow-assassin-safe-rooms.html', 'utf8');
const lines = code.split('\n');

// Find the end of gameLoop
let endIndex = lines.findIndex(l => l.includes('requestAnimationFrame(gameLoop);'));

for (let j = Math.max(0, endIndex - 50); j <= endIndex; j++) {
    console.log(`${j + 1}: ${lines[j].trim()}`);
}
