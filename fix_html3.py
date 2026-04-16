with open('index.html', 'r') as f:
    content = f.read()

import re

# let's just find tabCrew and replace from there to tabAdmin
match = re.search(r'(<button id="tabCrew".*?</button>).*?(<button\s*class="menu-btn"\s*id="tabAdmin")', content, re.DOTALL)
if match:
    new_str = match.group(1) + '\n        <button id="tabSocial" class="menu-btn" onclick="window.toggleTopPanelOverlay(\'overlaySocial\')">\n          SOCIAL\n        </button>\n        ' + match.group(2)
    content = content[:match.start()] + new_str + content[match.end():]

with open('index.html', 'w') as f:
    f.write(content)
