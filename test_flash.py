import re

code = open('games/shadow-assassin-safe-rooms.html', 'r').read()

# I am looking for the closing brace of the `} else {` I inserted at 10142.
# Wait, I didn't insert a closing brace for it! That means it consumed the rest of the game loop!
# Wait, I did `code.replace(/} else \{\n            \n            \/\/ Player input/g, '} else {\n            \n            // Player input');` which didn't do anything because the first one was already replaced.
# Let's count open and close braces in the gameLoop function.
