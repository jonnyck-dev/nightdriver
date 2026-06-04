const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Configuración de pantalla
canvas.width = 640;
canvas.height = 480;

// Variables de juego
let speed = 0;
let position = 0;
const roadWidth = 2000;
const segmentLength = 200;
const segments = [];
const drawDistance = 300;
const maxSpeed = 100;

// Entrada de teclado
const keys = {};
document.addEventListener('keydown', e => keys[e.code] = true);
document.addEventListener('keyup', e => keys[e.code] = false);

// Crear carretera básica
for (let n = 0; n < 500; n++) {
    segments.push({
        p1: { world: { z: n * segmentLength }, screen: {} },
        p2: { world: { z: (n + 1) * segmentLength }, screen: {} },
        color: Math.floor(n / 3) % 2 ? '#333' : '#444'
    });
}

function project(p, cameraX, cameraY, cameraZ, cameraDepth) {
    const worldX = 0 - cameraX;
    const worldY = 0 - cameraY;
    const worldZ = p.world.z - cameraZ;
    
    const scale = cameraDepth / worldZ;
    p.screen.x = Math.round((canvas.width / 2) + (scale * worldX * canvas.width / 2));
    p.screen.y = Math.round((canvas.height / 2) - (scale * worldY * canvas.height / 2));
    p.screen.w = Math.round(scale * roadWidth * canvas.width / 2);
}

function update(dt) {
    if (keys['ArrowUp']) speed = Math.min(speed + 1, maxSpeed);
    else speed = Math.max(speed - 1, 0);
    
    position += speed;
    
    // Actualizar UI
    document.getElementById('speed').innerText = `Velocidad: ${Math.floor(speed * 2)} km/h`;
    document.getElementById('distance').innerText = `Distancia: ${Math.floor(position / 100)}m`;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Cielo y césped (fondo estático por ahora)
    ctx.fillStyle = '#005'; // Cielo nocturno
    ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
    ctx.fillStyle = '#020'; // Césped oscuro
    ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

    const cameraDepth = 1 / Math.tan((80 / 2) * Math.PI / 180);
    const startPos = Math.floor(position / segmentLength);
    
    for (let n = startPos; n < startPos + drawDistance; n++) {
        const segment = segments[n % segments.length];
        
        project(segment.p1, 0, 1500, position, cameraDepth);
        project(segment.p2, 0, 1500, position, cameraDepth);
        
        if (segment.p1.world.z <= position || segment.p2.screen.y >= segment.p1.screen.y) continue;
        
        const p1 = segment.p1.screen;
        const p2 = segment.p2.screen;
        
        // Dibujar carretera
        ctx.fillStyle = segment.color;
        ctx.beginPath();
        ctx.moveTo(p1.x - p1.w, p1.y);
        ctx.lineTo(p1.x + p1.w, p1.y);
        ctx.lineTo(p2.x + p2.w, p2.y);
        ctx.lineTo(p2.x - p2.w, p2.y);
        ctx.fill();
    }
    
    // "Coche" del jugador (un triángulo simple por ahora)
    ctx.fillStyle = '#f00';
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 20, canvas.height - 20);
    ctx.lineTo(canvas.width / 2 + 20, canvas.height - 20);
    ctx.lineTo(canvas.width / 2, canvas.height - 50);
    ctx.fill();
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();
