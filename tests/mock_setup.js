const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(path) {
  if (path === 'colyseus') {
    return {
      Server: class { listen() {} define() {} },
      Room: class {
        setState(s) { this.state = s; }
        setSimulationInterval(cb) { this.simulationInterval = cb; }
        onMessage() {}
        setMetadata() {}
      },
      ServerError: class extends Error {}
    };
  }
  if (path === '@colyseus/schema') {
    return {
      Schema: class {},
      type: () => (target, property) => {},
      MapSchema: class extends Map {},
      defineTypes: () => {}
    };
  }
  if (path === '@colyseus/ws-transport') {
    return { WebSocketTransport: class {} };
  }
  if (['http', 'express', 'cors', 'firebase-admin', 'fs', 'path', 'child_process', 'util', 'three'].includes(path)) {
     try {
       return originalRequire.apply(this, arguments);
     } catch(e) {
       if (path === 'express') return () => ({ use: () => {}, get: () => {} });
       if (path === 'cors') return () => () => {};
       if (path === 'firebase-admin') return { initializeApp: () => {}, credential: { cert: () => {} } };
       if (path === 'three') return {
         Vector3: class { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} },
         Box3: class { constructor(){this.min={x:0,y:0,z:0};this.max={x:0,y:0,z:0};} },
         Color: class { constructor(){} }
       };
       throw e;
     }
  }
  return originalRequire.apply(this, arguments);
};
