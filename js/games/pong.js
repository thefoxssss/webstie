import { beep, setText, showToast } from '../utils.js';

let pCtx, pCv;
let ball = { x: 400, y: 300, dx: 5, dy: 5 };
let p1 = { y: 250, h: 80 };
let p2 = { y: 250, h: 80 };
let pSc = 0, aiSc = 0;
let pDiff = 0.08;
let pAnim;
let lossStreak = 0;

export function initPong(System) {
    pCv = document.getElementById('pongCanvas');
    pCtx = pCv.getContext('2d');
    pSc = 0; 
    aiSc = 0;
    resetBall();
    loopPong(System);
}

export function stopPong() {
    cancelAnimationFrame(pAnim);
}

export function setPongDiff(level) {
    pDiff = level === 'hard' ? 0.15 : 0.08;
    resetBall();
}

function resetBall() {
    if (!pCv) return;
    ball.x = 400; ball.y = 300;
    ball.dx = (Math.random() > 0.5 ? 6 : -6);
    ball.dy = (Math.random() * 8 - 4);
}

// Key handler is handled in main loop via keysPressed object passed from System, 
// OR we can export a handler like Snake. Let's use the standard System.keys object.
function loopPong(System) {
    // Clear
    pCtx.fillStyle = 'rgba(0,0,0,0.2)'; 
    pCtx.fillRect(0, 0, 800, 600);

    // Player Movement
    if (System.inventory.includes('item_aimbot')) {
        p1.y += (ball.y - p1.h / 2 - p1.y) * 0.1;
    } else {
        if (System.keys['w'] || System.keys['ArrowUp']) p1.y -= 8;
        if (System.keys['s'] || System.keys['ArrowDown']) p1.y += 8;
    }
    
    // Clamp Player
    if (p1.y < 0) p1.y = 0; 
    if (p1.y > 520) p1.y = 520;

    // AI Movement
    p2.y += (ball.y - p2.h / 2 - p2.y) * pDiff;
    if (p2.y < 0) p2.y = 0; 
    if (p2.y > 520) p2.y = 520;

    // Draw Paddles
    pCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent');
    pCtx.fillRect(20, p1.y, 10, p1.h);
    pCtx.fillRect(770, p2.y, 10, p2.h);

    // Draw Ball
    pCtx.beginPath();
    pCtx.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
    pCtx.fill();

    // Move Ball
    ball.x += ball.dx; 
    ball.y += ball.dy;

    // Wall Bounce
    if (ball.y < 0 || ball.y > 600) ball.dy *= -1;

    // Paddle Hit Logic
    if (ball.x < 30 && ball.y > p1.y && ball.y < p1.y + p1.h) {
        ball.dx = Math.abs(ball.dx) + 0.5;
        ball.x = 30;
        beep(600);
    }
    if (ball.x > 770 && ball.y > p2.y && ball.y < p2.y + p2.h) {
        ball.dx = -(Math.abs(ball.dx) + 0.5);
        ball.x = 770;
        beep(600);
    }

    // Scoring
    if (ball.x < 0) {
        aiSc++;
        resetBall();
        beep(200);
        lossStreak++;
        if(lossStreak === 3) System.unlockAchievement('rage_quit');
        pSc = 0;
    }
    if (ball.x > 800) {
        pSc++;
        System.updateHighScore('pong', pSc);
        resetBall();
        beep(800);
        lossStreak = 0;
        if (pSc >= 10 && aiSc === 0) System.unlockAchievement('untouchable');
    }

    setText('pongScore', `${pSc} : ${aiSc}`);
    pAnim = requestAnimationFrame(() => loopPong(System));
}
