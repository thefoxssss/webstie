const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

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
fs.writeFileSync('server.js', code);
