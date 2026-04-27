from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Click the Arena Shooter icon
    page.evaluate("window.launchGame('fps')")
    page.wait_for_timeout(1500)

    # Set Map to CTF
    page.evaluate("""
        const select = document.getElementById("fpsMapSelect");
        if (select) {
           select.value = "5";
        }
    """)
    page.locator("#btnCreateFpsServer").click()
    page.wait_for_timeout(2000)

    # Join Team Red
    page.evaluate("if(window.joinFpsTeam) { window.joinFpsTeam(1); } else { console.log('joinFpsTeam not found'); }")
    page.wait_for_timeout(1000)

    # We should be spawned into the map. Switch to rocket launcher and fire it.
    page.keyboard.press("5") # Rocket launcher
    page.wait_for_timeout(500)

    # Force mock lock so the engine thinks pointer is locked to receive firing actions
    page.evaluate("""
       document.pointerLockElement = document.getElementById('fpsCanvas');
       document.dispatchEvent(new Event('pointerlockchange'));
    """)
    page.wait_for_timeout(500)

    page.evaluate("document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))")
    page.wait_for_timeout(1000) # Wait for boom

    # Cycle grenades
    page.keyboard.press("h") # Cycle to smoke
    page.wait_for_timeout(200)

    page.keyboard.press("g") # Throw smoke
    page.wait_for_timeout(1000) # Wait for throw and smoke pop

    # Take screenshot at the key moment
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(2000)  # Hold final state for the video

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={'width': 1280, 'height': 720}
        )
        page = context.new_page()

        try:
            # Bypass login logic (mocking login based on memory hints)
            page.goto("http://localhost:8000")
            page.wait_for_timeout(500)
            page.evaluate("document.body.classList.replace('logged-out', 'logged-in')")
            page.evaluate("window.isGodUser = () => true")

            run_cuj(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            context.close()
            browser.close()