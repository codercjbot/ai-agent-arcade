const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const messageElement = document.getElementById('message');
const startBtn = document.getElementById('startBtn');

// Game settings
const PADDLE_WIDTH = 120;
const PADDLE_HEIGHT = 15;
const BALL_RADIUS = 10;
const BRICK_ROWS = 6;
const BRICK_COLS = 10;
const BRICK_WIDTH = 70;
const BRICK_HEIGHT = 25;
const BRICK_PADDING = 8;
const BRICK_TOP_OFFSET = 60;
const BRICK_LEFT_OFFSET = (canvas.width - (BRICK_COLS * (BRICK_WIDTH + BRICK_PADDING) - BRICK_PADDING)) / 2;

// Colors for brick rows
const BRICK_COLORS = [
    '#ff6b6b', // Red
    '#ffa502', // Orange
    '#ffd93d', // Yellow
    '#6bcb77', // Green
    '#4d96ff', // Blue
    '#9b59b6'  // Purple
];

// Game state
let paddle, ball, bricks, score, lives, gameRunning, animationId;

function initGame() {
    paddle = {
        x: canvas.width / 2 - PADDLE_WIDTH / 2,
        y: canvas.height - 40,
        width: PADDLE_WIDTH,
        height: PADDLE_HEIGHT,
        speed: 8
    };

    ball = {
        x: canvas.width / 2,
        y: paddle.y - BALL_RADIUS - 5,
        radius: BALL_RADIUS,
        dx: 5 * (Math.random() > 0.5 ? 1 : -1),
        dy: -5,
        speed: 5
    };

    bricks = [];
    for (let row = 0; row < BRICK_ROWS; row++) {
        bricks[row] = [];
        for (let col = 0; col < BRICK_COLS; col++) {
            bricks[row][col] = {
                x: BRICK_LEFT_OFFSET + col * (BRICK_WIDTH + BRICK_PADDING),
                y: BRICK_TOP_OFFSET + row * (BRICK_HEIGHT + BRICK_PADDING),
                width: BRICK_WIDTH,
                height: BRICK_HEIGHT,
                color: BRICK_COLORS[row],
                alive: true,
                points: (BRICK_ROWS - row) * 10
            };
        }
    }

    score = 0;
    lives = 3;
    gameRunning = false;
    updateUI();
}

function updateUI() {
    scoreElement.textContent = score;
    livesElement.textContent = lives;
}

function drawPaddle() {
    const gradient = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y + paddle.height);
    gradient.addColorStop(0, '#00ffff');
    gradient.addColorStop(1, '#0088aa');
    
    ctx.beginPath();
    ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 8);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Glow effect
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    
    const gradient = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 0, ball.x, ball.y, ball.radius);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#00ffff');
    ctx.fillStyle = gradient;
    
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawBricks() {
    for (let row = 0; row < BRICK_ROWS; row++) {
        for (let col = 0; col < BRICK_COLS; col++) {
            const brick = bricks[row][col];
            if (brick.alive) {
                const gradient = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.height);
                gradient.addColorStop(0, brick.color);
                gradient.addColorStop(1, shadeColor(brick.color, -30));
                
                ctx.beginPath();
                ctx.roundRect(brick.x, brick.y, brick.width, brick.height, 5);
                ctx.fillStyle = gradient;
                ctx.fill();
                
                // Highlight
                ctx.beginPath();
                ctx.roundRect(brick.x + 3, brick.y + 3, brick.width - 6, brick.height / 2 - 3, 3);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fill();
            }
        }
    }
}

function shadeColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 +
        (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)
    ).toString(16).slice(1);
}

