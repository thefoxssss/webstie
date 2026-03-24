const fs = require('fs');
let content = fs.readFileSync('script.js', 'utf8');

// The function `disableInGameExitButtons()` hides the exit buttons inside games.
// Let's remove this behavior or adapt it.
content = content.replace(
  /disableInGameExitButtons\(\);/g,
  `// disableInGameExitButtons(); // Removed so exit buttons work`
);

content = content.replace(
  /function disableInGameExitButtons\(\) \{[\s\S]*?\}\n/g,
  `function disableInGameExitButtons() {
  // disabled since we now need exit buttons
}
`
);

fs.writeFileSync('script.js', content);
