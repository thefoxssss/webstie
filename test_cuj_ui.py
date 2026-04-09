import pytest
from playwright.sync_api import sync_playwright
import time

def test_inventory_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:8001/index.html?local=1", wait_until="domcontentloaded")

        # Login
        page.evaluate("window.myName = 'TEST_USER'")
        page.evaluate("document.getElementById('overlayLogin').classList.remove('active')")
        page.evaluate("document.getElementById('matrixCanvas').style.opacity = 0")
        page.evaluate("document.getElementById('hackOverlay').style.display = 'none'")
        page.evaluate("document.body.classList.remove('flicker-on')")

        # Open Builder
        page.click("#icon-builder")
        time.sleep(1) # wait for connect
        page.evaluate("document.getElementById('btnJoin').click()")
        time.sleep(2)

        # Open Inventory
        page.keyboard.press("i")
        time.sleep(1)

        # Open Recipes
        page.mouse.click(page.viewport_size['width']/2 + 100, page.viewport_size['height']/2 - 50)
        time.sleep(1)

        browser.close()

test_inventory_ui()
print('Success')
