const fs = require('fs');

let content = fs.readFileSync('games/builder.js', 'utf8');

const search = `    const getMergedInventoryType = (type) => type;
    const getMaxStack = (type) => [11, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27].includes(type) ? 1 : 99;`;

const replace = `    const getMergedInventoryType = (type) => type;
    const getMaxStack = (type) => loadedBlockData[type] ? loadedBlockData[type].maxStack : ([11, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27].includes(type) ? 1 : 99);

    const blockDataUrls = [
        "data/blocks/1.json", "data/blocks/2.json", "data/blocks/3.json", "data/blocks/4.json",
        "data/blocks/5.json", "data/blocks/6.json", "data/blocks/7.json", "data/blocks/8.json",
        "data/blocks/9.json", "data/blocks/10.json", "data/items/11.json", "data/blocks/12.json",
        "data/blocks/13.json", "data/blocks/14.json", "data/blocks/15.json", "data/blocks/16.json",
        "data/blocks/17.json", "data/items/18.json", "data/items/19.json", "data/items/20.json",
        "data/items/21.json", "data/items/22.json", "data/items/23.json", "data/items/24.json",
        "data/items/25.json", "data/items/26.json", "data/items/27.json", "data/items/28.json"
    ];
    let loadedBlockData = {};
    let blockImages = {};
    let assetsLoaded = false;

    Promise.all(blockDataUrls.map(url => fetch(url).then(res => res.json()))).then(results => {
        let loadedImgs = 0;
        results.forEach(data => {
            loadedBlockData[data.id] = data;
            const img = new Image();
            img.onload = () => {
                loadedImgs++;
                if (loadedImgs === results.length) assetsLoaded = true;
            };
            img.src = data.sprite;
            blockImages[data.id] = img;
        });
    });`;

if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync('games/builder.js', content);
    console.log("Replaced successfully.");
} else {
    console.log("Search string not found.");
}
