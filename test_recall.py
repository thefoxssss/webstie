from playwright.sync_api import sync_playwright
import time

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
    page.wait_for_timeout(3000)

    page.keyboard.down("d")
    page.wait_for_timeout(3000)
    page.keyboard.up("d")

    # Store old position
    old_x = page.evaluate("localPlayer.x")
    old_y = page.evaluate("localPlayer.y")

    print(f"Old pos: {old_x}, {old_y}")

    # Trigger recall
    page.keyboard.press("r")
    page.wait_for_timeout(1000)

    # Store new position
    new_x = page.evaluate("localPlayer.x")
    new_y = page.evaluate("localPlayer.y")

    print(f"New pos: {new_x}, {new_y}")

    assert old_x != new_x or old_y != new_y
    assert abs(new_x) < 500

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720}
        )
        page = context.new_page()
        try:
            run_cuj(page)
            print("TEST PASSED")
        except Exception as e:
            print("TEST FAILED")
            print(e)
        finally:
            context.close()
            browser.close()
