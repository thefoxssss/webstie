const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

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

code = code.replace(/this\.onMessage\("hammer",/, interactAdd.trim() + "\n\nthis.onMessage(\"hammer\",");
fs.writeFileSync('server.js', code);
