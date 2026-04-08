from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:8001/index.html?local=1")
    page.wait_for_timeout(1500)

    page.evaluate('''
        window.myName = "TEST_USER";
        document.getElementById("overlayLogin").classList.remove("active");
        document.getElementById("matrixCanvas").style.opacity = 0;
        document.getElementById("hackOverlay").style.display = "none";
        document.body.classList.remove("flicker-on");
    ''')
    page.wait_for_timeout(500)

    page.evaluate("window.launchGame('builder')")
    page.wait_for_timeout(2000)

    # Click the quick join button using the element ID
    page.evaluate('''
        document.getElementById("btnJoinBuilder").click();
    ''')
    page.wait_for_timeout(6000)

    # In builder, open inventory to show the item icons
    page.keyboard.press("e")
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/screenshots/inventory_icons12.png")
    page.wait_for_timeout(1000)

    # Close inventory
    page.keyboard.press("e")
    page.wait_for_timeout(1000)

    # Select an item (sword or block) in hotbar (1-9 keys)
    page.keyboard.press("1")
    page.wait_for_timeout(500)

    # Walk around to force map load
    page.keyboard.down("w")
    page.wait_for_timeout(3000)
    page.keyboard.up("w")
    page.keyboard.down("a")
    page.wait_for_timeout(3000)
    page.keyboard.up("a")

    # Zoom out or switch to cave view if needed, but walking might reveal surface caves
    page.screenshot(path="/home/jules/verification/screenshots/world_caves12.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    import os
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={'width': 1280, 'height': 720}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
