from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Load game directly via file protocol, passing local flag if needed
    page.goto("http://localhost:8001/index.html?local=1")
    page.wait_for_timeout(1500)

    # Login bypass
    # Find the login input or execute bypass script from memory
    page.evaluate('''
        window.myName = "TEST_USER";
        document.getElementById("overlayLogin").classList.remove("active");
        document.getElementById("matrixCanvas").style.opacity = 0;
        document.getElementById("hackOverlay").style.display = "none";
        document.body.classList.remove("flicker-on");
    ''')
    page.wait_for_timeout(500)

    # Open the game UI
    page.evaluate("window.launchGame('builder')")
    page.wait_for_timeout(2000)

    # In builder, open inventory to show the item icons
    page.keyboard.press("e")
    page.wait_for_timeout(1000)

    # Take screenshot of inventory showing icons
    page.screenshot(path="/home/jules/verification/screenshots/inventory_icons.png")
    page.wait_for_timeout(1000)

    # Close inventory
    page.keyboard.press("e")
    page.wait_for_timeout(1000)

    # Select an item (sword or block) in hotbar (1-9 keys)
    page.keyboard.press("1")
    page.wait_for_timeout(500)

    # Walk around to force map load
    page.keyboard.press("d")
    page.wait_for_timeout(1000)

    # Take screenshot of the world to see the terrain and the new hand-held icons in hotbar
    page.screenshot(path="/home/jules/verification/screenshots/world_caves.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    import os
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
