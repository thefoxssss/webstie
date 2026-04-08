
function perlin(x, y, z) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);
  const A = permutation[X] + Y, AA = permutation[A] + Z, AB = permutation[A + 1] + Z;
  const B = permutation[X + 1] + Y, BA = permutation[B] + Z, BB = permutation[B + 1] + Z;
  return lerp(w, lerp(v, lerp(u, grad(permutation[AA], x, y, z),
                                 grad(permutation[BA], x - 1, y, z)),
                         lerp(u, grad(permutation[AB], x, y - 1, z),
                                 grad(permutation[BB], x - 1, y - 1, z))),
                 lerp(v, lerp(u, grad(permutation[AA + 1], x, y, z - 1),
                                 grad(permutation[BA + 1], x - 1, y, z - 1)),
                         lerp(u, grad(permutation[AB + 1], x, y - 1, z - 1),
                                 grad(permutation[BB + 1], x - 1, y - 1, z - 1))));
}

function layeredNoise(x, y, octaves, persistence, scale) {
  let total = 0;
  let frequency = scale;
  let amplitude = 1;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    total += perlin(x * frequency, y * frequency, 0) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }
  return total / maxValue;
}

// Initialize Firebase (You will eventually need your Firebase Service Account key here)
// admin.initializeApp({
//   credential: admin.credential.cert(require("./firebase-key.json"))
// });



for (let y = 20; y < 25; y++) {
    let line = "";
    for (let x = 0; x < 50; x++) {
        let noise = layeredNoise(x, y, 3, 0.5, 0.05);
        if (Math.abs(noise) < 0.25) line += " ";
        else line += "#";
    }
    console.log(line);
}
