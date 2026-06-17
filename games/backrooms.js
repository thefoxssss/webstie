/* ============================================================
   THE BACKROOMS — desktop survival horror
   L0 Lobby -> L1 Habitable Zone -> L37 Poolrooms -> L2 Pipe Dreams
   -> L! Run For Your Life -> M.E.G. Outpost
   ============================================================ */
'use strict';



const $ = id => document.querySelector('#overlayBackrooms #' + id) || document.createElement('div');

/* ---------------- procedural textures ---------------- */
function makeCanvas(s){ const c=document.createElement('canvas'); c.width=c.height=s; return [c, c.getContext('2d')]; }
function noiseOver(ctx,s,n,alpha,dark){
  for(let i=0;i<n;i++){
    const v=Math.random()*255|0;
    ctx.fillStyle = dark ? `rgba(0,0,0,${Math.random()*alpha})` : `rgba(${v},${v},${v},${Math.random()*alpha})`;
    ctx.fillRect(Math.random()*s|0, Math.random()*s|0, 1+Math.random()*2, 1+Math.random()*2);
  }
}
function stains(ctx,s,n,color){
  for(let i=0;i<n;i++){
    const x=Math.random()*s, y=Math.random()*s, r=8+Math.random()*48;
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0, color); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
  }
}
function tex(c, rx, ry){
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx||1, ry||1);
  t.anisotropy=4; return t;
}

function wallpaperCanvas(){
  const [c,x]=makeCanvas(512);
  x.fillStyle='#b3a04a'; x.fillRect(0,0,512,512);
  for(let i=0;i<512;i+=16){
    x.fillStyle = (i/16)%2 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,220,0.05)';
    x.fillRect(i,0,8,512);
  }
  noiseOver(x,512,9000,.06,false);
  stains(x,512,10,'rgba(70,55,10,0.16)');
  stains(x,512,5,'rgba(255,250,200,0.07)');
  x.fillStyle='rgba(40,30,5,0.25)'; x.fillRect(0,500,512,12);
  return c;
}
function carpetCanvas(){
  const [c,x]=makeCanvas(256);
  x.fillStyle='#7d6f33'; x.fillRect(0,0,256,256);
  noiseOver(x,256,14000,.14,false);
  stains(x,256,8,'rgba(35,28,8,0.28)');
  return c;
}
function ceilingCanvas(){
  const [c,x]=makeCanvas(256);
  x.fillStyle='#cfc8ad'; x.fillRect(0,0,256,256);
  noiseOver(x,256,3500,.05,false);
  x.strokeStyle='rgba(60,55,35,0.5)'; x.lineWidth=2;
  for(let i=0;i<=256;i+=128){ x.beginPath();x.moveTo(i,0);x.lineTo(i,256);x.stroke();
    x.beginPath();x.moveTo(0,i);x.lineTo(256,i);x.stroke(); }
  stains(x,256,5,'rgba(90,70,20,0.18)');
  return c;
}
function concreteCanvas(){
  const [c,x]=makeCanvas(512);
  x.fillStyle='#6e6c66'; x.fillRect(0,0,512,512);
  noiseOver(x,512,12000,.1,false);
  stains(x,512,12,'rgba(20,20,20,0.2)');
  x.strokeStyle='rgba(30,30,30,0.45)'; x.lineWidth=1.5;
  for(let i=0;i<7;i++){ x.beginPath(); let px=Math.random()*512, py=Math.random()*512; x.moveTo(px,py);
    for(let j=0;j<6;j++){ px+=(Math.random()-.5)*90; py+=(Math.random()-.5)*90; x.lineTo(px,py); } x.stroke(); }
  return c;
}
function asphaltCanvas(){
  const [c,x]=makeCanvas(512);
  x.fillStyle='#454540'; x.fillRect(0,0,512,512);
  noiseOver(x,512,16000,.12,false);
  stains(x,512,10,'rgba(0,0,0,0.3)');
  x.fillStyle='rgba(200,190,60,0.5)'; x.fillRect(248,0,16,512);
  return c;
}
function rustCanvas(){
  const [c,x]=makeCanvas(512);
  x.fillStyle='#4a3f35'; x.fillRect(0,0,512,512);
  noiseOver(x,512,11000,.12,false);
  for(let i=0;i<26;i++){
    const sx=Math.random()*512, w=2+Math.random()*9, h=60+Math.random()*300;
    const g=x.createLinearGradient(0,0,0,h);
    g.addColorStop(0,'rgba(120,55,20,0.5)'); g.addColorStop(1,'rgba(120,55,20,0)');
    x.fillStyle=g; x.save(); x.translate(sx,Math.random()*250); x.fillRect(0,0,w,h); x.restore();
  }
  stains(x,512,8,'rgba(0,0,0,0.3)');
  return c;
}
function metalFloorCanvas(){
  const [c,x]=makeCanvas(256);
  x.fillStyle='#3a352f'; x.fillRect(0,0,256,256);
  noiseOver(x,256,8000,.12,false);
  x.strokeStyle='rgba(0,0,0,0.5)'; x.lineWidth=3;
  x.strokeRect(2,2,252,252);
  stains(x,256,6,'rgba(120,60,20,0.2)');
  return c;
}
function poolTileCanvas(){           // poolrooms: pale teal tiles + grout
  const [c,x]=makeCanvas(256);
  x.fillStyle='#3f6b6e'; x.fillRect(0,0,256,256); // grout
  const t=32;
  for(let gy=0;gy<256;gy+=t)for(let gx=0;gx<256;gx+=t){
    const sh=0.9+Math.random()*0.2;
    x.fillStyle=`rgba(${Math.round(150*sh)},${Math.round(196*sh)},${Math.round(196*sh)},1)`;
    x.fillRect(gx+1.5,gy+1.5,t-3,t-3);
  }
  noiseOver(x,256,3000,.05,false);
  stains(x,256,4,'rgba(20,40,40,0.15)');
  return c;
}
function poolFloorCanvas(){          // tiles seen through water
  const [c,x]=makeCanvas(256);
  x.fillStyle='#2c5557'; x.fillRect(0,0,256,256);
  const t=32;
  for(let gy=0;gy<256;gy+=t)for(let gx=0;gx<256;gx+=t){
    const sh=0.85+Math.random()*0.25;
    x.fillStyle=`rgba(${Math.round(120*sh)},${Math.round(170*sh)},${Math.round(172*sh)},1)`;
    x.fillRect(gx+2,gy+2,t-4,t-4);
  }
  return c;
}
function redWallCanvas(){            // run-for-your-life: grimy concrete, blood-dark
  const [c,x]=makeCanvas(512);
  x.fillStyle='#3a201c'; x.fillRect(0,0,512,512);
  noiseOver(x,512,12000,.12,false);
  // hazard stripes near the base
  for(let i=0;i<512;i+=40){
    x.fillStyle = (i/40)%2 ? 'rgba(150,30,20,0.35)' : 'rgba(20,15,12,0.4)';
    x.save(); x.translate(i,440); x.rotate(-0.5); x.fillRect(0,0,28,160); x.restore();
  }
  stains(x,512,14,'rgba(80,10,5,0.4)');
  return c;
}
function smilerCanvas(){
  const [c,x]=makeCanvas(512);
  x.clearRect(0,0,512,512);
  x.shadowColor='#fff'; x.shadowBlur=30;
  // narrowed crescent eyes
  x.fillStyle='#f6f6ff';
  x.beginPath(); x.ellipse(180,182,30,48,-0.30,0,7); x.fill();
  x.beginPath(); x.ellipse(332,182,30,48, 0.30,0,7); x.fill();
  // wide grin band
  x.strokeStyle='#f6f6ff'; x.lineWidth=30; x.lineCap='round';
  const cx=256, cy=236, r=152;
  x.beginPath(); x.arc(cx,cy,r,Math.PI*0.13,Math.PI*0.87); x.stroke();
  // jagged downward teeth along the grin
  x.shadowBlur=4; x.fillStyle='#f6f6ff';
  for(let i=0;i<=15;i++){
    const a=Math.PI*0.13 + (Math.PI*0.74)*(i/15);
    const px=cx+Math.cos(a)*r, py=cy+Math.sin(a)*r;
    x.beginPath(); x.moveTo(px-13,py-12); x.lineTo(px+13,py-12); x.lineTo(px,py+24); x.closePath(); x.fill();
  }
  return c;
}

/* ---------------- level definitions ---------------- */
const LEVELS=[
{ id:0, name:'LEVEL 0', title:'"The Lobby"', cls:'CLASS 1 — SAFE · SECURE · MINIMAL ENTITY COUNT',
  desc:'Mono-yellow rooms. Damp carpet. Fluorescent hum-buzz at maximum. The walls are thin here — find where reality has worn through, and noclip deeper.',
  objective:'FIND THE UNSTABLE WALL — NOCLIP DEEPER',
  size:27, openness:0.34, rooms:8, almond:4, theme:'lobby',
  entities:[], drain:0.35, fogColor:0x6a5f2c, fogDensity:0.018,
  ambient:0xfff3c0, ambientI:0.9, task:{type:'reach'} },

{ id:1, name:'LEVEL 1', title:'"Habitable Zone"', cls:'CLASS 2 — UNSAFE · UNSECURE · LOW ENTITY COUNT',
  desc:'A vast warehouse of concrete and drifting mist. Supply crates left by other wanderers. The fog moves when nothing should be moving. Find the stairwell down.',
  objective:'SCAVENGE SUPPLIES — FIND THE STAIRWELL DOWN',
  size:29, openness:0.5, rooms:10, almond:6, theme:'warehouse',
  entities:[{type:'hound',n:2}], drain:0.5, fogColor:0x1a1d20, fogDensity:0.045,
  ambient:0x9fb3c8, ambientI:0.3, task:{type:'switches',count:3} },

{ id:9, name:'LEVEL 9', title:'"The Suburbs"', cls:'CLASS 2 — UNSAFE · UNSECURE · LOW ENTITY COUNT',
  desc:'An endless residential neighborhood frozen at 3 A.M. Identical houses, buzzing streetlights, picket fences. A few other wanderers drift the streets, still half-sane. One porch light somewhere is the way out — but something stalks between the houses.',
  objective:'FIND THE HOUSE KEY — THEN THE LIT PORCH',
  size:31, openness:0.30, rooms:9, almond:6, theme:'suburbs',
  entities:[{type:'smiler',n:1},{type:'hound',n:1}], drain:0.5, fogColor:0x0a0e18, fogDensity:0.034,
  ambient:0x5a6e9a, ambientI:0.30, flashlight:true, task:{type:'keycard'} },

{ id:10, name:'LEVEL 10', title:'"The Hills"', cls:'CLASS 1 — SAFE · UNSECURE · NEAR-ZERO ENTITY COUNT',
  desc:'You step out of the last house into open air. Rolling moonlit hills stretch past the fog in every direction under a sky that has no stars. The grass whispers. Far off, a single cabin window glows. Walk to it.',
  objective:'CROSS THE HILLS — REACH THE LIT CABIN',
  size:33, openness:1.0, rooms:0, almond:4, theme:'hills',
  entities:[], drain:0.34, fogColor:0x12182a, fogDensity:0.020,
  ambient:0x8fa6d6, ambientI:0.40, flashlight:true, task:{type:'reach'} },

{ id:37, name:'LEVEL 37', title:'"The Poolrooms"', cls:'CLASS 1 — SAFE · UNSECURE · NEAR-ZERO ENTITY COUNT',
  desc:'Endless flooded chambers. Pale aquamarine water laps at your knees. Sunless light glows from nowhere and everywhere. It is calm. It is beautiful. It is wrong — and the water swallows the sound of anything sharing it with you.',
  objective:'WADE TO THE DRAINAGE ARCH',
  size:31, openness:0.62, rooms:12, almond:6, theme:'pools',
  entities:[{type:'smiler',n:1}], drain:0.32, fogColor:0x6fb6c4, fogDensity:0.030,
  ambient:0xbfeaf2, ambientI:0.62, water:true, task:{type:'valves',count:3} },

{ id:2, name:'LEVEL 2', title:'"Pipe Dreams"', cls:'CLASS 3 — UNSAFE · UNSECURE · MEDIUM ENTITY COUNT',
  desc:'Maintenance tunnels of scalding pipes and steam. Almost no light. Smilers wait in the dark and Hounds hunt the corridors. The exit hatch drops to a level wanderers only whisper about.',
  objective:'SURVIVE — REACH THE EXIT HATCH',
  size:31, openness:0.16, rooms:4, almond:7, theme:'pipes',
  entities:[{type:'hound',n:2},{type:'smiler',n:3}], drain:0.85, fogColor:0x0e0905, fogDensity:0.060,
  ambient:0xff9c5a, ambientI:0.14, flashlight:true, task:{type:'code',digits:3} },

{ id:99, name:'LEVEL !', title:'"Run For Your Life"', cls:'CLASS 5 — DEADLY · UNSECURE · SINGULAR PURSUER',
  desc:'Red. Everything is red. A single endless corridor that drinks the emergency light. Something the M.E.G. file only calls THE THING is already moving toward you, and the level itself rejects the still. Do not stop. Do not look back. The outpost is at the far end. RUN.',
  objective:'DO NOT STOP RUNNING — REACH THE OUTPOST',
  size:33, openness:0.08, rooms:2, almond:5, theme:'redrun',
  entities:[{type:'thing',n:1}], drain:1.1, fogColor:0x180404, fogDensity:0.058,
  ambient:0xff3a2a, ambientI:0.22, flashlight:true, stillKills:true, task:{type:'keycard'} }
];

