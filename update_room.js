const fs = require('fs');
const content = fs.readFileSync('games/shadow-assassin-safe-rooms.html', 'utf8');

const isPuzzleMatch = content.indexOf('function isPuzzleRoomNumber');
console.log(content.substring(isPuzzleMatch - 500, isPuzzleMatch + 1500));
