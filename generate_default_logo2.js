const size = 32;
const pixels = [];
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    // Draw a simple G shape (for Gooner) or just a square
    if ((x >= 8 && x <= 24 && (y === 8 || y === 24)) ||
        (x === 8 && y >= 8 && y <= 24) ||
        (x === 24 && y >= 16 && y <= 24) ||
        (x >= 16 && x <= 24 && y === 16)) {
       pixels.push("#00ff00"); // green outline
    } else {
       pixels.push("transparent");
    }
  }
}
console.log(JSON.stringify(pixels));
