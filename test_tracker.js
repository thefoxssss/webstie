// Check if player tracker logic makes sense
console.log("Checking math logic for player tracker");
const localPlayer = {x: 100, y: 100};
const p = {x: 300, y: -50};
const canvas = {width: 800, height: 600};
const dx = p.x - localPlayer.x;
const dy = p.y - localPlayer.y;
const distance = Math.sqrt(dx * dx + dy * dy);
console.log("Distance:", distance);
const angle = Math.atan2(dy, dx);
console.log("Angle:", angle);
