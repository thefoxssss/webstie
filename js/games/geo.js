import { beep, setText, showToast } from '../utils.js';

let gPlayer={}, gObs=[], gScore=0, gSpeed=6;
let gAnim;

export function initGeo(System) {
    const cv = document.getElementById('geoCanvas');
    gPlayer = { x: 100, y: 300, w: 30, h: 30, dy: 0, ang: 0, grounded: true };
    gObs = []; gScore=0; gSpeed=6;
    setText('geoScore', 'SCORE: 0');
    
    cv.onclick = () => { if(gPlayer.grounded) { gPlayer.dy = -13; gPlayer.grounded = false; } };
    
    loopGeometry(System);
}

export function stopGeo() {
    cancelAnimationFrame(gAnim);
    const cv = document.getElementById('geoCanvas');
    if(cv) cv.onclick = null;
}

export function handleGeoInput(k) {
    if((k===' ' || k==='ArrowUp') && gPlayer.grounded) { 
        gPlayer.dy = -13; 
        gPlayer.grounded = false; 
    }
}

function loopGeometry(System) {
    const cv = document.getElementById('geoCanvas');
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,800,400);
    
    let currentSpeed = gSpeed * (System.inventory.includes('item_slowmo') ? 0.8 : 1);
    
    gPlayer.dy += 0.9; 
    gPlayer.y += gPlayer.dy;
    
    if(gPlayer.y > 320) { 
        gPlayer.y = 320; gPlayer.dy = 0; gPlayer.grounded = true; 
        gPlayer.ang = Math.round(gPlayer.ang / (Math.PI/2)) * (Math.PI/2); 
    } else { 
        gPlayer.ang += 0.15; 
    }
    
    // Draw Ground
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent');
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0,350); ctx.lineTo(800,350); ctx.stroke();
    
    // Draw Player
    ctx.save();
    ctx.translate(gPlayer.x + gPlayer.w/2, gPlayer.y + gPlayer.h/2);
    ctx.rotate(gPlayer.ang);
    ctx.fillStyle = '#fff'; ctx.fillRect(-gPlayer.w/2, -gPlayer.h/2, gPlayer.w, gPlayer.h);
    ctx.restore();
    
    // Spawns
    if(Math.random() < 0.02) { 
        gObs.push({x: 800, y: 320, w: 30, h: 30, type: Math.random()>0.5 ? 'spike' : 'block'}); 
    }
    
    for(let i=gObs.length-1; i>=0; i--) { 
        let o = gObs[i]; 
        o.x -= currentSpeed; 
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent');
        
        if(o.type === 'spike') { 
            ctx.beginPath(); ctx.moveTo(o.x, o.y+30); ctx.lineTo(o.x+15, o.y); ctx.lineTo(o.x+30, o.y+30); ctx.fill(); 
        } else { 
            ctx.fillRect(o.x, o.y, o.w, o.h); 
        }
        
        if(gPlayer.x < o.x + o.w - 5 && gPlayer.x + gPlayer.w > o.x + 5 && gPlayer.y < o.y + o.h - 5 && gPlayer.y + gPlayer.h > o.y + 5) { 
            if(System.inventory.includes('item_shield')) { 
                System.consumeItem('item_shield');
                gObs.splice(i, 1); 
                showToast("SHIELD USED", "🛡️"); 
                continue; 
            } 
            System.triggerGameOver('geo', Math.floor(gScore)); 
            return; 
        }
        
        if(o.x < -50) { 
            gObs.splice(i,1); gScore++; 
            System.updateHighScore('geo', gScore);
            setText('geoScore', "SCORE: "+gScore); 
        } 
    }
    gAnim = requestAnimationFrame(() => loopGeometry(System));
}
