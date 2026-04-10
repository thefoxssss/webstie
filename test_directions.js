function getDirection(dx, dy) {
    const angle = Math.atan2(dy, dx) * 180 / Math.PI; // -180 to 180
    // 0 is right (East)
    // 90 is down (South)
    // -90 is up (North)
    // 180/-180 is left (West)
    if (angle >= -22.5 && angle < 22.5) return "E";
    if (angle >= 22.5 && angle < 67.5) return "SE";
    if (angle >= 67.5 && angle < 112.5) return "S";
    if (angle >= 112.5 && angle < 157.5) return "SW";
    if (angle >= 157.5 || angle < -157.5) return "W";
    if (angle >= -157.5 && angle < -112.5) return "NW";
    if (angle >= -112.5 && angle < -67.5) return "N";
    if (angle >= -67.5 && angle < -22.5) return "NE";
    return "?";
}

console.log("0 (dx=1, dy=0):", getDirection(1, 0));
console.log("90 (dx=0, dy=1):", getDirection(0, 1));
console.log("-90 (dx=0, dy=-1):", getDirection(0, -1));
console.log("180 (dx=-1, dy=0):", getDirection(-1, 0));
console.log("45 (dx=1, dy=1):", getDirection(1, 1));
console.log("-45 (dx=1, dy=-1):", getDirection(1, -1));
console.log("135 (dx=-1, dy=1):", getDirection(-1, 1));
console.log("-135 (dx=-1, dy=-1):", getDirection(-1, -1));
