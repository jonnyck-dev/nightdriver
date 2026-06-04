const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 640;
canvas.height = 480;

// Configuración
const roadWidth = 2000;
const segmentLength = 200;
const drawDistance = 200;
const cameraDepth = 1 / Math.tan((80 / 2) * Math.PI / 180);
const totalTrackLength = 1000;

let segments = [];
let playerX = 0;
let position = 0;
let speed = 0;
let maxSpeed = 400; // Velocidad que aumenta poco a poco
let accel = 2;
let breaking = -5;
let decel = -1;
let offRoadDecel = -10;
let gameActive = false;
let score = 0;
let highScore = localStorage.getItem('nightdriver_highscore') || 0;

const keys = {};
document.addEventListener('keydown', e => keys[e.code] = true);
document.addEventListener('keyup', e => keys[e.code] = false);

function resetTrack() {
    segments = [];
    for (let n = 0; n < totalTrackLength; n++) {
        // Añadir curvas
        let curve = 0;
        if (n > 50 && n < 150) curve = 2;
        else if (n > 200 && n < 300) curve = -3;
        else if (n > 400 && n < 600) curve = 4;
        else if (n > 700 && n < 900) curve = -4;

        // Añadir obstáculos de forma aleatoria (no en la salida)
        let obstacle = null;
        if (n > 100 && Math.random() < 0.05) {
            // Posición del obstáculo: -0.5 (izquierda), 0 (centro), 0.5 (derecha)
            obstacle = (Math.random() * 2) - 1; 
        }

        segments.push({
            index: n,
            p1: { world: { x: 0, y: 0, z: n * segmentLength }, screen: {} },
            p2: { world: { x: 0, y: 0, z: (n + 1) * segmentLength }, screen: {} },
            curve: curve,
            obstacle: obstacle,
            color: Math.floor(n / 3) % 2 ? { road: '#111', grass: '#000', rumble: '#0ff' } : { road: '#222', grass: '#005', rumble: '#f0f' }
        });
    }
}

function project(p, cameraX, cameraY, cameraZ) {
    p.camera = {
        x: (p.world.x || 0) - cameraX,
        y: (p.world.y || 0) - cameraY,
        z: (p.world.z || 0) - cameraZ
    };
    const scale = cameraDepth / (p.camera.z || 1);
    p.screen.x = Math.round((canvas.width / 2) + (scale * p.camera.x * canvas.width / 2));
    p.screen.y = Math.round((canvas.height / 2) - (scale * p.camera.y * canvas.height / 2));
    p.screen.w = Math.round(scale * roadWidth * canvas.width / 2);
    p.screen.scale = scale;
}

function initGame() {
    position = 0;
    speed = 0;
    playerX = 0;
    score = 0;
    gameActive = true;
    maxSpeed = 300; // Resetear dificultad
    resetTrack();
    
    // Actualizar High Score visual
    document.getElementById('highscore').innerText = `HIGH SCORE: ${Math.floor(highScore).toString().padStart(4, '0')}`;
}

function endGame() {
    gameActive = false;
    
    // Guardar High Score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('nightdriver_highscore', highScore);
    }

    document.getElementById('end-screen').classList.remove('hidden');
    document.getElementById('end-title').innerText = "¡COLISIÓN!";
    document.getElementById('end-title').style.color = '#f0f';
    document.getElementById('final-stats').innerText = `SCORE FINAL: ${Math.floor(score)}\nHIGH SCORE: ${Math.floor(highScore)}`;
    document.getElementById('msg').innerText = "EL NEÓN TE CONSUMIÓ";
}

