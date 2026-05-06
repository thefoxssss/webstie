const fs = require('fs');

let content = fs.readFileSync('games/fps-map-builder.html', 'utf8');

content = content.replace(
  '<button id="addPickupBtn" title="Add Pickup">Pickup</button>\n    </div>',
  `<button id="addPickupBtn" title="Add Pickup">Pickup</button>
    </div>
    <div class="section-title">Prefabs</div>
    <div class="add-actions">
      <button id="addWallBtn">Wall</button>
      <button id="addFloorBtn">Floor</button>
      <button id="addDoorwayBtn">Doorway</button>
      <button id="addWindowBtn">Window</button>
      <button id="addStairsBtn">Stairs</button>
      <button id="addRoomBtn">Room</button>
    </div>`
);

content = content.replace(
  'const addPickupBtn = document.getElementById(\'addPickupBtn\');',
  `const addPickupBtn = document.getElementById('addPickupBtn');
const addWallBtn = document.getElementById('addWallBtn');
const addFloorBtn = document.getElementById('addFloorBtn');
const addDoorwayBtn = document.getElementById('addDoorwayBtn');
const addWindowBtn = document.getElementById('addWindowBtn');
const addStairsBtn = document.getElementById('addStairsBtn');
const addRoomBtn = document.getElementById('addRoomBtn');`
);

// We need a helper to add multiple blocks and select them together
const prefabLogic = `
function addPrefab(parts) {
  saveHistoryState();
  const toSelect = [];

  // Use camera look target or origin as base
  let baseX = 0; let baseY = 0; let baseZ = 0;
  if (selectedIndex >= 0) {
    const p = objects[selectedIndices[0]].mesh.position;
    baseX = p.x; baseY = p.y; baseZ = p.z;
  }

  parts.forEach(p => {
    addObject('box', {
      pos: [p.pos[0] + baseX, p.pos[1] + baseY, p.pos[2] + baseZ],
      size: p.size,
      material: p.material || 'default'
    });
    toSelect.push(objects.length - 1);
  });

  selectObject(-1);
  toSelect.forEach(idx => selectObject(idx, true));
  updateStatus("Added Prefab");
}

addWallBtn.onclick = () => addPrefab([
  { pos: [0, 2, 0], size: [4, 4, 1] }
]);

addFloorBtn.onclick = () => addPrefab([
  { pos: [0, 0, 0], size: [4, 1, 4] }
]);

addDoorwayBtn.onclick = () => addPrefab([
  { pos: [-1.5, 2, 0], size: [1, 4, 1] },
  { pos: [1.5, 2, 0], size: [1, 4, 1] },
  { pos: [0, 4.5, 0], size: [4, 1, 1] }
]);

addWindowBtn.onclick = () => addPrefab([
  { pos: [-1.5, 2, 0], size: [1, 4, 1] },
  { pos: [1.5, 2, 0], size: [1, 4, 1] },
  { pos: [0, 0.5, 0], size: [2, 1, 1] },
  { pos: [0, 4.5, 0], size: [4, 1, 1] }
]);

addStairsBtn.onclick = () => addPrefab([
  { pos: [0, 0.5, 0], size: [4, 1, 1] },
  { pos: [0, 1.5, -1], size: [4, 1, 1] },
  { pos: [0, 2.5, -2], size: [4, 1, 1] },
  { pos: [0, 3.5, -3], size: [4, 1, 1] }
]);

addRoomBtn.onclick = () => addPrefab([
  { pos: [0, 0, 0], size: [10, 1, 10] }, // floor
  { pos: [0, 5, 0], size: [10, 1, 10] }, // ceiling
  { pos: [0, 2.5, -4.5], size: [10, 4, 1] }, // north wall
  { pos: [0, 2.5, 4.5], size: [10, 4, 1] }, // south wall
  { pos: [-4.5, 2.5, 0], size: [1, 4, 8] }, // west wall
  { pos: [4.5, 2.5, 0], size: [1, 4, 8] }  // east wall
]);
`;

content = content.replace(
  'addPickupBtn.onclick = () => addObject(\'pickup\');',
  'addPickupBtn.onclick = () => addObject(\'pickup\');\n\n' + prefabLogic
);

fs.writeFileSync('games/fps-map-builder.html', content);
