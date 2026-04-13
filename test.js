// Wait! I noticed something weird.
// In `games/builder.js`:
// ```javascript
//         // Handle Chest/Furnace clicks FIRST so they take priority
//         if (isChestOpen && currentChestId && room.state.chests && room.state.chests.has(currentChestId)) {
//             ...
//         } else if (isFurnaceOpen && currentFurnaceId && room.state.furnaces && room.state.furnaces.has(currentFurnaceId)) {
//             ...
//         }
// ```
// But wait! If `room.state.furnaces` doesn't exist, this fails. Is `room.state.furnaces` being correctly sent to the client?
// In Colyseus, `room.state` is synchronized, but maybe there's a schema issue.
