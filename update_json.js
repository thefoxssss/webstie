const fs = require('fs');

const blockNames = {
    1: "GRASS", 2: "DIRT", 3: "STONE", 4: "WOOD", 5: "GLASS", 6: "BRICK", 7: "LOG", 8: "LEAVES", 9: "PLANKS", 10: "CRAFTING TABLE",
    11: "SWORD", 12: "COAL", 13: "COPPER", 14: "IRON", 15: "GOLD", 16: "DIAMOND", 17: "URANIUM", 18: "COPPER ARMOR", 19: "IRON ARMOR",
    20: "GOLD ARMOR", 21: "DIAMOND ARMOR", 22: "URANIUM ARMOR", 23: "COPPER GUN", 24: "IRON GUN", 25: "GOLD GUN", 26: "DIAMOND RIFLE",
    27: "URANIUM LASER", 28: "COPPER AMMO",
};

const getMaxStack = (type) => [11, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27].includes(type) ? 1 : 99;

for (let i = 1; i <= 28; i++) {
    const isItem = [11, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28].includes(i);
    const data = {
        id: i,
        name: blockNames[i],
        maxStack: getMaxStack(i),
        sprite: `assets/sprites/${isItem ? 'items' : 'blocks'}/${i}.png`
    };

    // Move the generated sprite to correct folder if it's an item
    if (isItem) {
        if (fs.existsSync(`assets/sprites/blocks/${i}.png`)) {
            fs.renameSync(`assets/sprites/blocks/${i}.png`, `assets/sprites/items/${i}.png`);
        }
        fs.writeFileSync(`data/items/${i}.json`, JSON.stringify(data, null, 2));
    } else {
        fs.writeFileSync(`data/blocks/${i}.json`, JSON.stringify(data, null, 2));
    }
}
