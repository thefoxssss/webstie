import { beep, setText, showToast } from '../utils.js';

let sCtx, sCv, snake=[], food={}, sD='R', sNextD='R', sSc=0;
let sAnim;

// Main Init Function
export function initSnake(System) {
    sCv = document.getElementById('snakeCanvas');
    sCtx = sCv.getContext('2d');
    snake = [{x:10,y:10}];
    sD = 'R'; sNextD = 'R'; sSc = 0;
    setText('snakeScoreVal', 0);
    placeFood();
    
    // Start Loop
    loopSnake(System);
}

// Cleanup Function (To stop the game when closing overlay)
export function stopSnake() {
    clearTimeout(sAnim);
}

// Key Handler
export function handleSnakeKey(k) {
    if((k==='ArrowUp'||k==='w') && sD!=='D') sNextD='U';
    if((k==='ArrowDown'||k==='s') && sD!=='U') sNextD='D';
    if((k==='ArrowLeft'||k==='a') && sD!=='R') sNextD='L';
    if((k==='ArrowRight'||k==='d') && sD!=='L') sNextD='R';
}

function placeFood(){
    food={x:Math.floor(Math.random()*30), y:Math.floor(Math.random()*20)};
}

function loopSnake(System) {
    let h = {x:snake[0].x, y:snake[0].y};
    sD = sNextD;
    
    // Movement Logic
    if(sD==='R') h.x++; if(sD==='L') h.x--; if(sD==='U') h.y--; if(sD==='D') h.y++;
    
    // Collision Logic
    if(h.x<0||h.x>=30||h.y<0||h.y>=20||snake.some(s=>s.x===h.x&&s.y===h.y)){
        System.triggerGameOver('snake', sSc);
        return;
    }
    
    snake.unshift(h);
    
    // Eat Food Logic
    if(h.x===food.x && h.y===food.y){
        // Check Inventory from System
        let pts = System.inventory.includes('item_double') ? 20 : 10;
        sSc += pts;
        
        System.updateHighScore('snake', sSc);
        setText('snakeScoreVal', sSc);
        placeFood();
        beep(600);
        
        if(sSc>=30) System.unlockAchievement('viper'); 
    } else {
        snake.pop();
    }
    
    // Draw
    sCtx.fillStyle='#000'; sCtx.fillRect(0,0,600,400);
    sCtx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--accent');
    snake.forEach(s=>sCtx.fillRect(s.x*20,s.y*20,18,18));
    sCtx.fillStyle='#fff'; sCtx.fillRect(food.x*20,food.y*20,18,18);
    
    sAnim = setTimeout(() => loopSnake(System), 100);
}
