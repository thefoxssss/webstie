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

    # Take screenshot of the voice menu
    page.screenshot(path="/home/jules/verification/screenshots/voice_menu.png")
    page.wait_for_timeout(1000)

    # Check if there are active rooms
    page.screenshot(path="/home/jules/verification/screenshots/voice_rooms.png")

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
            try:
                run_cuj(page)
            finally:
                context.close()
                browser.close()
    finally:
        server_process.terminate()
        http_process.terminate()