/* ---------------- maze generation ---------------- */
function genMaze(L){
  const N=L.size, g=[];
  for(let y=0;y<N;y++){ g.push(new Array(N).fill(1)); }
  const stack=[[1,1]]; g[1][1]=0;
  const dirs=[[2,0],[-2,0],[0,2],[0,-2]];
  while(stack.length){
    const [cx,cy]=stack[stack.length-1];
    const opts=dirs.filter(([dx,dy])=>{
      const nx=cx+dx, ny=cy+dy;
      return nx>0&&ny>0&&nx<N-1&&ny<N-1&&g[ny][nx]===1;
    });
    if(!opts.length){ stack.pop(); continue; }
    const [dx,dy]=opts[Math.random()*opts.length|0];
    g[cy+dy/2][cx+dx/2]=0; g[cy+dy][cx+dx]=0;
    stack.push([cx+dx,cy+dy]);
  }
  for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++)
    if(g[y][x]===1 && Math.random()<L.openness) g[y][x]=0;
  for(let r=0;r<L.rooms;r++){
    const w=3+(Math.random()*4|0), h=3+(Math.random()*4|0);
    const x0=1+(Math.random()*(N-w-2)|0), y0=1+(Math.random()*(N-h-2)|0);
    for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++) g[y][x]=0;
  }
  for(let y=2;y<N-2;y++)for(let x=2;x<N-2;x++){
    if(g[y][x]===0 && Math.random()<0.04){
      let open=0; for(const[dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if(g[y+dy][x+dx]===0) open++;
      if(open===4) g[y][x]=1;
    }
  }
  g[1][1]=0; g[1][2]=0; g[2][1]=0;
  g[N-2][N-2]=0; g[N-2][N-3]=0; g[N-3][N-2]=0;
  return g;
}

/* ---------------- renderer / scene ---------------- */
const CELL=4, WALL_H=3.7;
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
renderer.shadowMap.enabled=false;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(75, 1, 0.08, 260);
function syncSize(){
  const w=Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
  const h=Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
  const cur=renderer.getSize(new THREE.Vector2());
  if(Math.abs(cur.x-w)>0.5 || Math.abs(cur.y-h)>0.5){
    renderer.setSize(w,h,true);
    camera.aspect=w/h; camera.updateProjectionMatrix();
  }
}
syncSize();
addEventListener('resize',syncSize);
addEventListener('load',syncSize);
setTimeout(syncSize,100);

const T={};
function sidingCanvas(){
  const [c,x]=makeCanvas(256);
  x.fillStyle='#5b606a'; x.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=22){ x.fillStyle='rgba(0,0,0,0.18)'; x.fillRect(0,y,256,2);
    x.fillStyle='rgba(255,255,255,0.05)'; x.fillRect(0,y+3,256,3); }
  noiseOver(x,256,4000,.06,false);
  stains(x,256,5,'rgba(20,22,26,0.25)');
  return c;
}
function grassCanvas(){
  const [c,x]=makeCanvas(256);
  x.fillStyle='#243a26'; x.fillRect(0,0,256,256);
  for(let i=0;i<9000;i++){ const v=Math.random();
    x.fillStyle=`rgba(${30+v*40|0},${60+v*70|0},${30+v*40|0},0.5)`;
    x.fillRect(Math.random()*256|0,Math.random()*256|0,2,2); }
  stains(x,256,6,'rgba(10,20,10,0.3)');
  return c;
}
function buildTextures(){
  T.wallpaper=wallpaperCanvas(); T.carpet=carpetCanvas(); T.ceiling=ceilingCanvas();
  T.concrete=concreteCanvas(); T.asphalt=asphaltCanvas(); T.rust=rustCanvas(); T.metal=metalFloorCanvas();
  T.poolTile=poolTileCanvas(); T.poolFloor=poolFloorCanvas(); T.redWall=redWallCanvas();
  T.siding=sidingCanvas(); T.grass=grassCanvas();
  T.smiler=new THREE.CanvasTexture(smilerCanvas());
}
function mergeGeo(base, matrices){
  const bp=base.attributes.position, bn=base.attributes.normal, bu=base.attributes.uv, bi=base.index;
  const n=matrices.length, vc=bp.count;
  const pos=new Float32Array(n*vc*3), nor=new Float32Array(n*vc*3), uv=new Float32Array(n*vc*2);
  const idx=[]; const v=new THREE.Vector3(), nm=new THREE.Matrix3();
  for(let k=0;k<n;k++){
    const m=matrices[k]; nm.getNormalMatrix(m); const o=k*vc;
    for(let i=0;i<vc;i++){
      v.set(bp.getX(i),bp.getY(i),bp.getZ(i)).applyMatrix4(m);
      pos[(o+i)*3]=v.x; pos[(o+i)*3+1]=v.y; pos[(o+i)*3+2]=v.z;
      v.set(bn.getX(i),bn.getY(i),bn.getZ(i)).applyMatrix3(nm).normalize();
      nor[(o+i)*3]=v.x; nor[(o+i)*3+1]=v.y; nor[(o+i)*3+2]=v.z;
      uv[(o+i)*2]=bu.getX(i); uv[(o+i)*2+1]=bu.getY(i);
    }
    for(let i=0;i<bi.count;i++) idx.push(bi.getX(i)+o);
  }
  base.dispose();
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  g.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  g.setIndex(idx);
  return g;
}
function mat4At(x,y,z,rx,ry){ const m=new THREE.Matrix4();
  if(ry) m.makeRotationY(ry); else if(rx) m.makeRotationX(rx);
  m.setPosition(x,y,z); return m; }

/* ---------------- world gameState ---------------- */
const world={ group:null, grid:null, N:0, exit:null, glitchMesh:null, items:[], entities:[],
  steamSprites:[], theme:'', exitLight:null, water:null, seen:null,
  glitchProps:[], npcs:[], terrainFn:null };
const player={ pos:new THREE.Vector3(), yaw:0, pitch:0, vel:new THREE.Vector3(),
  hp:100, sanity:100, stamina:100, power:100, radius:0.42, sprinting:false, crouch:false,
  bob:0, lastHit:-9, almonds:0, startTime:0, deaths:0, flashOn:true };
let curLevel=0, gameState='menu', flashlight=null, playerLamp=null;
const GAME={ sens:0.0018, volume:0.55, fov:75, invertY:false, diff:'normal', startLevel:0 };
const DIFF={ easy:{drain:0.7,espeed:0.85,still:0.7,label:'EASY'},
             normal:{drain:1.0,espeed:1.0,still:1.0,label:'NORMAL'},
             nightmare:{drain:1.45,espeed:1.2,still:1.3,label:'NIGHTMARE'} };
function diffNow(){ return DIFF[GAME.diff]||DIFF.normal; }
let SENS=GAME.sens;   // legacy alias, kept in sync with GAME.sens

/* ============================================================
   MULTIPLAYER MODULE — STUB FOR HANDOFF
   Another developer/AI implements these. See MULTIPLAYER_SPEC.md.
   Contract:
     MP.mode : 'single' | 'splitscreen' | 'host' | 'join'
     MP.players[] : { id, pos:Vector3, yaw, avatar(THREE.Group from makeHuman) }
     MP.startSplitscreen()  -> set up player 2, dual cameras, scissor render
     MP.host()              -> open a relay/WebRTC session, return a join code
     MP.join(code)          -> connect to a host session
     MP.sendState()         -> called each frame in 'host'/'join' to broadcast local player
     MP.onRemoteState(data) -> called when a peer's gameState arrives; move their avatar
   The single-player loop already exposes everything needed: world, player,
   makeHuman(), collide(), camera, renderer, scene. Hook points are marked
   with  // MP-HOOK  comments in frame() and the render call.
   ============================================================ */

const MP = {};
let colyseusClient = null;
let currentRoom = null;
let otherPlayers = new Map();

MP.host = function() {
    if(!colyseusClient) colyseusClient = new Colyseus.Client(window.getColyseusWsUrl());
    $('mpNote').textContent = 'CREATING ROOM...';
    colyseusClient.create('backrooms_room', { hostName: window.gameState?.username || 'Player' })
        .then(room => {
            currentRoom = room;
            setupRoom(room);
            MP.mode = 'host';
            startGame();
        }).catch(e => {
            $('mpNote').textContent = 'ERROR HOSTING: ' + e.message;
        });
};

MP.join = function(roomId) {
    if(!colyseusClient) colyseusClient = new Colyseus.Client(window.getColyseusWsUrl());
    $('mpNote').textContent = 'JOINING...';
    colyseusClient.joinById(roomId, {})
        .then(room => {
            currentRoom = room;
            setupRoom(room);
            MP.mode = 'join';
            startGame();
        }).catch(e => {
            $('mpNote').textContent = 'ERROR JOINING: ' + e.message;
        });
};

function setupRoom(room) {
    room.state.players.onAdd((p, sessionId) => {
        if(sessionId === room.sessionId) return;

        let avatar = makeHuman();
        world.group.add(avatar.g);
        otherPlayers.set(sessionId, { state: p, avatar: avatar });

        p.onChange(() => {
            let op = otherPlayers.get(sessionId);
            if(op && op.avatar) {
                op.avatar.g.position.set(p.x, p.y, p.z);
                op.avatar.g.rotation.y = p.yaw;

                if (Math.abs(p.vx) > 0.1 || Math.abs(p.vz) > 0.1) {
                    const t = performance.now() / 1000;
                    const sw = Math.sin(t * 10) * 0.5;
                    op.avatar.arms[0].rotation.x = sw;
                    op.avatar.arms[1].rotation.x = -sw;
                    op.avatar.legs[0].rotation.x = -sw;
                    op.avatar.legs[1].rotation.x = sw;
                } else {
                    op.avatar.arms[0].rotation.x = 0;
                    op.avatar.arms[1].rotation.x = 0;
                    op.avatar.legs[0].rotation.x = 0;
                    op.avatar.legs[1].rotation.x = 0;
                }
            }
        });
    });

    room.state.players.onRemove((p, sessionId) => {
        let op = otherPlayers.get(sessionId);
        if(op && op.avatar) {
            world.group.remove(op.avatar.g);
        }
        otherPlayers.delete(sessionId);
    });

    room.onMessage("level_change", (data) => {
        if(MP.mode === 'join' && curLevel !== data.level) {
            enterLevel(data.level, false);
        }
    });
}

MP.sendState = function() {
    if (currentRoom && (MP.mode === 'host' || MP.mode === 'join')) {
        currentRoom.send("updatePosition", {
            x: player.pos.x,
            y: player.pos.y,
            z: player.pos.z,
            yaw: player.yaw,
            vx: player.vel.x,
            vz: player.vel.z
        });
    }
};

window.MP = MP;

const progress=new Set();

function cellToWorld(x,y,N){ return [ (x-(N-1)/2)*CELL, (y-(N-1)/2)*CELL ]; }
function worldToCell(wx,wz,N){ return [ Math.round(wx/CELL+(N-1)/2), Math.round(wz/CELL+(N-1)/2) ]; }
function isWall(cx,cy){ const g=world.grid; if(!g) return true;
  if(cx<0||cy<0||cx>=world.N||cy>=world.N) return true; return g[cy][cx]===1; }

function disposeWorld(){
  if(world.group){ scene.remove(world.group);
    world.group.traverse(o=>{ if(o.geometry)o.geometry.dispose();
      if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{ if(m.map)m.map.dispose(); m.dispose(); }); }});
  }
  world.group=null; world.items=[]; world.entities=[]; world.steamSprites=[];
  world.glitchMesh=null; world.lightPanels=null; world.exitLight=null; world.water=null; world.seen=null;
  world.interactables=[]; world.keypad=null; world.lockRing=null; world.locked=false;
  world.code=''; world.codeBuf=''; world.keypadNear=false; world.haveKeycard=false; world.taskType='reach';
  world.glitchProps=[]; world.npcs=[]; world.terrainFn=null;
}

function farFloorCells(grid,N,minDist,fromX,fromY){
  const out=[];
  for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++)
    if(grid[y][x]===0 && Math.hypot(x-fromX,y-fromY)>=minDist) out.push([x,y]);
  return out;
}
function pickRandom(arr){ return arr[Math.random()*arr.length|0]; }

