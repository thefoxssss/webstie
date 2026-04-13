from playwright.sync_api import sync_playwright
import os
import glob
import time

def run_cuj(page):
    page.goto("http://localhost:8001/index.html?local=1")
    page.wait_for_timeout(1000)

    # Login
    try:
        page.get_by_placeholder("CODENAME").fill("TestUser")
        page.get_by_placeholder("4-DIGIT PIN").fill("1234")
        page.get_by_role("button", name="LOGIN").click()
        page.wait_for_timeout(1000)
    except Exception as e:
        print("Login step skipped or failed:", e)

    # Click Builder
    try:
        page.evaluate("window.launchGame('builder')")
        page.wait_for_timeout(1000)
    except Exception as e:
        print("Game launch failed:", e)

    # Click auto network quick join
    try:
        page.locator("#btnJoinBuilder").click()
        page.wait_for_timeout(1500)
    except Exception as e:
        print("Join click failed:", e)

    # Open inventory
    page.keyboard.press("i")
    page.wait_for_timeout(500)
    page.screenshot(path="/home/jules/verification/screenshots/furnace_final3.png")

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    os.makedirs("/home/jules/verification/videos", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
