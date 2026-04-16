with open('index.html', 'r') as f:
    content = f.read()

import re
content = re.sub(r'(\s*<button id="tabCrew".*?>\s*CREW\s*</button>)', r'\1\n        <button id="tabSocial" class="menu-btn" onclick="window.toggleTopPanelOverlay(\'overlaySocial\')">\n          SOCIAL\n        </button>', content)

overlay_social = """
    <!-- Social Media Overlay -->
    <div class="overlay menu-overlay" id="overlaySocial">
      <div class="score-box" style="width: min(94vw, 600px);">
        <h2 style="text-align: center">GOONER FEED</h2>
        <div style="font-size: 10px; text-align: center; margin-bottom: 10px; color: #aaa;">GLOBAL SOCIAL NETWORK</div>

        <div class="social-compose" style="margin-bottom: 20px; border-bottom: 1px dashed var(--accent-dim); padding-bottom: 15px;">
          <textarea id="socialPostInput" class="term-input" placeholder="WHAT'S ON YOUR MIND?" maxlength="140" rows="3" style="width: 100%; resize: none; margin-bottom: 10px;"></textarea>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span id="socialPostChars" style="font-size: 10px; color: #aaa;">0 / 140</span>
            <button class="term-btn" id="socialPostBtn" onclick="window.createSocialPost()">POST</button>
          </div>
        </div>

        <div class="social-feed" id="socialFeedList" style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px;">
          <div class="social-empty" style="text-align: center; font-size: 10px; color: #aaa;">LOADING FEED...</div>
        </div>

        <button class="term-btn" style="margin-top: 20px; width: 100%;" onclick="window.closeOverlays()">
          CLOSE
        </button>
      </div>
    </div>
"""

content = content.replace('    <!-- Configuration overlay for display/audio toggles. -->', overlay_social + '\n    <!-- Configuration overlay for display/audio toggles. -->')

# also need to add back the bio and social links as the checkout reverted everything. Wait, did the checkout revert the bio fields too? Let's check.
with open('index.html', 'w') as f:
    f.write(content)
