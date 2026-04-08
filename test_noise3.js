const fs = require('fs');
const code = fs.readFileSync('server.js', 'utf8');

const matches = code.match(/const permutation[\s\S]*?function layeredNoise[\s\S]*?return total \/ maxValue;\n\}/);

const script = `
${matches[0]}

for (let y = 15; y < 45; y++) {
    let line = "";
    for (let x = 0; x < 120; x++) {
        let caveNoise = layeredNoise(x, y, 3, 0.5, 0.1);
        let h = Math.floor(20 + layeredNoise(x, 0, 4, 0.5, 0.05) * 15);

        const isCave = Math.abs(caveNoise) < 0.08 && y >= h;

        if (y < h) {
            line += " ";
        } else if (isCave) {
            line += " ";
        } else {
            line += "#";
        }
    }
    console.log(String(y).padStart(2, "0") + " " + line);
}
`;
fs.writeFileSync('run_test_noise3.js', script);
