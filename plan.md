1. **Update `server.js` with Agar.io logic:**
   - Define `AgarPlayer`, `AgarFood`, and `AgarState` schemas using Colyseus `@colyseus/schema`.
   - Implement `AgarRoom` class, mimicking `BuilderRoom` for server discovery (`agarServerDirectory`).
   - Add tick loop inside `AgarRoom` to handle player movement, food collision, and player-to-player collision (eating).
   - Register the `agar_room` game room and add the `/agar-servers` Express endpoint.

2. **Update `index.html`:**
   - Add a new overlay `<div id="overlayAgar">` containing the menu for server joining/creation, and the game area with a canvas, a leaderboard overlay, and a death screen.

3. **Update `gameCatalog.js`:**
   - Add the Agar game entry to `GAME_DIRECTORY_ENTRIES` with `id: "agar"`.

4. **Update `script.js`:**
   - Import `initAgar` from `./games/agar.js`.
   - Call `initAgar()` in the game launch dispatch.

5. **Create `games/agar.js`:**
   - Implement the game loop with `requestAnimationFrame`.
   - Setup Colyseus client connection (handling local vs prod via the UI like Builder).
   - Draw players, foods, and a grid background.
   - Handle mouse movement (`mousemove`) to send target coordinates to the server.
   - Add logic for respawning and updating the leaderboard.

6. **Complete pre commit steps:**
   - Run pre commit scripts.
   - Verify server loads correctly, and syntax is clean.

7. **Submit the change.**
