import fs from 'fs';
const code = fs.readFileSync('core.js', 'utf-8');
const regex = /export async function saveStats\(\) \{([\s\S]*?)\}/;
console.log(code.match(regex)[0].substring(0, 2500));
