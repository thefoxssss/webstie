const { Client } = require('colyseus.js');
async function run() {
    const client = new Client('ws://localhost:2567');
    const room = await client.joinOrCreate('builder_room', { name: "TestBot" });
    console.log("Joined builder room successfully!");
    setTimeout(() => {
        room.leave();
        console.log("Left room.");
        process.exit(0);
    }, 1000);
}
run().catch(e => { console.error(e); process.exit(1); });
