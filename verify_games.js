const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    await page.goto('http://localhost:2567');

    // Login
    await page.fill('#usernameInput', 'TESTER');
    await page.fill('#pinInput', '1234');
    await page.click('#btnLogin');

    // Wait for login to complete
    await page.waitForSelector('#desktop', { timeout: 5000 });
    console.log('Logged in successfully');

    const games = ['pong', 'snake', 'geo'];
    for (const game of games) {
        console.log(`Testing game: ${game}`);
        // Find icon and click
        const iconSelector = `#icon-${game}`;
        await page.click(iconSelector);

        // Wait for window
        const windowSelector = `#window-overlay${game.charAt(0).toUpperCase()}${game.slice(1)}`;
        await page.waitForSelector(windowSelector, { timeout: 5000 });

        // Check for canvas
        const canvasSelector = `${windowSelector} canvas`;
        const canvas = await page.$(canvasSelector);
        if (canvas) {
            console.log(`Canvas found for ${game}`);
            // Wait a bit and take screenshot
            await page.waitForTimeout(1000);
            await page.screenshot({ path: `screenshot_${game}.png` });
        } else {
            console.log(`Canvas NOT found for ${game}`);
        }

        // Close window
        await page.click(`${windowSelector} .close-btn`);
    }

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await browser.close();
  }
})();
