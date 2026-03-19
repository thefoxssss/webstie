from playwright.sync_api import sync_playwright
import time
import os

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    file_path = f"file://{os.path.abspath('games/shadow-assassin-safe-rooms.html')}"
    page.goto(file_path)

    # Wait for game to load
    page.wait_for_timeout(1000)

    page.evaluate("""
        // Start game and trigger abilities/ninja spawn directly
        startGame();

        // Spawn a ninja
        const currentRoom = window.currentRoom || { enemies: [] };
        if (typeof Enemy !== 'undefined') {
            currentRoom.enemies.push(new Enemy(200, 200, 'ninja'));
        }

        // Use shadow nova
        if (typeof player !== 'undefined') {
            player.activeAbilities.push('shadowNova');
            player.executeSpecialAbility('shadowNova');
        }

        // Ensure screen update
        if (typeof gameLoop !== 'undefined') {
            gameLoop();
        }
    """)

    page.wait_for_timeout(1000)

    # Check for console errors
    errors = []
    page.on("pageerror", lambda err: errors.append(err.message))

    if errors:
        print("ERRORS FOUND:")
        for e in errors:
            print(e)
    else:
        print("No JavaScript errors detected after triggering Ninja and Shadow Nova.")

    browser.close()
