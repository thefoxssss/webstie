// === GEO DASH ===
let gPlayer={}, gObs=[], gScore=0, gSpeed=6;

export function initGeometry() { 
    window.currentGame='geo'; 
    window.loadHighScores(); 
    const cv = document.getElementById('geoCanvas'); 
    const ctx = cv.getContext('2d'); 
    gPlayer = { x: 100, y: 300, w: 30, h: 30, dy: 0, ang: 0, grounded: true }; 
    gObs = []; gScore=0; gSpeed=6; 
    window.setText('geoScore', 'SCORE: 0'); 
    loopGeometry(); 
}

function loopGeometry() { 
    if(window.currentGame!=='geo') return; 
    const cv = document.getElementById('geoCanvas'); 
    const ctx = cv.getContext('2d'); 
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,800,400); 
    let currentSpeed = gSpeed * (window.myInventory.includes('item_slowmo') ? 0.8 : 1); 
    if((window.keysPressed[' '] || window.keysPressed['ArrowUp']) && gPlayer.grounded) { gPlayer.dy = -13; gPlayer.grounded = false; } 
    gPlayer.dy += 0.9; gPlayer.y += gPlayer.dy; 
    if(gPlayer.y > 320) { gPlayer.y = 320; gPlayer.dy = 0; gPlayer.grounded = true; gPlayer.ang = Math.round(gPlayer.ang / (Math.PI/2)) * (Math.PI/2); } 
    else { gPlayer.ang += 0.15; } 
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0,350); ctx.lineTo(800,350); ctx.stroke(); 
    ctx.save(); ctx.translate(gPlayer.x + gPlayer.w/2, gPlayer.y + gPlayer.h/2); ctx.rotate(gPlayer.ang); ctx.fillStyle = '#fff'; ctx.fillRect(-gPlayer.w/2, -gPlayer.h/2, gPlayer.w, gPlayer.h); ctx.restore(); 
    if(Math.random() < 0.02) { gObs.push({x: 800, y: 320, w: 30, h: 30, type: Math.random()>0.5 ? 'spike' : 'block'}); } 
    for(let i=gObs.length-1; i>=0; i--) { 
        let o = gObs[i]; o.x -= currentSpeed; ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent'); 
        if(o.type === 'spike') { ctx.beginPath(); ctx.moveTo(o.x, o.y+30); ctx.lineTo(o.x+15, o.y); ctx.lineTo(o.x+30, o.y+30); ctx.fill(); } 
        else { ctx.fillRect(o.x, o.y, o.w, o.h); } 
        if(gPlayer.x < o.x + o.w - 5 && gPlayer.x + gPlayer.w > o.x + 5 && gPlayer.y < o.y + o.h - 5 && gPlayer.y + gPlayer.h > o.y + 5) { 
            if(window.myInventory.includes('item_shield')) { 
                window.myInventory = window.myInventory.filter(id => id !== 'item_shield'); gObs.splice(i, 1); window.showToast("SHIELD USED", "🛡️"); continue; 
            } 
            window.showGameOver('geo', Math.floor(gScore)); return; 
        } 
        if(o.x < -50) { gObs.splice(i,1); gScore++; window.updateHighScore('geo', gScore); window.setText('geoScore', "SCORE: "+gScore); } 
    } 
    window.gAnim = requestAnimationFrame(loopGeometry); 
}

document.getElementById('geoCanvas').onclick=()=>{ if(window.currentGame==='geo' && gPlayer.grounded) { gPlayer.dy = -13; gPlayer.grounded = false; } };
