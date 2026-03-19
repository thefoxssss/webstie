from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page Error: {err.message}"))

        page.goto('file:///app/games/shadow-assassin-safe-rooms.html')
        page.wait_for_selector('#playBtn')
        page.click('#playBtn')
        page.wait_for_selector('#tutorialStartBtn')
        page.click('#tutorialStartBtn')

        page.wait_for_timeout(2000)

        browser.close()

if __name__ == "__main__":
    run()
