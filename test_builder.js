const { Client } = require("colyseus.js");

async function test() {
    const client = new Client("ws://localhost:2567");

    console.log("Connecting...");
    try {
        const room = await client.joinOrCreate('builder_room', { name: "TestBot" });
        console.log("Joined builder room successfully!");

        // Try building far away
        console.log("Attempting distant build...");
        const targetX = 2000 * 32;
        const targetY = 2000 * 32;
        // Move player close to target first to satisfy reach check
        room.send("input", { left: false, right: false, upPress: false }); // Just to trigger state logic if needed

        // Reach check is 6 blocks = 6 * 32 = 192 pixels.
        // Let's just build something at (100, 100) instead which should be near spawn
        console.log("Building at 100, 100...");
        room.send("build", { x: 100, y: 100, type: 4 });

        setTimeout(() => {
            console.log("Leaving room...");
            room.leave();
            process.exit(0);
        }, 1000);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
