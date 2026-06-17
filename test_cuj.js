const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    recordVideo: { dir: '.ai-artifacts/playwright/videos/' }
  });
  const page = await context.newPage();

  await page.exposeFunction('logError', msg => console.log('CAUGHT:', msg));

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('resource-exhausted') || text.includes('BatchGetDocuments')) {
       console.log('BROWSER QUOTA ERROR:', text);
    }
  });

  await page.goto('http://localhost:8080/index.html');
  await page.evaluate(() => {
    document.getElementById('overlayLogin').style.display = 'none';
    window.isGodUser = () => true;
  });

  await page.waitForTimeout(1000);

  // Open Blackjack
  await page.evaluate(() => {
    window.openGame('blackjack');
  });
  await page.waitForTimeout(2000);

  // Click Create Blackjack
  await page.evaluate(async () => {
    try {
      await document.getElementById('btnCreateBJ').click();
    } catch (e) {
      window.logError(e.toString());
    }
  });

  await page.waitForTimeout(5000);

  await page.screenshot({ path: '.ai-artifacts/playwright/images/verification.png' });

  await context.close();
  await browser.close();

  console.log('Video saved to .ai-artifacts/playwright/videos/');
})();
