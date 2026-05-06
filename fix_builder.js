const fs = require('fs');

let content = fs.readFileSync('games/fps-map-builder.html', 'utf8');

// 1. Add "Test Map" button to UI
content = content.replace(
  '<button id="btnDownload" class="primary">Download JSON</button>',
  '<button id="btnDownload" class="primary">Download JSON</button>\n    <button id="btnTestMap" style="background:#22c55e; color:white;">Test Map</button>'
);

// 2. Add Prefab buttons to left sidebar
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

// 3. Add Snap dropdown to viewport toolbar
content = content.replace(
  '<button id="btnSnap">Snap: ON</button>',
  '<button id="btnSnap">Snap: ON</button>\n      <select id="snapStep" style="background:var(--bg-light); color:var(--text-main); border:1px solid var(--border); border-radius:4px; padding:4px; margin-right:8px;" title="Snap Size">\n        <option value="0.1">0.1</option>\n        <option value="0.25">0.25</option>\n        <option value="0.5">0.5</option>\n        <option value="1" selected>1.0</option>\n        <option value="2">2.0</option>\n        <option value="4">4.0</option>\n      </select>'
);

// 4. Add UI overlay and Selection Box div for canvas
content = content.replace(
  '<canvas id="view"></canvas>',
  '<canvas id="view"></canvas>\n    <div id="selectionBox" style="display:none; position:absolute; border:1px solid #3b82f6; background:rgba(59, 130, 246, 0.2); pointer-events:none;"></div>'
);

content = content.replace(
  '</body></html>',
  `<div id="testMapOverlay" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:9999; justify-content:center; align-items:center;">
    <div style="color:white; font-size:24px; font-weight:bold; text-shadow:2px 2px 0 #000; background:rgba(0,0,0,0.5); padding:10px 20px; border-radius:8px;">TEST MODE - Press ESC to Exit</div>
    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:white; font-size:20px;">+</div>
  </div>
</body></html>`
);

// 5. Add PointerLockControls import
content = content.replace(
  `import { TransformControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/TransformControls.js';`,
  `import { TransformControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/TransformControls.js';\nimport { PointerLockControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/PointerLockControls.js';`
);

// 6. Update state variables (multi-select, box select, test map, prefabs, snap)
content = content.replace(
  'let selectedIndex = -1;',
  'let selectedIndices = [];\nlet selectionGroup = new THREE.Group();'
);

content = content.replace(
  'const canvas = document.getElementById(\'view\');',
  'const canvas = document.getElementById(\'view\');\nconst selectionBoxEl = document.getElementById(\'selectionBox\');\nlet isBoxSelecting = false;\nlet boxSelectStart = new THREE.Vector2();\nlet boxSelectEnd = new THREE.Vector2();\nconst testMapOverlay = document.getElementById(\'testMapOverlay\');'
);

content = content.replace(
  'const btnDownload = document.getElementById(\'btnDownload\');',
  `const btnDownload = document.getElementById('btnDownload');\nconst btnTestMap = document.getElementById('btnTestMap');`
);

content = content.replace(
  'const addPickupBtn = document.getElementById(\'addPickupBtn\');',
  `const addPickupBtn = document.getElementById('addPickupBtn');
const addWallBtn = document.getElementById('addWallBtn');
const addFloorBtn = document.getElementById('addFloorBtn');
const addDoorwayBtn = document.getElementById('addDoorwayBtn');
const addWindowBtn = document.getElementById('addWindowBtn');
const addStairsBtn = document.getElementById('addStairsBtn');
const addRoomBtn = document.getElementById('addRoomBtn');
const snapStepEl = document.getElementById('snapStep');`
);

// 7. Add selectionGroup and grid to scene
content = content.replace('scene.add(grid);', 'scene.add(grid);\n\n  scene.add(selectionGroup);');

// 8. Update transformControls change listener
content = content.replace(
  `transformControls.addEventListener('change', () => {
    if (selectedIndex >= 0) syncObjectDataFromMesh(selectedIndex);
  });`,
  `transformControls.addEventListener('change', () => {
    selectedIndices.forEach(i => syncObjectDataFromMesh(i));
  });`
);

