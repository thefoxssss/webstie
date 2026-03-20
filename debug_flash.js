const fs = require('fs');
const code = fs.readFileSync('games/shadow-assassin-safe-rooms.html', 'utf8');
const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('fillRect(0, 0, canvas.width, canvas.height)')) {
        console.log(`\n--- Line ${i + 1} Context ---`);
        for (let j = Math.max(0, i - 10); j <= Math.min(lines.length - 1, i + 10); j++) {
            console.log(`${j + 1}: ${lines[j].trim()}`);
        }
    }
}
