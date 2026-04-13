from playwright.sync_api import sync_playwright

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        page.on("console", lambda msg: print(f"Console: {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page Error: {err}"))

        page.goto("http://localhost:8001/index.html?local=1")
        page.wait_for_timeout(2000)

        # Test if launchGame is available
        launch_game_exists = page.evaluate("typeof window.launchGame === 'function'")
        print(f"window.launchGame exists: {launch_game_exists}")

        browser.close()

if __name__ == "__main__":
    run_test()
