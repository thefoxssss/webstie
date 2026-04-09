const fs = require('fs');
let content = fs.readFileSync('games/builder.js', 'utf8');

const search = `        // Hold left click to repeatedly place blocks after a short delay.
        if (!e.shiftKey && e.button === 0) {`;
const replace = `        // Hold left/right click to repeatedly place/break blocks after a short delay.
        if (e.shiftKey || e.button === 2) {
            clearBuildHoldTimers();
            buildHoldTimeout = setTimeout(() => {
                buildHoldInterval = setInterval(() => {
                    if (!mouse.isDown || !room) {
                        clearBuildHoldTimers();
                        return;
                    }
                    sendBuildOrBreak({ button: 2, shiftKey: true, type: "interval" });
                }, BUILD_HOLD_REPEAT_MS);
            }, BUILD_HOLD_DELAY_MS);
        } else if (!e.shiftKey && e.button === 0) {`;

if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync('games/builder.js', content);
    console.log("Replaced");
} else {
    console.log("Not found");
}
