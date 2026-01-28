import { beep, setText, showToast } from '../utils.js';

let rCtx, rCv, player={}, rObs=[], rSpeed=5, rScore=0, rFrame=0;
let rAnim;
let lossStreak = 0;

export function initRunner(System) {
    rCv = document.getElementById('runnerCanvas');
    rCtx = rCv.getContext('2d');
    player = { x: 50, y: 300, w: 30, h: 50, dy: 0, grounded: true, jumpForce: 12, gravity: 0.6 };
    rObs = []; 
    rSpeed = 5; rScore = 0; rFrame = 0;
    setText('runnerScoreBoard', "SCORE: 0");
    
    // Add click listener specifically for this canvas
    rCv.onclick = () => { if(player.grounded) { player.dy = -player.jumpForce; player.grounded = false; } };
    
    loopRunner(System);
}

export function stopRunner() {
    cancelAnimationFrame(rAnim);
    if(rCv) rCv.onclick = null;
}

export function handleRunnerInput(k) {
    if((k === ' ' || k === 'ArrowUp') && player.grounded) {
        player.dy = -player.jumpForce; 
        player.grounded = false;
    }
}

function loopRunner(System) {
    rFrame++;
    // Clear
    rCtx.fillStyle='#000'; rCtx.fillRect(0,0,800,400);
    
    // Floor
    rCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent');
    rCtx.lineWidth = 2; rCtx.beginPath(); rCtx.moveTo(0,350); rCtx.lineTo(800,350); rCtx.stroke();

    // Logic
    let currentSpeed = rSpeed * (System.inventory.includes('item_slowmo') ? 0.8 : 1);
    
    player.dy += player.gravity; 
    player.y += player.dy;
    
    if(player.y > 300) { player.y = 300; player.dy = 0; player.grounded = true; }
    
    // Draw Player
    rCtx.fillStyle = '#fff'; rCtx.fillRect(player.x, player.y, player.w, player.h);

    // Obstacle Spawning
    if(rFrame % Math.floor(1000/currentSpeed) === 0) { 
        let height = Math.random() > 0.7 ? 60 : 30; 
        rObs.push({ x: 800, y: 350 - height, w: 20, h: height }); 
    }

    // Loop Obstacles
    for(let i=rObs.length-1; i>=0; i--){
        let o = rObs[i]; o.x -= currentSpeed;
        rCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent');
        rCtx.fillRect(o.x, o.y, o.w, o.h);

        // Collision
        if (player.x < o.x + o.w && player.x + player.w > o.x && player.y < o.y + o.h && player.y + player.h > o.y) {
             if(System.inventory.includes('item_shield')) { 
                 System.consumeItem('item_shield');
                 rObs.splice(i, 1); 
                 showToast("SHIELD USED", "🛡️"); 
                 continue; 
             }
             lossStreak++;
             if(lossStreak === 3) System.unlockAchievement('rage_quit');
             System.triggerGameOver('runner', Math.floor(rScore)); 
             return;
        }

        // Score
        if(o.x < -30) { 
            rObs.splice(i, 1); 
            rScore += 1; 
            System.updateHighScore('runner', rScore);
            setText('runnerScoreBoard', "SCORE: "+rScore); 
            if(rScore % 5 === 0) rSpeed += 0.5; 
            lossStreak = 0; 
        }
    }
    rAnim = requestAnimationFrame(() => loopRunner(System));
}
