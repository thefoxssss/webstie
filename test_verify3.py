import time
from playwright.sync_api import sync_playwright

def test_shadow_assassin():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 800, "height": 600})
        page.goto('http://localhost:8000/index.html', wait_until='domcontentloaded')

        page.wait_for_timeout(1000)

        # Remove login overlay
        page.evaluate("if(document.getElementById('overlayLogin')) document.getElementById('overlayLogin').classList.remove('active');")
        page.wait_for_timeout(500)

        page.evaluate("if(document.getElementById('btnGames')) document.getElementById('btnGames').click(); else console.log('not found');")
        page.evaluate("if(document.getElementById('tabGames')) document.getElementById('tabGames').click(); else console.log('not found');")
        page.evaluate("document.querySelectorAll('.term-btn').forEach(b => { if(b.textContent.includes('GAMES')) b.click() })")

        page.wait_for_timeout(1000)

        page.screenshot(path="verification_grid3.png")

        browser.close()

test_shadow_assassin()