/* ---------------- world building ---------------- */
function buildLevel(idx){
  disposeWorld();
  const L=LEVELS[idx], N=L.size;
  const grid=(L.theme==='hills')?openGrid(L.size):genMaze(L);
  world.grid=grid; world.N=N; world.theme=L.theme; world.L=L;
  world.seen=[]; for(let y=0;y<N;y++) world.seen.push(new Array(N).fill(0));
  const G=new THREE.Group(); world.group=G; scene.add(G);

  scene.fog=new THREE.FogExp2(L.fogColor, L.fogDensity);
  renderer.setClearColor(L.fogColor);
  scene.children.filter(o=>o.isLight).forEach(o=>scene.remove(o));
  const amb=new THREE.AmbientLight(L.ambient, L.ambientI); scene.add(amb); world.amb=amb; world.ambBase=L.ambientI;
  const hemi=new THREE.HemisphereLight(L.ambient, 0x202018, L.ambientI*0.5); scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff6dd, L.theme==='lobby'?0.7:(L.theme==='pools'?0.5:0.3));
  sun.position.set(0.5,1,0.3); scene.add(sun);
  const sun2=new THREE.DirectionalLight(0xddd0a0, L.theme==='lobby'?0.25:0.12);
  sun2.position.set(-0.6,0.4,-0.5); scene.add(sun2);
  if(L.theme==='hills'||L.theme==='suburbs'){
    const moon=new THREE.DirectionalLight(0x9fb6e0, 0.5); moon.position.set(0.4,1,-0.6); scene.add(moon);
    if(L.theme==='hills'){
      const m=new THREE.Mesh(new THREE.SphereGeometry(6,16,16), new THREE.MeshBasicMaterial({color:0xe6ecff}));
      m.position.set(60,55,-95); G.add(m);
    }
  }

  playerLamp=new THREE.PointLight(0xffeebb, L.theme==='lobby'?0.45:(L.theme==='pools'?0.35:0.55), L.theme==='lobby'?18:14, 2); scene.add(playerLamp);

  if(flashlight){ camera.remove(flashlight); flashlight=null; }
  const hasFlash=!!L.flashlight;
  if(hasFlash){
    flashlight=new THREE.SpotLight(0xfff2d0, L.theme==='redrun'?1.5:1.6, 40, 0.5, 0.45, 1.4);
    flashlight.position.set(0,0,0.1);
    camera.add(flashlight); camera.add(flashlight.target);
    flashlight.target.position.set(0,0,-1);
    flashlight.visible=player.flashOn;
  }
  $('powerBar').style.display=hasFlash?'block':'none';
  scene.add(camera);

  /* ----- materials per theme ----- */
  let wallMat, floorMat, ceilMat, panelColor=0xfff7cf;
  if(L.theme==='lobby'){
    wallMat=new THREE.MeshLambertMaterial({map:tex(T.wallpaper, 1.6, 1)});
    floorMat=new THREE.MeshLambertMaterial({map:tex(T.carpet, N, N)});
    ceilMat=new THREE.MeshLambertMaterial({map:tex(T.ceiling, N*2, N*2)});
  } else if(L.theme==='warehouse'){
    wallMat=new THREE.MeshLambertMaterial({map:tex(T.concrete, 1.4, 1)});
    floorMat=new THREE.MeshLambertMaterial({map:tex(T.asphalt, N, N)});
    ceilMat=new THREE.MeshLambertMaterial({color:0x33363a});
    panelColor=0xcfe2ff;
  } else if(L.theme==='pools'){
    wallMat=new THREE.MeshLambertMaterial({map:tex(T.poolTile, 1.5, 1.2)});
    floorMat=new THREE.MeshLambertMaterial({map:tex(T.poolFloor, N*1.4, N*1.4)});
    ceilMat=new THREE.MeshLambertMaterial({map:tex(T.poolTile, N, N), color:0xdfeff0});
    panelColor=0xdffaff;
  } else if(L.theme==='redrun'){
    wallMat=new THREE.MeshLambertMaterial({map:tex(T.redWall, 1.4, 1)});
    floorMat=new THREE.MeshLambertMaterial({map:tex(T.concrete, N, N), color:0x6a3530});
    ceilMat=new THREE.MeshLambertMaterial({color:0x1a0807});
    panelColor=0xff3324;
  } else if(L.theme==='suburbs'){
    wallMat=new THREE.MeshLambertMaterial({map:tex(T.siding, 1.2, 1.4)});
    floorMat=new THREE.MeshLambertMaterial({map:tex(T.asphalt, N, N), color:0x3a3d42});
    ceilMat=new THREE.MeshLambertMaterial({color:0x05070d});
    panelColor=0x90a4d0;
  } else if(L.theme==='hills'){
    wallMat=new THREE.MeshLambertMaterial({map:tex(T.grass, 2, 2)});
    floorMat=new THREE.MeshLambertMaterial({map:tex(T.grass, N*1.2, N*1.2)});
    ceilMat=new THREE.MeshLambertMaterial({color:0x0a0e1a});
    panelColor=0x90a4d0;
  } else {
    wallMat=new THREE.MeshLambertMaterial({map:tex(T.rust, 1.4, 1)});
    floorMat=new THREE.MeshLambertMaterial({map:tex(T.metal, N, N)});
    ceilMat=new THREE.MeshLambertMaterial({color:0x1a130d});
    panelColor=0xffb27a;
  }

  const size=N*CELL;
  const ceilH = L.theme==='redrun' ? WALL_H-0.4 : WALL_H;
  const hasCeiling = !(L.theme==='hills'||L.theme==='suburbs');
  const outdoor = (L.theme==='hills');

  if(outdoor){
    const seg=84;
    const tg=new THREE.PlaneGeometry(size,size,seg,seg);
    const fn=(x,z)=> Math.sin(x*0.06)*1.7 + Math.cos(z*0.052)*1.8 + Math.sin((x*0.9+z)*0.028)*1.3;
    world.terrainFn=fn;
    const pa=tg.attributes.position;
    for(let i=0;i<pa.count;i++){ const px=pa.getX(i), py=pa.getY(i); pa.setZ(i, fn(px,-py)); }
    pa.needsUpdate=true; tg.computeVertexNormals();
    const terrain=new THREE.Mesh(tg, floorMat); terrain.rotation.x=-Math.PI/2; G.add(terrain);
  } else {
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(size,size), floorMat);
    floor.rotation.x=-Math.PI/2; G.add(floor);
  }
  if(hasCeiling){
    const ceil=new THREE.Mesh(new THREE.PlaneGeometry(size,size), ceilMat);
    ceil.rotation.x=Math.PI/2; ceil.position.y=ceilH; G.add(ceil);
  }

  /* ----- walls (merged) ----- */
  if(!outdoor){
    const wallCells=[];
    for(let y=0;y<N;y++)for(let x=0;x<N;x++) if(grid[y][x]===1) wallCells.push([x,y]);
    const wallH2 = L.theme==='suburbs' ? WALL_H+0.8 : WALL_H;
    const walls=new THREE.Mesh(
      mergeGeo(new THREE.BoxGeometry(CELL, wallH2, CELL),
        wallCells.map(([x,y])=>{ const [wx,wz]=cellToWorld(x,y,N); return mat4At(wx,wallH2/2,wz); })),
      wallMat);
    G.add(walls);
  }

  /* ----- ceiling light panels (merged, emissive) ----- */
  if(hasCeiling){
    const panelCells=[];
    const step=(L.theme==='pipes'||L.theme==='redrun')?5:3;
    for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++)
      if(grid[y][x]===0 && x%step===1 && y%step===1) panelCells.push([x,y]);
    const panelMat=new THREE.MeshBasicMaterial({color:panelColor});
    world.panelMat=panelMat; world.panelBase=new THREE.Color(panelColor);
    const panels=new THREE.Mesh(
      mergeGeo(new THREE.PlaneGeometry(1.8,0.9),
        panelCells.map(([x,y])=>{ const [wx,wz]=cellToWorld(x,y,N);
          return mat4At(wx,ceilH-0.04,wz,Math.PI/2,0); })),
      panelMat);
    G.add(panels);
    world.lightPanels=panels;
  } else {
    world.panelMat=new THREE.MeshBasicMaterial({color:panelColor});
    world.panelBase=new THREE.Color(panelColor); world.lightPanels=null;
  }

  /* ----- water plane (poolrooms) ----- */
  if(L.water){
    const seg=Math.min(60, N*2);
    const wgeo=new THREE.PlaneGeometry(size,size,seg,seg);
    const wmat=new THREE.MeshPhongMaterial({color:0x4fd0d8, transparent:true, opacity:0.5,
      shininess:120, specular:0x99ffff, depthWrite:false});
    const water=new THREE.Mesh(wgeo, wmat);
    water.rotation.x=-Math.PI/2; water.position.y=0.42; G.add(water);
    world.water=water; world.waterBase=wgeo.attributes.position.array.slice();
    // caustic glow lights drifting over the water
    world.caustics=[];
    for(let i=0;i<4;i++){
      const cl=new THREE.PointLight(0x9ffaff,0.5,18,2); cl.position.set((Math.random()-.5)*size*0.6,2.4,(Math.random()-.5)*size*0.6);
      cl.userData.ph=Math.random()*7; G.add(cl); world.caustics.push(cl);
    }
  }

  /* ----- theme decoration ----- */
  if(L.theme==='warehouse'){
    const open=farFloorCells(grid,N,0,1,1).filter(()=>Math.random()<0.12);
    const crateMat=new THREE.MeshLambertMaterial({map:tex(T.rust,1,1), color:0x9a8a6a});
    if(open.length){
      const crates=new THREE.Mesh(
        mergeGeo(new THREE.BoxGeometry(1.4,1.4,1.4),
          open.map(([x,y])=>{ const[wx,wz]=cellToWorld(x,y,N);
            return mat4At(wx+(Math.random()-.5)*1.4,0.7,wz+(Math.random()-.5)*1.4,0,Math.random()*Math.PI); })),
        crateMat);
      G.add(crates);
    }
  }
  if(L.theme==='pools'){
    // tiled columns rising from the water in open cells
    const open=farFloorCells(grid,N,0,1,1).filter(()=>Math.random()<0.06);
    const colMat=new THREE.MeshLambertMaterial({map:tex(T.poolTile,1,2.5), color:0xdfeff0});
    if(open.length){
      const cols=new THREE.Mesh(
        mergeGeo(new THREE.BoxGeometry(0.9,WALL_H,0.9),
          open.map(([x,y])=>{ const[wx,wz]=cellToWorld(x,y,N); return mat4At(wx,WALL_H/2,wz); })),
        colMat);
      G.add(cols);
    }
  }
  if(L.theme==='pipes'){
    const pipeCells=[];
    for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++)
      if(grid[y][x]===0 && (x%2===0||y%3===0)) pipeCells.push([x,y]);
    const pipeMat=new THREE.MeshLambertMaterial({color:0x5d4630});
    const pmats=[];
    pipeCells.forEach(([x,y])=>{ const[wx,wz]=cellToWorld(x,y,N);
      const a=new THREE.Matrix4().makeRotationZ(Math.PI/2); a.setPosition(wx,WALL_H-0.35,wz+0.6); pmats.push(a);
      const b=new THREE.Matrix4().makeRotationX(Math.PI/2); b.setPosition(wx-0.6,WALL_H-0.7,wz); pmats.push(b); });
    if(pmats.length){
      const pipes=new THREE.Mesh(mergeGeo(new THREE.CylinderGeometry(0.13,0.13,CELL,8), pmats), pipeMat);
      G.add(pipes);
    }
    const steamMat=new THREE.SpriteMaterial({color:0xffd8b0, opacity:0.12, transparent:true, depthWrite:false});
    for(let i=0;i<14;i++){
      const cell=pickRandom(pipeCells)||[2,2]; const[wx,wz]=cellToWorld(cell[0],cell[1],N);
      const s=new THREE.Sprite(steamMat.clone());
      s.position.set(wx+(Math.random()-.5)*2, 1+Math.random()*2, wz+(Math.random()-.5)*2);
      s.scale.set(2.5,2.5,1); s.userData.v=0.25+Math.random()*0.4; G.add(s); world.steamSprites.push(s);
    }
  }
  if(L.theme==='redrun'){
    // ground fog haze drifting low
    const hazeMat=new THREE.SpriteMaterial({color:0xff4030, opacity:0.10, transparent:true, depthWrite:false});
    for(let i=0;i<18;i++){
      const far=farFloorCells(grid,N,0,1,1); if(!far.length) break;
      const[cx,cy]=pickRandom(far); const[wx,wz]=cellToWorld(cx,cy,N);
      const s=new THREE.Sprite(hazeMat.clone());
      s.position.set(wx+(Math.random()-.5)*3, 0.5+Math.random()*0.8, wz+(Math.random()-.5)*3);
      s.scale.set(4,4,1); s.userData.v=0.1+Math.random()*0.2; G.add(s); world.steamSprites.push(s);
    }
  }

  /* ----- spawn / exit ----- */
  const [sx,sz]=cellToWorld(1,1,N);
  player.pos.set(sx,1.62,sz); player.yaw=Math.PI*0.75; player.pitch=0; player.vel.set(0,0,0);
  world.spawn={x:sx,z:sz};
  camera.position.set(sx,1.62,sz);
  camera.rotation.set(0,player.yaw,0);
  playerLamp.position.set(sx,2.2,sz);
  const ex=N-2, ey=N-2; world.exit={x:ex,y:ey};
  const [ewx,ewz]=cellToWorld(ex,ey,N);

  if(L.theme==='lobby'){
    const gm=new THREE.Mesh(new THREE.BoxGeometry(CELL*0.96, WALL_H, CELL*0.96),
      new THREE.MeshBasicMaterial({color:0x8a7a30}));
    gm.position.set(ewx, WALL_H/2, ewz); G.add(gm); world.glitchMesh=gm;
  } else if(L.theme==='warehouse'){
    const frame=new THREE.Mesh(new THREE.BoxGeometry(2.6,3.2,0.4),
      new THREE.MeshLambertMaterial({color:0x15161a}));
    frame.position.set(ewx, 1.6, ewz); G.add(frame);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.6,0.5),
      new THREE.MeshBasicMaterial({color:0x77ff99}));
    sign.position.set(ewx, 3.3, ewz+0.25); G.add(sign);
  } else if(L.theme==='pools'){
    const arch=new THREE.Mesh(new THREE.TorusGeometry(1.4,0.22,8,18,Math.PI),
      new THREE.MeshLambertMaterial({color:0x244f52, map:tex(T.poolTile,2,1)}));
    arch.position.set(ewx,0.4,ewz); G.add(arch);
    const glow=new THREE.Mesh(new THREE.PlaneGeometry(2.4,3),
      new THREE.MeshBasicMaterial({color:0xaef6ff, transparent:true, opacity:0.55, side:THREE.DoubleSide}));
    glow.position.set(ewx,1.8,ewz); glow.lookAt(sx,1.8,sz); G.add(glow);
  } else if(L.theme==='redrun'){
    const door=new THREE.Mesh(new THREE.BoxGeometry(2.6,3.4,0.3),
      new THREE.MeshBasicMaterial({color:0xeaffe0}));
    door.position.set(ewx,1.7,ewz); G.add(door);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(2,0.6),
      new THREE.MeshBasicMaterial({color:0x9fff9f}));
    sign.position.set(ewx,3.4,ewz+0.2); G.add(sign);
  } else if(L.theme==='suburbs'){
    const fr=new THREE.Mesh(new THREE.BoxGeometry(2.8,3.4,0.5), new THREE.MeshLambertMaterial({color:0x241f18}));
    fr.position.set(ewx,1.7,ewz); G.add(fr);
    const door=new THREE.Mesh(new THREE.BoxGeometry(1.5,2.6,0.3), new THREE.MeshBasicMaterial({color:0xffe6a8}));
    door.position.set(ewx,1.3,ewz+0.2); G.add(door);
    const porch=new THREE.PointLight(0xffd27a,1.0,9,2); porch.position.set(ewx,2.6,ewz+0.6); G.add(porch);
  } else if(L.theme==='hills'){
    const gy=world.terrainFn?world.terrainFn(ewx,ewz):0;
    const cabin=new THREE.Mesh(new THREE.BoxGeometry(3.2,2.8,3.2), new THREE.MeshLambertMaterial({color:0x241c14}));
    cabin.position.set(ewx,gy+1.4,ewz); G.add(cabin);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(2.6,1.4,4), new THREE.MeshLambertMaterial({color:0x18120c}));
    roof.position.set(ewx,gy+3.4,ewz); roof.rotation.y=Math.PI/4; G.add(roof);
    const win=new THREE.Mesh(new THREE.PlaneGeometry(1.0,0.9), new THREE.MeshBasicMaterial({color:0xffd98a}));
    win.position.set(ewx,gy+1.5,ewz+1.62); G.add(win);
  } else {
    const door=new THREE.Mesh(new THREE.BoxGeometry(2.4,3.4,0.3),
      new THREE.MeshBasicMaterial({color:0xfff6dd}));
    door.position.set(ewx,1.7,ewz); G.add(door);
  }
  world.exitLight=new THREE.PointLight(
    L.theme==='lobby'?0xfff0c4:(L.theme==='pools'?0xaef6ff:(L.theme==='redrun'?0x9fff9f:0xfff2bb)),
    L.theme==='lobby'?0.7:1.4, L.theme==='lobby'?12:18, 2);
  world.exitLight.position.set(ewx, 2.2, ewz); G.add(world.exitLight);

  setupTask(L, ewx, ewz, grid, N, G);

  try{ scatterProps(L, grid, N, G); }catch(e){ console.error('PROPS: '+e.message); }

  /* ----- almond water ----- */
  const spots=farFloorCells(grid,N,6,1,1);
  const bottleGeo=new THREE.CylinderGeometry(0.10,0.10,0.42,10);
  const capGeo=new THREE.CylinderGeometry(0.05,0.05,0.07,8);
  const bottleY=L.water?0.62:0.45;
  for(let i=0;i<L.almond && spots.length;i++){
    const idx2=Math.random()*spots.length|0; const [cx,cy]=spots.splice(idx2,1)[0];
    const [wx,wz]=cellToWorld(cx,cy,N);
    const grp=new THREE.Group();
    const body=new THREE.Mesh(bottleGeo,new THREE.MeshLambertMaterial({color:0xead9a0, emissive:0x8a7430, emissiveIntensity:0.7}));
    const cap=new THREE.Mesh(capGeo,new THREE.MeshLambertMaterial({color:0x303030})); cap.position.y=0.245;
    grp.add(body,cap); grp.position.set(wx,bottleY,wz);
    const gl=new THREE.PointLight(0xffe9a0, 0.6, 4.5, 2); gl.position.y=0.3; grp.add(gl);
    G.add(grp); world.items.push({mesh:grp, taken:false, base:bottleY, phase:Math.random()*7});
  }

  /* ----- entities ----- */
  L.entities.forEach(spec=>{
    for(let i=0;i<spec.n;i++){
      const minD = spec.type==='thing'?16:10;
      const far=farFloorCells(grid,N,minD,1,1); if(!far.length) break;
      const [cx,cy]=pickRandom(far); const [wx,wz]=cellToWorld(cx,cy,N);
      world.entities.push(makeEntity(spec.type, wx, wz, G));
    }
  });

  // HUD
  $('lvName').textContent=L.name+' — '+L.title;
  $('lvClass').textContent=L.cls.split('—')[0].trim();
  setObjective();
  $('invAlmond').textContent=player.almonds;
}

