const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  let txCount = 0;
  await page.exposeFunction('logTx', () => txCount++);

  await page.goto('http://localhost:8080/index.html');
  await page.evaluate(() => {
    document.getElementById('overlayLogin').style.display = 'none';
    window.isGodUser = () => true;
  });

  await page.waitForTimeout(20000);
  console.log('Test completed.');
  await browser.close();
})();
