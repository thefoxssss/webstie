const fs = require('fs');

let content = fs.readFileSync('games/fps-map-builder.html', 'utf8');

content = content.replace(
  '<button id="btnSnap">Snap: ON</button>',
  '<button id="btnSnap">Snap: ON</button>\n      <select id="snapStep" style="background:var(--bg-light); color:var(--text-main); border:1px solid var(--border); border-radius:4px; padding:4px; margin-right:8px;" title="Snap Size">\n        <option value="0.1">0.1</option>\n        <option value="0.25">0.25</option>\n        <option value="0.5">0.5</option>\n        <option value="1" selected>1.0</option>\n        <option value="2">2.0</option>\n        <option value="4">4.0</option>\n      </select>'
);

content = content.replace(
  'const btnSnap = document.getElementById(\'btnSnap\');',
  'const btnSnap = document.getElementById(\'btnSnap\');\nconst snapStepEl = document.getElementById(\'snapStep\');'
);

const snapListener = `
  snapStepEl.onchange = () => {
    gridStep = parseFloat(snapStepEl.value);
    if (snapEnabled) {
      transformControls.setTranslationSnap(gridStep);
    }
  };
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
  };\n` + snapListener
);

fs.writeFileSync('games/fps-map-builder.html', content);
