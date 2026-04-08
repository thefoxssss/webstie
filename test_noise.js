// Extract noise functions from server.js
const fs = require('fs');
const code = fs.readFileSync('server.js', 'utf8');

// VERY simple extraction for test
const perlinMatch = code.match(/function perlin[\s\S]*?function layeredNoise/);
const layeredMatch = code.match(/function layeredNoise[\s\S]*?const app =/);

const script = `
${perlinMatch[0].replace('function layeredNoise', '')}
${layeredMatch[0].replace('const app =', '')}

for (let y = 20; y < 25; y++) {
    let line = "";
    for (let x = 0; x < 50; x++) {
        let noise = layeredNoise(x, y, 3, 0.5, 0.05);
        if (Math.abs(noise) < 0.25) line += " ";
        else line += "#";
    }
    console.log(line);
}
`;
fs.writeFileSync('run_test_noise.js', script);
