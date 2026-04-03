const { Client } = require('colyseus.js');

async function test() {
    const client = new Client('wss://seahorse-app-mv4sg.ondigitalocean.app');
    try {
        const room = await client.joinOrCreate('builder_room', { name: "TestBot" });
        console.log("Success! Joined builder_room on remote server.");
        room.leave();
    } catch (e) {
        console.error("Failed to connect to builder_room on remote server:", e.message);
    }
}
test();
