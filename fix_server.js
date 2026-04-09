const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// The code review mentioned that patch_chests_server.js and patch_explosives.js weren't fully applied
// Let's re-apply them carefully using string replace.

// Add "interact" message for explosives and containers
const interactAdd = `
    this.onMessage("interact", (client, message) => {
        const p = this.state.players.get(client.sessionId);
        if (!p || p.hp <= 0) return;

        const x = Math.floor(message.x / TILE_SIZE);
        const y = Math.floor(message.y / TILE_SIZE);
        const cx = Math.floor(x / CHUNK_SIZE);
        const cy = Math.floor(y / CHUNK_SIZE);

        const distSq = (p.x+TILE_SIZE/2 - message.x)**2 + (p.y+TILE_SIZE/2 - message.y)**2;
        if (distSq > (TILE_SIZE * 6)**2) return;

        const chunk = this.state.chunks.get(\`\${cx},\${cy}\`);
        if (chunk) {
            const b = chunk.blocks.get(\`\${x},\${y}\`);
            if (b && (b.type === 33 || b.type === 34)) {
                // Ignite TNT (33) or Nuke (34)
                const explosive = new Explosive();
                explosive.x = x * TILE_SIZE + TILE_SIZE/2;
                explosive.y = y * TILE_SIZE + TILE_SIZE/2;
                explosive.type = b.type;
                explosive.timer = b.type === 34 ? 100 : 60; // Nuke takes longer
                this.state.explosives.set(\`exp-\${Date.now()}-\${Math.random()}\`, explosive);

                chunk.blocks.delete(\`\${x},\${y}\`);
            } else if (b && (b.type === 31 || b.type === 32)) {
                // Chest or Furnace
                const containerId = \`\${x},\${y}\`;
                if (b.type === 31 && !this.state.chests.has(containerId)) {
                    this.state.chests.set(containerId, new ChestData());
                } else if (b.type === 32 && !this.state.furnaces.has(containerId)) {
                    this.state.furnaces.set(containerId, new FurnaceData());
                }
            }
        }
    });

    this.onMessage("container_move", (client, message) => {
        const p = this.state.players.get(client.sessionId);
        if (!p || p.hp <= 0) return;

        const containerId = message.containerId; // "x,y"
        const chest = this.state.chests.get(containerId);
        if (!chest) return;

        if (message.action === "put") {
            const currentItem = chest.items.get(message.slot.toString());
            if (currentItem && currentItem.type === message.item.type) {
                currentItem.count += message.item.count;
            } else if (!currentItem) {
                const newItem = new ChestItem();
                newItem.type = message.item.type;
                newItem.count = message.item.count;
                chest.items.set(message.slot.toString(), newItem);
            }
        } else if (message.action === "take") {
            const currentItem = chest.items.get(message.slot.toString());
            if (currentItem && currentItem.type === message.item.type) {
                currentItem.count -= message.item.count;
                if (currentItem.count <= 0) {
                    chest.items.delete(message.slot.toString());
                }
            }
        }
    });

    this.onMessage("furnace_sync", (client, message) => {
        const p = this.state.players.get(client.sessionId);
        if (!p || p.hp <= 0) return;

        const containerId = message.containerId;
        const furnace = this.state.furnaces.get(containerId);
        if (!furnace) return;

        furnace.inputItem = message.inputItem || 0;
        furnace.inputCount = message.inputCount || 0;
        furnace.fuelItem = message.fuelItem || 0;
        furnace.fuelCount = message.fuelCount || 0;
        furnace.outputItem = message.outputItem || 0;
        furnace.outputCount = message.outputCount || 0;
    });
`;

if (!code.includes('this.onMessage("interact"')) {
    code = code.replace(/    this\.onMessage\("hammer",/, interactAdd.trim() + "\n\n    this.onMessage(\"hammer\",");
}

const explodeLogic = `
    // Explosives logic
    const explosivesToDelete = [];
    this.state.explosives.forEach((exp, id) => {
        exp.timer--;
        if (exp.timer <= 0) {
            // EXPLODE!
            const isNuke = exp.type === 34;
            const radius = isNuke ? (TILE_SIZE * 15) : (TILE_SIZE * 5);
            const damage = isNuke ? 100 : 20;

            // Damage players
            this.state.players.forEach(p => {
                if (p.hp <= 0) return;
                const dx = p.x + TILE_SIZE/2 - exp.x;
                const dy = p.y + TILE_SIZE/2 - exp.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < radius) {
                    this.damagePlayer(p, damage, isNuke ? "Nuke" : "TNT");
                    const knockback = (radius - dist) / radius * (isNuke ? 30 : 15);
                    p.vx += (dx / dist) * knockback;
                    p.vy += (dy / dist) * knockback - 5;
                }
            });

            // Destroy blocks
            const blockRadius = Math.ceil(radius / TILE_SIZE);
            const expTx = Math.floor(exp.x / TILE_SIZE);
            const expTy = Math.floor(exp.y / TILE_SIZE);

            for (let dx = -blockRadius; dx <= blockRadius; dx++) {
                for (let dy = -blockRadius; dy <= blockRadius; dy++) {
                    if (dx*dx + dy*dy <= blockRadius*blockRadius) {
                        const tx = expTx + dx;
                        const ty = expTy + dy;
                        const cx = Math.floor(tx / CHUNK_SIZE);
                        const cy = Math.floor(ty / CHUNK_SIZE);
                        const chunk = this.state.chunks.get(\`\${cx},\${cy}\`);
                        if (chunk) {
                            const b = chunk.blocks.get(\`\${tx},\${ty}\`);
                            if (b) {
                                if (Math.random() < (isNuke ? 0.2 : 0.5)) {
                                    const drop = new ItemDrop();
                                    drop.id = \`drop-\${Date.now()}-\${Math.random()}\`;
                                    drop.x = tx * TILE_SIZE + TILE_SIZE / 2;
                                    drop.y = ty * TILE_SIZE + TILE_SIZE / 2;
                                    drop.vx = (Math.random() - 0.5) * 8;
                                    drop.vy = -4 - Math.random() * 8;
                                    drop.type = b.type;
                                    drop.count = 1;
                                    this.state.drops.set(drop.id, drop);
                                }
                                chunk.blocks.delete(\`\${tx},\${ty}\`);
                            }
                        }
                    }
                }
            }

            explosivesToDelete.push(id);
        }
    });
    explosivesToDelete.forEach(id => this.state.explosives.delete(id));
`;

if (!code.includes('this.state.explosives.forEach')) {
    code = code.replace(/    \/\/ Simulate item drops physics/, explodeLogic.trim() + "\n\n    // Simulate item drops physics");
}

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
