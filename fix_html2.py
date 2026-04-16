with open('index.html', 'r') as f:
    content = f.read()

import re
content = re.sub(r'(<button id="tabSocial" class="menu-btn" onclick="window\.toggleTopPanelOverlay\(\'overlaySocial\'\)">\s*SOCIAL\s*</button>\s*)+', r'<button id="tabSocial" class="menu-btn" onclick="window.toggleTopPanelOverlay(\'overlaySocial\')">\n          SOCIAL\n        </button>\n        ', content)
content = content.replace("          CREW\n        <button id=\"tabSocial\"", "        <button id=\"tabSocial\"")

with open('index.html', 'w') as f:
    f.write(content)
