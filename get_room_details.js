const fs = require('fs');
const content = fs.readFileSync('games/shadow-assassin-safe-rooms.html', 'utf8');

const roomClassStart = content.indexOf('class Room {');
if (roomClassStart !== -1) {
    console.log(content.substring(roomClassStart + 35000, roomClassStart + 40000));
} else {
    console.log('Could not find Room class.');
}
