const colyseus = require("colyseus");
const http = require("http");
const express = require("express");

// Set up a basic web server
const app = express();
const port = process.env.PORT || 2567; // DigitalOcean will inject its own port here

const gameServer = new colyseus.Server({
  server: http.createServer(app)
});

// Define your basic game room
class GameRoom extends colyseus.Room {
  onCreate(options) {
    console.log("Game room created!");
    
    // Listen for movement messages from thefoxsss.com
    this.onMessage("move", (client, message) => {
      console.log(`Player ${client.sessionId} moved!`, message);
      
      // Broadcast that movement to all other players in the room
      this.broadcast("move", message, { except: client });
    });
  }

  onJoin(client, options) {
    console.log(`Player ${client.sessionId} joined the game!`);
  }

  onLeave(client, consented) {
    console.log(`Player ${client.sessionId} left the game!`);
  }
}

// Open the room to the public
gameServer.define("my_game_room", GameRoom);

// Turn the server on!
gameServer.listen(port);
console.log(`Colyseus game server is listening on port ${port}...`);
