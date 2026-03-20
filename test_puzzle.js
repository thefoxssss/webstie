const fs = require('fs');
const content = fs.readFileSync('games/shadow-assassin-safe-rooms.html', 'utf8');

console.log("Found isPuzzleRoomNumber:", content.indexOf('function isPuzzleRoomNumber'));
console.log("Found Room class:", content.indexOf('class Room {'));
