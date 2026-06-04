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

// --- SISTEMA DE AUDIO PROCEDURAL (Web Audio API) ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
let engineOsc;
let engineGain;
let audioInitialized = false;

function initAudio() {
    if (audioInitialized) return;
    try {
        audioCtx = new AudioContext();
        
        // 1. Sonido de Motor (Diente de sierra + Filtro Pasa-bajos)
        engineOsc = audioCtx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 60; // Frecuencia base (ralentí)
        
        engineGain = audioCtx.createGain();
        engineGain.gain.value = 0; // Silenciado hasta iniciar
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 350; // Frecuencia de corte para sonido ronco
        
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(audioCtx.destination);
        engineOsc.start();
        
        // 2. Música de Fondo 8-Bit (Arpegio Synthwave)
        const notes = [220.00, 261.63, 329.63, 440.00, 261.63, 329.63, 392.00, 523.25];
        let noteIdx = 0;
        
        setInterval(() => {
            if (!gameActive || audioCtx.state !== 'running') return;
            
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'square';
            osc.frequency.setValueAtTime(notes[noteIdx], audioCtx.currentTime);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            // Envolvente de sonido "Plucky"
            gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
            
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.15);
            
            noteIdx = (noteIdx + 1) % notes.length;
        }, 125);
        
        audioInitialized = true;
    } catch (e) {
        console.error("Audio Initialization failed:", e);
    }
}

function playCrashSound() {
    if (!audioInitialized || !audioCtx) return;
    const gain = audioCtx.createGain();
    
    // Generar ruido blanco para el choque (0.5 segundos)
    const bufferSize = audioCtx.sampleRate * 0.5;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass'; // Sonido grave tipo explosión 8-bit
    filter.frequency.value = 800;
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    // Volumen alto y decaimiento
    gain.gain.setValueAtTime(0.6, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    noise.start();
    noise.stop(audioCtx.currentTime + 0.5);
}

function updateAudio(currentSpeed, maxSpeedValue) {
    if (!audioInitialized || !audioCtx) return;
    
    if (gameActive && !isPaused) {
        const r = maxSpeedValue > 0 ? (currentSpeed / maxSpeedValue) : 0;
        const totalGears = 6;
        const gear = Math.min(totalGears - 1, Math.floor(r * totalGears));
        const gearMin = gear / totalGears;
        const gearMax = (gear + 1) / totalGears;
        const gearProgress = gearMax === gearMin ? 0 : (r - gearMin) / (gearMax - gearMin);
        
        // Tonos más contrastantes para simular el cambio de palanca (6 marchas)
        const baseFreq = 40 + gear * 20; 
        const targetFreq = baseFreq + gearProgress * 120;
        
        engineOsc.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.1);
        engineGain.gain.setTargetAtTime(0.05 + r * 0.2, audioCtx.currentTime, 0.1);
    } else {
        engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
    }
}
// ---------------------------------------------------

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
let lastSegmentIndex = 0;
let segmentsToNextSpawn = 0;
let isPaused = false;

const keys = {};
document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyP') {
        if (gameActive) isPaused = !isPaused;
    }
});
document.addEventListener('keyup', e => keys[e.code] = false);

