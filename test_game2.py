from playwright.sync_api import sync_playwright
import time
import os

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        errors = []
        page.on("pageerror", lambda err: errors.append(err))

        file_path = f"file://{os.path.abspath('games/shadow-assassin-safe-rooms.html')}"
        page.goto(file_path)

        page.wait_for_timeout(2000)

        try:
            # We must interact with the start menu
            page.evaluate("""
                const btn = document.querySelector('button');
                if (btn && btn.textContent.includes('Start Game')) {
                    btn.click();
                } else if (typeof initGame === 'function') {
                    initGame();
                }
            """)
            page.wait_for_timeout(1000)

            # Spawn a ninja and use shadow nova
            page.evaluate("""
                // Add a ninja
                if (window.currentRoom) {
                    window.currentRoom.enemies.push(new window.Enemy(window.canvas.width/2 + 50, window.canvas.height - 150, 'ninja'));
                }

                // Trigger shadow nova
                if (window.player) {
                    window.player.activeAbilities.push('shadowNova');
                    window.player.executeSpecialAbility('shadowNova');
                }
            """)
            page.wait_for_timeout(2000)

        except Exception as e:
            print("Exception during evaluate:", e)

        if errors:
            print("JAVASCRIPT ERRORS DETECTED:")
            for e in errors:
                print(e)
            return False
        else:
            print("No JavaScript errors detected!")
            return True

        browser.close()

if __name__ == "__main__":
    run_test()