// 9. Replace single object logic with multi-object logic
const newObjectManagement = `
// Object Management
function addObject(type, data = {}) {
  let mesh;
  const defaultData = { pos: [0, 0, 0], rot: [0, 0, 0], size: [1, 1, 1], material: 'default' };
  const finalData = { ...defaultData, ...data };

  if (type === 'box') {
    mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshPhongMaterial({ color: 0x94a3b8 })
    );
  } else if (type === 'spawn') {
    mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 2, 8),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, wireframe: true })
    );
    finalData.team = data.team || 0;
  } else if (type === 'light') {
    mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xeab308 })
    );
    finalData.lightType = data.lightType || 'point';
    finalData.intensity = data.intensity || 1;
    finalData.color = data.color || '#ffffff';
  } else if (type === 'pickup') {
    mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6, wireframe: true })
    );
    finalData.pickupType = data.pickupType || 'health';
  }

  mesh.position.set(...finalData.pos);
  mesh.rotation.set(...finalData.rot);
  mesh.scale.set(...finalData.size);
  mesh.userData.index = objects.length;

  scene.add(mesh);
  const obj = { type, mesh, data: finalData };
  objects.push(obj);
  applyObjectVisual(obj);

  selectObject(objects.length - 1, false);
  refreshOutliner();
  updateStatus(\`Added \${type}\`);
}

function selectObject(index, additive = false) {
  selectedIndices.forEach(i => {
    if (objects[i] && objects[i].mesh) scene.attach(objects[i].mesh);
  });
  transformControls.detach();

  if (index === -1) {
    selectedIndices = [];
  } else if (additive) {
    const idx = selectedIndices.indexOf(index);
    if (idx >= 0) {
      selectedIndices.splice(idx, 1);
    } else {
      selectedIndices.push(index);
    }
  } else {
    selectedIndices = [index];
  }

  if (selectedIndices.length > 0) {
    selectionGroup.position.set(0, 0, 0);
    selectionGroup.rotation.set(0, 0, 0);
    selectionGroup.scale.set(1, 1, 1);

    const firstMesh = objects[selectedIndices[0]].mesh;
    firstMesh.getWorldPosition(selectionGroup.position);

    selectedIndices.forEach(i => {
      selectionGroup.attach(objects[i].mesh);
    });
    transformControls.attach(selectionGroup);
  }

  refreshOutliner();
  refreshInspector();
}

function syncObjectDataFromMesh(index) {
  const obj = objects[index];
  const mesh = obj.mesh;
  const pos = new THREE.Vector3();
  const rot = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  mesh.matrixWorld.decompose(pos, rot, scale);
  const euler = new THREE.Euler().setFromQuaternion(rot);

  obj.data.pos = [pos.x, pos.y, pos.z];
  obj.data.rot = [euler.x, euler.y, euler.z];
  obj.data.size = [scale.x, scale.y, scale.z];

  if (selectedIndices[0] === index) refreshInspector();
}

function deleteSelected() {
  if (selectedIndices.length === 0) return;
  saveHistoryState();

  selectedIndices.forEach(i => {
    if (objects[i] && objects[i].mesh) scene.attach(objects[i].mesh);
  });
  transformControls.detach();

  selectedIndices.sort((a,b) => b - a);
  selectedIndices.forEach(i => {
    const obj = objects[i];
    scene.remove(obj.mesh);
    if(obj.mesh.geometry) obj.mesh.geometry.dispose();
    objects.splice(i, 1);
  });

  objects.forEach((o, i) => o.mesh.userData.index = i);

  selectedIndices = [];
  refreshOutliner();
  refreshInspector();
  updateStatus("Objects Deleted");
}

function duplicateSelected() {
  if (selectedIndices.length === 0) return;
  saveHistoryState();

  const toAdd = [];
  selectedIndices.forEach(i => {
    const original = objects[i];
    const newData = JSON.parse(JSON.stringify(original.data));
    newData.pos[0] += 1;
    newData.pos[2] += 1;
    toAdd.push({type: original.type, data: newData});
  });

  selectedIndices = [];
  toAdd.forEach(item => {
    addObject(item.type, item.data);
    selectedIndices.push(objects.length - 1);
  });
  selectObject(-1);
  selectedIndices = toAdd.map((_, idx) => objects.length - toAdd.length + idx);
  selectedIndices.forEach(idx => selectObject(idx, true));
}

function copySelected() {
  if (selectedIndices.length === 0) return;
  copiedObject = selectedIndices.map(i => ({
    type: objects[i].type,
    data: JSON.parse(JSON.stringify(objects[i].data))
  }));
  updateStatus(\`Copied \${selectedIndices.length} objects\`);
}

function pasteCopiedObject() {
  if (!copiedObject || copiedObject.length === 0) return;
  saveHistoryState();

  const toSelect = [];
  copiedObject.forEach(item => {
    const newData = JSON.parse(JSON.stringify(item.data));
    if (Array.isArray(newData.pos) && newData.pos.length === 3) {
      newData.pos[0] += 1;
      newData.pos[2] += 1;
    }
    addObject(item.type, newData);
    toSelect.push(objects.length - 1);
  });

  selectObject(-1);
  toSelect.forEach(idx => selectObject(idx, true));
  updateStatus(\`Pasted \${copiedObject.length} objects\`);
}
`;