function resetTrack() {
    segments = [];
    for (let n = 0; n < totalTrackLength; n++) {
        let curve = 0;
        if (n > 50 && n < 150) curve = 2;
        else if (n > 200 && n < 300) curve = -3;
        else if (n > 400 && n < 600) curve = 4;
        else if (n > 700 && n < 900) curve = -4;

        let obstacle = null;

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
    initAudio();
    if(audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    position = 0;
    speed = 0;
    playerX = 0;
    score = 0;
    lastSegmentIndex = 0;
    segmentsToNextSpawn = 10;
    gameActive = true;
    maxSpeed = 300; 
    resetTrack();
    
    document.getElementById('highscore').innerText = `HIGH SCORE: ${Math.floor(highScore).toString().padStart(4, '0')}`;
}

function endGame() {
    gameActive = false;
    playCrashSound();
    
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
    if (!gameActive) {
        updateAudio(0, maxSpeed);
        return;
    }
    
    if (isPaused) {
        updateAudio(0, maxSpeed);
        return;
    }

    if (keys['ArrowUp']) speed += accel;
    else if (keys['ArrowDown']) speed += breaking;
    else speed += decel;

    if (speed > 0) {
        if (keys['ArrowLeft']) playerX -= 0.05;
        if (keys['ArrowRight']) playerX += 0.05;
    }

    if (Math.abs(playerX) > 1) {
        if (speed > 50) speed += offRoadDecel;
    }

    speed = Math.max(0, Math.min(speed, maxSpeed));
    position += speed;

    if (position >= totalTrackLength * segmentLength) {
        position -= totalTrackLength * segmentLength;
    }

    const currentSegmentIndex = Math.floor(position / segmentLength) % totalTrackLength;
    const currentSegment = segments[currentSegmentIndex];
    playerX -= (speed / maxSpeed) * currentSegment.curve * 0.01;

    if (currentSegmentIndex !== lastSegmentIndex) {
        let idx = lastSegmentIndex;
        while (idx !== currentSegmentIndex) {
            // Limpiamos el obstáculo del segmento que dejamos atrás
            segments[idx].obstacle = null;

            idx = (idx + 1) % totalTrackLength;
            
            // Comprobamos colisión en segmentos intermedios (por si saltamos alguno a muy alta velocidad)
            if (idx !== currentSegmentIndex && segments[idx].obstacle !== null) {
                if (Math.abs(playerX - segments[idx].obstacle) < 0.18) {
                    endGame();
                }
            }
            
            let futureIndex = (idx + drawDistance) % totalTrackLength;
            
            if (segmentsToNextSpawn > 0) {
                segmentsToNextSpawn--;
            } else {
                let probability = 0.10 + Math.min(score / 1500, 1) * 0.25;
                if (Math.random() < probability) {
                    // Decidimos el tamaño del grupo de obstáculos: 1 o 2 carros.
                    let groupSize = Math.random() < 0.5 ? 1 : 2;
                    
                    if (groupSize === 1) {
                        segments[futureIndex].obstacle = (Math.random() * 1.4) - 0.7; // Colocar en la carretera (-0.7 a 0.7)
                        // Cooldown de 30 a 45 segmentos para dar un buen radio de aparición
                        segmentsToNextSpawn = Math.floor(Math.random() * 15) + 30;
                    } else {
                        // Grupo de 2 carros: uno a la izquierda y otro a la derecha
                        let x1 = (Math.random() * 0.6) - 0.7; // Izquierda (-0.7 a -0.1)
                        let x2 = (Math.random() * 0.6) + 0.1; // Derecha (0.1 a 0.7)
                        
                        // Aleatorizar cuál va primero
                        if (Math.random() < 0.5) {
                            let temp = x1;
                            x1 = x2;
                            x2 = temp;
                        }
                        
                        segments[futureIndex].obstacle = x1;
                        segments[(futureIndex + 3) % totalTrackLength].obstacle = x2; // El segundo con una pequeña separación de 3 segmentos
                        
                        // Cooldown de 45 a 60 segmentos para grupos de 2
                        segmentsToNextSpawn = Math.floor(Math.random() * 15) + 45;
                    }
                }
            }
        }
        lastSegmentIndex = currentSegmentIndex;
    }

    if (currentSegment.obstacle !== null) {
        const distanceToObstacle = Math.abs(playerX - currentSegment.obstacle);
        if (distanceToObstacle < 0.18) { // 0.10 del obstáculo + 0.08 del ancho del coche para una colisión visualmente exacta
            endGame();
        }
    }

    if (speed > 10) score += (speed / 100);

    document.getElementById('speed').innerText = `VELOCIDAD: ${Math.floor(speed)} KM/H`;
    document.getElementById('score').innerText = `SCORE: ${Math.floor(score).toString().padStart(4, '0')}`;
    
    updateAudio(speed, maxSpeed);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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

        ctx.fillStyle = segment.color.grass;
        ctx.fillRect(0, p2.y, canvas.width, p1.y - p2.y);

        const rumbleW1 = p1.w * 0.1;
        const rumbleW2 = p2.w * 0.1;
        ctx.fillStyle = segment.color.rumble;
        
        ctx.beginPath();
        ctx.moveTo(p1.x - p1.w - rumbleW1, p1.y); ctx.lineTo(p1.x - p1.w, p1.y);
        ctx.lineTo(p2.x - p2.w, p2.y); ctx.lineTo(p2.x - p2.w - rumbleW2, p2.y);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(p1.x + p1.w + rumbleW1, p1.y); ctx.lineTo(p1.x + p1.w, p1.y);
        ctx.lineTo(p2.x + p2.w, p2.y); ctx.lineTo(p2.x + p2.w + rumbleW2, p2.y);
        ctx.fill();

        ctx.fillStyle = segment.color.road;
        ctx.beginPath();
        ctx.moveTo(p1.x - p1.w, p1.y); ctx.lineTo(p1.x + p1.w, p1.y);
        ctx.lineTo(p2.x + p2.w, p2.y); ctx.lineTo(p2.x - p2.w, p2.y);
        ctx.fill();

        maxy = p2.y;
    }

    for (let n = startPos + drawDistance - 1; n >= startPos; n--) {
        const segment = segments[n % totalTrackLength];
        if (segment.obstacle !== null && segment.p1.camera.z > cameraDepth) {
            const p1 = segment.p1.screen;
            const obsX = p1.x + (segment.obstacle * p1.w);
            const obsW = p1.w * 0.2; 
            const obsH = p1.w * 0.2; 
            
            ctx.fillStyle = '#ff0055'; 
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff0055';
            ctx.fillRect(obsX - obsW / 2, p1.y - obsH, obsW, obsH);
            ctx.shadowBlur = 0;
        }
    }

    drawPlayer(canvas.width / 2, canvas.height - 30);

    if (isPaused) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#0ff";
        ctx.font = "bold 40px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("PAUSADO", canvas.width / 2, canvas.height / 2);
    }
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