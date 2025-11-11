// Constants
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const CELL_SIZE = 30;
const DAS_DELAY = 170;
const DAS_INTERVAL = 50;

const SHAPES = {
  I: [[1,1,1,1]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1]],
  S: [[0,1,1],[1,1,0]],
  Z: [[1,1,0],[0,1,1]],
  J: [[1,0,0],[1,1,1]],
  L: [[0,0,1],[1,1,1]]
};

const COLORS = {
  I: '#00f0f0',
  O: '#f0f000',
  T: '#a000f0',
  S: '#00f000',
  Z: '#f00000',
  J: '#0000f0',
  L: '#f0a000'
};

// Modal functionality
function toggleUpdateLog() {
  const modal = document.getElementById('updateLogModal');
  modal.classList.toggle('show');
}

// Tetris Game Class
class TetrisGame {
  constructor() {
    this.board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
    this.currentPiece = null;
    this.currentPos = { x: 0, y: 0 };
    this.heldPiece = null;
    this.canHold = true;
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.gameOver = false;
    this.isPaused = false;
    this.nextPieces = [];
    this.clearingLines = [];
    this.ghostPos = null;
    this.particles = [];
    this.comboCount = 0;
    this.fallSpeed = 500;
    this.lastFallTime = Date.now();
    this.dropLock = false;
    
    this.keysPressed = {};
    this.dasTimers = {};
    this.dasIntervals = {};
    
    this.initGame();
    this.setupControls();
    this.gameLoop();
  }

  initGame() {
    this.nextPieces = [this.getRandomPiece(), this.getRandomPiece(), this.getRandomPiece()];
    this.spawnPiece();
    this.setupParticleCanvas();
    this.updateDisplay();
  }

  setupParticleCanvas() {
    const canvas = document.getElementById('particleCanvas');
    canvas.width = BOARD_WIDTH * CELL_SIZE + 6;
    canvas.height = BOARD_HEIGHT * CELL_SIZE + 6;
    this.particleCtx = canvas.getContext('2d');
  }

  getRandomPiece() {
    const types = Object.keys(SHAPES);
    const type = types[Math.floor(Math.random() * types.length)];
    return { type, shape: JSON.parse(JSON.stringify(SHAPES[type])) };
  }

  spawnPiece(piece = null) {
    const newPiece = piece || this.nextPieces.shift();
    if (!piece) this.nextPieces.push(this.getRandomPiece());
    
    const x = Math.floor(BOARD_WIDTH / 2) - Math.floor(newPiece.shape[0].length / 2);
    this.currentPiece = newPiece;
    this.currentPos = { x, y: 0 };
    this.canHold = true;
    this.calculateGhost();
    
    if (this.checkCollision(this.currentPiece, this.currentPos)) {
      this.gameOver = true;
      this.showGameOver();
    }
    
    this.render();
  }

