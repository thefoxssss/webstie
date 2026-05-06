from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto('file://' + __import__('os').path.abspath('games/fps-map-builder.html'))
    try:
        page.wait_for_selector('.brand', timeout=2000)
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.wait_for_timeout(1000)
        print("Success! No immediate crashes.")
        if errors:
            print("Console Errors:", errors)
    except Exception as e:
        print("Error:", e)
    browser.close()