/* ---------------- entities ---------------- */
function makeEntity(type, wx, wz, G){
  const grp=new THREE.Group();
  if(type==='hound'){
    // emaciated, hunched, pale-grey dog-thing with a long snapping jaw
    const skin=new THREE.MeshLambertMaterial({color:0x534b40, emissive:0x140a06, emissiveIntensity:0.5});
    const dark=new THREE.MeshLambertMaterial({color:0x2c2620});
    const body=new THREE.Mesh(new THREE.CylinderGeometry(0.30,0.20,1.7,7), skin);
    body.rotation.x=Math.PI/2; body.position.set(0,0.80,0.1); grp.add(body);
    for(let i=0;i<4;i++){            // exposed ribs
      const rib=new THREE.Mesh(new THREE.TorusGeometry(0.26,0.03,5,8,Math.PI*1.1), dark);
      rib.rotation.y=Math.PI/2; rib.position.set(0,0.84,0.4-i*0.28); grp.add(rib);
    }
    const shoulder=new THREE.Mesh(new THREE.SphereGeometry(0.30,8,8), skin);
    shoulder.scale.set(1,0.8,1); shoulder.position.set(0,0.98,-0.55); grp.add(shoulder);
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.18,0.5,6), skin);
    neck.position.set(0,0.88,-0.85); neck.rotation.x=0.5; grp.add(neck);
    const head=new THREE.Group(); head.position.set(0,0.76,-1.15); grp.add(head);
    const skull=new THREE.Mesh(new THREE.ConeGeometry(0.20,0.7,6), skin);
    skull.rotation.x=-Math.PI/2; skull.position.z=-0.15; head.add(skull);
    const jaw=new THREE.Mesh(new THREE.ConeGeometry(0.16,0.55,5), dark);
    jaw.rotation.x=-Math.PI/2; jaw.position.set(0,-0.10,-0.12); head.add(jaw);
    const teethMat=new THREE.MeshBasicMaterial({color:0xe8e2d0});
    for(let i=0;i<6;i++){
      const ang=(i/6)*Math.PI*2;
      const tooth=new THREE.Mesh(new THREE.ConeGeometry(0.03,0.12,4), teethMat);
      tooth.position.set(Math.cos(ang)*0.12,0.02,-0.34); tooth.rotation.x=Math.PI; head.add(tooth);
    }
    for(const s of [-1,1]){          // sunken glowing eyes
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.05,7,7), new THREE.MeshBasicMaterial({color:0xffd23a}));
      eye.position.set(0.10*s,0.10,-0.05); head.add(eye);
    }
    const legs=[];                   // four long thin legs
    for(const [lx,lz] of [[-0.22,-0.55],[0.22,-0.55],[-0.22,0.55],[0.22,0.55]]){
      const leg=new THREE.Group(); leg.position.set(lx,0.72,lz); grp.add(leg);
      const upper=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.045,0.55,5), skin);
      upper.position.y=-0.27; leg.add(upper);
      const lower=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.03,0.5,5), dark);
      lower.position.set(0,-0.62,0.06); leg.add(lower);
      legs.push(leg);
    }
    const tail=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.01,0.9,5), skin);
    tail.position.set(0,0.88,0.9); tail.rotation.x=-0.7; grp.add(tail);
    const halo=new THREE.PointLight(0xff5a2a,0.0,6,2); halo.position.set(0,0.7,-1); grp.add(halo);
    grp.position.set(wx,0,wz); G.add(grp);
    return {type, mesh:grp, jaw, legs, halo, speed:5.0, wanderSpeed:1.4, aggroRange:13, gameState:'wander',
      dir:Math.random()*7, dirT:0, growled:false, r:0.5};
  }
  if(type==='thing'){
    // gaunt, elongated, hunched humanoid — wrong proportions, overlong reaching arms
    const skin=new THREE.MeshLambertMaterial({color:0xcdbfae, emissive:0x2a0c0c, emissiveIntensity:0.35});
    const dark=new THREE.MeshLambertMaterial({color:0x1a1410});
    const torso=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.18,1.6,7), skin);
    torso.position.y=1.55; torso.rotation.x=0.18; grp.add(torso);
    for(let i=0;i<5;i++){            // protruding spine
      const rib=new THREE.Mesh(new THREE.TorusGeometry(0.20,0.025,5,8,Math.PI), dark);
      rib.rotation.x=Math.PI/2; rib.position.set(0,1.05+i*0.22,-0.16+i*0.03); grp.add(rib);
    }
    const head=new THREE.Group(); head.position.set(0,2.5,-0.05); head.rotation.z=0.25; grp.add(head);
    const skull=new THREE.Mesh(new THREE.SphereGeometry(0.26,10,10), skin);
    skull.scale.set(0.95,1.2,0.95); head.add(skull);
    const mouth=new THREE.Mesh(new THREE.BoxGeometry(0.10,0.36,0.05), new THREE.MeshBasicMaterial({color:0x000000}));
    mouth.position.set(0,-0.04,-0.24); head.add(mouth);
    for(const s of [-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.045,6,6), new THREE.MeshBasicMaterial({color:0x070707}));
      eye.position.set(0.09*s,0.08,-0.23); head.add(eye);
    }
    const arms=[];                   // overlong arms with splayed fingers
    for(const s of [-1,1]){
      const arm=new THREE.Group(); arm.position.set(0.26*s,2.2,0); grp.add(arm);
      const upper=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.05,1.0,6), skin);
      upper.position.y=-0.5; arm.add(upper);
      const fore=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.035,1.1,6), skin);
      fore.position.set(0,-1.35,0.1); arm.add(fore);
      for(let f=0;f<4;f++){
        const fin=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.004,0.28,4), skin);
        fin.position.set((f-1.5)*0.05,-2.0,0.12); fin.rotation.x=0.3; arm.add(fin);
      }
      arm.rotation.z=s*0.12; arms.push(arm);
    }
    for(const s of [-1,1]){          // long legs
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.05,1.6,6), skin);
      leg.position.set(0.12*s,0.78,0); grp.add(leg);
    }
    const halo=new THREE.PointLight(0xff4030,0.55,8,2); halo.position.y=2.2; grp.add(halo);
    grp.position.set(wx,0,wz); G.add(grp);
    return {type, mesh:grp, head, arms, halo, speed:4.6, wanderSpeed:3.6, aggroRange:999, gameState:'chase',
      dir:Math.random()*7, dirT:0, growled:false, r:0.55};
  }
  // smiler — a jagged grin growing out of a faint dark mass
  const bodySp=new THREE.Sprite(new THREE.SpriteMaterial({color:0x000000, transparent:true, opacity:0.32, depthWrite:false}));
  bodySp.scale.set(2.4,3.0,1); bodySp.position.y=-0.2; grp.add(bodySp);
  const sm=new THREE.Sprite(new THREE.SpriteMaterial({map:T.smiler, transparent:true, depthWrite:false}));
  sm.scale.set(1.7,1.7,1); grp.add(sm);
  const halo=new THREE.PointLight(0xcdd2ff, 0.30, 6, 2); grp.add(halo);
  grp.position.set(wx,1.6,wz); G.add(grp);
  return {type, mesh:grp, grin:sm, body:bodySp, halo, speed:1.45, wanderSpeed:0.4, aggroRange:11, gameState:'wander',
    dir:Math.random()*7, dirT:0, growled:false, r:0.45};
}

/* ---------------- puzzle objects ---------------- */
function digitTexture(str){
  const [c,x]=makeCanvas(128);
  x.fillStyle='#0a160c'; x.fillRect(0,0,128,128);
  x.fillStyle='#7dff9a'; x.font='bold 92px monospace'; x.textAlign='center'; x.textBaseline='middle';
  x.shadowColor='#7dff9a'; x.shadowBlur=14; x.fillText(str,64,70);
  return new THREE.CanvasTexture(c);
}
function makeConsole(wx,wz){
  const g=new THREE.Group();
  const box=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.8,0.28), new THREE.MeshLambertMaterial({color:0x3a3a42}));
  box.position.y=1.0; g.add(box);
  const post=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.9,0.12), new THREE.MeshLambertMaterial({color:0x202024}));
  post.position.y=0.45; g.add(post);
  const lever=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.34,6), new THREE.MeshLambertMaterial({color:0xc23a30}));
  lever.position.set(0,1.18,0.16); lever.rotation.x=0.7; g.add(lever);
  const led=new THREE.Mesh(new THREE.SphereGeometry(0.06,8,8), new THREE.MeshBasicMaterial({color:0xff2a1a}));
  led.position.set(0,1.36,0.15); g.add(led);
  const lt=new THREE.PointLight(0xff3020,0.6,3.5,2); lt.position.set(0,1.36,0.35); g.add(lt);
  g.position.set(wx,0,wz);
  return {g, lever, led, lt};
}
function makeValve(wx,wz){
  const g=new THREE.Group();
  const mat=new THREE.MeshLambertMaterial({color:0x8a5a3a, emissive:0x140a04, emissiveIntensity:0.4});
  const pipe=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,1.3,8), mat); pipe.position.y=0.65; g.add(pipe);
  const wg=new THREE.Group(); wg.position.y=1.3; g.add(wg);
  const rimMat=new THREE.MeshLambertMaterial({color:0xc24a38, emissive:0x300a06, emissiveIntensity:0.4});
  const rim=new THREE.Mesh(new THREE.TorusGeometry(0.30,0.05,8,16), rimMat); wg.add(rim);
  for(let i=0;i<3;i++){ const sp=new THREE.Mesh(new THREE.BoxGeometry(0.58,0.05,0.05), rimMat); sp.rotation.z=i*Math.PI/3; wg.add(sp); }
  const led=new THREE.Mesh(new THREE.SphereGeometry(0.06,8,8), new THREE.MeshBasicMaterial({color:0xff2a1a})); led.position.set(0,1.65,0); g.add(led);
  g.position.set(wx,0,wz);
  return {g, wg, led};
}
function makeFragment(wx,wz,digit){
  const g=new THREE.Group();
  const back=new THREE.Mesh(new THREE.BoxGeometry(0.46,0.46,0.05), new THREE.MeshLambertMaterial({color:0x14241a}));
  back.position.y=1.4; g.add(back);
  const face=new THREE.Mesh(new THREE.PlaneGeometry(0.4,0.4), new THREE.MeshBasicMaterial({map:digitTexture(''+digit), transparent:true}));
  face.position.set(0,1.4,0.03); g.add(face);
  const post=new THREE.Mesh(new THREE.BoxGeometry(0.06,1.2,0.06), new THREE.MeshLambertMaterial({color:0x20281f})); post.position.y=0.6; g.add(post);
  const lt=new THREE.PointLight(0x6dff8a,0.7,4,2); lt.position.set(0,1.4,0.3); g.add(lt);
  g.position.set(wx,0,wz);
  return {g};
}
function makeKeypad(wx,wz){
  const g=new THREE.Group();
  const box=new THREE.Mesh(new THREE.BoxGeometry(0.6,1.0,0.28), new THREE.MeshLambertMaterial({color:0x2e2e36})); box.position.y=1.0; g.add(box);
  const post=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.9,0.12), new THREE.MeshLambertMaterial({color:0x1c1c20})); post.position.y=0.45; g.add(post);
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(0.42,0.22), new THREE.MeshBasicMaterial({color:0x123a1c})); screen.position.set(0,1.32,0.15); g.add(screen);
  const lt=new THREE.PointLight(0x40ff70,0.7,3.5,2); lt.position.set(0,1.3,0.35); g.add(lt);
  g.position.set(wx,0,wz);
  return {g, screen, lt};
}
function makeKeycard(wx,wz){
  const g=new THREE.Group();
  const card=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.46,0.03), new THREE.MeshLambertMaterial({color:0xeaff8a, emissive:0x6a7a20, emissiveIntensity:0.8}));
  card.rotation.z=0.35; g.add(card);
  const lt=new THREE.PointLight(0xd0ff60,0.8,4.5,2); g.add(lt);
  g.position.set(wx,1.1,wz);
  return {g};
}

