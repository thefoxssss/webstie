from playwright.sync_api import sync_playwright
import time
import subprocess
import os

def run_cuj(page):
    page.goto("http://localhost:8080")
    page.wait_for_timeout(2000)

    # Bypass login
    page.evaluate('''
        window.myName = "TEST_USER";
        document.getElementById("overlayLogin").classList.remove("active");
        document.getElementById("matrixCanvas").style.opacity = 0;
        document.getElementById("hackOverlay").style.display = "none";
        document.body.classList.remove("flicker-on");
    ''')
    page.wait_for_timeout(500)

    # Open Voice Lounge
    page.evaluate("window.openGame('overlayVoice')")
    page.wait_for_timeout(2000)

    # Create a room
    page.get_by_text("CREATE NEW ROOM").click()
    page.wait_for_timeout(2000)

    # We are now in the lobby. Take a screenshot to show we joined a room
    page.screenshot(path="/home/jules/verification/screenshots/voice_joined.png")
    page.wait_for_timeout(1000)

    # Go back to menu and let's check rooms.
    page.get_by_text("LEAVE ROOM").click()
    page.wait_for_timeout(2000)

if __name__ == "__main__":
    # Start the server
    server_process = subprocess.Popen(["node", "server.js"])
    time.sleep(2) # Give server time to start

    # Run a simple python http server for the frontend to avoid CORS
    http_process = subprocess.Popen(["python3", "-m", "http.server", "8080"])
    time.sleep(1)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            # Give permission for microphone
            context = browser.new_context(
                record_video_dir="/home/jules/verification/videos",
                permissions=['microphone']
            )
            page = context.new_page()
            # Also create a second page to act as another user to test the room listing.
            context2 = browser.new_context(
                permissions=['microphone']
            )
            page2 = context2.new_page()

            try:
                run_cuj(page)

                # In page2 we just open the voice lounge and check room list
                page2.goto("http://localhost:8080")
                page2.wait_for_timeout(2000)

                page2.evaluate('''
                    window.myName = "TEST_USER_2";
                    document.getElementById("overlayLogin").classList.remove("active");
                    document.getElementById("matrixCanvas").style.opacity = 0;
                    document.getElementById("hackOverlay").style.display = "none";
                    document.body.classList.remove("flicker-on");
                ''')
                page2.wait_for_timeout(500)
                page2.evaluate("window.openGame('overlayVoice')")
                page2.wait_for_timeout(2000)

                page2.screenshot(path="/home/jules/verification/screenshots/voice_menu_user2.png")
            finally:
                context.close()
                context2.close()
                browser.close()
    finally:
        server_process.terminate()
        http_process.terminate()