  checkCollision(piece, pos) {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const newX = pos.x + x;
          const newY = pos.y + y;
          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) return true;
          if (newY >= 0 && this.board[newY][newX]) return true;
        }
      }
    }
    return false;
  }

  movePiece(dx, dy) {
    if (!this.currentPiece || this.gameOver || this.isPaused || this.clearingLines.length > 0 || this.dropLock) return false;
    
    const newPos = { x: this.currentPos.x + dx, y: this.currentPos.y + dy };
    if (!this.checkCollision(this.currentPiece, newPos)) {
      this.currentPos = newPos;
      this.calculateGhost();
      this.render();
      return true;
    }
    return false;
  }

  rotatePiece() {
    if (!this.currentPiece || this.gameOver || this.isPaused || this.clearingLines.length > 0 || this.dropLock) return;
    
    const rotated = this.currentPiece.shape[0].map((_, i) =>
      this.currentPiece.shape.map(row => row[i]).reverse()
    );
    const rotatedPiece = { ...this.currentPiece, shape: rotated };
    
    const kicks = [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: -2, y: 0 },
      { x: 2, y: 0 }
    ];
    
    for (let kick of kicks) {
      const testPos = { x: this.currentPos.x + kick.x, y: this.currentPos.y + kick.y };
      if (!this.checkCollision(rotatedPiece, testPos)) {
        this.currentPiece = rotatedPiece;
        this.currentPos = testPos;
        this.calculateGhost();
        this.render();
        return;
      }
    }
  }

  calculateGhost() {
    if (!this.currentPiece) {
      this.ghostPos = null;
      return;
    }
    
    let ghostY = this.currentPos.y;
    while (!this.checkCollision(this.currentPiece, { x: this.currentPos.x, y: ghostY + 1 })) {
      ghostY++;
    }
    this.ghostPos = ghostY;
  }

  hardDrop() {
    if (!this.currentPiece || this.gameOver || this.isPaused || this.clearingLines.length > 0 || this.dropLock) return;
    
    this.dropLock = true;
    let newY = this.currentPos.y;
    while (!this.checkCollision(this.currentPiece, { x: this.currentPos.x, y: newY + 1 })) {
      newY++;
    }
    
    const dropDistance = newY - this.currentPos.y;
    this.currentPos.y = newY;
    
    for (let y = 0; y < this.currentPiece.shape.length; y++) {
      for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
        if (this.currentPiece.shape[y][x]) {
          this.createParticles(this.currentPos.x + x, this.currentPos.y + y, COLORS[this.currentPiece.type], 15);
        }
      }
    }
    
    this.shakeBoard();
    this.lockPiece();
    
    const points = dropDistance * 2;
    this.score += points;
    this.updateDisplay();
  }

  lockPiece() {
    for (let y = 0; y < this.currentPiece.shape.length; y++) {
      for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
        if (this.currentPiece.shape[y][x]) {
          const boardY = this.currentPos.y + y;
          if (boardY >= 0) {
            this.board[boardY][this.currentPos.x + x] = this.currentPiece.type;
          }
        }
      }
    }
    
    this.clearLines();
  }

  clearLines() {
    const linesToClear = [];
    this.board.forEach((row, y) => {
      if (row.every(cell => cell !== 0)) {
        linesToClear.push(y);
      }
    });

    if (linesToClear.length > 0) {
      this.clearingLines = linesToClear;
      
      linesToClear.forEach(lineY => {
        for (let x = 0; x < BOARD_WIDTH; x++) {
          const color = COLORS[this.board[lineY][x]];
          this.createParticles(x, lineY, color, 12);
        }
      });
      
      this.shakeBoard();
      
      setTimeout(() => {
        this.board = this.board.filter((_, y) => !linesToClear.includes(y));
        while (this.board.length < BOARD_HEIGHT) {
          this.board.unshift(Array(BOARD_WIDTH).fill(0));
        }
        
        if (this.board.every(row => row.every(cell => cell === 0))) {
          this.showMessage('★ PERFECT CLEAR ★', 'perfect-clear', 2000);
          this.score += 1000;
        }
        
        const points = linesToClear.length === 1 ? 100 : 
                      linesToClear.length === 2 ? 300 :
                      linesToClear.length === 3 ? 500 : 800;
        
        this.score += points * this.level;
        this.lines += linesToClear.length;
        this.level = Math.floor(this.lines / 10) + 1;
        this.fallSpeed = Math.max(100, 500 - (this.level - 1) * 40);
        
        let actionText = '';
        if (linesToClear.length === 4) actionText = 'TETRIS!';
        else if (linesToClear.length === 3) actionText = 'TRIPLE!';
        else if (linesToClear.length === 2) actionText = 'DOUBLE!';
        
        if (actionText) {
          this.showMessage(actionText, 'action-text', 1500);
        }
        
        this.comboCount++;
        if (this.comboCount > 1) {
          this.showMessage(`${this.comboCount}x COMBO!`, 'combo-text', 1000);
        }
        
        this.clearingLines = [];
        this.updateDisplay();
        this.dropLock = false;
        this.spawnPiece();
        this.render();
      }, 400);
    } else {
      this.comboCount = 0;
      this.dropLock = false;
      this.spawnPiece();
    }
  }

  holdPiece() {
    if (!this.canHold || !this.currentPiece || this.gameOver || this.isPaused || this.clearingLines.length > 0 || this.dropLock) return;
    
    this.canHold = false;
    const holdPanel = document.getElementById('holdPanel');
    holdPanel.classList.add('glow');
    setTimeout(() => holdPanel.classList.remove('glow'), 300);
    
    if (this.heldPiece) {
      const temp = this.currentPiece;
      this.spawnPiece(this.heldPiece);
      this.heldPiece = temp;
    } else {
      this.heldPiece = this.currentPiece;
      this.spawnPiece();
    }
    
    this.renderHold();
  }

  createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x * CELL_SIZE + CELL_SIZE / 2 + 2,
        y: y * CELL_SIZE + CELL_SIZE / 2 + 2,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10 - 3,
        color,
        life: 1,
        size: Math.random() * 3 + 2
      });
    }
  }

  updateParticles() {
    const ctx = this.particleCtx;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.4;
      p.vx *= 0.98;
      p.life -= 0.015;
      
      if (p.life > 0) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        return true;
      }
      return false;
    });
    
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  shakeBoard() {
    const board = document.getElementById('gameBoard');
    board.classList.add('shake');
    setTimeout(() => board.classList.remove('shake'), 100);
  }

  showMessage(text, className, duration) {
    const container = document.getElementById('overlayMessages');
    const msg = document.createElement('div');
    msg.className = `overlay-message ${className}`;
    msg.textContent = text;
    container.appendChild(msg);
    
    setTimeout(() => {
      msg.remove();
    }, duration);
  }

  showGameOver() {
    const screen = document.getElementById('gameOverScreen');
    screen.style.display = 'block';
    screen.innerHTML = `
      <div class="game-over">
        <div class="game-over-title">GAME OVER</div>
        <div style="font-size: 1.5rem; margin-bottom: 20px;">
          Final Score: <span style="color: #00f0f0; font-weight: bold;">${this.score}</span>
        </div>
        <button class="btn" onclick="location.reload()">Play Again</button>
      </div>
    `;
  }

  setupControls() {
    document.addEventListener('keydown', (e) => {
      if (this.gameOver) return;
      
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'c', 'C', 'p', 'P'].includes(e.key)) {
        e.preventDefault();
      }
      
      if (!this.keysPressed[e.key]) {
        this.keysPressed[e.key] = true;
        
        switch(e.key) {
          case 'ArrowUp':
            this.rotatePiece();
            break;
          case ' ':
            this.hardDrop();
            break;
          case 'c':
          case 'C':
            this.holdPiece();
            break;
          case 'p':
          case 'P':
            this.isPaused = !this.isPaused;
            if (this.isPaused) {
              this.showMessage('⏸ PAUSED', 'paused', 999999);
            } else {
              document.getElementById('overlayMessages').innerHTML = '';
              this.lastFallTime = Date.now();
            }
            break;
        }
        
        if (['ArrowLeft', 'ArrowRight', 'ArrowDown'].includes(e.key)) {
          this.handleMovement(e.key);
          
          this.dasTimers[e.key] = setTimeout(() => {
            this.dasIntervals[e.key] = setInterval(() => {
              this.handleMovement(e.key);
            }, DAS_INTERVAL);
          }, DAS_DELAY);
        }
      }
    });
    
    document.addEventListener('keyup', (e) => {
      this.keysPressed[e.key] = false;
      
      if (this.dasTimers[e.key]) {
        clearTimeout(this.dasTimers[e.key]);
        delete this.dasTimers[e.key];
      }
      
      if (this.dasIntervals[e.key]) {
        clearInterval(this.dasIntervals[e.key]);
        delete this.dasIntervals[e.key];
      }
    });
  }

  handleMovement(key) {
    switch(key) {
      case 'ArrowLeft':
        this.movePiece(-1, 0);
        break;
      case 'ArrowRight':
        this.movePiece(1, 0);
        break;
      case 'ArrowDown':
        if (this.movePiece(0, 1)) {
          this.lastFallTime = Date.now();
        }
        break;
    }
  }

  gameLoop() {
    const now = Date.now();
    
    if (!this.gameOver && !this.isPaused && !this.dropLock && now - this.lastFallTime > this.fallSpeed) {
      if (!this.movePiece(0, 1)) {
        this.lockPiece();
      }
      this.lastFallTime = now;
    }
    
    this.updateParticles();
    requestAnimationFrame(() => this.gameLoop());
  }

  render() {
    const board = document.getElementById('gameBoard');
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${BOARD_WIDTH}, ${CELL_SIZE}px)`;
    
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.y = y;
        cell.dataset.x = x;
        cell.style.width = CELL_SIZE + 'px';
        cell.style.height = CELL_SIZE + 'px';
        
        let isCurrentPiece = false;
        let isGhost = false;
        let pieceColor = null;
        
        if (this.currentPiece) {
          for (let py = 0; py < this.currentPiece.shape.length; py++) {
            for (let px = 0; px < this.currentPiece.shape[py].length; px++) {
              if (this.currentPiece.shape[py][px]) {
                if (this.currentPos.x + px === x && this.currentPos.y + py === y) {
                  isCurrentPiece = true;
                  pieceColor = COLORS[this.currentPiece.type];
                }
                if (this.ghostPos !== null && this.currentPos.x + px === x && this.ghostPos + py === y) {
                  isGhost = true;
                }
              }
            }
          }
        }
        
        if (isCurrentPiece) {
          cell.style.backgroundColor = pieceColor;
          cell.style.boxShadow = `0 0 15px ${pieceColor}, inset 0 0 10px ${pieceColor}40`;
        } else if (isGhost && !this.board[y][x]) {
          cell.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
          cell.style.border = '2px dashed rgba(255, 255, 255, 0.3)';
        } else if (this.board[y][x]) {
          const color = COLORS[this.board[y][x]];
          cell.style.backgroundColor = color;
          cell.style.boxShadow = `0 0 8px ${color}40`;
        } else {
          cell.style.backgroundColor = '#0a0a0a';
        }
        
        board.appendChild(cell);
      }
    }
    
    this.renderHold();
    this.renderNext();
  }

  renderHold() {
    const holdBox = document.getElementById('holdBox');
    holdBox.innerHTML = '';
    
    if (this.heldPiece) {
      const preview = this.createPiecePreview(this.heldPiece, 20);
      holdBox.appendChild(preview);
    }
  }

  renderNext() {
    const container = document.getElementById('nextPieces');
    container.innerHTML = '';
    
    this.nextPieces.slice(0, 3).forEach((piece, i) => {
      const box = document.createElement('div');
      box.className = 'preview-box next-preview';
      box.style.opacity = (1 - (i * 0.25)).toString();
      box.style.transform = 'scale(' + (1 - (i * 0.1)) + ')';
      
      const preview = this.createPiecePreview(piece, 20);
      box.appendChild(preview);
      container.appendChild(box);
    });
  }

  createPiecePreview(piece, size) {
    const container = document.createElement('div');
    container.style.display = 'inline-block';
    
    piece.shape.forEach(row => {
      const rowDiv = document.createElement('div');
      rowDiv.style.display = 'flex';
      
      row.forEach(cell => {
        const cellDiv = document.createElement('div');
        cellDiv.style.width = size + 'px';
        cellDiv.style.height = size + 'px';
        cellDiv.style.border = cell ? '1px solid rgba(255,255,255,0.3)' : 'none';
        cellDiv.style.backgroundColor = cell ? COLORS[piece.type] : 'transparent';
        cellDiv.style.borderRadius = '2px';
        cellDiv.style.transition = 'all 0.1s';
        if (cell) {
          cellDiv.style.boxShadow = '0 0 ' + (size/4) + 'px ' + COLORS[piece.type] + '40';
        }
        rowDiv.appendChild(cellDiv);
      });
      
      container.appendChild(rowDiv);
    });
    
    return container;
  }

  updateDisplay() {
    document.getElementById('score').textContent = this.score;
    document.getElementById('level').textContent = this.level;
    document.getElementById('lines').textContent = this.lines;
  }
}

// Initialize game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  new TetrisGame();
  
  // Setup modal event listeners
  const updateLogBtn = document.getElementById('updateLogBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const updateLogModal = document.getElementById('updateLogModal');
  const playAgainBtn = document.getElementById('playAgainBtn');
  
  updateLogBtn.addEventListener('click', toggleUpdateLog);
  closeModalBtn.addEventListener('click', toggleUpdateLog);
  playAgainBtn.addEventListener('click', () => location.reload());
  
  // Close modal when clicking outside
  updateLogModal.addEventListener('click', (e) => {
    if (e.target === updateLogModal) {
      toggleUpdateLog();
    }
  });
});
