from playwright.sync_api import sync_playwright

def verify_feature(page):
    page.goto("file:///app/games/shadow-assassin-safe-rooms.html", wait_until="load", timeout=60000)

    page.evaluate("""
        document.getElementById('playBtn').click();

        // Go straight to room 7
        roomNumber = 7;
        const isWaveRoom = isWaveRoomNumber(roomNumber);
        currentRoom = new Room(roomNumber * 12345, false, false, false, false, false, false, false, false, isWaveRoom);

        player.x = 200;
        player.y = canvas.height - 200;
    """)

    page.wait_for_timeout(1500)

    # Trigger an attack to verify the screen doesn't flash white randomly
    page.evaluate("player.attack();")

    page.wait_for_timeout(100)

    # Take a screenshot right after the attack
    page.screenshot(path="/app/verification_attack.png")

    page.wait_for_timeout(1000)

    # Verify we are in room 7 and it's a wave room
    room = page.evaluate("roomNumber")
    is_wave = page.evaluate("currentRoom.isWaveRoom")
    wave = page.evaluate("currentRoom.currentWave") if is_wave else None

    print(f"Room: {room}, Is Wave Room: {is_wave}, Wave: {wave}")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(record_video_dir="/app/video")
        page = context.new_page()
        try:
            verify_feature(page)
        finally:
            context.close()
            browser.close()
