import sys
import time
from playwright.sync_api import sync_playwright

def verify_wave_chamber(page):
    print("Navigating to game...")
    # Load game directly from file system
    page.goto("file:///app/games/shadow-assassin-safe-rooms.html", wait_until='domcontentloaded')

    # Wait for the game to initialize
    page.wait_for_timeout(1000)

    print("Setting up game state for testing...")
    page.evaluate("""() => {
        // Start game
        gameStarted = true;

        // Skip to room 9 to test wave room trigger at room 10
        roomNumber = 9;

        // Give player a grappling hook to test visuals
        player.inventory = ['hook'];
        player.equippedSpecial = 'hook';

        // Setup a wave room directly to verify logic and combat
        currentRoom = new Room(10);

        // Move player to center
        player.x = canvas.width / 2;
        player.y = canvas.height - 100;

        // Clear first wave immediately to test the spawn logic
        currentRoom.enemies = [];
    }""")

    print("Waiting for wave 2 to spawn (should take 2 seconds)...")
    # Wait 2.5 seconds to ensure the 2-second timeout in Room logic completes
    page.wait_for_timeout(2500)

    print("Taking screenshot after wave spawn...")
    page.screenshot(path="/app/verification_attack_no_flash.png")

    print("Testing combat attack (checking for drawDynamicLighting recursion crash)...")
    page.evaluate("""() => {
        // Force an enemy near player to ensure hit-stop/vignette triggers
        if (currentRoom.enemies.length === 0) {
            currentRoom.enemies.push(new Enemy(player.x + 50, player.y, 'standard'));
        }

        // Trigger attack
        player.attack();
    }""")

    # Wait a few frames to let the attack and hit-stop process
    page.wait_for_timeout(500)

    print("Taking post-attack screenshot...")
    page.screenshot(path="/app/verification_post_attack.png")

    print("Verification complete.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/app/verification_video",
            record_video_size={"width": 1280, "height": 720}
        )
        page = context.new_page()
        try:
            verify_wave_chamber(page)
        except Exception as e:
            print(f"Error during verification: {e}")
        finally:
            context.close()
            browser.close()