const fs = require('fs');
let content = fs.readFileSync('games/builder.js', 'utf8');

const search = `        if (e.key === "i" || e.key === "I") {`;
const replace = `        if (e.key === "q" || e.key === "Q") {
            const selectedSlotItem = hotbarSlots[selectedHotbarIndex];
            if (selectedSlotItem) {
                room.send("spawn_drops", { items: [{ type: selectedSlotItem.type, count: 1 }] });
                selectedSlotItem.count -= 1;
                if (selectedSlotItem.count <= 0) {
                    hotbarSlots[selectedHotbarIndex] = undefined;
                }
                saveInventoryState();
            }
        }
        if (e.key === "i" || e.key === "I") {`;

if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync('games/builder.js', content);
    console.log("Replaced drop key");
}
