const fs = require('fs');

let content = fs.readFileSync('games/fps-map-builder.html', 'utf8');

// Replace selectedIndex with selectedIndices
content = content.replace('let selectedIndex = -1;', 'let selectedIndices = [];\nlet selectionGroup = new THREE.Group();');

content = content.replace('scene.add(grid);', 'scene.add(grid);\n\n  scene.add(selectionGroup);');

// Replace transformControls change listener
content = content.replace(
  `transformControls.addEventListener('change', () => {
    if (selectedIndex >= 0) syncObjectDataFromMesh(selectedIndex);
  });`,
  `transformControls.addEventListener('change', () => {
    selectedIndices.forEach(i => syncObjectDataFromMesh(i));
  });`
);

// We need to rewrite selectObject
const newSelectObject = `
function selectObject(index, additive = false) {
  // Detach all from selectionGroup back to scene
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
    // Reset group transform
    selectionGroup.position.set(0, 0, 0);
    selectionGroup.rotation.set(0, 0, 0);
    selectionGroup.scale.set(1, 1, 1);

    // Set group position to center of first selected object for pivot
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
  // Get world transform since it might be in selectionGroup
  const pos = new THREE.Vector3();
  const rot = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  mesh.matrixWorld.decompose(pos, rot, scale);
  const euler = new THREE.Euler().setFromQuaternion(rot);

  obj.data.pos = [pos.x, pos.y, pos.z];
  obj.data.rot = [euler.x, euler.y, euler.z];
  obj.data.size = [scale.x, scale.y, scale.z];

  // Only refresh inspector if it's the primary selection to avoid flickering
  if (selectedIndices[0] === index) refreshInspector();
}
`;

content = content.replace(/function selectObject\(index\) \{[\s\S]*?refreshInspector\(\);\n\}/, newSelectObject);

// Remove the old syncObjectDataFromMesh as it's part of the replacement above
content = content.replace(/function syncObjectDataFromMesh\(index\) \{[\s\S]*?refreshInspector\(\);\n\}\n/, '');

// Fix addObject to use selectObject
content = content.replace('selectObject(objects.length - 1);', 'selectObject(objects.length - 1, false);');

// Fix deleteSelected
content = content.replace(
  `function deleteSelected() {
  if (selectedIndex < 0) return;
  saveHistoryState();
  const obj = objects[selectedIndex];
  scene.remove(obj.mesh);
  objects.splice(selectedIndex, 1);

  // Re-index
  objects.forEach((o, i) => o.mesh.userData.index = i);

  selectObject(-1);
  refreshOutliner();
  updateStatus("Object Deleted");
}`,
  `function deleteSelected() {
  if (selectedIndices.length === 0) return;
  saveHistoryState();

  // Detach first
  selectedIndices.forEach(i => {
    if (objects[i] && objects[i].mesh) scene.attach(objects[i].mesh);
  });
  transformControls.detach();

  // Sort descending so splicing doesn't mess up indices
  selectedIndices.sort((a,b) => b - a);
  selectedIndices.forEach(i => {
    const obj = objects[i];
    scene.remove(obj.mesh);
    if(obj.mesh.geometry) obj.mesh.geometry.dispose();
    objects.splice(i, 1);
  });

  // Re-index
  objects.forEach((o, i) => o.mesh.userData.index = i);

  selectedIndices = [];
  refreshOutliner();
  refreshInspector();
  updateStatus("Objects Deleted");
}`
);

// Fix duplicateSelected
content = content.replace(
  `function duplicateSelected() {
  if (selectedIndex < 0) return;
  saveHistoryState();
  const original = objects[selectedIndex];
  const newData = JSON.parse(JSON.stringify(original.data));
  newData.pos[0] += 1;
  newData.pos[2] += 1;
  addObject(original.type, newData);
}`,
  `function duplicateSelected() {
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

  selectedIndices = []; // We will select the new ones
  toAdd.forEach(item => {
    addObject(item.type, item.data);
    selectedIndices.push(objects.length - 1); // Add to selection
  });
  selectObject(-1); // Trick to re-attach
  selectedIndices = toAdd.map((_, idx) => objects.length - toAdd.length + idx);
  selectObject(selectedIndices[0], true); // Force attach to group
  for(let i=1; i<selectedIndices.length; i++) selectObject(selectedIndices[i], true);
}`
);

// Fix copySelected
content = content.replace(
  `function copySelected() {
  if (selectedIndex < 0) return;
  const original = objects[selectedIndex];
  copiedObject = {
    type: original.type,
    data: JSON.parse(JSON.stringify(original.data))
  };
  updateStatus(\`Copied \${original.type}\`);
}`,
  `function copySelected() {
  if (selectedIndices.length === 0) return;
  copiedObject = selectedIndices.map(i => ({
    type: objects[i].type,
    data: JSON.parse(JSON.stringify(objects[i].data))
  }));
  updateStatus(\`Copied \${selectedIndices.length} objects\`);
}`
);

// Fix pasteCopiedObject
content = content.replace(
  `function pasteCopiedObject() {
  if (!copiedObject) return;
  saveHistoryState();
  const newData = JSON.parse(JSON.stringify(copiedObject.data));
  if (Array.isArray(newData.pos) && newData.pos.length === 3) {
    newData.pos[0] += 1;
    newData.pos[2] += 1;
  }
  addObject(copiedObject.type, newData);
  updateStatus(\`Pasted \${copiedObject.type}\`);
}`,
  `function pasteCopiedObject() {
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
}`
);

// Fix refreshOutliner
content = content.replace(
  `div.className = \`outliner-item \${i === selectedIndex ? 'selected' : ''}\`;`,
  `div.className = \`outliner-item \${selectedIndices.includes(i) ? 'selected' : ''}\`;`
);
content = content.replace(
  `div.onclick = () => selectObject(i);`,
  `div.onclick = (e) => selectObject(i, e.shiftKey || e.ctrlKey || e.metaKey);`
);

// Fix refreshInspector
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

// Fix updateSelectedProp
content = content.replace(
  `function updateSelectedProp(key, index, value) {
  if (selectedIndex < 0) return;
  const obj = objects[selectedIndex];`,
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

content = content.replace(
  `const mesh = obj.mesh;
  if (key === 'pos') mesh.position.set(...obj.data.pos);
  if (key === 'rot') mesh.rotation.set(...obj.data.rot);
  if (key === 'size') mesh.scale.set(...obj.data.size);
  if (key === 'material') applyObjectVisual(obj);

  updateStatus(\`Updated \${key}\`);
}`,
  ``
);

// Fix focus
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

// Fix raycasting selection
content = content.replace(
  `if (intersects.length > 0) {
    selectObject(intersects[0].object.userData.index);
  }`,
  `if (intersects.length > 0) {
    selectObject(intersects[0].object.userData.index, e.shiftKey || e.ctrlKey || e.metaKey);
  } else {
    selectObject(-1);
  }`
);

fs.writeFileSync('games/fps-map-builder.html', content);