content = content.replace(/\/\/ Object Management[\s\S]*?function refreshOutliner\(\) \{/, newObjectManagement + '\n// UI Refresh\nfunction refreshOutliner() {');

// 10. Fix outliner rendering
content = content.replace(
  `div.className = \`outliner-item \${i === selectedIndex ? 'selected' : ''}\`;`,
  `div.className = \`outliner-item \${selectedIndices.includes(i) ? 'selected' : ''}\`;`
);
content = content.replace(
  `div.onclick = () => selectObject(i);`,
  `div.onclick = (e) => selectObject(i, e.shiftKey || e.ctrlKey || e.metaKey);`
);

// 11. Fix inspector rendering
content = content.replace(
  `function refreshInspector() {
  if (selectedIndex < 0) {
    inspectorEl.innerHTML = '<div class="empty-msg">Select an object to view properties</div>';
    return;
  }
  const obj = objects[selectedIndex];`,
  `function refreshInspector() {
  if (selectedIndices.length === 0) {
    inspectorEl.innerHTML = '<div class="empty-msg">Select an object to view properties</div>';
    return;
  }
  const obj = objects[selectedIndices[0]];
  const multiText = selectedIndices.length > 1 ? \`<div class="hint">(\${selectedIndices.length} items selected. Edits apply to all.)</div>\` : '';`
);
content = content.replace(
  `inspectorEl.innerHTML = html;`,
  `inspectorEl.innerHTML = multiText + html;`
);

// 12. Fix property update logic
content = content.replace(
  `function updateSelectedProp(key, index, value) {
  if (selectedIndex < 0) return;
  const obj = objects[selectedIndex];
  if (index !== null) {
    obj.data[key][index] = value;
  } else {
    obj.data[key] = value;
  }

  // Apply to mesh
  const mesh = obj.mesh;
  if (key === 'pos') mesh.position.set(...obj.data.pos);
  if (key === 'rot') mesh.rotation.set(...obj.data.rot);
  if (key === 'size') mesh.scale.set(...obj.data.size);
  if (key === 'material') applyObjectVisual(obj);

  updateStatus(\`Updated \${key}\`);
}`,
  `function updateSelectedProp(key, index, value) {
  if (selectedIndices.length === 0) return;
  selectedIndices.forEach(i => {
    const obj = objects[i];
    if (index !== null) {
      obj.data[key][index] = value;
    } else {
      obj.data[key] = value;
    }

    const mesh = obj.mesh;
    if (key === 'pos') mesh.position.set(...obj.data.pos);
    if (key === 'rot') mesh.rotation.set(...obj.data.rot);
    if (key === 'size') mesh.scale.set(...obj.data.size);
    if (key === 'material') applyObjectVisual(obj);
  });

  updateStatus(\`Updated \${key}\`);
}`
);

// 13. Fix focus action
content = content.replace(
  `if (selectedIndex >= 0) {
      const pos = objects[selectedIndex].mesh.position;
      camera.position.set(pos.x + 5, pos.y + 5, pos.z + 5);
      camera.lookAt(pos);
    }`,
  `if (selectedIndices.length > 0) {
      const pos = objects[selectedIndices[0]].mesh.position;
      camera.position.set(pos.x + 5, pos.y + 5, pos.z + 5);
      camera.lookAt(pos);
    }`
);

// 14. Add Test Map logic, Box Select, Snap settings, and Prefabs to bottom
const extraLogic = `
let isTesting = false;
let testControls;
let testVelocity = new THREE.Vector3();
let testDirection = new THREE.Vector3();
let testMoveForward = false;
let testMoveBackward = false;
let testMoveLeft = false;
let testMoveRight = false;
let testCanJump = false;
let testPrevTime = performance.now();
let testGameLoopId = null;

function initTestControls() {
  testControls = new PointerLockControls(camera, document.body);
  scene.add(testControls.getObject());

  testControls.addEventListener('lock', () => {
    isTesting = true;
    testMapOverlay.style.display = 'flex';
    document.querySelector('.top-nav').style.display = 'none';
    document.querySelector('.main-layout').style.display = 'none';
    document.querySelector('.bottom-bar').style.display = 'none';

    const spawns = objects.filter(o => o.type === 'spawn');
    if (spawns.length > 0) {
      const sp = spawns[0].mesh.position;
      testControls.getObject().position.set(sp.x, sp.y + 1, sp.z);
    } else {
      testControls.getObject().position.y = 2;
    }

    transformControls.detach();
    testPrevTime = performance.now();
    testLoop();
  });

  testControls.addEventListener('unlock', () => {
    isTesting = false;
    testMapOverlay.style.display = 'none';
    document.querySelector('.top-nav').style.display = 'flex';
    document.querySelector('.main-layout').style.display = 'flex';
    document.querySelector('.bottom-bar').style.display = 'flex';
    cancelAnimationFrame(testGameLoopId);

    camera.position.set(10, 10, 10);
    camera.lookAt(0,0,0);
    yaw = -Math.PI/4;
    pitch = -Math.PI/4;
  });
}

function testLoop() {
  if (!isTesting) return;
  testGameLoopId = requestAnimationFrame(testLoop);

  const time = performance.now();
  const delta = (time - testPrevTime) / 1000;

  testVelocity.x -= testVelocity.x * 10.0 * delta;
  testVelocity.z -= testVelocity.z * 10.0 * delta;
  testVelocity.y -= 40.0 * delta;

  testDirection.z = Number(testMoveForward) - Number(testMoveBackward);
  testDirection.x = Number(testMoveRight) - Number(testMoveLeft);
  testDirection.normalize();

  if (testMoveForward || testMoveBackward) testVelocity.z -= testDirection.z * 40.0 * delta;
  if (testMoveLeft || testMoveRight) testVelocity.x -= testDirection.x * 40.0 * delta;

  testControls.moveRight(-testVelocity.x * delta);
  testControls.moveForward(-testVelocity.z * delta);
  testControls.getObject().position.y += (testVelocity.y * delta);

  let highestFloor = 0;
  const px = testControls.getObject().position.x;
  const pz = testControls.getObject().position.z;

  objects.forEach(obj => {
    if (obj.type === 'box') {
      const box = new THREE.Box3().setFromObject(obj.mesh);
      if (px > box.min.x - 0.5 && px < box.max.x + 0.5 && pz > box.min.z - 0.5 && pz < box.max.z + 0.5) {
        if (box.max.y > highestFloor && testControls.getObject().position.y - 1.5 >= box.max.y - 0.5) {
          highestFloor = box.max.y;
        }
      }
    }
  });

  if (testControls.getObject().position.y < highestFloor + 1.5) {
    testVelocity.y = 0;
    testControls.getObject().position.y = highestFloor + 1.5;
    testCanJump = true;
  }

  renderer.render(scene, camera);
  testPrevTime = time;
}

function addPrefab(parts) {
  saveHistoryState();
  const toSelect = [];

  let baseX = 0; let baseY = 0; let baseZ = 0;
  if (selectedIndices.length > 0) {
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
`;

content = content.replace(
  'function initEventListeners() {',
  extraLogic + '\nfunction initEventListeners() {'
);

// 15. Setup event bindings for the new logic
const additionalBindings = `
  snapStepEl.onchange = () => {
    gridStep = parseFloat(snapStepEl.value);
    if (snapEnabled) {
      transformControls.setTranslationSnap(gridStep);
    }
  };

  btnTestMap.onclick = () => {
    if (!testControls) initTestControls();
    testControls.lock();
  };

  addWallBtn.onclick = () => addPrefab([ { pos: [0, 2, 0], size: [4, 4, 1] } ]);
  addFloorBtn.onclick = () => addPrefab([ { pos: [0, 0, 0], size: [4, 1, 4] } ]);
  addDoorwayBtn.onclick = () => addPrefab([ { pos: [-1.5, 2, 0], size: [1, 4, 1] }, { pos: [1.5, 2, 0], size: [1, 4, 1] }, { pos: [0, 4.5, 0], size: [4, 1, 1] } ]);
  addWindowBtn.onclick = () => addPrefab([ { pos: [-1.5, 2, 0], size: [1, 4, 1] }, { pos: [1.5, 2, 0], size: [1, 4, 1] }, { pos: [0, 0.5, 0], size: [2, 1, 1] }, { pos: [0, 4.5, 0], size: [4, 1, 1] } ]);
  addStairsBtn.onclick = () => addPrefab([ { pos: [0, 0.5, 0], size: [4, 1, 1] }, { pos: [0, 1.5, -1], size: [4, 1, 1] }, { pos: [0, 2.5, -2], size: [4, 1, 1] }, { pos: [0, 3.5, -3], size: [4, 1, 1] } ]);
  addRoomBtn.onclick = () => addPrefab([ { pos: [0, 0, 0], size: [10, 1, 10] }, { pos: [0, 5, 0], size: [10, 1, 10] }, { pos: [0, 2.5, -4.5], size: [10, 4, 1] }, { pos: [0, 2.5, 4.5], size: [10, 4, 1] }, { pos: [-4.5, 2.5, 0], size: [1, 4, 8] }, { pos: [4.5, 2.5, 0], size: [1, 4, 8] } ]);
`;

content = content.replace(
  `btnSnap.onclick = () => {
    snapEnabled = !snapEnabled;
    transformControls.setTranslationSnap(snapEnabled ? gridStep : null);
    transformControls.setRotationSnap(snapEnabled ? THREE.MathUtils.degToRad(15) : null);
    transformControls.setScaleSnap(snapEnabled ? 0.25 : null);
    btnSnap.textContent = \`Snap: \${snapEnabled ? 'ON' : 'OFF'}\`;
  };`,
  `btnSnap.onclick = () => {
    snapEnabled = !snapEnabled;
    transformControls.setTranslationSnap(snapEnabled ? gridStep : null);
    transformControls.setRotationSnap(snapEnabled ? THREE.MathUtils.degToRad(15) : null);
    transformControls.setScaleSnap(snapEnabled ? 0.25 : null);
    btnSnap.textContent = \`Snap: \${snapEnabled ? 'ON' : 'OFF'}\`;
  };\n` + additionalBindings
);

// 16. Replace the old Raycasting for selection section with the new Box/Raycast selection logic
const newSelectionLogic = `
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || transformControls.dragging) return;
  if (document.pointerLockElement === canvas) return;

  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(objects.map(o => o.mesh));

  if (intersects.length > 0) {
    isBoxSelecting = false;
    selectObject(intersects[0].object.userData.index, e.shiftKey || e.ctrlKey || e.metaKey);
  } else {
    isBoxSelecting = true;
    boxSelectStart.set(e.clientX, e.clientY);
    boxSelectEnd.copy(boxSelectStart);
    selectionBoxEl.style.display = 'block';
    selectionBoxEl.style.left = e.clientX + 'px';
    selectionBoxEl.style.top = e.clientY + 'px';
    selectionBoxEl.style.width = '0px';
    selectionBoxEl.style.height = '0px';
  }
});

document.addEventListener('mousemove', (e) => {
  if (!isBoxSelecting) return;
  boxSelectEnd.set(e.clientX, e.clientY);

  const minX = Math.min(boxSelectStart.x, boxSelectEnd.x);
  const maxX = Math.max(boxSelectStart.x, boxSelectEnd.x);
  const minY = Math.min(boxSelectStart.y, boxSelectEnd.y);
  const maxY = Math.max(boxSelectStart.y, boxSelectEnd.y);

  selectionBoxEl.style.left = minX + 'px';
  selectionBoxEl.style.top = minY + 'px';
  selectionBoxEl.style.width = (maxX - minX) + 'px';
  selectionBoxEl.style.height = (maxY - minY) + 'px';
});

document.addEventListener('mouseup', (e) => {
  if (!isBoxSelecting) return;
  isBoxSelecting = false;
  selectionBoxEl.style.display = 'none';

  if (boxSelectStart.distanceTo(boxSelectEnd) < 5) {
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) selectObject(-1);
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const minX = Math.min(boxSelectStart.x, boxSelectEnd.x) - rect.left;
  const maxX = Math.max(boxSelectStart.x, boxSelectEnd.x) - rect.left;
  const minY = Math.min(boxSelectStart.y, boxSelectEnd.y) - rect.top;
  const maxY = Math.max(boxSelectStart.y, boxSelectEnd.y) - rect.top;

  const toSelect = [];
  objects.forEach((obj, i) => {
    const pos = new THREE.Vector3();
    obj.mesh.getWorldPosition(pos);
    pos.project(camera);

    if (pos.z > 1) return;

    const px = (pos.x * 0.5 + 0.5) * rect.width;
    const py = (-(pos.y * 0.5) + 0.5) * rect.height;

    if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
      toSelect.push(i);
    }
  });

  if (!e.shiftKey && !e.ctrlKey && !e.metaKey) selectObject(-1);
  toSelect.forEach(idx => selectObject(idx, true));
});
`;

content = content.replace(/\/\/ Raycasting for selection[\s\S]*?\}\);/, '// Raycasting and Box Selection' + newSelectionLogic);

