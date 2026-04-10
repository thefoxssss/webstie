// Test drawing math
function drawPointer(ctx, localX, localY, targetX, targetY, canvasWidth, canvasHeight, distance) {
    const dx = targetX - localX;
    const dy = targetY - localY;
    const angle = Math.atan2(dy, dx);
    const radius = Math.min(canvasWidth, canvasHeight) / 2 - 40;

    // Draw near edge of screen
    const x = canvasWidth / 2 + Math.cos(angle) * radius;
    const y = canvasHeight / 2 + Math.sin(angle) * radius;

    console.log(`Pointer at ${x}, ${y} for angle ${angle}`);
}

drawPointer(null, 100, 100, 300, -50, 800, 600, 250);
