const { Client } = require("colyseus.js");

async function test() {
    const client = new Client("ws://localhost:2567");

    console.log("Connecting...");
    try {
        const room = await client.joinOrCreate('builder_room', { name: "TestBot" });
        console.log("Joined builder room successfully!");

        // Try building far away
        console.log("Attempting out of bounds build...");
        room.send("build", { x: 1000000, y: 1000000, type: 3 });

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
