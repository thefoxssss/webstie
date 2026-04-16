with open('index.html', 'r') as f:
    content = f.read()

import re

# Looks like we accidentally added overlaySocial twice. Let's remove the second one.
match = re.search(r'(<!-- Social Media Overlay -->.*?</div>\s*</div>).*?(<!-- Social Media Overlay -->.*?</div>\s*</div>)', content, re.DOTALL)
if match:
    content = content[:match.start(2)] + content[match.end(2):]

with open('index.html', 'w') as f:
    f.write(content)
