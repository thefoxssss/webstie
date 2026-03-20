const fs = require('fs');
const code = fs.readFileSync('games/shadow-assassin-safe-rooms.html', 'utf8');
const lines = code.split('\n');

// Find the line that closes the main else block (before post-processing)
let vignetteIndex = lines.findIndex(l => l.includes('// Dark vignette'));

for (let j = Math.max(0, vignetteIndex - 15); j <= Math.min(lines.length - 1, vignetteIndex + 10); j++) {
    console.log(`${j + 1}: ${lines[j]}`);
}
