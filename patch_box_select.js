const fs = require('fs');

let content = fs.readFileSync('games/fps-map-builder.html', 'utf8');

// Insert a div for the selection box
content = content.replace(
  '<canvas id="view"></canvas>',
  '<canvas id="view"></canvas>\n    <div id="selectionBox" style="display:none; position:absolute; border:1px solid #3b82f6; background:rgba(59, 130, 246, 0.2); pointer-events:none;"></div>'
);

// Inject variables for box selection
content = content.replace(
  'const canvas = document.getElementById(\'view\');',
  'const canvas = document.getElementById(\'view\');\nconst selectionBoxEl = document.getElementById(\'selectionBox\');\nlet isBoxSelecting = false;\nlet boxSelectStart = new THREE.Vector2();\nlet boxSelectEnd = new THREE.Vector2();'
);

// We need to change the canvas click handler and mousedown/up
// The current code has:
/*
canvas.addEventListener('click', (e) => {
  if (transformControls.dragging) return;
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(objects.map(o => o.mesh));
  if (intersects.length > 0) {
    selectObject(intersects[0].object.userData.index, e.shiftKey || e.ctrlKey || e.metaKey);
  } else {
    selectObject(-1);
  }
});
*/

content = content.replace(/canvas\.addEventListener\('click', \(e\) => \{[\s\S]*?\}\);/, '');

const newMouseEvents = `
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || transformControls.dragging) return;
  if (document.pointerLockElement === canvas) return; // camera look

  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(objects.map(o => o.mesh));

  if (intersects.length > 0) {
    // Clicked an object, don't box select
    isBoxSelecting = false;
    selectObject(intersects[0].object.userData.index, e.shiftKey || e.ctrlKey || e.metaKey);
  } else {
    // Start box select
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

  // If tiny drag, just count as click empty
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
    pos.project(camera); // NDC

    // Convert NDC to pixel
    const px = (pos.x * 0.5 + 0.5) * rect.width;
    const py = (-(pos.y * 0.5) + 0.5) * rect.height;

    // Check if behind camera
    if (pos.z > 1) return;

    if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
      toSelect.push(i);
    }
  });

  if (!e.shiftKey && !e.ctrlKey && !e.metaKey) selectObject(-1);
  toSelect.forEach(idx => selectObject(idx, true));
});
`;

content += '\n' + newMouseEvents;

fs.writeFileSync('games/fps-map-builder.html', content);
