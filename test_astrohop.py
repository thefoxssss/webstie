import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto('http://localhost:8080')

        # Bypass login
        await page.evaluate("""() => {
            document.body.classList.replace('logged-out', 'logged-in');
            const l = document.getElementById('overlayLogin');
            if (l) { l.classList.remove('active'); l.style.display = 'none'; l.remove(); }
            window.isGodUser = () => true;
        }""")

        # Click the game catalog icon for Astro Hop
        await page.click('text="ASTRO HOP"')

        await page.wait_for_timeout(2000)

        # Click canvas to start game
        await page.evaluate("""() => {
            const canvas = document.getElementById('astrohopCanvas');
            const event = new PointerEvent('pointerdown', {
                bubbles: true,
                cancelable: true,
                clientX: 100,
                clientY: 100
            });
            canvas.dispatchEvent(event);
        }""")

        await page.wait_for_timeout(2000)

        # Move right
        await page.keyboard.press("ArrowRight")
        await page.wait_for_timeout(2000)

        await page.screenshot(path="astrohop_playing.png")

        await browser.close()

asyncio.run(run())
