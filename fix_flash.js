const fs = require('fs');
let code = fs.readFileSync('games/shadow-assassin-safe-rooms.html', 'utf8');

// The vignette rendering block
const vignetteBlock = `
            // Dynamic Screen Vignette & Player Lighting
            if (gameStarted && !gameOver && !showingUpgrade) {
                // Deep cool blue night vignette
                const vignetteGrad = ctx.createRadialGradient(
                    player.x, player.y, 80,
                    player.x, player.y, canvas.width * 0.7
                );

                let ambientColor = 'rgba(2, 5, 15, 0.9)'; // Dark navy vignette
                if (currentRoom.isSafeRoom) {
                    ambientColor = 'rgba(2, 15, 10, 0.8)';
                } else if (currentRoom.isBossRoom) {
                    ambientColor = 'rgba(15, 5, 25, 0.9)'; // Purple/blue for boss
                }

                vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
                vignetteGrad.addColorStop(0.3, 'rgba(5, 10, 20, 0.3)');
                vignetteGrad.addColorStop(1, ambientColor);

                // Multiply makes the dark edges actually darken everything beneath
                ctx.globalCompositeOperation = 'multiply';
                ctx.fillStyle = vignetteGrad;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.globalCompositeOperation = 'source-over';

                // Pulsing player light - mystical blue/cyan glow
                const isAttackingOrDashing = player.attacking || player.dashing;
                const lightPulse = 0.5 + Math.sin(Date.now() / 200) * 0.2;
                const lightSize = 160 + lightPulse * 40 + (isAttackingOrDashing ? 60 : 0);
                const lightGrad = ctx.createRadialGradient(
                    player.x, player.y - 10, 0,
                    player.x, player.y - 10, lightSize
                );

                let lightColor = currentRoom.isSafeRoom ? 'rgba(100, 255, 150, 0.25)' : 'rgba(120, 180, 255, 0.2)';
                if (isAttackingOrDashing) {
                    lightColor = currentRoom.isSafeRoom ? 'rgba(150, 255, 200, 0.4)' : 'rgba(150, 220, 255, 0.35)';
                }

                lightGrad.addColorStop(0, lightColor);
                lightGrad.addColorStop(0.5, lightColor.replace(/[\\d.]+\\)$/g, '0.05)'));
                lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

                // Screen blending mode makes it look like actual light
                ctx.globalCompositeOperation = 'screen';
                ctx.fillStyle = lightGrad;
                ctx.fillRect(player.x - lightSize, player.y - lightSize - 10, lightSize * 2, lightSize * 2);
                ctx.globalCompositeOperation = 'source-over'; // Reset
            }`;

// Let's create a new function called `drawDynamicLighting()` to hold this
if (!code.includes('function drawDynamicLighting()')) {
    const fnDef = `
        function drawDynamicLighting() {${vignetteBlock}
        }
`;
    // Insert it right before gameLoop
    code = code.replace('function gameLoop(now = performance.now()) {', fnDef + '\n        function gameLoop(now = performance.now()) {');

    // Replace the old block at the end with the function call
    const oldBlockRegex = /\/\/ Dynamic Screen Vignette & Player Lighting[\s\S]*?source-over'; \/\/ Reset\n            }/;
    code = code.replace(oldBlockRegex, 'drawDynamicLighting();');

    // Add the function call into the hitStopFrames block right before 'continue;'
    const hitStopRegex = /(drawExecutionCinematic\(\);\n                    )(continue;)/;
    code = code.replace(hitStopRegex, '$1drawDynamicLighting();\n                    $2');

    fs.writeFileSync('games/shadow-assassin-safe-rooms.html', code);
    console.log('Successfully refactored lighting and fixed hitStop flash bug.');
} else {
    console.log('Already refactored.');
}
