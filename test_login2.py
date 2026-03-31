import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(record_video_dir="/app/videos")
        page = context.new_page()

        page.on("console", lambda msg: print(f"Console {msg.type}: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"Page Error: {exc}"))

        print("Navigating to index.html...")
        page.goto("http://localhost:8000/index.html")
        page.wait_for_timeout(2000)

        print("Logging in...")
        page.fill("#usernameInput", "TEST_USER")
        page.fill("#pinInput", "1234")
        page.click("#btnRegister")
        page.wait_for_timeout(2000)

        page.screenshot(path="verification_login2.png")

        print("Done.")
        context.close()
        browser.close()

if __name__ == "__main__":
    run()
