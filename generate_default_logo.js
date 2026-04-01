const size = 32;
const pixels = [];
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    // Draw a simple plus or cross in the middle as a default logo
    if ((x >= 12 && x <= 19 && y >= 4 && y <= 27) || (y >= 12 && y <= 19 && x >= 4 && x <= 27)) {
       pixels.push("#00ff00"); // green cross
    } else {
       pixels.push("transparent");
    }
  }
}
console.log(JSON.stringify(pixels));