/* ---------------- task / interaction system ---------------- */
function codeFound(){ let n=0; for(const o of world.interactables) if(o.type==='fragment'&&o.done) n++; return n; }
function setObjective(){
  const L=LEVELS[curLevel]; let s=L.objective;
  if(world.taskType==='switches') s='ENGAGE BREAKERS  '+world.tasksDone+'/'+world.tasksTotal+'  ·  THEN THE STAIRWELL';
  else if(world.taskType==='valves') s='OPEN DRAIN VALVES  '+world.tasksDone+'/'+world.tasksTotal+'  ·  THEN THE ARCH';
  else if(world.taskType==='code') s='FIND CODE DIGITS  '+codeFound()+'/'+world.tasksTotal+'  ·  KEYPAD BY THE HATCH';
  else if(world.taskType==='keycard') s=world.haveKeycard?'KEYCARD ACQUIRED — REACH THE OUTPOST':'GRAB THE KEYCARD — THEN RUN FOR THE OUTPOST';
  if(world.keypadNear && world.taskType==='code' && world.locked){
    const buf=(world.codeBuf||'').padEnd(world.code.length,'_').split('').join(' ');
    s='KEYPAD  [ '+buf+' ]  ·  TYPE THE DIGITS';
  }
  $('objective').textContent=s;
}
function lockMsg(){
  if(world.taskType==='switches') return 'NO POWER ('+world.tasksDone+'/'+world.tasksTotal+' BREAKERS)';
  if(world.taskType==='valves') return 'WATER TOO HIGH ('+world.tasksDone+'/'+world.tasksTotal+' VALVES)';
  if(world.taskType==='code') return 'ENTER THE KEYPAD CODE';
  if(world.taskType==='keycard') return 'NEED THE KEYCARD';
  return 'SEALED';
}
function setupTask(L, ewx, ewz, grid, N, G){
  world.interactables=[]; world.tasksDone=0; world.tasksTotal=0; world.code=''; world.codeBuf='';
  world.keypad=null; world.keypadNear=false; world.haveKeycard=false; world.lockRing=null; world.exitLightOpenColor=null;
  world.waterTargetY = world.water ? world.water.position.y : 0;
  const task=L.task||{type:'reach'};
  world.taskType=task.type;
  world.locked = task.type!=='reach';

  if(world.locked){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(0.7,0.09,8,20), new THREE.MeshBasicMaterial({color:0xff2a1a}));
    ring.position.set(ewx,3.65,ewz); ring.rotation.x=Math.PI/2; G.add(ring); world.lockRing=ring;
    if(world.exitLight){ world.exitLightOpenColor=world.exitLight.color.getHex(); world.exitLight.color.setHex(0xff2a1a); }
  }

  const spots=farFloorCells(grid,N,5,1,1);
  function nextSpot(){
    if(!spots.length) return [ewx+4,ewz];
    const i=Math.random()*spots.length|0; const [cx,cy]=spots.splice(i,1)[0]; return cellToWorld(cx,cy,N);
  }

  if(task.type==='switches'){
    world.tasksTotal=task.count;
    for(let i=0;i<task.count;i++){ const [wx,wz]=nextSpot(); const c=makeConsole(wx,wz); G.add(c.g);
      world.interactables.push({type:'switch', mesh:c.g, done:false, parts:c}); }
  } else if(task.type==='valves'){
    world.tasksTotal=task.count;
    for(let i=0;i<task.count;i++){ const [wx,wz]=nextSpot(); const v=makeValve(wx,wz); G.add(v.g);
      world.interactables.push({type:'valve', mesh:v.g, done:false, parts:v, spin:0}); }
  } else if(task.type==='code'){
    world.tasksTotal=task.digits; let code='';
    for(let i=0;i<task.digits;i++){ const d=1+(Math.random()*9|0); code+=d;
      const [wx,wz]=nextSpot(); const fr=makeFragment(wx,wz,d); G.add(fr.g);
      world.interactables.push({type:'fragment', mesh:fr.g, done:false, digit:d, pos:i+1}); }
    world.code=code;
    const [kx,kz]=cellToWorld(N-3,N-2,N);
    const kp=makeKeypad(kx,kz); G.add(kp.g); world.keypad=kp.g;
  } else if(task.type==='keycard'){
    world.tasksTotal=1;
    const [wx,wz]=nextSpot(); const k=makeKeycard(wx,wz); G.add(k.g);
    world.interactables.push({type:'keycard', mesh:k.g, done:false});
  }
  setObjective();
}
function unlockExit(){
  if(!world.locked) return;
  world.locked=false;
  if(world.lockRing) world.lockRing.material.color.setHex(0x32ff5a);
  if(world.exitLight && world.exitLightOpenColor!=null) world.exitLight.color.setHex(world.exitLightOpenColor);
  AUDIO.noclip(); toast('THE WAY IS OPEN',true);
}
function checkUnlock(){ if(world.locked && world.taskType!=='code' && world.tasksDone>=world.tasksTotal) unlockExit(); }
function tryInteract(){
  if(gameState!=='play') return;
  let best=null,bd=2.7;
  for(const o of world.interactables){ if(o.done && o.type!=='fragment') continue;
    const d=o.mesh.position.distanceTo(player.pos); if(d<bd){ bd=d; best=o; } }
  if(!best) return;
  if(best.type==='switch'){ best.done=true; best.parts.led.material.color.setHex(0x32ff5a); best.parts.lt.color.setHex(0x32ff5a);
    best.parts.lever.rotation.x=-0.7; world.tasksDone++; AUDIO.blip(300,0.18,0.12,'square');
    toast('BREAKER ENGAGED  '+world.tasksDone+'/'+world.tasksTotal); checkUnlock(); setObjective(); }
  else if(best.type==='valve'){ best.done=true; best.spin=1.0; best.parts.led.material.color.setHex(0x32ff5a);
    world.tasksDone++; world.waterTargetY-=0.20; AUDIO.blip(150,0.5,0.12,'sawtooth');
    toast('VALVE OPEN — WATER FALLING  '+world.tasksDone+'/'+world.tasksTotal); checkUnlock(); setObjective(); }
  else if(best.type==='fragment'){ if(!best.done){ best.done=true; AUDIO.blip(720,0.15,0.1,'sine');
    toast('CODE — DIGIT '+best.pos+' IS  '+best.digit, true); setObjective(); } }
  else if(best.type==='keycard'){ best.done=true; best.mesh.visible=false; world.haveKeycard=true; world.tasksDone++;
    AUDIO.drink(); toast('KEYCARD ACQUIRED'); unlockExit(); setObjective(); }
}

/* ---------------- props, characters, terrain ---------------- */
function openGrid(N){ const g=[]; for(let y=0;y<N;y++){ const row=new Array(N).fill(0);
  if(y===0||y===N-1){ row.fill(1); } else { row[0]=1; row[N-1]=1; } g.push(row); } return g; }
function pmat(c,e){ return new THREE.MeshLambertMaterial({color:c, emissive:e||0x000000, emissiveIntensity:e?0.45:0}); }

function makeWoodChair(){ const g=new THREE.Group(); const m=pmat(0x3a2a1a);
  const seat=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.07,0.45), m); seat.position.y=0.48; g.add(seat);
  const back=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.55,0.05), m); back.position.set(0,0.78,-0.2); g.add(back);
  for(let i=0;i<3;i++){ const sl=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.5,0.06), m); sl.position.set(-0.15+i*0.15,0.76,-0.2); g.add(sl); }
  for(const [x,z] of [[-.18,-.18],[.18,-.18],[-.18,.18],[.18,.18]]){ const l=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.48,0.05), m); l.position.set(x,0.24,z); g.add(l); }
  return g; }
function makePillar(){ const g=new THREE.Group();
  const col=new THREE.Mesh(new THREE.BoxGeometry(0.95,WALL_H,0.95), new THREE.MeshLambertMaterial({map:tex(T.wallpaper,1,2)}));
  col.position.y=WALL_H/2; g.add(col); return g; }
function graffitiTexture(){
  const [c,x]=makeCanvas(256); x.clearRect(0,0,256,256);
  const dark = Math.random()<0.7;
  x.strokeStyle = dark?'rgba(22,16,10,0.85)':'rgba(110,20,15,0.8)';
  x.fillStyle = x.strokeStyle; x.lineWidth=4+Math.random()*3; x.lineCap='round';
  for(let i=0;i<3;i++){ x.beginPath(); x.moveTo(Math.random()*256,Math.random()*256);
    for(let j=0;j<4;j++) x.lineTo(Math.random()*256,Math.random()*256); x.stroke(); }
  const k=Math.random();
  if(k<0.34){ for(let i=0;i<6;i++){ x.beginPath(); x.moveTo(40+i*22,80); x.lineTo(40+i*22,150); x.stroke(); }
    x.beginPath(); x.moveTo(32,142); x.lineTo(44+5*22,88); x.stroke(); }
  else if(k<0.67){ x.beginPath(); x.ellipse(128,128,66,38,0,0,7); x.stroke(); x.beginPath(); x.arc(128,128,16,0,7); x.fill(); }
  else { for(let i=0;i<3;i++){ const yy=72+i*48; x.beginPath(); x.moveTo(44,yy); x.lineTo(200,yy);
    x.lineTo(180,yy-14); x.moveTo(200,yy); x.lineTo(180,yy+14); x.stroke(); } }
  return new THREE.CanvasTexture(c);
}
function wallFaces(grid,N){
  const out=[];
  for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){ if(grid[y][x]!==0) continue;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if(grid[y+dy][x+dx]===1) out.push([x,y,dx,dy]); }
  return out;
}
function buildFurniturePile(wx,wz,G){
  const grp=new THREE.Group(); grp.position.set(wx,0,wz);
  const couch=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.8,0.85), pmat(0x8a7a58)); couch.position.set(0,0.4,0); grp.add(couch);
  const couchBack=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.6,0.25), pmat(0x8a7a58)); couchBack.position.set(0,0.9,-0.3); grp.add(couchBack);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(0.7,1.4,0.5), pmat(0x4a3a26)); cab.position.set(0.75,0.75,0.35); cab.rotation.z=0.12; grp.add(cab);
  const tv=new THREE.Mesh(new THREE.BoxGeometry(0.85,0.62,0.6), pmat(0x14141a)); tv.position.set(-0.55,1.25,0.2); tv.rotation.z=-0.22; grp.add(tv);
  const table=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.08,0.8), pmat(0x5a4630)); table.position.set(0.2,1.85,-0.2); table.rotation.set(0.35,0.4,0.5); grp.add(table);
  for(let i=0;i<7;i++){ const ch=makeWoodChair();
    ch.position.set((Math.random()-.5)*1.7, 1.0+Math.random()*1.3, (Math.random()-.5)*1.2);
    ch.rotation.set(Math.random()*3, Math.random()*7, Math.random()*3); ch.scale.setScalar(0.85+Math.random()*0.3); grp.add(ch); }
  G.add(grp);
}

function makeChair(){ const g=new THREE.Group(); const m=pmat(0x26262e);
  const seat=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.08,0.5), m); seat.position.y=0.5; g.add(seat);
  const back=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.55,0.07), m); back.position.set(0,0.78,-0.21); g.add(back);
  for(const [x,z] of [[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]]){ const l=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.5,0.06), m); l.position.set(x,0.25,z); g.add(l); }
  return g; }
function makeDesk(){ const g=new THREE.Group(); const m=pmat(0x3a2f22);
  const top=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.08,0.7), m); top.position.y=0.75; g.add(top);
  for(const [x,z] of [[-.6,-.28],[.6,-.28],[-.6,.28],[.6,.28]]){ const l=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.75,0.08), m); l.position.set(x,0.37,z); g.add(l); }
  return g; }
function makeCabinet(){ const g=new THREE.Group(); const m=pmat(0x4a4640);
  const box=new THREE.Mesh(new THREE.BoxGeometry(0.7,1.5,0.5), m); box.position.y=0.75; g.add(box);
  for(let i=0;i<3;i++){ const dr=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.04,0.02), pmat(0x222020)); dr.position.set(0,0.4+i*0.42,0.26); g.add(dr); }
  return g; }
function makePlant(){ const g=new THREE.Group();
  const pot=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.13,0.4,8), pmat(0x5a4030)); pot.position.y=0.2; g.add(pot);
  const leaf=new THREE.Mesh(new THREE.SphereGeometry(0.32,7,7), pmat(0x2c4a26)); leaf.position.y=0.7; leaf.scale.set(1,1.4,1); g.add(leaf);
  return g; }
function makeBarrel(){ const g=new THREE.Group();
  const b=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,0.9,12), pmat(0x6a4a28)); b.position.y=0.45; g.add(b);
  const r1=new THREE.Mesh(new THREE.TorusGeometry(0.33,0.03,6,12), pmat(0x33260f)); r1.rotation.x=Math.PI/2; r1.position.y=0.65; g.add(r1);
  const r2=r1.clone(); r2.position.y=0.25; g.add(r2); return g; }
function makePallet(){ const g=new THREE.Group(); const m=pmat(0x6a5436);
  for(let i=0;i<4;i++){ const sl=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.06,0.16), m); sl.position.set(0,0.12,-0.45+i*0.3); g.add(sl); }
  const base=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.08,1.0), m); base.position.y=0.04; g.add(base); return g; }
function makeFloat(){ const g=new THREE.Group();
  const t=new THREE.Mesh(new THREE.TorusGeometry(0.45,0.16,8,16), pmat(0xe0e8ec)); t.rotation.x=Math.PI/2; t.position.y=0.55; g.add(t); return g; }
function makeDebris(){ const g=new THREE.Group(); const m=pmat(0x33302a);
  for(let i=0;i<4;i++){ const b=new THREE.Mesh(new THREE.BoxGeometry(0.2+Math.random()*0.3,0.12,0.2+Math.random()*0.3), m);
    b.position.set((Math.random()-.5)*0.8,0.08,(Math.random()-.5)*0.8); b.rotation.y=Math.random()*7; g.add(b); } return g; }
function makeSign(){ const g=new THREE.Group();
  const post=new THREE.Mesh(new THREE.BoxGeometry(0.06,1.6,0.06), pmat(0x222020)); post.position.y=0.8; g.add(post);
  const plate=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.5,0.04), pmat(0xb02818,0x401008)); plate.position.y=1.5; g.add(plate); return g; }
function makeStreetlight(){ const g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,4.0,8), pmat(0x1a1a1e)); pole.position.y=2.0; g.add(pole);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.08,0.08), pmat(0x1a1a1e)); arm.position.set(0.3,4.0,0); g.add(arm);
  const lamp=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.12,0.25), new THREE.MeshBasicMaterial({color:0xffe7a0})); lamp.position.set(0.6,3.95,0); g.add(lamp);
  const lt=new THREE.PointLight(0xffd58a,0.9,12,2); lt.position.set(0.6,3.7,0); g.add(lt); return g; }
function makeFence(){ const g=new THREE.Group(); const m=pmat(0x8a8678);
  const rail=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.06,0.05), m); rail.position.set(0,0.7,0); g.add(rail);
  const rail2=rail.clone(); rail2.position.y=0.35; g.add(rail2);
  for(let i=0;i<7;i++){ const pk=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.9,0.05), m); pk.position.set(-0.8+i*0.27,0.45,0); g.add(pk); } return g; }
function makeMailbox(){ const g=new THREE.Group();
  const post=new THREE.Mesh(new THREE.BoxGeometry(0.06,1.0,0.06), pmat(0x3a3026)); post.position.y=0.5; g.add(post);
  const box=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.18,0.4), pmat(0x44484e)); box.position.y=1.05; g.add(box); return g; }
function makeBush(){ const g=new THREE.Group(); const m=pmat(0x24401f);
  for(let i=0;i<3;i++){ const s=new THREE.Mesh(new THREE.SphereGeometry(0.3+Math.random()*0.2,7,7), m);
    s.position.set((Math.random()-.5)*0.4,0.3+Math.random()*0.2,(Math.random()-.5)*0.4); g.add(s); } return g; }
