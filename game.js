const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 640;
canvas.height = 480;

// Configuración
const roadWidth = 2000;
const segmentLength = 200;
const drawDistance = 200;
const cameraDepth = 1 / Math.tan((80 / 2) * Math.PI / 180);
const playerZ = 0;
const totalTrackLength = 500; // Número de segmentos

let segments = [];
let playerX = 0;
let position = 0;
let speed = 0;
let maxSpeed = 300;
let accel = 2;
let breaking = -5;
let decel = -1;
let offRoadDecel = -10;
let gameActive = false;
let score = 0;
let timeLeft = 60;
let timerId = null;

const keys = {};
document.addEventListener('keydown', e => keys[e.code] = true);
document.addEventListener('keyup', e => keys[e.code] = false);

function resetTrack() {
    segments = [];
    for (let n = 0; n < totalTrackLength; n++) {
        segments.push({
            index: n,
            p1: { world: { x: 0, y: 0, z: n * segmentLength }, screen: {} },
            p2: { world: { x: 0, y: 0, z: (n + 1) * segmentLength }, screen: {} },
            curve: (n > 50 && n < 150) ? 2 : (n > 200 && n < 300) ? -3 : (n > 350) ? 5 : 0,
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
    const scale = cameraDepth / (p.camera.z || 1); // Evitar división por cero
    p.screen.x = Math.round((canvas.width / 2) + (scale * p.camera.x * canvas.width / 2));
    p.screen.y = Math.round((canvas.height / 2) - (scale * p.camera.y * canvas.height / 2));
    p.screen.w = Math.round(scale * roadWidth * canvas.width / 2);
}

function initGame() {
    position = 0;
    speed = 0;
    playerX = 0;
    score = 0;
    timeLeft = 60;
    gameActive = true;
    resetTrack();
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
        if (gameActive) {
            timeLeft--;
            if (timeLeft <= 0) endGame("¡TIEMPO AGOTADO!", false);
        }
    }, 1000);
}

function endGame(title, win) {
    gameActive = false;
    document.getElementById('end-screen').classList.remove('hidden');
    document.getElementById('end-title').innerText = title;
    document.getElementById('end-title').style.color = win ? '#0ff' : '#f0f';
    document.getElementById('final-stats').innerText = `SCORE FINAL: ${Math.floor(score)}`;
    document.getElementById('msg').innerText = win ? "DOMINASTE LA NOCHE" : "EL NEÓN TE CONSUMIÓ";
}

function update(dt) {
    if (!gameActive) return;

    // Aceleración y Frenado
    if (keys['ArrowUp']) speed += accel;
    else if (keys['ArrowDown']) speed += breaking;
    else speed += decel;

    // Manejo de giro
    if (keys['ArrowLeft']) playerX -= 0.05 * (speed / maxSpeed);
    if (keys['ArrowRight']) playerX += 0.05 * (speed / maxSpeed);

    // Salirse de la carretera
    if (Math.abs(playerX) > 1) {
        if (speed > 50) speed += offRoadDecel;
    }

    speed = Math.max(0, Math.min(speed, maxSpeed));
    position += speed;

    // Curvatura de la carretera
    const currentSegment = segments[Math.floor(position / segmentLength) % segments.length];
    playerX -= (speed / maxSpeed) * currentSegment.curve * 0.01;

    // Puntaje progresivo
    if (speed > 10) score += (speed / 100);

    // Condición de Victoria
    if (position > (totalTrackLength - 20) * segmentLength) {
        endGame("¡META ALCANZADA!", true);
    }

    // UI
    document.getElementById('speed').innerText = `VELOCIDAD: ${Math.floor(speed)} KM/H`;
    document.getElementById('score').innerText = `SCORE: ${Math.floor(score).toString().padStart(4, '0')}`;
    document.getElementById('time').innerText = `TIEMPO: ${timeLeft}s`;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo Dinámico (Momento WOW: Cielo Reactivo)
    const skyColor = Math.floor(position / 100) % 2 ? '#001' : '#002';
    ctx.fillStyle = skyColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const startPos = Math.floor(position / segmentLength);
    const cameraY = 1500;
    let maxy = canvas.height;
    let x = 0;
    let dx = 0;

    for (let n = startPos; n < startPos + drawDistance; n++) {
        const segment = segments[n % segments.length];
        const loop = (n >= totalTrackLength);
        
        project(segment.p1, playerX * roadWidth - x, cameraY, position - (loop ? totalTrackLength * segmentLength : 0));
        project(segment.p2, playerX * roadWidth - x - dx, cameraY, position - (loop ? totalTrackLength * segmentLength : 0));
        
        x += dx;
        dx += segment.curve;

        if (segment.p1.camera.z <= cameraDepth || segment.p2.screen.y >= maxy) continue;

        const p1 = segment.p1.screen;
        const p2 = segment.p2.screen;

        // Césped
        ctx.fillStyle = segment.color.grass;
        ctx.fillRect(0, p2.y, canvas.width, p1.y - p2.y);

        // Rumbe strips (Bordes neón)
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

    // Dibujar Coche (Neon Sprite)
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

gameLoop();
mationFrame(gameLoop);
}

gameLoop();
