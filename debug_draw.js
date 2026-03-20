const fs = require('fs');
const code = fs.readFileSync('games/shadow-assassin-safe-rooms.html', 'utf8');
const lines = code.split('\n');

// Find hitStopFrames block
let hitStopIndex = lines.findIndex(l => l.includes('if (hitStopFrames > 0) {'));

for (let j = Math.max(0, hitStopIndex - 10); j <= Math.min(lines.length - 1, hitStopIndex + 35); j++) {
    console.log(`${j + 1}: ${lines[j].trim()}`);
}