function makeRock(){ const g=new THREE.Group();
  const r=new THREE.Mesh(new THREE.IcosahedronGeometry(0.3+Math.random()*0.4,0), pmat(0x4a4a50)); r.position.y=0.2; r.rotation.set(Math.random(),Math.random(),Math.random()); g.add(r); return g; }
function makeDeadTree(){ const g=new THREE.Group(); const m=pmat(0x2a2018);
  const tr=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.16,2.4,7), m); tr.position.y=1.2; g.add(tr);
  for(let i=0;i<4;i++){ const br=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.06,0.9,5), m);
    br.position.set(0,1.6+Math.random()*0.6,0); br.rotation.z=(Math.random()-.5)*1.6; br.rotation.y=Math.random()*7; g.add(br); } return g; }

function scatterProps(L, grid, N, G){
  const open=[]; for(let y=2;y<N-2;y++)for(let x=2;x<N-2;x++) if(grid[y][x]===0 && !(x>=N-4&&y>=N-4)) open.push([x,y]);
  function place(fn,count,glitch){
    for(let i=0;i<count && open.length;i++){
      const idx=Math.random()*open.length|0; const [cx,cy]=open[idx];
      if(Math.random()<0.5) open.splice(idx,1);
      const [wx,wz]=cellToWorld(cx,cy,N);
      const jx=(Math.random()-.5)*2.0, jz=(Math.random()-.5)*2.0;
      const gy=world.terrainFn?world.terrainFn(wx+jx,wz+jz):0;
      const o=fn(); o.position.set(wx+jx,gy,wz+jz); o.rotation.y=Math.random()*Math.PI*2; G.add(o);
      if(glitch && Math.random()<glitch) world.glitchProps.push({mesh:o, base:o.position.clone(), t:Math.random()*7});
    }
  }
  const th=L.theme;
  if(th==='lobby'){
    // mostly empty — but the real Level 0 has sparse lone chairs, pillars, graffiti, a furniture pile, and the wall-chair anomaly
    place(makeWoodChair, 5, 0);
    // support pillars in the middle of open rooms
    const oc=[]; for(let y=2;y<N-2;y++)for(let x=2;x<N-2;x++){ if(grid[y][x]!==0) continue;
      let nb=0; for(const[dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if(grid[y+dy][x+dx]===0) nb++;
      if(nb===4) oc.push([x,y]); }
    for(let i=0;i<4 && oc.length;i++){ const [cx,cy]=oc.splice(Math.random()*oc.length|0,1)[0];
      const [wx,wz]=cellToWorld(cx,cy,N); const p=makePillar(); p.position.set(wx,0,wz); G.add(p); }
    // wall graffiti
    const wf=wallFaces(grid,N);
    for(let i=0;i<9 && wf.length;i++){
      const [x,y,dx,dy]=wf.splice(Math.random()*wf.length|0,1)[0];
      const [owx,owz]=cellToWorld(x,y,N);
      const sx=owx+dx*(CELL/2-0.06), sz=owz+dy*(CELL/2-0.06), h=1.1+Math.random()*0.9;
      const gf=new THREE.Mesh(new THREE.PlaneGeometry(0.9+Math.random()*0.8, 0.7+Math.random()*0.5),
        new THREE.MeshBasicMaterial({map:graffitiTexture(), transparent:true, opacity:0.82, side:THREE.DoubleSide}));
      gf.position.set(sx,h,sz); gf.lookAt(owx,h,owz); G.add(gf);
    }
    // the "how did that get there" chair stuck high on a wall
    if(wf.length){ const [x,y,dx,dy]=wf.splice(Math.random()*wf.length|0,1)[0];
      const [owx,owz]=cellToWorld(x,y,N);
      const ch=makeWoodChair(); ch.position.set(owx+dx*(CELL/2-0.35), 2.7, owz+dy*(CELL/2-0.35));
      ch.rotation.set(0, Math.random()*7, Math.PI/2); G.add(ch); }
    // the legendary furniture pile
    const far=farFloorCells(grid,N,8,1,1);
    if(far.length){ const [cx,cy]=far[Math.random()*far.length|0]; const [wx,wz]=cellToWorld(cx,cy,N);
      buildFurniturePile(wx,wz,G); }
  }
  else if(th==='warehouse'){ place(makeBarrel,12,0); place(makePallet,9,0); place(makeCabinet,4,0); place(makeDebris,8,0); }
  else if(th==='pools'){ place(makeFloat,11,0); place(makeChair,5,0); }
  else if(th==='pipes'){ place(makeBarrel,8,0.2); place(makeDebris,12,0); }
  else if(th==='suburbs'){ place(makeStreetlight,8,0); place(makeFence,16,0); place(makeMailbox,7,0); place(makeBush,12,0); }
  else if(th==='hills'){ place(makeRock,18,0); place(makeDeadTree,12,0); place(makeBush,16,0); }
  else if(th==='redrun'){ place(makeDebris,12,0.3); place(makeChair,6,0.5); place(makeSign,5,0); }
}

function makeHuman(col){
  const g=new THREE.Group();
  const skin=pmat(0xcaa17a), cloth=pmat(col||0x4a5a6a), pants=pmat(0x2c2c34);
  const hips=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.14,0.34,8), cloth); hips.position.y=0.98; g.add(hips);
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(0.21,0.17,0.6,8), cloth); torso.position.y=1.42; g.add(torso);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.1,6), skin); neck.position.y=1.74; g.add(neck);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.16,10,10), skin); head.position.y=1.88; head.scale.set(0.92,1.05,0.92); g.add(head);
  const hair=new THREE.Mesh(new THREE.SphereGeometry(0.165,8,8,0,Math.PI*2,0,Math.PI*0.6), pmat(0x201810)); hair.position.y=1.9; g.add(hair);
  const arms=[],legs=[];
  for(const sn of [-1,1]){
    const sh=new THREE.Group(); sh.position.set(0.22*sn,1.6,0); g.add(sh);
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.045,0.62,6), cloth); arm.position.y=-0.3; sh.add(arm);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(0.055,6,6), skin); hand.position.y=-0.62; sh.add(hand); arms.push(sh);
    const hp=new THREE.Group(); hp.position.set(0.09*sn,0.86,0); g.add(hp);
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.05,0.8,6), pants); leg.position.y=-0.4; hp.add(leg); legs.push(hp);
  }
  return {g, arms, legs, head};
}
function spawnNPCs(L, grid, N, G){
  const th=L.theme;
  if(th!=='lobby' && th!=='suburbs') return;
  const lines = th==='lobby'
    ? ['"...you hear it too? the buzzing never stops."','"i counted nine thousand tiles. then i started over."','"don\u2019t drink the water unless it\u2019s almond. trust me."','"which way is out? ...there is no out."']
    : ['"three a.m. forever out here. check your watch."','"i used to live in a house like that one. maybe that one."','"the porch lights move when you\u2019re not looking."','"keep off the lawns. the lawns are hungry."'];
  const cols=[0x4a5a6a,0x6a4a3a,0x3a4a3a,0x5a4a5a];
  const far=farFloorCells(grid,N,8,1,1);
  for(let i=0;i<3 && far.length;i++){
    const [cx,cy]=far.splice(Math.random()*far.length|0,1)[0];
    const [wx,wz]=cellToWorld(cx,cy,N);
    const h=makeHuman(cols[Math.random()*cols.length|0]);
    const gy=world.terrainFn?world.terrainFn(wx,wz):0;
    h.g.position.set(wx,gy,wz); G.add(h.g);
    world.npcs.push({g:h.g, arms:h.arms, legs:h.legs, dir:Math.random()*7, dirT:0, greeted:-99, line:lines[i%lines.length]});
  }
}
function updateNPCs(dt,t){
  for(const n of world.npcs){
    n.dirT-=dt; if(n.dirT<=0){ n.dir=Math.random()*Math.PI*2; n.dirT=2+Math.random()*3; }
    const vx=Math.cos(n.dir)*0.7, vz=Math.sin(n.dir)*0.7;
    let nx=n.g.position.x+vx*dt, nz=n.g.position.z+vz*dt;
    [nx,nz]=collide(nx,nz,0.4);
    if(Math.abs(nx-n.g.position.x)<0.001 && Math.abs(nz-n.g.position.z)<0.001) n.dirT=0;
    n.g.position.x=nx; n.g.position.z=nz;
    if(world.terrainFn) n.g.position.y=world.terrainFn(nx,nz);
    n.g.rotation.y=Math.atan2(vx,vz);
    const sw=Math.sin(t*5)*0.5;
    if(n.arms){ n.arms[0].rotation.x=sw; n.arms[1].rotation.x=-sw; }
    if(n.legs){ n.legs[0].rotation.x=-sw; n.legs[1].rotation.x=sw; }
    const d=Math.hypot(player.pos.x-nx, player.pos.z-nz);
    if(d<3.4 && t-n.greeted>14){ n.greeted=t; toast(n.line,true); }
  }
}

function lineOfSight(ax,az,bx,bz){
  const dx=bx-ax, dz=bz-az, d=Math.hypot(dx,dz), steps=Math.ceil(d/0.6);
  for(let i=1;i<steps;i++){
    const t=i/steps;
    const [cx,cy]=worldToCell(ax+dx*t, az+dz*t, world.N);
    if(isWall(cx,cy)) return false;
  }
  return true;
}

function collide(px,pz,r){
  const [ccx,ccy]=worldToCell(px,pz,world.N);
  for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
    const cx=ccx+ox, cy=ccy+oy;
    if(!isWall(cx,cy)) continue;
    const [wx,wz]=cellToWorld(cx,cy,world.N);
    const hx=CELL/2, hz=CELL/2;
    const nx=Math.max(wx-hx,Math.min(px,wx+hx));
    const nz=Math.max(wz-hz,Math.min(pz,wz+hz));
    let dx=px-nx, dz=pz-nz, d2=dx*dx+dz*dz;
    if(d2<r*r){
      let d=Math.sqrt(d2);
      if(d<1e-5){ dx=px-wx; dz=pz-wz; d=Math.hypot(dx,dz)||1; }
      const push=r-Math.sqrt(d2)+0.001;
      px+=dx/d*push; pz+=dz/d*push;
    }
  }
  return [px,pz];
}

function updateEntities(dt,t){
  for(const e of world.entities){
    const m=e.mesh;
    const dx=player.pos.x-m.position.x, dz=player.pos.z-m.position.z;
    const dist=Math.hypot(dx,dz)||0.0001;
    // crouch shrinks detection range
    const aggro = e.aggroRange * (player.crouch?0.6:1) * (player.sprinting?1.25:1);
    let sees = e.type==='thing' ? true : (dist<aggro && lineOfSight(m.position.x,m.position.z,player.pos.x,player.pos.z));
    if(sees && e.gameState!=='chase'){ e.gameState='chase'; if(!e.growled){ e.growled=true; AUDIO.sting(e.type); } }
    if(!sees && dist>aggro*1.4 && e.type!=='thing'){ e.gameState='wander'; e.growled=false; }

    let vx=0,vz=0;
    if(e.gameState==='chase'){
      const sm=diffNow().espeed; vx=dx/dist*e.speed*sm; vz=dz/dist*e.speed*sm;
      if(e.type==='smiler'){
        const look=( dx*Math.sin(player.yaw) + dz*Math.cos(player.yaw) )/dist;
        if(look>0.55){ vx*=0.12; vz*=0.12; }
      }
    } else {
      e.dirT-=dt;
      if(e.dirT<=0){ e.dir=Math.random()*Math.PI*2; e.dirT=1.5+Math.random()*2.5; }
      vx=Math.cos(e.dir)*e.wanderSpeed; vz=Math.sin(e.dir)*e.wanderSpeed;
    }
    let nx=m.position.x+vx*dt, nz=m.position.z+vz*dt;
    [nx,nz]=collide(nx,nz,e.r);
    if(Math.abs(nx-m.position.x)<0.001 && Math.abs(nz-m.position.z)<0.001 && e.gameState==='wander') e.dirT=0;
    m.position.x=nx; m.position.z=nz;

    if(e.type==='hound'){
      m.rotation.y=Math.atan2(-(player.pos.x-nx), -(player.pos.z-nz));
      if(e.gameState==='wander') m.rotation.y=-e.dir+Math.PI/2;
      const gait=e.gameState==='chase'?16:7;
      m.position.y=Math.abs(Math.sin(t*gait))*0.07;
      if(e.legs) for(let i=0;i<e.legs.length;i++) e.legs[i].rotation.x=Math.sin(t*gait+i*Math.PI/2)*0.6;
      if(e.jaw) e.jaw.rotation.x=-Math.PI/2 + (e.gameState==='chase'? Math.abs(Math.sin(t*12))*0.5 : 0.04);
      if(e.halo) e.halo.intensity=e.gameState==='chase'? 0.6+Math.sin(t*10)*0.2 : 0.0;
    } else if(e.type==='thing'){
      m.rotation.y=Math.atan2(player.pos.x-nx, player.pos.z-nz);
      m.position.y=Math.abs(Math.sin(t*7))*0.05;
      if(e.head) e.head.rotation.z=0.25+Math.sin(t*1.3)*0.08;
      if(e.arms) for(let i=0;i<e.arms.length;i++) e.arms[i].rotation.x=Math.sin(t*5+i*Math.PI)*0.18;
      if(e.halo) e.halo.intensity=0.5+Math.sin(t*8)*0.15;
    } else {
      m.position.y=1.6+Math.sin(t*1.7+e.dir)*0.12;
      const vis=0.55+0.45*Math.max(0,1-dist/e.aggroRange);
      if(e.grin){ e.grin.material.opacity=vis;
        const sc=1.7+(1-Math.min(1,dist/e.aggroRange))*0.8; e.grin.scale.set(sc,sc,1); }
      if(e.body) e.body.material.opacity=0.30*vis;
    }

    if(dist<0.9 && t-player.lastHit>1.0){
      player.lastHit=t;
      if(e.type==='hound'){ player.hp-=34; AUDIO.hit(); toast('THE HOUND TORE INTO YOU'); }
      else if(e.type==='thing'){ player.hp-=60; AUDIO.hit(); toast('IT WORE YOUR FACE'); }
      else { player.sanity-=26; player.hp-=10; AUDIO.hit(); toast('ITS SMILE FILLS YOUR MIND'); }
      kickPulse=1;
      m.position.x-=dx/dist*1.2; m.position.z-=dz/dist*1.2;
    }
  }
}

