from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:8000", wait_until='domcontentloaded')

    # login
    page.fill("#usernameInput", "TEST")
    page.fill("#pinInput", "1234")
    page.click("#btnLogin")

    page.wait_for_timeout(1000)

    # open games
    page.click("button[data-open-overlay='overlayGamebox']")
    page.wait_for_timeout(1000)

    # click Astro Hop
    page.evaluate("window.launchGame('astrohop')")
    page.wait_for_timeout(1000)

    # take screenshot
    page.screenshot(path="astrohop_overlay.png", full_page=True)
    browser.close()