function moveBall() {
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall collisions
    if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= canvas.width) {
        ball.dx = -ball.dx;
    }
    if (ball.y - ball.radius <= 0) {
        ball.dy = -ball.dy;
    }

    // Bottom - lose life
    if (ball.y + ball.radius >= canvas.height) {
        lives--;
        updateUI();
        
        if (lives <= 0) {
            gameOver(false);
        } else {
            resetBall();
        }
    }

    // Paddle collision
    if (ball.y + ball.radius >= paddle.y &&
        ball.y - ball.radius <= paddle.y + paddle.height &&
        ball.x >= paddle.x &&
        ball.x <= paddle.x + paddle.width) {
        
        // Calculate hit position for angle
        const hitPos = (ball.x - paddle.x) / paddle.width;
        const angle = (hitPos - 0.5) * Math.PI * 0.7; // -63 to +63 degrees
        
        const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
        ball.dx = speed * Math.sin(angle);
        ball.dy = -speed * Math.cos(angle);
        
        // Make sure ball is above paddle
        ball.y = paddle.y - ball.radius;
    }

    // Brick collisions
    for (let row = 0; row < BRICK_ROWS; row++) {
        for (let col = 0; col < BRICK_COLS; col++) {
            const brick = bricks[row][col];
            if (brick.alive) {
                if (ball.x + ball.radius > brick.x &&
                    ball.x - ball.radius < brick.x + brick.width &&
                    ball.y + ball.radius > brick.y &&
                    ball.y - ball.radius < brick.y + brick.height) {
                    
                    brick.alive = false;
                    score += brick.points;
                    updateUI();
                    
                    // Determine collision side
                    const overlapLeft = ball.x + ball.radius - brick.x;
                    const overlapRight = brick.x + brick.width - (ball.x - ball.radius);
                    const overlapTop = ball.y + ball.radius - brick.y;
                    const overlapBottom = brick.y + brick.height - (ball.y - ball.radius);
                    
                    const minOverlapX = Math.min(overlapLeft, overlapRight);
                    const minOverlapY = Math.min(overlapTop, overlapBottom);
                    
                    if (minOverlapX < minOverlapY) {
                        ball.dx = -ball.dx;
                    } else {
                        ball.dy = -ball.dy;
                    }
                    
                    // Check win
                    if (checkWin()) {
                        gameOver(true);
                    }
                    
                    return; // Only one brick per frame
                }
            }
        }
    }
}

function checkWin() {
    for (let row = 0; row < BRICK_ROWS; row++) {
        for (let col = 0; col < BRICK_COLS; col++) {
            if (bricks[row][col].alive) return false;
        }
    }
    return true;
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = paddle.y - ball.radius - 5;
    ball.dx = ball.speed * (Math.random() > 0.5 ? 1 : -1);
    ball.dy = -ball.speed;
    paddle.x = canvas.width / 2 - paddle.width / 2;
}

function gameOver(won) {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    
    if (won) {
        messageElement.textContent = '🎉 YOU WIN! 🎉';
        messageElement.style.color = '#6bcb77';
    } else {
        messageElement.textContent = '💀 GAME OVER 💀';
        messageElement.style.color = '#ff6b6b';
    }
    
    startBtn.textContent = 'Play Again';
    startBtn.classList.remove('hidden');
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawBricks();
    drawPaddle();
    drawBall();
    
    if (gameRunning) {
        moveBall();
        animationId = requestAnimationFrame(draw);
    }
}

// Controls
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    paddle.x = mouseX - paddle.width / 2;
    
    // Keep paddle in bounds
    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x + paddle.width > canvas.width) paddle.x = canvas.width - paddle.width;
});

// Touch support
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const touchX = (e.touches[0].clientX - rect.left) * scaleX;
    paddle.x = touchX - paddle.width / 2;
    
    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x + paddle.width > canvas.width) paddle.x = canvas.width - paddle.width;
});

// Keyboard support
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') {
        paddle.x -= paddle.speed * 5;
        if (paddle.x < 0) paddle.x = 0;
    }
    if (e.key === 'ArrowRight' || e.key === 'd') {
        paddle.x += paddle.speed * 5;
        if (paddle.x + paddle.width > canvas.width) paddle.x = canvas.width - paddle.width;
    }
});

startBtn.addEventListener('click', () => {
    initGame();
    startBtn.classList.add('hidden');
    messageElement.textContent = '';
    gameRunning = true;
    draw();
});

// Polyfill for roundRect
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
    };
}

// Initial draw
initGame();
draw();