/* ---------------- audio ---------------- */
const AUDIO={ ctx:null, master:null, humGain:null, started:false,
  start(){
    if(this.started) return; this.started=true;
    const C=this.ctx=new (window.AudioContext||window.webkitAudioContext)();
    this.master=C.createGain(); this.master.gain.value=GAME.volume; this.master.connect(C.destination);
    const hg=this.humGain=C.createGain(); hg.gain.value=0.05; hg.connect(this.master);
    [120,240,360].forEach((f,i)=>{ const o=C.createOscillator(); o.type='sawtooth'; o.frequency.value=f;
      const g=C.createGain(); g.gain.value=[0.4,0.14,0.05][i]; o.connect(g); g.connect(hg); o.start(); });
    const buf=C.createBuffer(1,C.sampleRate*2,C.sampleRate);
    const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    const n=C.createBufferSource(); n.buffer=buf; n.loop=true;
    const f=C.createBiquadFilter(); f.type='bandpass'; f.frequency.value=900; f.Q.value=0.6;
    const ng=C.createGain(); ng.gain.value=0.012; n.connect(f); f.connect(ng); ng.connect(this.master); n.start();
    this.noiseBuf=buf;
  },
  resume(){ if(this.ctx && this.ctx.gameState==='suspended') this.ctx.resume(); },
  setHum(v){ if(this.humGain) this.humGain.gain.setTargetAtTime(v,this.ctx.currentTime,0.4); },
  setVolume(v){ if(this.master) this.master.gain.value=v; },
  blip(freq,dur,vol,type){ if(!this.ctx) return; const C=this.ctx;
    const o=C.createOscillator(); o.type=type||'sine'; o.frequency.value=freq;
    const g=C.createGain(); g.gain.setValueAtTime(vol,C.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001,C.currentTime+dur);
    o.connect(g); g.connect(this.master); o.start(); o.stop(C.currentTime+dur); },
  step(wet){ if(!this.ctx) return; const C=this.ctx;
    const s=C.createBufferSource(); s.buffer=this.noiseBuf;
    s.playbackRate.value=(wet?0.6:0.4)+Math.random()*0.3;
    const f=C.createBiquadFilter(); f.type=wet?'highpass':'lowpass'; f.frequency.value=wet?500:300+Math.random()*200;
    const g=C.createGain(); g.gain.setValueAtTime(wet?0.07:0.10,C.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001,C.currentTime+(wet?0.2:0.12));
    s.connect(f); f.connect(g); g.connect(this.master); s.start(); s.stop(C.currentTime+0.22); },
  drink(){ this.blip(620,0.25,0.12,'sine'); setTimeout(()=>this.blip(840,0.3,0.1,'sine'),140); },
  hit(){ this.blip(90,0.4,0.3,'sawtooth'); },
  click(){ this.blip(900,0.04,0.08,'square'); },
  heartbeat(){ this.blip(55,0.16,0.22,'sine'); setTimeout(()=>this.blip(48,0.2,0.18,'sine'),190); },
  sting(type){ if(!this.ctx) return; const C=this.ctx;
    const o=C.createOscillator(); o.type='sawtooth';
    const lo = type==='hound'?180 : type==='thing'?260 : 520;
    const hi = type==='hound'?70 : type==='thing'?60 : 1400;
    o.frequency.setValueAtTime(lo,C.currentTime);
    o.frequency.exponentialRampToValueAtTime(hi,C.currentTime+1.1);
    const g=C.createGain(); g.gain.setValueAtTime(0.13,C.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001,C.currentTime+1.2);
    o.connect(g); g.connect(this.master); o.start(); o.stop(C.currentTime+1.25); },
  noclip(){ if(!this.ctx) return;
    for(let i=0;i<8;i++) setTimeout(()=>this.blip(200+Math.random()*1800,0.1,0.08,'square'), i*70); }
};

/* ---------------- input ---------------- */
const keys={};
addEventListener('keydown',e=>{
  if(e.code==='Tab'){ e.preventDefault(); if(gameState==='play') $('mapWrap').classList.toggle('show'); }
  if(e.code==='KeyF' && gameState==='play'){ toggleFlash(); }
  if(keys[e.code]) return; keys[e.code]=true;
  if(e.code==='Escape' && gameState==='play') pauseGame();
  if(e.code==='KeyE' && gameState==='play') tryInteract();
  if(gameState==='play' && world.keypadNear && world.taskType==='code' && world.locked){
    const m=e.code.match(/^(?:Digit|Numpad)(\d)$/);
    if(m){ world.codeBuf=(world.codeBuf+m[1]).slice(-world.code.length);
      if(world.codeBuf.length>=world.code.length){
        if(world.codeBuf===world.code) unlockExit();
        else { AUDIO.blip(90,0.4,0.2,'sawtooth'); toast('CODE REJECTED'); }
        world.codeBuf='';
      } else AUDIO.click();
      setObjective();
    } else if(e.code==='Backspace'){ world.codeBuf=world.codeBuf.slice(0,-1); setObjective(); }
  }
});
addEventListener('keyup',e=>{ keys[e.code]=false; });

function toggleFlash(){
  player.flashOn=!player.flashOn;
  if(flashlight) flashlight.visible=player.flashOn && player.power>0;
  AUDIO.click();
}

camera.rotation.order='YXZ';
document.addEventListener('mousemove',e=>{
  if(gameState!=='play'||!document.pointerLockElement) return;
  player.yaw-=e.movementX*GAME.sens;
  const iy=GAME.invertY?-1:1;
  player.pitch=Math.max(-1.45,Math.min(1.45,player.pitch-e.movementY*GAME.sens*iy));
});
canvas.addEventListener('click',()=>{ if(gameState==='play'&&!document.pointerLockElement) canvas.requestPointerLock(); });
document.addEventListener('pointerlockchange',()=>{
  const locked=!!document.pointerLockElement;
  document.body.classList.toggle('locked',locked);
  if(!locked && gameState==='play') pauseGame();
});

/* sensitivity slider */
const sensRange=$('sensRange');
sensRange.addEventListener('input',()=>{
  GAME.sens=(+sensRange.value)/10000; SENS=GAME.sens;
  $('sensVal').textContent=((+sensRange.value)/10).toFixed(1);
  const os=$('optSens'); if(os.value!==undefined) os.value=sensRange.value; const ov=$('optSensV'); ov.textContent=((+sensRange.value)/10).toFixed(1);
});

/* ---------------- HUD helpers ---------------- */
let toastT=null;
function toast(msg,long){
  const el=$('toast');
  el.textContent=msg; el.style.opacity=1;
  clearTimeout(toastT); toastT=setTimeout(()=>el.style.opacity=0, long?4200:2400);
}
function setBars(){
  $('hpF').style.width=Math.max(0,player.hp)+'%';
  $('saF').style.width=Math.max(0,player.sanity)+'%';
  $('stF').style.width=Math.max(0,player.stamina)+'%';
  $('pwF').style.width=Math.max(0,player.power)+'%';
}
function fmtTime(s){ s|=0; return String(s/60|0).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }

/* grain overlay */
const grainC=$('grain'), gctx=grainC.getContext('2d');
grainC.width=grainC.height=256;
function redrawGrain(){
  const img=gctx.createImageData(256,256);
  for(let i=0;i<img.data.length;i+=4){ const v=Math.random()*255|0;
    img.data[i]=img.data[i+1]=img.data[i+2]=v; img.data[i+3]=255; }
  gctx.putImageData(img,0,0);
}
redrawGrain();
grainC.style.imageRendering='pixelated';

/* minimap */
const mapC=$('map'), mctx=mapC.getContext('2d');
function drawMap(){
  if(!world.grid || !$('mapWrap').classList.contains('show')) return;
  const N=world.N, S=mapC.width, cs=S/N;
  mctx.clearRect(0,0,S,S);
  mctx.fillStyle='rgba(0,0,0,0.5)'; mctx.fillRect(0,0,S,S);
  const [pcx,pcy]=worldToCell(player.pos.x,player.pos.z,N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    if(Math.hypot(x-pcx,y-pcy)<4.5) world.seen[y][x]=1;
    if(!world.seen[y][x]) continue;
    mctx.fillStyle = world.grid[y][x]===1 ? 'rgba(120,112,70,0.55)' : 'rgba(40,38,22,0.7)';
    mctx.fillRect(x*cs,y*cs,cs+0.5,cs+0.5);
  }
  // exit
  if(world.seen[world.exit.y] && world.seen[world.exit.y][world.exit.x]){
    mctx.fillStyle='#9fb06a'; mctx.fillRect(world.exit.x*cs-1,world.exit.y*cs-1,cs+2,cs+2);
  }
  // almond
  mctx.fillStyle='#e3cf86';
  for(const it of world.items){ if(it.taken) continue;
    const[cx,cy]=worldToCell(it.mesh.position.x,it.mesh.position.z,N);
    if(world.seen[cy]&&world.seen[cy][cx]) mctx.fillRect(cx*cs,cy*cs,cs,cs); }
  // puzzle interactables
  for(const o of world.interactables){ if(o.done&&o.type!=='fragment') continue;
    const[cx,cy]=worldToCell(o.mesh.position.x,o.mesh.position.z,N);
    if(world.seen[cy]&&world.seen[cy][cx]){ mctx.fillStyle=o.type==='keycard'?'#eaff8a':'#5ad0ff'; mctx.fillRect(cx*cs,cy*cs,cs,cs); } }
  if(world.keypad){ const[cx,cy]=worldToCell(world.keypad.position.x,world.keypad.position.z,N);
    if(world.seen[cy]&&world.seen[cy][cx]){ mctx.fillStyle='#40ff70'; mctx.fillRect(cx*cs,cy*cs,cs,cs); } }
  // player
  mctx.save(); mctx.translate(pcx*cs+cs/2,pcy*cs+cs/2); mctx.rotate(-player.yaw);
  mctx.fillStyle='#fff'; mctx.beginPath(); mctx.moveTo(0,-cs*1.4); mctx.lineTo(cs,cs); mctx.lineTo(-cs,cs); mctx.closePath(); mctx.fill();
  mctx.restore();
}

/* ---------------- game flow ---------------- */
const fadeEl=$('fade');
function show(id,on){ $(id).classList.toggle('show',on); }
function fade(on){ fadeEl.style.opacity=on?1:0; fadeEl.classList.toggle('on',on); }
function updateProgressList(){
  const html=LEVELS.map(L=>{
    const done=progress.has(L.id);
    return `<span class="${done?'done':''}">${done?'■':'□'} ${L.name} ${L.title}</span>`;
  }).join('<br>');
  $('progressList').innerHTML=html;
}

function startGame(){
  AUDIO.start();
  player.hp=100; player.sanity=100; player.stamina=100; player.power=100; player.almonds=0;
  player.flashOn=true; player.crouch=false;
  player.startTime=performance.now(); player.deaths=0;
  progress.clear();
  curLevel=GAME.startLevel;
  ['menuScreen','optionsScreen','mpScreen','helpScreen','deadScreen','winScreen'].forEach(id=>show(id,false));
  enterLevel(GAME.startLevel,true);
}
function enterLevel(idx, first){
  gameState='loading'; fade(true);
  $('mapWrap').classList.remove('show');
  setTimeout(()=>{
    try{
      curLevel=idx; buildLevel(idx);
      const L=LEVELS[idx];
      AUDIO.setHum(L.theme==='lobby'?0.07: L.theme==='pools'?0.025 : L.theme==='warehouse'?0.03 : L.theme==='redrun'?0.06 : 0.045);
      $('cardLv').textContent=L.name+' — '+L.title;
      $('cardCl').textContent=L.cls;
      $('cardDs').textContent=L.desc;
      const card=$('card');
      card.style.display='flex'; card.style.opacity=1;
      fade(false);
      setTimeout(()=>{ card.style.transition='opacity 1s'; card.style.opacity=0;
        setTimeout(()=>{ card.style.display='none'; card.style.transition=''; },1000);
        gameState='play';
        $('hud').style.display='block';
        canvas.requestPointerLock();
        if(L.theme==='pipes') setTimeout(()=>toast('PRESS [F] — KILL THE LIGHT TO HIDE',true),2500);
        if(L.theme==='pools') setTimeout(()=>toast('THE WATER IS DEEP. SOMETHING SHARES IT.',true),2500);
        if(L.theme==='redrun') setTimeout(()=>toast('STOP MOVING AND YOU DIE. RUN.',true),2200);
      }, first?3400:2800);
    }catch(err){ console.error('BUILD: '+err.message); }
  },950);
}
function pauseGame(){ if(gameState!=='play') return; gameState='pause'; updateProgressList(); show('pauseScreen',true);
  if(document.pointerLockElement) document.exitPointerLock(); }
function resumeGame(){ show('pauseScreen',false); gameState='play'; AUDIO.resume(); canvas.requestPointerLock(); }
function die(cause,flavor){
  if(gameState!=='play') return;
  gameState='dead'; player.deaths++;
  if(document.pointerLockElement) document.exitPointerLock();
  $('deathCause').textContent=cause;
  $('deathFlavor').textContent=flavor;
  $('hud').style.display='none';
  AUDIO.hit(); show('deadScreen',true);
}
function win(){
  gameState='win';
  if(document.pointerLockElement) document.exitPointerLock();
  $('hud').style.display='none';
  const secs=(performance.now()-player.startTime)/1000;
  $('winStats').innerHTML=
    'TIME WANDERED — '+fmtTime(secs)+'<br>ALMOND WATER FOUND — '+player.almonds+
    '<br>TIMES LOST — '+player.deaths;
  show('winScreen',true);
}
function menuTo(id){ ['menuScreen','optionsScreen','mpScreen','helpScreen'].forEach(s=>show(s,false)); show(id,true); }


/* ---------------- main loop ---------------- */
let kickPulse=0, stepAcc=0, flickerT=0, blackout=0, heartT=0, grainT=0, lastT=performance.now();

