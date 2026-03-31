from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:8000/index.html", wait_until="commit")
    page.wait_for_timeout(2000)

    # Login
    page.evaluate("""
      if (document.getElementById('usernameInput')) {
        document.getElementById('usernameInput').value = 'TESTER';
        document.getElementById('pinInput').value = '1234';
        document.getElementById('btnRegister').click();
      }
    """)
    page.wait_for_timeout(2000)

    # Bypassing module load issues with Firebase during testing
    page.evaluate("""
      document.getElementById('overlayLogin').classList.remove('active');
    """)
    page.wait_for_timeout(500)

    # Open Inventory overlay by direct DOM manipulation
    page.evaluate("""
      document.querySelectorAll('.overlay').forEach(el => el.classList.remove('active'));
      document.getElementById('overlayInventory').classList.add('active');
    """)
    page.wait_for_timeout(1000)
    page.screenshot(path="/app/verification_inventory.png")
    page.wait_for_timeout(500)

    # Open Video Poker
    page.evaluate("""
      document.querySelectorAll('.overlay').forEach(el => el.classList.remove('active'));
      document.getElementById('overlayVideopoker').classList.add('active');
    """)
    page.wait_for_timeout(1000)
    page.screenshot(path="/app/verification_videopoker.png")
    page.wait_for_timeout(500)

    # Open Craps
    page.evaluate("""
      document.querySelectorAll('.overlay').forEach(el => el.classList.remove('active'));
      document.getElementById('overlayCraps').classList.add('active');
    """)
    page.wait_for_timeout(1000)
    page.screenshot(path="/app/verification_craps.png")
    page.wait_for_timeout(500)

    # Open Baccarat
    page.evaluate("""
      document.querySelectorAll('.overlay').forEach(el => el.classList.remove('active'));
      document.getElementById('overlayBaccarat').classList.add('active');
    """)
    page.wait_for_timeout(1000)
    page.screenshot(path="/app/verification_baccarat.png")
    page.wait_for_timeout(500)

    # Open Mines
    page.evaluate("""
      document.querySelectorAll('.overlay').forEach(el => el.classList.remove('active'));
      document.getElementById('overlayMines').classList.add('active');
    """)
    page.wait_for_timeout(1000)
    page.screenshot(path="/app/verification_mines.png")

    # We don't have JS loaded, so we can't fully interact with Mines, but we can screenshot the UI.

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/app/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
