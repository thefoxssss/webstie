const blockNames = {
    1: "GRASS", 2: "DIRT", 3: "STONE", 4: "WOOD", 5: "GLASS", 6: "BRICK", 7: "LOG", 8: "LEAVES", 9: "PLANKS", 10: "CRAFTING TABLE",
    11: "SWORD", 12: "COAL", 13: "COPPER", 14: "IRON", 15: "GOLD", 16: "DIAMOND", 17: "URANIUM", 18: "COPPER ARMOR", 19: "IRON ARMOR",
    20: "GOLD ARMOR", 21: "DIAMOND ARMOR", 22: "URANIUM ARMOR", 23: "COPPER GUN", 24: "IRON GUN", 25: "GOLD GUN", 26: "DIAMOND RIFLE",
    27: "URANIUM LASER", 28: "COPPER AMMO",
};

let jsonList = [];
for (let i = 1; i <= 28; i++) {
    const isItem = [11, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28].includes(i);
    const path = isItem ? `data/items/${i}.json` : `data/blocks/${i}.json`;
    jsonList.push(`"${path}"`);
}

console.log("const blockDataUrls = [\n    " + jsonList.join(",\n    ") + "\n];");