function tick(){
  requestAnimationFrame(tick);
  try{ frame(); }
  catch(err){ console.error(err.message+'\n'+((err.stack||'').split('\n')[1]||'').trim()); }
}
function frame(){
  syncSize();
  const now=performance.now();
  let dt=Math.min(0.05,(now-lastT)/1000); lastT=now;
  const t=now/1000;

  grainT+=dt;
  if(grainT>0.07){ grainT=0; redrawGrain();
    grainC.style.transform=`translate(${(Math.random()*30|0)-15}px,${(Math.random()*30|0)-15}px)`; }

  if(gameState!=='play'){ renderer.render(scene,camera); return; }
  if(!isFinite(player.pos.x+player.pos.z+player.yaw+player.pitch)){
    player.pos.set(world.spawn.x,1.62,world.spawn.z); player.yaw=0; player.pitch=0;
    console.error('position reset (NaN)');
  }
  const L=LEVELS[curLevel];

  /* --- movement --- */
  let mx=0,mz=0;
  if(keys['KeyW']||keys['ArrowUp'])mz-=1; if(keys['KeyS']||keys['ArrowDown'])mz+=1;
  if(keys['KeyA']||keys['ArrowLeft'])mx-=1; if(keys['KeyD']||keys['ArrowRight'])mx+=1;
  const mlen=Math.hypot(mx,mz);
  if(mlen>1){ mx/=mlen; mz/=mlen; }
  player.crouch=!!(keys['KeyC']||keys['ControlLeft']);
  const wantSprint=(keys['ShiftLeft']||keys['ShiftRight'])&&mlen>0.1&&!player.crouch;
  player.sprinting=wantSprint&&player.stamina>1;
  if(player.sprinting) player.stamina=Math.max(0,player.stamina-19*dt);
  else player.stamina=Math.min(100,player.stamina+11*dt);
  let speed=player.sprinting?6.0:3.4;
  if(player.crouch) speed=2.0;
  if(L.theme==='pools') speed*=0.74;            // wading
  const sin=Math.sin(player.yaw), cos=Math.cos(player.yaw);
  const vx=(-sin*-mz + cos*mx)*speed;
  const vz=(-cos*-mz - sin*mx)*speed;
  let nx=player.pos.x+vx*dt, nz=player.pos.z+vz*dt;
  [nx,nz]=collide(nx,nz,player.radius);
  const moved=Math.hypot(nx-player.pos.x,nz-player.pos.z);
  player.pos.x=nx; player.pos.z=nz;

  if(moved>0.001){
    player.bob+=dt*(player.sprinting?11:7.5);
    stepAcc+=moved;
    if(stepAcc>(player.sprinting?2.1:1.7)){ stepAcc=0; AUDIO.step(L.theme==='pools'); }
  }
  const groundY = world.terrainFn ? world.terrainFn(player.pos.x,player.pos.z) : 0;
  const eyeY=groundY+(player.crouch?1.12:1.62)+Math.sin(player.bob)*0.05*(moved>0.001?1:0);
  camera.position.set(player.pos.x, eyeY, player.pos.z);
  camera.rotation.y=player.yaw;
  camera.rotation.x=player.pitch+Math.sin(t*0.7)*0.003*(100-player.sanity)/100*3;
  camera.rotation.z=Math.sin(t*0.9)*0.004*(100-player.sanity)/100*3;
  const targetFov=player.sprinting?GAME.fov+7:GAME.fov;
  camera.fov+= (targetFov-camera.fov)*Math.min(1,dt*6); camera.updateProjectionMatrix();
  playerLamp.position.set(player.pos.x,groundY+2.2,player.pos.z);
  // MP-HOOK: local player gameState (player.pos, player.yaw, curLevel) is final here — MP.sendState() goes here

  /* --- flashlight power --- */
  if(L.flashlight){
    if(player.flashOn && player.power>0){ player.power=Math.max(0,player.power-2.2*dt); if(flashlight) flashlight.visible=true; }
    else { player.power=Math.min(100,player.power+1.0*dt); if(flashlight) flashlight.visible=false; }
    if(player.power<=0 && flashlight){ flashlight.visible=false; }
  }

  /* --- sanity / vitals --- */
  let drain=L.drain*diffNow().drain;
  for(const e of world.entities){
    const d=e.mesh.position.distanceTo(player.pos);
    if(d<7&&e.gameState==='chase') drain+=2.2;
  }
  if(blackout>0) drain+=1.4;
  // Run For Your Life: standing still is lethal
  if(L.stillKills){
    if(moved<0.02){ player.hp-=14*dt*diffNow().still; drain+=1.5; if(Math.random()<0.04) toast('THE STILLNESS IS EATING YOU'); }
  }
  player.sanity=Math.max(0,player.sanity-drain*dt);
  if(!L.stillKills) player.hp=Math.min(100,player.hp+0.35*dt);
  setBars();
  $('timer').textContent=fmtTime((now-player.startTime)/1000);

  const dread=Math.max( (30-player.sanity)/30, (30-player.hp)/30, kickPulse, L.stillKills?0.25:0 );
  $('redpulse').style.opacity=Math.max(0,Math.min(0.9,dread));
  kickPulse=Math.max(0,kickPulse-dt*1.4);
  heartT-=dt;
  if((player.sanity<30||player.hp<35||L.stillKills)&&heartT<=0){ heartT=Math.max(0.42,player.sanity/30); AUDIO.heartbeat(); }
  if(player.hp<=0) die('TORN APART','Something in the dark finally caught up with you. The hum-buzz never even paused.');
  if(player.sanity<=0) die('MIND GONE','You sat down on the moist carpet and started counting the ceiling tiles. You are still counting.');

  /* --- light flicker --- */
  flickerT-=dt;
  if(flickerT<=0){
    flickerT=0.06+Math.random()*0.25;
    let dim=1;
    const flickChance = L.theme==='lobby'?0.06 : L.theme==='pools'?0.03 : L.theme==='redrun'?0.2 : 0.12;
    if(Math.random()<flickChance){ dim=0.25+Math.random()*0.3; blackout=0.25; }
    else { dim=0.92+Math.random()*0.08; blackout=Math.max(0,blackout-0.1); }
    if(L.theme==='redrun') dim*=0.6+Math.abs(Math.sin(t*6))*0.6; // pulsing strobe feel
    world.amb.intensity=world.ambBase*dim;
    world.panelMat.color.copy(world.panelBase).multiplyScalar(dim);
  }
  blackout=Math.max(0,blackout-dt);

  /* --- glitch wall (level 0 exit) --- */
  if(world.glitchMesh){
    const gm=world.glitchMesh;
    gm.material.color.setHSL(0.13, 0.45, 0.30+Math.random()*0.12);
    gm.position.x+= (Math.random()-0.5)*0.015;
    gm.scale.y=1+Math.sin(t*9)*0.012;
  }
  if(world.exitLight) world.exitLight.intensity=1.2+Math.sin(t*5)*0.5;

  /* --- water animation --- */
  if(world.water){
    world.water.position.y += (world.waterTargetY - world.water.position.y)*Math.min(1,dt*1.5);
    const pos=world.water.geometry.attributes.position, base=world.waterBase;
    for(let i=0;i<pos.count;i++){
      const bx=base[i*3], by=base[i*3+1];
      pos.setZ(i, Math.sin(bx*0.5+t*1.4)*0.10 + Math.cos(by*0.6+t*1.1)*0.10);
    }
    pos.needsUpdate=true;
    for(const cl of world.caustics){ cl.intensity=0.4+Math.abs(Math.sin(t*1.3+cl.userData.ph))*0.5; }
  }

  /* --- drifting sprites (steam / haze) --- */
  for(const s of world.steamSprites){
    s.position.y+=s.userData.v*dt;
    if(s.position.y>WALL_H-0.2) s.position.y=0.6;
  }

  /* --- glitching props --- */
  for(const gp of world.glitchProps){
    gp.t+=dt;
    if(Math.sin(gp.t*11)>0.55){
      gp.mesh.position.set(gp.base.x+(Math.random()-.5)*0.3, gp.base.y+(Math.random()-.5)*0.18, gp.base.z+(Math.random()-.5)*0.3);
      gp.mesh.rotation.z=(Math.random()-.5)*0.4;
      gp.mesh.visible = Math.random()>0.18;
    } else { gp.mesh.position.copy(gp.base); gp.mesh.rotation.z=0; gp.mesh.visible=true; }
  }

  /* --- items --- */
  for(const it of world.items){
    if(it.taken) continue;
    it.mesh.rotation.y+=dt*1.5;
    it.mesh.position.y=it.base+Math.sin(t*2+it.phase)*0.08;
    if(it.mesh.position.distanceTo(player.pos)<1.5){
      it.taken=true; it.mesh.visible=false;
      player.almonds++; $('invAlmond').textContent=player.almonds;
      player.sanity=Math.min(100,player.sanity+38);
      player.hp=Math.min(100,player.hp+14);
      player.power=Math.min(100,player.power+25);
      AUDIO.drink(); toast('ALMOND WATER — THE FOG IN YOUR HEAD LIFTS');
    }
  }

  /* --- interactables --- */
  for(const o of world.interactables){
    if(o.type==='valve' && o.spin>0){ o.parts.wg.rotation.z+=dt*7; o.spin-=dt; }
    if((o.type==='fragment'||o.type==='keycard') && !o.done){ o.mesh.rotation.y+=dt*1.1;
      o.mesh.position.y=(o.type==='keycard'?0:0)+Math.sin(t*2+o.mesh.id)*0.05; }
    if(o.type==='keycard' && !o.done && o.mesh.position.distanceTo(player.pos)<1.7){
      o.done=true; o.mesh.visible=false; world.haveKeycard=true; world.tasksDone++;
      AUDIO.drink(); toast('KEYCARD ACQUIRED'); unlockExit(); setObjective(); }
  }
  if(world.keypad){
    const near=world.keypad.position.distanceTo(player.pos)<2.7;
    if(near!==world.keypadNear){ world.keypadNear=near;
      if(near && world.locked) toast('ENTER THE '+world.code.length+'-DIGIT CODE',true);
      setObjective(); }
  }

  /* --- entities --- */
  updateEntities(dt,t);
  updateNPCs(dt,t);

  /* --- crosshair interact hint --- */
  let near=false;
  for(const it of world.items){ if(!it.taken && it.mesh.position.distanceTo(player.pos)<2.4){ near=true; break; } }
  if(!near) for(const o of world.interactables){ if(o.done&&o.type!=='fragment') continue;
    if(o.mesh.position.distanceTo(player.pos)<2.7){ near=true; break; } }
  $('crosshair').classList.toggle('interact',near);

  /* --- map --- */
  drawMap();

  /* --- exit check --- */
  const [ewx,ewz]=cellToWorld(world.exit.x,world.exit.y,world.N);
  if(Math.hypot(player.pos.x-ewx,player.pos.z-ewz)<2.2){
    if(world.locked){
      if(!world._lockT || now-world._lockT>2600){ world._lockT=now; toast('SEALED — '+lockMsg()); }
    } else {
    gameState='loading';
    AUDIO.noclip();
    progress.add(L.id);

    if (curLevel < LEVELS.length - 1) {
      if (currentRoom && MP.mode === 'host') currentRoom.send('changeLevel', { level: curLevel + 1 });

      const msgs={lobby:'YOU NOCLIP THROUGH THE WALL',warehouse:'YOU DESCEND THE STAIRWELL',
        pools:'YOU SLIP THROUGH THE DRAINAGE ARCH',pipes:'THE HATCH GIVES WAY BENEATH YOU'};
      toast(msgs[L.theme]||'DEEPER STILL',true);
      enterLevel(curLevel+1,false);
    } else {
      fade(true); setTimeout(()=>{ fade(false); win(); },1200);
    }
    }
  }

  // MP-HOOK: split-screen renders a second pass here with camera2 + setScissor; online updates remote avatars before this
  renderer.render(scene,camera);
}
tick();


window.initBackrooms = function() {
    buildTextures();
    syncSize();

    if (!window._backroomsEventsAttached) {
        window._backroomsEventsAttached = true;
        $('spBtn').addEventListener('click', startGame);
        $('mpBtn').addEventListener('click', () => { $('mpNote').textContent = ''; menuTo('mpScreen'); fetchBackroomsServers(); });
        $('optBtn').addEventListener('click', () => { refreshOptions(); menuTo('optionsScreen'); });
        $('helpBtn').addEventListener('click', () => menuTo('helpScreen'));
        $('optBack').addEventListener('click', () => menuTo('menuScreen'));
        $('mpBack').addEventListener('click', () => menuTo('menuScreen'));
        $('helpBack').addEventListener('click', () => menuTo('menuScreen'));
        $('mpRefresh').addEventListener('click', () => fetchBackroomsServers());
        $('mpHost').addEventListener('click', () => MP.host());

        $('optSens').addEventListener('input', e => { GAME.sens = (+e.target.value) / 10000; SENS = GAME.sens; $('optSensV').textContent = (GAME.sens * 1000).toFixed(1); });
        $('optVol').addEventListener('input', e => { GAME.volume = (+e.target.value) / 100; AUDIO.setVolume(GAME.volume); $('optVolV').textContent = e.target.value; });
        $('optFov').addEventListener('input', e => { GAME.fov = +e.target.value; $('optFovV').textContent = e.target.value; });
        $('optDiff').addEventListener('click', () => { const order = ['easy', 'normal', 'nightmare']; GAME.diff = order[(order.indexOf(GAME.diff) + 1) % 3]; $('optDiff').textContent = diffNow().label; });
        $('optInv').addEventListener('click', () => { GAME.invertY = !GAME.invertY; $('optInv').textContent = GAME.invertY ? 'ON' : 'OFF'; });
        $('optLevel').addEventListener('click', () => {
            GAME.startLevel = (GAME.startLevel + 1) % LEVELS.length;
            $('optLevel').textContent = LEVELS[GAME.startLevel].name + ' — ' + LEVELS[GAME.startLevel].title.replace(/"/g, '').toUpperCase();
        });
        $('resumeBtn').addEventListener('click', resumeGame);
        $('retryBtn').addEventListener('click', () => {
            player.hp = 100; player.sanity = 100; player.stamina = 100; player.power = 100; player.flashOn = true;
            show('deadScreen', false); enterLevel(curLevel, false);
        });
        $('againBtn').addEventListener('click', () => { show('winScreen', false); startGame(); });
    }

    gameState = 'menu';
    menuTo('menuScreen');

    if (!window.backroomsTicking) {
        window.backroomsTicking = true;
        tick();
    }
};

window.stopBackrooms = function() {
    gameState = 'menu';
    if (document.pointerLockElement) document.exitPointerLock();
    if (AUDIO && AUDIO.setVolume) AUDIO.setVolume(0);
};

function fetchBackroomsServers() {
    $('backroomsServerList').innerHTML = '<div style="color:var(--dim); font-size: 11px; text-align:center;">LOADING SERVERS...</div>';
    fetch(window.getColyseusHttpUrl() + '/backrooms-servers')
        .then(res => res.json())
        .then(servers => {
            if (servers.length === 0) {
                $('backroomsServerList').innerHTML = '<div style="color:var(--dim); font-size: 11px; text-align:center;">NO SERVERS FOUND</div>';
                return;
            }
            let html = '';
            for (const s of servers) {
                html += `<div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;">
                    <div>Host: ${s.hostName || 'Unknown'} <span style="color:var(--dim);">(${s.clients}/${s.maxClients})</span></div>
                    <button style="padding:4px 10px; font-size:10px; min-width:auto;" onclick="MP.join('${s.roomId}')">JOIN</button>
                </div>`;
            }
            $('backroomsServerList').innerHTML = html;
        })
        .catch(err => {
            $('backroomsServerList').innerHTML = '<div style="color:var(--danger); font-size: 11px; text-align:center;">ERROR LOADING SERVERS</div>';
        });
}
