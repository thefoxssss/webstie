const fs = require('fs');
const code = fs.readFileSync('server.js', 'utf8');

const matches = code.match(/const permutation[\s\S]*?function layeredNoise[\s\S]*?return total \/ maxValue;\n\}/);

const script = `
${matches[0]}

for (let y = 15; y < 35; y++) {
    let line = "";
    for (let x = 0; x < 60; x++) {
        // test cave noise with the exact parameters used in server.js
        let caveNoise = layeredNoise(x, y, 3, 0.5, 0.05);
        let h = Math.floor(20 + layeredNoise(x, 0, 4, 0.5, 0.05) * 15);

        const isCave = Math.abs(caveNoise) < 0.25 && y >= h;

        if (y < h) {
            line += " ";
        } else if (isCave) {
            line += ".";
        } else {
            line += "#";
        }
    }
    console.log(String(y).padStart(2, "0") + " " + line);
}
`;
fs.writeFileSync('run_test_noise2.js', script);
