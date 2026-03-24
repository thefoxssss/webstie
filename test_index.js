const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// I should check if the overlays have .game-content-shell or if they are just .overlay elements.
// Example: id="overlayGeo"
let match = html.match(/id="overlayGeo"[\s\S]*?<\/div>/);
console.log(match ? match[0] : 'not found');
