import { state } from '../config.js';
import { beep, setText, updateDoc } from '../utils.js';

let animFrame;
let snakeInterval;

// === PONG ===
let pCtx, ball, p1, p2, pScore, aiScore;

export function initPong() {
    state.currentGame = 'pong';
    const canvas = document.getElementById('pongCanvas');
    pCtx = canvas.getContext('2d');
    pScore = 0; aiScore = 0;
    p1 = { y: 250, h: 80 }; 
    p2 = { y: 250, h: 80 };
    resetBall();
    loopPong();
}

function resetBall() {
    ball = { x: 400, y: 300, dx: (Math.random() > .5 ? 6 : -6), dy: (Math.random() * 8 - 4) };
}

function loopPong() {
    if (state.currentGame !== 'pong') return;
    // Clear
    pCtx.fillStyle = 'rgba(0,0,0,0.2)'; pCtx.fillRect(0, 0, 800, 600);
    
    // Logic
    if (state.keysPressed['w'] || state.keysPressed['ArrowUp']) p1.y -= 8;
    if (state.keysPressed['s'] || state.keysPressed['ArrowDown']) p1.y += 8;
    // AI
    p2.y += (ball.y - p2.h / 2 - p2.y) * 0.08;

    // Draw
    pCtx.fillStyle = '#ff0606'; // Should use var, hardcoded for JS
    pCtx.fillRect(20, p1.y, 10, p1.h);
    pCtx.fillRect(770, p2.y, 10, p2.h);
    pCtx.beginPath(); pCtx.arc(ball.x, ball.y, 8, 0, Math.PI * 2); pCtx.fill();

    // Move Ball
    ball.x += ball.dx; ball.y += ball.dy;
    if (ball.y < 0 || ball.y > 600) ball.dy *= -1;
    
    // Collisions
    if(ball.x < 30 && ball.y > p1.y && ball.y < p1.y + p1.h) { ball.dx = Math.abs(ball.dx) + 0.5; beep(600); }
    if(ball.x > 770 && ball.y > p2.y && ball.y < p2.y + p2.h) { ball.dx = -(Math.abs(ball.dx) + 0.5); beep(600); }

    if(ball.x < 0) { aiScore++; resetBall(); beep(200); }
    if(ball.x > 800) { pScore++; resetBall(); beep(800); }
    
    setText('pongScore', `${pScore} : ${aiScore}`);
    animFrame = requestAnimationFrame(loopPong);
}

// === SNAKE ===
let sCtx, snake, food, sDir, sNextDir, sScore;

export function initSnake() {
    state.currentGame = 'snake';
    const cv = document.getElementById('snakeCanvas');
    sCtx = cv.getContext('2d');
    snake = [{ x: 10, y: 10 }];
    sDir = 'R'; sNextDir = 'R'; sScore = 0;
    placeFood();
    loopSnake();
}

function placeFood() {
    food = { x: Math.floor(Math.random() * 30), y: Math.floor(Math.random() * 20) };
}

function loopSnake() {
    if (state.currentGame !== 'snake') return;
    
    // Input Logic handled in main event listener via state.keysPressed or specific handler
    // Simplified specific handler for Snake direction
    
    let head = { x: snake[0].x, y: snake[0].y };
    sDir = sNextDir;
    if (sDir === 'R') head.x++;
    if (sDir === 'L') head.x--;
    if (sDir === 'U') head.y--;
    if (sDir === 'D') head.y++;

    // Collision
    if (head.x < 0 || head.x >= 30 || head.y < 0 || head.y >= 20 || snake.some(s => s.x === head.x && s.y === head.y)) {
        window.gameUI.showGameOver(sScore);
        return;
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
        sScore += 10;
        placeFood();
        beep(600);
        setText('snakeScoreVal', sScore);
    } else {
        snake.pop();
    }

    // Draw
    sCtx.fillStyle = '#000'; sCtx.fillRect(0, 0, 600, 400);
    sCtx.fillStyle = '#ff0606';
    snake.forEach(s => sCtx.fillRect(s.x * 20, s.y * 20, 18, 18));
    sCtx.fillStyle = '#fff'; sCtx.fillRect(food.x * 20, food.y * 20, 18, 18);

    snakeInterval = setTimeout(loopSnake, 100);
}

export function handleSnakeKey(key) {
    if(state.currentGame !== 'snake') return;
    if ((key === 'ArrowUp' || key === 'w') && sDir !== 'D') sNextDir = 'U';
    if ((key === 'ArrowDown' || key === 's') && sDir !== 'U') sNextDir = 'D';
    if ((key === 'ArrowLeft' || key === 'a') && sDir !== 'R') sNextDir = 'L';
    if ((key === 'ArrowRight' || key === 'd') && sDir !== 'L') sNextDir = 'R';
}

export function stopArcade() {
    if(animFrame) cancelAnimationFrame(animFrame);
    if(snakeInterval) clearTimeout(snakeInterval);
}