// 17. Add Test Map keys listener
const newKeys = `
  window.addEventListener('keydown', e => {
    if (isTesting) {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW': testMoveForward = true; break;
        case 'ArrowLeft':
        case 'KeyA': testMoveLeft = true; break;
        case 'ArrowDown':
        case 'KeyS': testMoveBackward = true; break;
        case 'ArrowRight':
        case 'KeyD': testMoveRight = true; break;
        case 'Space':
          if (testCanJump === true) testVelocity.y += 15.0;
          testCanJump = false;
          break;
      }
      return;
    }
    if (document.activeElement.tagName === 'INPUT') return;
`;

content = content.replace(
  `  window.addEventListener('keydown', e => {
    if (document.activeElement.tagName === 'INPUT') return;`,
  newKeys
);

const newKeyUp = `
  window.addEventListener('keyup', e => {
    if (isTesting) {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW': testMoveForward = false; break;
        case 'ArrowLeft':
        case 'KeyA': testMoveLeft = false; break;
        case 'ArrowDown':
        case 'KeyS': testMoveBackward = false; break;
        case 'ArrowRight':
        case 'KeyD': testMoveRight = false; break;
      }
    }
  });
`;

content = content.replace('init();\nsaveHistoryState();', newKeyUp + '\ninit();\nsaveHistoryState();');

// 18. Disable handleCameraMovement if testing
content = content.replace(
  'function handleCameraMovement() {',
  'function handleCameraMovement() {\n  if (isTesting) return;'
);

fs.writeFileSync('games/fps-map-builder.html', content);
