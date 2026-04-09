const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const furnaceTick = `
    // Furnace Smelting Logic
    this.state.furnaces.forEach(furnace => {
        if (furnace.inputCount > 0 && furnace.fuelCount > 0 && furnace.inputItem >= 12 && furnace.inputItem <= 17) {
            // Check if fuel is log/coal
            if (furnace.fuelItem === 12 || furnace.fuelItem === 7 || furnace.fuelItem === 9) {
                furnace.progress += 1;
                if (furnace.progress >= 100) {
                    furnace.progress = 0;

                    furnace.inputCount--;
                    if (furnace.inputCount <= 0) furnace.inputItem = 0;

                    furnace.fuelCount--;
                    if (furnace.fuelCount <= 0) furnace.fuelItem = 0;

                    let outputType = 0;
                    if (furnace.inputItem === 13) outputType = 43;
                    if (furnace.inputItem === 14) outputType = 44;
                    if (furnace.inputItem === 15) outputType = 45;
                    if (furnace.inputItem === 16) outputType = 46;
                    if (furnace.inputItem === 17) outputType = 47;
                    if (furnace.inputItem === 12) outputType = 12; // Coal

                    if (outputType !== 0) {
                        if (furnace.outputItem === 0 || furnace.outputItem === outputType) {
                            furnace.outputItem = outputType;
                            furnace.outputCount++;
                        } else {
                            // Output full of something else, refund
                            furnace.inputCount++;
                            furnace.fuelCount++;
                        }
                    }
                }
            }
        } else {
            furnace.progress = 0;
        }
    });
`;

if (!code.includes('// Furnace Smelting Logic')) {
    code = code.replace(/    this\.state\.players\.forEach\(\(p, sessionId\) => \{/, furnaceTick.trim() + "\n\n    this.state.players.forEach((p, sessionId) => {");
}
fs.writeFileSync('server.js', code);
