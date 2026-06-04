# NightDriver: Neon Overdrive - Documentación para Desarrollo y Diseño

Este es el repositorio oficial de **NightDriver: Neon Overdrive**, un juego *Endless Runner* con estilo Pseudo-3D (Raster Road / Outrun style) y estética Cyberpunk/Neón, desarrollado con **HTML5 Canvas y Vanilla JavaScript**.

## 1. Stack Tecnológico
- **Lenguaje:** Vanilla JavaScript (sin frameworks).
- **Renderizado:** HTML5 Canvas API (renderizado pseudo-3D mediante proyección trapezoidal).
- **Audio:** Procedural Web Audio API (no requiere archivos externos).
- **UI:** CSS3 + HTML estático.

## 2. Arquitectura del Motor (`game.js`)
- **Renderizado:** Basado en segmentos. El mundo se divide en `totalTrackLength = 1000`. La función `project()` convierte coordenadas 3D a 2D basándose en la profundidad (`cameraDepth`).
- **Bucle de Juego:** `requestAnimationFrame` que separa `update()` (física/lógica) y `draw()` (renderizado).
- **Pista:** Infinita, mediante el operador módulo sobre la posición del jugador.
- **Audio:** Sistema procedural de dos capas con Web Audio API:
    - `engineOsc`: Oscilador `sawtooth` filtrado (LowPass) que simula **6 marchas/cambios de velocidad**. La frecuencia de revoluciones sube y cae dinámicamente según la velocidad relativa del carro.
    - `Música 8-bit`: Oscilador `square` que reproduce arpegios procedurales mediante `setInterval`.
    - `playCrashSound()`: Efecto de explosión de choque de 8-bits generado con ruido blanco y filtro `lowpass` de 800Hz durante 0.5s.

## 3. Guía de Integración para el Equipo de Diseño (Sprites)

Si tu equipo va a reemplazar los gráficos vectoriales por imágenes (`.png`/`.webp`), deben seguir estas directrices:

### 1. Sistema de Renderizado de Obstáculos
Actualmente, los obstáculos se dibujan como rectángulos rojos en la función `draw()`:
```javascript
// Dentro del bucle de dibujo de obstáculos
const obsX = p1.x + (segment.obstacle * p1.w);
const obsW = p1.w * 0.2; // Ancho dinámico basado en profundidad
const obsH = p1.w * 0.2; // Alto dinámico
// Reemplazar ctx.fillRect por ctx.drawImage(myImage, obsX - obsW/2, p1.y - obsH, obsW, obsH)
```
*   **Requisito:** Usar `ctx.drawImage()`. Deben respetar el cálculo dinámico de `obsW` y `obsH` para mantener la ilusión 3D.

### 2. Sistema de Renderizado del Jugador
El coche se dibuja en la función `drawPlayer(x, y)`.
*   **Requisito:** Reemplazar el dibujo vectorial por `ctx.drawImage()`.
*   **Tip:** Implementar lógica de *Sprite Sheets* o rotación mediante `ctx.rotate()` para que el coche se incline al girar (usando `playerX`).

### 3. Precarga (Performance)
Dado que es Vanilla JS:
*   Deben implementar una función `preloadImages()` que cree instancias de `new Image()` y espere a que todas carguen antes de llamar a `gameLoop()`. 
*   Todas las imágenes deben tener fondo transparente.

---

## 4. Dificultad Dinámica y Física
- **Generación de Obstáculos (Evita Agrupamiento):** Se generan por grupos de 1 o 2 carros con una distancia de enfriamiento (cooldown) de 30-45 segmentos (grupo de 1) o 45-60 segmentos (grupo de 2) para evitar aglomeración. La probabilidad de aparición del grupo es dinámica:
  ```javascript
  let probability = 0.10 + Math.min(score / 1500, 1) * 0.25; // Rango de 10% a 35%
  ```
- **Velocidad Infinita:** `maxSpeed` se mantiene estable en 300 KM/H para permitir un juego infinito y controlado en base a la habilidad, eliminando la aceleración automática desmedida.
- **Física de Dirección:** Solo se permite mover el coche de izquierda a derecha cuando el coche está en movimiento (`speed > 0`).
- **Colisiones Robustas:** Detectadas mediante `Math.abs(playerX - currentSegment.obstacle) < 0.18` (0.10 del obstáculo + 0.08 de la mitad del coche). Las colisiones se evalúan y limpian de forma secuencial hacia atrás para evitar atravesar objetos al viajar a altas velocidades.

## 5. Nuevas Funcionalidades
- **Sistema de Pausa:** Presionando la tecla **P** se congela la carrera, se pausa el audio del motor y se dibuja un filtro de pantalla semitransparente con el texto "PAUSADO".
- **Top 5 Récords Locales:** Al chocar, el juego ordena y guarda los 5 mejores puntajes utilizando `localStorage` (`nightdriver_topscores`), mostrando una tabla interactiva con el récord actual destacado.

## 6. Notas Importantes para el equipo
1. **No cargar desde el file system:** Debido a las políticas de seguridad de los navegadores (CORS), no abran `index.html` directamente. Usen un servidor local (`python3 -m http.server 8000`).
2. **Audio:** El sistema de audio se inicializa al hacer clic en "INICIAR CARRERA" (se requiere una interacción del usuario para que el navegador desbloquee el audio).
3. **Limpieza:** No eliminar `resetTrack()` ni `initAudio()` al inicio de `game.js`, ya que causan errores de ejecución en el motor.
