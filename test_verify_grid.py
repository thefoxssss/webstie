import time
from playwright.sync_api import sync_playwright

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # Use an incognito context without trying to register
        context = browser.new_context()
        page = context.new_page()
        page.goto('http://localhost:8000', wait_until='domcontentloaded')

        # Click the 'GAMES' menu button directly. It's supposed to work without login or we can just bypass
        # The gamebox overlay toggle is just a visual overlay toggle.
        page.evaluate("window.openGame('overlayGamebox')")
        page.wait_for_timeout(1000)

        # Check if the grid is displayed
        strip_display = page.evaluate("window.getComputedStyle(document.getElementById('gameboxGameStrip')).display")
        print(f"Grid strip display: {strip_display}")

        # Check if Astrohop is NOT displayed (meaning it didn't auto-launch)
        astrohop_display = page.evaluate("window.getComputedStyle(document.getElementById('overlayAstrohop')).display")
        print(f"Astrohop overlay display: {astrohop_display}")

        # Click Astrohop from the grid to launch it
        # Since overlayLogin might cover it, we can force-hide overlayLogin to click stuff safely
        page.evaluate("document.getElementById('overlayLogin').style.display = 'none'")

        page.click('.leaderboard-game-card[data-game="astrohop"]')
        page.wait_for_timeout(1000)

        # Check if Astrohop IS displayed now
        astrohop_display_after = page.evaluate("window.getComputedStyle(document.getElementById('overlayAstrohop')).display")
        print(f"Astrohop overlay display after click: {astrohop_display_after}")

        # Check if the grid overlay is closed/hidden
        gamebox_display = page.evaluate("window.getComputedStyle(document.getElementById('overlayGamebox')).display")
        print(f"Gamebox (grid) overlay display after launching game: {gamebox_display}")

        # Click EXIT to return to grid
        page.click('#menuToggle') # The menuToggle button acts as EXIT when in a game overlay and its text changes to EXIT
        page.wait_for_timeout(1000)

        # Check if we returned to the grid
        gamebox_display_returned = page.evaluate("window.getComputedStyle(document.getElementById('overlayGamebox')).display")
        print(f"Gamebox display after exit: {gamebox_display_returned}")
        astrohop_display_returned = page.evaluate("window.getComputedStyle(document.getElementById('overlayAstrohop')).display")
        print(f"Astrohop display after exit: {astrohop_display_returned}")

        browser.close()

if __name__ == '__main__':
    run_test()
