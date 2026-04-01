// We can compress this by using an array of 32 strings (each 32 chars long) where each char represents a color index.
// This is much smaller to store in Firestore and local storage.
// ' ' = transparent, '1' = #00ff00
const size = 32;
const rows = [];
for (let y = 0; y < size; y++) {
  let row = '';
  for (let x = 0; x < size; x++) {
    if ((x >= 8 && x <= 24 && (y === 8 || y === 24)) ||
        (x === 8 && y >= 8 && y <= 24) ||
        (x === 24 && y >= 16 && y <= 24) ||
        (x >= 16 && x <= 24 && y === 16)) {
       row += '1';
    } else {
       row += ' ';
    }
  }
  rows.push(row);
}
// 0 is transparent, 1 is #00ff00
const palette = ['transparent', '#00ff00'];
console.log(JSON.stringify({ palette, pixels: rows }));
