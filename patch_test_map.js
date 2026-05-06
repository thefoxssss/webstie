const fs = require('fs');

let content = fs.readFileSync('games/fps-map-builder.html', 'utf8');

// Add button
content = content.replace(
  '<button id="btnDownload" class="primary">Download JSON</button>',
  '<button id="btnDownload" class="primary">Download JSON</button>\n    <button id="btnTestMap" style="background:#22c55e; color:white;">Test Map</button>'
);

// Add UI overlay
content = content.replace(
  '</body></html>',
  `<div id="testMapOverlay" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:9999; justify-content:center; align-items:center;">
    <div style="color:white; font-size:24px; font-weight:bold; text-shadow:2px 2px 0 #000; background:rgba(0,0,0,0.5); padding:10px 20px; border-radius:8px;">TEST MODE - Press ESC to Exit</div>
    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:white; font-size:20px;">+</div>
  </div>
</body></html>`
);

// Add import
content = content.replace(
  `import { TransformControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/TransformControls.js';`,
  `import { TransformControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/TransformControls.js';\nimport { PointerLockControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/PointerLockControls.js';`
);

// Add state variables
content = content.replace(
  'const btnDownload = document.getElementById(\'btnDownload\');',
  `const btnDownload = document.getElementById('btnDownload');\nconst btnTestMap = document.getElementById('btnTestMap');\nconst testMapOverlay = document.getElementById('testMapOverlay');`
);

const testMapLogic = `
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

// Initialize PointerLockControls
function initTestControls() {
  testControls = new PointerLockControls(camera, document.body);
  scene.add(testControls.getObject());

  testControls.addEventListener('lock', () => {
    isTesting = true;
    testMapOverlay.style.display = 'flex';
    document.querySelector('.top-nav').style.display = 'none';
    document.querySelector('.main-layout').style.display = 'none';
    document.querySelector('.bottom-bar').style.display = 'none';

    // Position player slightly above ground or at spawn
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

    // Restore editor camera
    camera.position.set(10, 10, 10);
    camera.lookAt(0,0,0);
    yaw = -Math.PI/4;
    pitch = -Math.PI/4;
  });
}

btnTestMap.onclick = () => {
  if (!testControls) initTestControls();
  testControls.lock();
};

document.addEventListener('keydown', (e) => {
  if (!isTesting) return;
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
      if (testCanJump === true) testVelocity.y += 15.0; // Jump height
      testCanJump = false;
      break;
  }
});

document.addEventListener('keyup', (e) => {
  if (!isTesting) return;
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
});

function testLoop() {
  if (!isTesting) return;
  testGameLoopId = requestAnimationFrame(testLoop);

  const time = performance.now();
  const delta = (time - testPrevTime) / 1000;

  testVelocity.x -= testVelocity.x * 10.0 * delta;
  testVelocity.z -= testVelocity.z * 10.0 * delta;
  testVelocity.y -= 40.0 * delta; // Gravity

  testDirection.z = Number(testMoveForward) - Number(testMoveBackward);
  testDirection.x = Number(testMoveRight) - Number(testMoveLeft);
  testDirection.normalize();

  if (testMoveForward || testMoveBackward) testVelocity.z -= testDirection.z * 40.0 * delta;
  if (testMoveLeft || testMoveRight) testVelocity.x -= testDirection.x * 40.0 * delta;

  testControls.moveRight(-testVelocity.x * delta);
  testControls.moveForward(-testVelocity.z * delta);
  testControls.getObject().position.y += (testVelocity.y * delta);

  // Very simple floor collision (y=0) and box top collision
  let highestFloor = 0;
  const px = testControls.getObject().position.x;
  const pz = testControls.getObject().position.z;

  objects.forEach(obj => {
    if (obj.type === 'box') {
      const box = new THREE.Box3().setFromObject(obj.mesh);
      // inflate slightly for player radius
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
`;

content = content.replace(
  'function initEventListeners() {',
  testMapLogic + '\nfunction initEventListeners() {'
);

// We need to disable the fly camera movement if testing
content = content.replace(
  'function handleCameraMovement() {',
  'function handleCameraMovement() {\n  if (isTesting) return;'
);

fs.writeFileSync('games/fps-map-builder.html', content);
