// === SNAKE ===
let sCtx, sCv, snake=[], food={}, sD='R', sNextD='R', sSc=0;

export function initSnake(){
    window.currentGame='snake';
    window.loadHighScores();
    sCv=document.getElementById('snakeCanvas');
    sCtx=sCv.getContext('2d');
    snake=[{x:10,y:10}];
    sD='R';sNextD='R';sSc=0;
    window.setText('snakeScoreVal', 0);
    placeFood();loopSnake();
}

function placeFood(){food={x:Math.floor(Math.random()*30),y:Math.floor(Math.random()*20)};}

function loopSnake(){
    if(window.currentGame!=='snake')return;
    let h={x:snake[0].x,y:snake[0].y};
    sD=sNextD;
    if(sD==='R')h.x++;if(sD==='L')h.x--;if(sD==='U')h.y--;if(sD==='D')h.y++;
    if(h.x<0||h.x>=30||h.y<0||h.y>=20||snake.some(s=>s.x===h.x&&s.y===h.y)){
        window.checkLossStreak(); window.showGameOver('snake',sSc);return;
    }
    snake.unshift(h);
    if(h.x===food.x&&h.y===food.y){
        let pts = window.myInventory.includes('item_double') ? 20 : 10;
        sSc+=pts; window.updateHighScore('snake',sSc);window.setText('snakeScoreVal', sSc);placeFood();window.beep(600); window.lossStreak=0; if(sSc>=30) window.unlockAchievement('viper'); 
    }else snake.pop();
    sCtx.fillStyle='#000';sCtx.fillRect(0,0,600,400);sCtx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--accent');snake.forEach(s=>sCtx.fillRect(s.x*20,s.y*20,18,18));sCtx.fillStyle='#fff';sCtx.fillRect(food.x*20,food.y*20,18,18);
    window.sAnim=setTimeout(loopSnake,100);
}

document.addEventListener('keydown', e => { 
    if(window.currentGame==='snake'){
        const k=e.key;
        if((k==='ArrowUp'||k==='w')&&sD!=='D')sNextD='U';
        if((k==='ArrowDown'||k==='s')&&sD!=='U')sNextD='D';
        if((k==='ArrowLeft'||k==='a')&&sD!=='R')sNextD='L';
        if((k==='ArrowRight'||k==='d')&&sD!=='L')sNextD='R';
    } 
});
