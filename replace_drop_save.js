const fs = require('fs');
let content = fs.readFileSync('games/builder.js', 'utf8');

const search = `    function handleMouseUp() {`;
const replace = `    function handleMouseUp() {
        if (inventoryOpen && draggedItemType !== null) {
            setTimeout(() => saveInventoryState(), 10);
        }`;

if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync('games/builder.js', content);
    console.log("Replaced handleMouseUp save");
}
