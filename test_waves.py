from playwright.sync_api import sync_playwright

def test_shadow_assassin():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto('http://localhost:8000/games/shadow-assassin-safe-rooms.html', wait_until='domcontentloaded')

        # Give time for the game to initialize
        page.wait_for_timeout(1000)

        # Click start
        page.evaluate("if(document.getElementById('playBtn')) document.getElementById('playBtn').click();")
        page.wait_for_timeout(500)

        # Click skip tutorial
        page.evaluate("""
            if (document.getElementById('tutorialStartBtn')) {
                document.getElementById('tutorialStartBtn').click();
            }
        """)
        page.wait_for_timeout(500)

        # Evaluate script to set up game state for the screenshot
        page.evaluate("""
            roomNumber = 7;
            currentRoom = new Room(7 * 12345, false, false, false, false, false, false, false, false, true);

            player.x = 200;
            player.y = 400;
            player.grappling = true;
            player.grapplePoint = {x: 500, y: 200};
            player.grappleTimer = 60; // So it doesn't immediately cancel!
        """)

        page.wait_for_timeout(200) # shorter timeout so we catch it
        page.screenshot(path="verification_hook_fixed2.png")

        browser.close()

test_shadow_assassin()
