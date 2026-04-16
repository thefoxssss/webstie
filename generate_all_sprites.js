const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const blocks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 29, 31, 32, 33, 34, 35, 37, 38, 39, 40, 41, 42, 48, 60, 64];
const items = [11, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 36, 43, 44, 45, 46, 47, 61, 62, 63, 65];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const htmlPath = 'file://' + path.resolve('generate_sprites.html');
  await page.goto(htmlPath);

  if (!fs.existsSync('assets/sprites/blocks')) fs.mkdirSync('assets/sprites/blocks', { recursive: true });
  if (!fs.existsSync('assets/sprites/items')) fs.mkdirSync('assets/sprites/items', { recursive: true });

  for (const id of blocks) {
    const dataUrl = await page.evaluate((type) => window.generateSprite(type), id);
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(`assets/sprites/blocks/${id}.png`, base64Data, 'base64');
    console.log(`Generated block sprite: ${id}.png`);
  }

  for (const id of items) {
    const dataUrl = await page.evaluate((type) => window.generateSprite(type), id);
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(`assets/sprites/items/${id}.png`, base64Data, 'base64');
    console.log(`Generated item sprite: ${id}.png`);
  }

  await browser.close();
})();
