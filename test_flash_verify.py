from playwright.sync_api import sync_playwright

def test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("file:///app/games/shadow-assassin-safe-rooms.html", wait_until="load", timeout=60000)

        try:
            page.wait_for_selector("#playBtn", state="visible", timeout=10000)
        except Exception as e:
            pass

        # Start game
        page.evaluate("""
            document.getElementById('playBtn').click();
            player.x = 200;
            player.y = 200;
        """)

        page.wait_for_timeout(500)

        # Attack!
        page.evaluate("player.attack();")

        # Take a screenshot to verify it doesn't flash white randomly
        page.screenshot(path="verification_attack_no_flash.png")

        print("Done")

        browser.close()

if __name__ == "__main__":
    test()
