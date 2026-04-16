with open('index.html', 'r') as f:
    content = f.read()

import re

# Fix duplicated html blocks
match = re.search(r'(<div class="social-feed" id="socialFeedList".*?</div>\s*<button class="term-btn".*?CLOSE\s*</button>\s*</div>\s*</div>).*?(<div class="social-feed" id="socialFeedList".*?</div>\s*<button class="term-btn".*?CLOSE\s*</button>\s*</div>\s*</div>)', content, re.DOTALL)
if match:
    content = content[:match.start(2)] + content[match.end(2):]

with open('index.html', 'w') as f:
    f.write(content)