function update(dt) {
    if (!gameActive) return;

    // Aceleración y Frenado
    if (keys['ArrowUp']) speed += accel;
    else if (keys['ArrowDown']) speed += breaking;
    else speed += decel;

    // Aumentar la velocidad máxima poco a poco (dificultad progresiva)
    maxSpeed += 0.05;

    // Manejo de giro
    if (keys['ArrowLeft']) playerX -= 0.05 * (speed / maxSpeed);
    if (keys['ArrowRight']) playerX += 0.05 * (speed / maxSpeed);

    // Salirse de la carretera te frena mucho
    if (Math.abs(playerX) > 1) {
        if (speed > 50) speed += offRoadDecel;
    }

    speed = Math.max(0, Math.min(speed, maxSpeed));
    position += speed;

    // Pista Infinita (Loop)
    if (position >= totalTrackLength * segmentLength) {
        position -= totalTrackLength * segmentLength;
    }

    // Curvatura de la carretera
    const currentSegmentIndex = Math.floor(position / segmentLength) % totalTrackLength;
    const currentSegment = segments[currentSegmentIndex];
    playerX -= (speed / maxSpeed) * currentSegment.curve * 0.01;

    // Detección de Colisión con Obstáculos
    if (currentSegment.obstacle !== null) {
        // Si el coche está en el mismo segmento y cerca del obstáculo (X)
        const distanceToObstacle = Math.abs(playerX - currentSegment.obstacle);
        if (distanceToObstacle < 0.3) { // 0.3 es el "ancho" de la colisión
            endGame();
        }
    }

    // Puntaje progresivo
    if (speed > 10) score += (speed / 100);

    // UI
    document.getElementById('speed').innerText = `VELOCIDAD: ${Math.floor(speed)} KM/H`;
    document.getElementById('score').innerText = `SCORE: ${Math.floor(score).toString().padStart(4, '0')}`;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Cielo Reactivo
    const skyColor = Math.floor(position / 100) % 2 ? '#001' : '#002';
    ctx.fillStyle = skyColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const startPos = Math.floor(position / segmentLength);
    const cameraY = 1500;
    let maxy = canvas.height;
    let x = 0;
    let dx = 0;

    for (let n = startPos; n < startPos + drawDistance; n++) {
        const segment = segments[n % totalTrackLength];
        const loop = (n >= totalTrackLength);
        const zOffset = (loop ? totalTrackLength * segmentLength : 0);
        
        project(segment.p1, playerX * roadWidth - x, cameraY, position - zOffset);
        project(segment.p2, playerX * roadWidth - x - dx, cameraY, position - zOffset);
        
        x += dx;
        dx += segment.curve;

        if (segment.p1.camera.z <= cameraDepth || segment.p2.screen.y >= maxy) continue;

        const p1 = segment.p1.screen;
        const p2 = segment.p2.screen;

        // Césped
        ctx.fillStyle = segment.color.grass;
        ctx.fillRect(0, p2.y, canvas.width, p1.y - p2.y);

        // Bordes neón
        const rumbleW1 = p1.w * 0.1;
        const rumbleW2 = p2.w * 0.1;
        ctx.fillStyle = segment.color.rumble;
        
        // Izquierda
        ctx.beginPath();
        ctx.moveTo(p1.x - p1.w - rumbleW1, p1.y); ctx.lineTo(p1.x - p1.w, p1.y);
        ctx.lineTo(p2.x - p2.w, p2.y); ctx.lineTo(p2.x - p2.w - rumbleW2, p2.y);
        ctx.fill();
        
        // Derecha
        ctx.beginPath();
        ctx.moveTo(p1.x + p1.w + rumbleW1, p1.y); ctx.lineTo(p1.x + p1.w, p1.y);
        ctx.lineTo(p2.x + p2.w, p2.y); ctx.lineTo(p2.x + p2.w + rumbleW2, p2.y);
        ctx.fill();

        // Carretera
        ctx.fillStyle = segment.color.road;
        ctx.beginPath();
        ctx.moveTo(p1.x - p1.w, p1.y); ctx.lineTo(p1.x + p1.w, p1.y);
        ctx.lineTo(p2.x + p2.w, p2.y); ctx.lineTo(p2.x - p2.w, p2.y);
        ctx.fill();

        maxy = p2.y;
    }

    // Dibujar obstáculos en una segunda pasada (para que se vean encima de la carretera)
    for (let n = startPos + drawDistance - 1; n >= startPos; n--) {
        const segment = segments[n % totalTrackLength];
        if (segment.obstacle !== null && segment.p1.camera.z > cameraDepth) {
            const p1 = segment.p1.screen;
            // Calcular posición X del obstáculo en pantalla
            const obsX = p1.x + (segment.obstacle * p1.w);
            const obsW = p1.w * 0.2; // Ancho del obstáculo
            const obsH = p1.w * 0.2; // Alto del obstáculo
            
            ctx.fillStyle = '#ff0055'; // Color del obstáculo
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff0055';
            ctx.fillRect(obsX - obsW / 2, p1.y - obsH, obsW, obsH);
            ctx.shadowBlur = 0;
        }
    }

    // Dibujar Coche
    drawPlayer(canvas.width / 2, canvas.height - 30);
}

function drawPlayer(x, y) {
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#0ff";
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(x - 30, y);
    ctx.lineTo(x + 30, y);
    ctx.lineTo(x + 20, y - 40);
    ctx.lineTo(x - 20, y - 40);
    ctx.fill();
    
    // Luces traseras
    ctx.shadowColor = "#f0f";
    ctx.fillStyle = "#f0f";
    ctx.fillRect(x - 25, y - 10, 15, 5);
    ctx.fillRect(x + 10, y - 10, 15, 5);
    ctx.shadowBlur = 0;
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Inicialización
resetTrack();
document.getElementById('highscore').innerText = `HIGH SCORE: ${Math.floor(highScore).toString().padStart(4, '0')}`;
gameLoop();
