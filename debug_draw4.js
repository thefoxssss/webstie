const fs = require('fs');
const code = fs.readFileSync('games/shadow-assassin-safe-rooms.html', 'utf8');
const lines = code.split('\n');

// Find the line that closes the main else block (before post-processing)
let updateRoomStateIndex = lines.findIndex(l => l.includes('currentRoom.updateRoomState();'));

for (let j = Math.max(0, updateRoomStateIndex - 5); j <= Math.min(lines.length - 1, updateRoomStateIndex + 10); j++) {
    console.log(`${j + 1}: ${lines[j]}`);
}
