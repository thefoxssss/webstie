from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:8000", wait_until="domcontentloaded")
    page.wait_for_timeout(1000)

    # Bypass login
    page.evaluate('''
      document.getElementById("usernameInput").value = "TEST_USER";
      document.getElementById("pinInput").value = "1234";
      document.getElementById("btnLogin").click();
    ''')
    page.wait_for_timeout(1500)

    # Open crew tab
    page.evaluate('''window.toggleTopPanelOverlay('overlayCrew')''')
    page.wait_for_timeout(1000)

    # Create crew - it might be in the crew finder area
    page.locator("#crewFinderInput").fill("TEST")
    page.locator("#crewFinderCreateBtn").click()
    page.wait_for_timeout(1000)

    # Open edit logo
    page.get_by_role("button", name="EDIT LOGO").click()
    page.wait_for_timeout(1000)

    # Draw on canvas
    canvas = page.locator("#crewLogoEditorCanvas")
    box = canvas.bounding_box()

    # draw a red line
    page.get_by_role("button", name="DRAW").click()

    # select red color
    page.locator("#crewLogoPalette .color-swatch[data-color='#ff0000']").click()

    page.mouse.move(box["x"] + 50, box["y"] + 50)
    page.mouse.down()
    page.mouse.move(box["x"] + 150, box["y"] + 150)
    page.mouse.up()
    page.wait_for_timeout(500)

    # fill with blue
    page.get_by_role("button", name="FILL (BUCKET)").click()
    page.locator("#crewLogoPalette .color-swatch[data-color='#0000ff']").click()
    page.mouse.click(box["x"] + 20, box["y"] + 20)
    page.wait_for_timeout(500)

    page.screenshot(path="verification_logo_editor.png")

    # save logo
    page.get_by_role("button", name="SAVE LOGO").click()
    page.wait_for_timeout(1000)

    page.screenshot(path="verification_logo_saved.png")

    # Check season board
    page.evaluate('''window.toggleTopPanelOverlay('overlaySeason')''')
    page.wait_for_timeout(1000)
    page.get_by_text("GANG SCORES").click()
    page.wait_for_timeout(1000)
    page.screenshot(path="verification_season_board.png")

    page.get_by_text("SOLO SCORES").click()
    page.wait_for_timeout(1000)
    page.screenshot(path="verification_season_board_solo.png")

    # Check games panel leaderboard
    page.evaluate('''window.toggleTopPanelOverlay('overlayGamebox')''')
    page.wait_for_timeout(500)
    page.get_by_role("button", name="LEADERBOARD").click()
    page.wait_for_timeout(2000)
    page.screenshot(path="verification_leaderboard.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(record_video_dir="/home/jules/verification/videos")
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
