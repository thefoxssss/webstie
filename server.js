const colyseus = require("colyseus");
const http = require("http");
const express = require("express");
const admin = require("firebase-admin"); // <-- Firebase is here!

// Initialize Firebase (You will eventually need your Firebase Service Account key here)
// admin.initializeApp({
//   credential: admin.credential.cert(require("./firebase-key.json"))
// });

const app = express();
const port = process.env.PORT || 2567;

const gameServer = new colyseus.Server({
  server: http.createServer(app)
});

class GameRoom extends colyseus.Room {
  
  // 1. FIREBASE CHECK: Make sure they are logged into Firebase before letting them play!
  async onAuth(client, options, request) {
    /* Once you add your Firebase key, you will uncomment this code to verify them:
    try {
      const decodedToken = await admin.auth().verifyIdToken(options.accessToken);
      return decodedToken; 
    } catch (e) {
      throw new colyseus.ServerError(400, "Bad Firebase Token");
    }
    */
    return true; // Letting anyone in for now just so you can test the movement!
  }

  // 2. THE GAME LOOP: Fast movement, no lag!
  onCreate(options) {
    console.log("Game room created!");
    
    this.onMessage("move", (client, message) => {
      // Broadcast movement to everyone else instantly
      this.broadcast("move", message, { except: client });
    });
  }

  onJoin(client, options, auth) {
    // When Firebase is fully linked, you can pull their Firebase UID right here
    // console.log(`Firebase User ${auth.uid} joined the game!`);
    console.log(`Player ${client.sessionId} joined the game!`);
  }

  onLeave(client, consented) {
    console.log(`Player ${client.sessionId} left the game!`);
    // Here is where you could tell Firebase to save their coins or high score!
  }
}

gameServer.define("my_game_room", GameRoom);

gameServer.listen(port);
console.log(`Colyseus game server is listening on port ${port}...`);
