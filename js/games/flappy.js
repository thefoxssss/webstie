import { beep, setText, showToast } from '../utils.js';

let fBird={}, fPipes=[], fScore=0;
let fAnim;

export function initFlappy(System) {
    fBird={x:50,y:300,dy:0}; 
    fPipes=[]; 
    fScore=0;
    setText('flappyScore','SCORE: 0');
    
    const cv = document.getElementById('flappyCanvas');
    cv.onclick = () => { fBird.dy = -6; };
    
    loopFlappy(System);
}

export function stopFlappy() {
    cancelAnimationFrame(fAnim);
    const cv = document.getElementById('flappyCanvas');
    if(cv) cv.onclick = null;
}

export function handleFlappyInput(k) {
    if(k === ' ' || k === 'ArrowUp') fBird.dy = -6;
}

function loopFlappy(System){
    const ctx=document.getElementById('flappyCanvas').getContext('2d');
    ctx.fillStyle='#000'; ctx.fillRect(0,0,400,600);
    
    fBird.dy+=0.4; 
    fBird.y+=fBird.dy;
    
    ctx.fillStyle='#fff'; ctx.fillRect(fBird.x,fBird.y,20,20);
    
    if(fBird.y>600||fBird.y<0) { 
        System.triggerGameOver('flappy',fScore); 
        return; 
    }
    
    if(Math.random()<0.015) { 
        fPipes.push({x:400, gap:150, h:Math.random()*300+50}); 
    }
    
    for(let i=fPipes.length-1; i>=0; i--) { 
        let p=fPipes[i]; p.x-=3; 
        ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--accent');
        ctx.fillRect(p.x,0,40,p.h); 
        ctx.fillRect(p.x,p.h+p.gap,40,600);
        
        if(fBird.x+20>p.x && fBird.x<p.x+40 && (fBird.y<p.h || fBird.y+20>p.h+p.gap)) { 
            System.triggerGameOver('flappy',fScore); 
            return; 
        }
        
        if(p.x<-40) { 
            fPipes.splice(i,1); fScore++; 
            System.updateHighScore('flappy',fScore);
            setText('flappyScore','SCORE: '+fScore); 
        }
    }
    fAnim=requestAnimationFrame(() => loopFlappy(System));
}
