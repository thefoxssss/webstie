const fs = require('fs');
const content = fs.readFileSync('games/shadow-assassin-safe-rooms.html', 'utf8');

const spikeMatches = [...content.matchAll(/spike/gi)];
console.log("Found spikes:", spikeMatches.length);
if (spikeMatches.length > 0) {
    console.log("Sample:", content.substring(Math.max(0, spikeMatches[0].index - 50), spikeMatches[0].index + 100));
}
