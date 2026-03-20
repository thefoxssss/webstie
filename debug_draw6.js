const fs = require('fs');
const code = fs.readFileSync('games/shadow-assassin-safe-rooms.html', 'utf8');
const lines = code.split('\n');

// Find closing brace of `if (gameStarted && !gameOver && !showingUpgrade)` starting at 10502
for (let j = 10502; j <= 10560; j++) {
    if (lines[j].trim() === '}') {
        console.log(`Line ${j+1}: ${lines[j]}`);
    }
}
