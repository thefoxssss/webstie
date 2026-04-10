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

    # Click create server manually or evaluate it since it might not be bound to text
    page.evaluate("document.getElementById('btnCreateBuilderServer').click()")
    page.wait_for_timeout(4000)

    page.keyboard.press("e")
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/screenshots/inventory_icons5.png")
    page.wait_for_timeout(1000)

    page.keyboard.press("e")
    page.wait_for_timeout(1000)

    page.keyboard.press("1")
    page.wait_for_timeout(500)

    # Walk around a bit
    page.keyboard.press("d")
    page.wait_for_timeout(500)
    page.keyboard.press("d")
    page.wait_for_timeout(500)

    # Try breaking a block to spawn a drop to see the icon drop
    # (Just an interaction)
    page.mouse.click(640, 360, button="left")
    page.wait_for_timeout(1000)

    page.screenshot(path="/home/jules/verification/screenshots/world_caves5.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
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
