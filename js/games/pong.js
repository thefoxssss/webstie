// === PONG ===
let pCtx, pCv, ball={x:400,y:300,dx:5,dy:5}, p1={y:250,h:80}, p2={y:250,h:80}, pSc=0, aiSc=0, pDiff=0.08;

window.setPongDiff=(l)=>{pDiff=l==='hard'?0.15:0.08; resetBall();};

export function initPong(){
    window.currentGame='pong';
    window.loadHighScores();
    pCv=document.getElementById('pongCanvas');
    pCtx=pCv.getContext('2d');
    pSc=0;aiSc=0;resetBall();loopPong();
}

function resetBall(){if(!pCv)return;ball.x=400;ball.y=300;ball.dx=(Math.random()>.5?6:-6);ball.dy=(Math.random()*8-4);}

function loopPong(){
    if(window.currentGame!=='pong')return;
    pCtx.fillStyle='rgba(0,0,0,0.2)'; pCtx.fillRect(0,0,800,600);
    if(window.myInventory.includes('item_aimbot')) { p1.y += (ball.y - p1.h/2 - p1.y) * 0.1; } 
    else { if(window.keysPressed['w'] || window.keysPressed['ArrowUp']) p1.y -= 8; if(window.keysPressed['s'] || window.keysPressed['ArrowDown']) p1.y += 8; }
    if(p1.y < 0) p1.y = 0; if(p1.y > 520) p1.y = 520; p2.y+=(ball.y-p2.h/2-p2.y)*pDiff; if(p2.y < 0) p2.y = 0; if(p2.y > 520) p2.y = 520;
    pCtx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--accent');
    pCtx.fillRect(20,p1.y,10,p1.h); pCtx.fillRect(770,p2.y,10,p2.h);
    pCtx.beginPath();pCtx.arc(ball.x,ball.y,8,0,Math.PI*2);pCtx.fill();
    ball.x+=ball.dx; ball.y+=ball.dy;
    if(ball.y<0||ball.y>600)ball.dy*=-1;
    if(ball.x<30 && ball.y>p1.y && ball.y<p1.y+p1.h){ ball.dx = Math.abs(ball.dx)+0.5; ball.x = 30; window.beep(600); }
    if(ball.x>770 && ball.y>p2.y && ball.y<p2.y+p2.h){ ball.dx = -(Math.abs(ball.dx)+0.5); ball.x = 770; window.beep(600); }
    if(ball.x<0){aiSc++; resetBall(); window.beep(200); window.checkLossStreak(); pSc=0; } 
    if(ball.x>800){ pSc++; window.updateHighScore('pong',pSc); window.loadHighScores(); resetBall(); window.beep(800); window.lossStreak=0; if(pSc >= 10 && aiSc === 0) window.unlockAchievement('untouchable'); }
    window.setText('pongScore', `${pSc} : ${aiSc}`);
    window.pAnim=requestAnimationFrame(loopPong);
}
