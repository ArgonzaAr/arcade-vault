# GJ-04.1 — Juego Invasores (motor)

**Estado:** Borrador
**Pedido:** "Invasores" — shooter de invasores alienígenas por oleadas, estilo clásico de marcianitos, con nombre genérico propio
**Depende de:** SPEC 05, SPEC 07, SPEC 09
**Fecha:** 2026-09-23

**Objetivo:** Crear desde cero un motor de invasores por oleadas infinitas con render geométrico en `app/game/invasores/engine.ts`, montado en `app/game/invasores/InvasoresCanvas.tsx` con el contrato `GameCanvasComponent` del registro.

## Alcance

**Incluye:**

- Motor escrito desde cero en `app/game/invasores/engine.ts`. No hay motor en `references/started-games/` (solo `02-asteroids`, `03-tetris`, `04-arkanoid`) ni assets en `references/source-assets/` (solo `snake-assets`), así que todo se dibuja con `fillRect` sobre el canvas.
- Componente canvas `app/game/invasores/InvasoresCanvas.tsx` con `<canvas width={800} height={600}>`, mismo contrato `GameCanvasComponent` que `SnakeCanvas`/`ArkanoidCanvas` (props `GameCanvasProps`, ref `GameEngineHandle`).
- Módulo de formas `app/game/invasores/shapes.ts`: bitmaps de 1 bit (arrays de strings `"0"`/`"1"`) para los tres tipos de invasor (dos cuadros de animación cada uno), el cañón y la nave nodriza. Un helper `drawBitmap(ctx, bitmap, x, y, pixelSize, color)` los pinta con `fillRect`.
- Sin archivos en `public/games/invasores/`: el juego no usa imágenes ni sonidos.
- **Cañón del jugador:** se mueve solo en horizontal sobre la fila inferior (`PLAYER_Y = 550`) con `←`/`→` o `A`/`D`, y dispara hacia arriba con `Espacio`. Solo puede haber 1 disparo propio en pantalla a la vez.
- **Formación:** 5 filas × 11 columnas = 55 invasores. La fila 0 es de tipo `squid` (30 puntos), las filas 1-2 de tipo `crab` (20 puntos) y las filas 3-4 de tipo `octopus` (10 puntos).
- **Marcha por pasos:** la formación completa avanza `STEP_X` píxeles de lado cada `stepMs`. Si algún invasor vivo quedaría fuera del margen lateral, en ese paso la formación baja `STEP_DOWN` píxeles e invierte el sentido. Cada paso alterna el cuadro de animación de los invasores.
- **Aceleración por bajas:** `stepMs` se interpola linealmente entre `BASE_STEP_MS` (55 vivos) y `MIN_STEP_MS` (1 vivo), y se multiplica por `WAVE_SPEED_FACTOR` elevado a `wave - 1`.
- **Fuego enemigo:** cada `enemyFireMs`, un invasor al azar de la fila más baja de una columna viva dispara hacia abajo, con un máximo de `MAX_ENEMY_BULLETS` disparos enemigos en pantalla.
- **Búnkeres:** 4 búnkeres destructibles de celdas de 4 px. Cualquier disparo (propio o enemigo) que toca una celda viva se destruye y borra las celdas en un bloque de 3×3 alrededor del impacto. Un invasor que se superpone con un búnker borra las celdas que toca. Los búnkeres se reconstruyen completos al empezar cada oleada.
- **Nave nodriza:** cruza la franja superior (`SAUCER_Y = 40`) de un lado al otro. Aparece cada intervalo aleatorio entre `SAUCER_MIN_INTERVAL_MS` y `SAUCER_MAX_INTERVAL_MS`, solo si quedan al menos `SAUCER_MIN_ALIVE` invasores vivos. Derribarla suma un valor al azar de `SAUCER_POINTS`.
- **Choque entre disparos:** un disparo propio que toca un disparo enemigo destruye ambos, sin sumar puntos.
- **Vidas:** 3 al empezar. Una sola vida extra al alcanzar `EXTRA_LIFE_SCORE` puntos, hasta un máximo de `MAX_LIVES`.
- **Impacto al jugador:** un disparo enemigo que toca el cañón resta 1 vida. La formación y el fuego enemigo se congelan durante `PLAYER_RESPAWN_MS`, se borran todos los disparos enemigos y el cañón reaparece centrado.
- **Oleadas:** al eliminar los 55 invasores se suma `WAVE_CLEAR_BONUS × wave`, `wave` sube 1 y, tras `WAVE_TRANSITION_MS`, aparece una formación nueva. Cada oleada nueva empieza `WAVE_START_Y_STEP` píxeles más abajo, hasta `MAX_WAVE_START_Y`. Durante la transición se dibuja en el canvas el texto `OLEADA N` (no es un overlay de fin de partida).
- **Condición de victoria:** sin victoria: partida infinita. Las oleadas se repiten sin fin con dificultad creciente.
- **Condición de game over:** (a) las vidas llegan a 0, o (b) el borde inferior de cualquier invasor vivo alcanza `INVASION_Y = 530`, sin importar las vidas restantes. Ambos casos van por el mismo `endGame()`, que detiene el loop y llama `onGameOver(score)` una sola vez.
- Ciclo de vida completo: `start`, `pause`, `resume`, `restart`, `destroy` y `forceGameOver` (botón FIN del reproductor).

**Fuera de alcance (para futuras specs):**

- Integración con el catálogo (`GAMES`), el registro (`app/game/registry.ts`), la portada `.cover-invasores` y la migración de Supabase. Todo eso vive en `integracion.md` (GJ-04.2).
- Controles táctiles/móvil.
- Tests automatizados (no hay framework configurado en el repo).
- Cambios a `asteroides`, `tetris`, `arkanoid`, `snake` o a sus specs.
- Cualquier archivo bajo `references/`.
- Sonido y música: el motor no crea ningún `Audio`.
- Power-ups de cualquier tipo (disparo doble, escudo temporal o disparo perforante).
- Invasores que se separan de la formación y se lanzan en picado.
- Modo de dos jugadores alternados.
- Puntuación de la nave nodriza calculada por número de disparos (la del original). Aquí es al azar.
- Tecla de pausa propia del juego: la pausa es solo el botón PAUSA del reproductor.

## Modelo de datos

```ts
// app/game/invasores/engine.ts
export interface InvasoresStats {
  score: number;
  lives: number; // vidas restantes (0..MAX_LIVES)
  wave: number; // oleada actual, empieza en 1
}

export interface InvasoresCallbacks {
  onStats: (stats: InvasoresStats) => void; // se invoca solo cuando cambia algún valor
  onGameOver: (finalScore: number) => void; // se invoca una vez: 0 vidas O invasión alcanza INVASION_Y
}

export interface InvasoresGame {
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void; // detiene el loop y quita listeners de teclado
  forceGameOver: () => void; // botón FIN del reproductor
}

export function createInvasoresGame(
  canvas: HTMLCanvasElement,
  callbacks: InvasoresCallbacks
): InvasoresGame;
```

```ts
// app/game/invasores/InvasoresCanvas.tsx — implementa GameCanvasComponent (registry.ts)
// props: GameCanvasProps { onStats, onGameOver }; ref: GameEngineHandle { pause, resume, restart, forceGameOver }
// Traduce InvasoresStats → GameStats: { score, lives, level: wave }
```

Entidades internas del motor (no se exportan):

```ts
type InvaderKind = "squid" | "crab" | "octopus";

interface Invader {
  kind: InvaderKind;
  col: number; // 0..10
  row: number; // 0..4
  alive: boolean;
  explodingMs: number; // > 0 mientras se dibuja el destello de explosión
}

interface Formation {
  originX: number; // px, esquina superior izquierda de la celda (0,0)
  originY: number;
  dir: 1 | -1; // 1 = derecha, -1 = izquierda
  frame: 0 | 1; // cuadro de animación actual
  stepAccumMs: number;
}

interface Bullet {
  x: number;
  y: number;
  vy: number; // px/s, negativo = hacia arriba
  owner: "player" | "enemy";
}

interface Bunker {
  x: number; // px, esquina superior izquierda
  y: number;
  cells: boolean[][]; // [BUNKER_ROWS][BUNKER_COLS], true = celda viva
}

interface Saucer {
  x: number;
  dir: 1 | -1;
  active: boolean;
  nextSpawnMs: number; // cuenta regresiva hasta la próxima aparición
}
```

Formato de las formas en `app/game/invasores/shapes.ts` (bitmaps propios, genéricos, no copiados de ningún juego comercial):

```ts
export type Bitmap = readonly string[]; // cada string es una fila; "1" = píxel encendido
export const INVADER_BITMAPS: Record<InvaderKind, readonly [Bitmap, Bitmap]>; // 11×8 cada cuadro
export const CANNON_BITMAP: Bitmap; // 13×7
export const SAUCER_BITMAP: Bitmap; // 16×7
```

Constantes de balance (nuevas, sin referencia previa que portar):

```ts
// Tablero
const W = 800; // px
const H = 600; // px
const MAX_DT_MS = 50; // tope de dt por frame, evita saltos tras un freeze del navegador

// Jugador
const PIXEL = 3; // px por píxel de bitmap (invasores, cañón y nave nodriza)
const PLAYER_Y = 550; // px, borde superior del cañón
const PLAYER_SPEED = 300; // px/s
const PLAYER_BULLET_SPEED = 600; // px/s hacia arriba
const PLAYER_FIRE_COOLDOWN_MS = 250; // ms mínimos entre disparos propios
const MAX_PLAYER_BULLETS = 1; // disparos propios simultáneos
const INITIAL_LIVES = 3;
const MAX_LIVES = 6;
const EXTRA_LIFE_SCORE = 1500; // puntos para la única vida extra
const PLAYER_RESPAWN_MS = 1000; // ms de congelamiento tras perder una vida
const GROUND_Y = 580; // px, línea de suelo dibujada

// Formación
const FORMATION_COLS = 11;
const FORMATION_ROWS = 5;
const CELL_W = 48; // px de separación horizontal entre invasores
const CELL_H = 40; // px de separación vertical entre filas
const INVADER_W = 33; // px (11 × PIXEL)
const INVADER_H = 24; // px (8 × PIXEL)
const SIDE_MARGIN = 20; // px libres a cada lado antes de bajar y girar
const STEP_X = 8; // px por paso lateral
const STEP_DOWN = 20; // px por descenso
const BASE_STEP_MS = 800; // ms por paso con 55 invasores vivos
const MIN_STEP_MS = 60; // ms por paso con 1 invasor vivo (y piso absoluto)
const WAVE_SPEED_FACTOR = 0.9; // multiplicador de stepMs por oleada
const WAVE_START_Y = 80; // px, originY de la oleada 1
const WAVE_START_Y_STEP = 20; // px más abajo por cada oleada siguiente
const MAX_WAVE_START_Y = 160; // px, tope del originY inicial
const INVASION_Y = 530; // px, borde inferior de un invasor que dispara game over
const INVADER_EXPLOSION_MS = 150; // ms que dura el destello de un invasor derribado
const POINTS: Record<InvaderKind, number> = {
  squid: 30,
  crab: 20,
  octopus: 10,
};

// Fuego enemigo
const ENEMY_FIRE_BASE_MS = 1200; // ms entre disparos enemigos en la oleada 1
const ENEMY_FIRE_STEP_MS = 100; // ms que se restan por oleada
const ENEMY_FIRE_MIN_MS = 400; // piso del intervalo
const ENEMY_BULLET_BASE_SPEED = 240; // px/s hacia abajo en la oleada 1
const ENEMY_BULLET_SPEED_STEP = 20; // px/s extra por oleada
const ENEMY_BULLET_MAX_SPEED = 400; // px/s
const MAX_ENEMY_BULLETS = 3;
const BULLET_W = 3; // px
const BULLET_H = 12; // px

// Búnkeres
const BUNKER_COUNT = 4;
const BUNKER_CELL = 4; // px por celda
const BUNKER_COLS = 22; // 88 px de ancho
const BUNKER_ROWS = 16; // 64 px de alto
const BUNKER_Y = 440; // px, borde superior
const BUNKER_CENTERS_X = [160, 320, 480, 640]; // px
const BUNKER_DAMAGE_RADIUS = 1; // celdas: el impacto borra un bloque 3×3

// Nave nodriza
const SAUCER_Y = 40; // px
const SAUCER_SPEED = 150; // px/s
const SAUCER_MIN_INTERVAL_MS = 20000;
const SAUCER_MAX_INTERVAL_MS = 30000;
const SAUCER_MIN_ALIVE = 8; // invasores vivos mínimos para que aparezca
const SAUCER_POINTS = [50, 100, 150, 300] as const;

// Oleadas
const WAVE_CLEAR_BONUS = 100; // puntos × número de oleada completada
const WAVE_TRANSITION_MS = 1500; // ms entre oleadas con el texto OLEADA N

// Colores (render geométrico, paleta neón de la plataforma)
const COLORS = {
  squid: "#ff006e",
  crab: "#00f5ff",
  octopus: "#f5ff00",
  cannon: "#00ff88",
  bunker: "#00ff88",
  saucer: "#ff006e",
  playerBullet: "#ffffff",
  enemyBullet: "#f5ff00",
  ground: "#00ff88",
} as const;
```

Fórmulas derivadas:

- `stepMs = max(MIN_STEP_MS, (MIN_STEP_MS + (BASE_STEP_MS - MIN_STEP_MS) × (alive - 1) / 54) × WAVE_SPEED_FACTOR^(wave - 1))`.
- `enemyFireMs = max(ENEMY_FIRE_MIN_MS, ENEMY_FIRE_BASE_MS - (wave - 1) × ENEMY_FIRE_STEP_MS)`.
- `enemyBulletSpeed = min(ENEMY_BULLET_MAX_SPEED, ENEMY_BULLET_BASE_SPEED + (wave - 1) × ENEMY_BULLET_SPEED_STEP)`.
- `originY` inicial de la oleada `n` = `min(MAX_WAVE_START_Y, WAVE_START_Y + (n - 1) × WAVE_START_Y_STEP)`.
- `originX` inicial = `(W - (10 × CELL_W + INVADER_W)) / 2` = 143 px.

## Plan de implementación

1. **`app/game/invasores/shapes.ts`** — definir los tipos `Bitmap`/`InvaderKind`, los bitmaps propios de `squid`/`crab`/`octopus` (11×8, dos cuadros cada uno), `CANNON_BITMAP` (13×7) y `SAUCER_BITMAP` (16×7). Agregar el helper `drawBitmap(ctx, bitmap, x, y, pixelSize, color)`, que recorre filas y columnas y hace un `fillRect` por cada `"1"`. También una función `createBunkerCells(): boolean[][]` que devuelve la matriz 22×16 con las dos esquinas superiores achaflanadas (triángulos de 4 celdas) y un arco de 8×5 celdas vacías abajo al centro.
2. **Motor: estado y arranque (`app/game/invasores/engine.ts`)** — dentro del closure de `createInvasoresGame(canvas, callbacks)`, declarar el estado: `playerX`, `invaders`, `formation`, `bullets`, `bunkers`, `saucer`, `score`, `lives`, `wave`, `extraLifeGranted`, `respawnMs`, `transitionMs`, `enemyFireAccumMs`, `playerFireCooldownMs`, `keys` (`left`/`right`/`fire`) y `over`. Implementar `initWave(n)` (formación nueva en el `originY` de la oleada `n`, búnkeres reconstruidos, disparos borrados, nave nodriza inactiva con `nextSpawnMs` aleatorio) e `initGame()` (`score = 0`, `lives = INITIAL_LIVES`, `wave = 1`, `extraLifeGranted = false`, cañón centrado en `(W - 39) / 2`, `initWave(1)`, `emitStats()`). `emitStats()` compara con los últimos valores emitidos y solo llama `onStats` si algo cambió, como en `app/game/snake/engine.ts`.
3. **Motor: loop con `requestAnimationFrame` y `dt`** — `loop(ts)` calcula `dt = min(MAX_DT_MS, ts - lastTime)` (con `lastTime === null` → `dt = 0`) y llama `update(dt)` y luego `draw()`. `update` tiene tres ramas excluyentes. Si `transitionMs > 0`, solo descuenta la transición. Si `respawnMs > 0`, solo descuenta el respawn, y al llegar a 0 recentra el cañón. Si no, corre la simulación completa: mover el cañón, disparar, mover los disparos, acumular `stepAccumMs` y dar pasos de formación, acumular `enemyFireAccumMs` y hacer disparar a un invasor, mover o hacer aparecer la nave nodriza, y resolver colisiones.
4. **Motor: marcha de la formación** — en cada paso, calcular el `minX`/`maxX` de los invasores vivos. Si `maxX + STEP_X × dir > W - SIDE_MARGIN` o `minX + STEP_X × dir < SIDE_MARGIN`, sumar `STEP_DOWN` a `originY` e invertir `dir`. Si no, sumar `STEP_X × dir` a `originX`. Alternar `frame` y recalcular `stepMs` con la fórmula del modelo de datos. Después de cada paso, borrar las celdas de búnker que se superponen con invasores vivos y comprobar la invasión: si el borde inferior de algún invasor vivo es `>= INVASION_Y`, llamar `endGame()`.
5. **Motor: colisiones y puntuación** — todas las colisiones son AABB. Se comprueban en este orden. (a) Disparo propio contra disparo enemigo: se destruyen ambos. (b) Disparo contra celda viva de búnker: se destruye el disparo y se borran las celdas dentro de `BUNKER_DAMAGE_RADIUS`. (c) Disparo propio contra invasor vivo: `alive = false`, `explodingMs = INVADER_EXPLOSION_MS` y `score += POINTS[kind]`. (d) Disparo propio contra nave nodriza activa: se desactiva, se suma un valor al azar de `SAUCER_POINTS` y se reprograma `nextSpawnMs`. (e) Disparo enemigo contra cañón: `lives -= 1`, se borran los disparos enemigos y `respawnMs = PLAYER_RESPAWN_MS`; si `lives === 0`, se llama `endGame()`. Los disparos que salen del tablero se descartan. Tras sumar puntos, si `!extraLifeGranted && score >= EXTRA_LIFE_SCORE`, se suma 1 vida (tope `MAX_LIVES`) y `extraLifeGranted = true`. Al quedar 0 invasores vivos: `score += WAVE_CLEAR_BONUS × wave`, `wave += 1`, `transitionMs = WAVE_TRANSITION_MS` y, al terminar la transición, `initWave(wave)`. Llamar `emitStats()` tras cada cambio de score, vidas u oleada.
6. **Motor: dibujo** — `draw()` limpia a `#000`. Luego dibuja la línea de suelo en `GROUND_Y`, los búnkeres (una celda viva = un `fillRect` de 4×4), los invasores vivos con `drawBitmap` en su cuadro actual, un destello de explosión (asterisco de 5 líneas) mientras `explodingMs > 0`, la nave nodriza, los disparos (el propio como barra blanca, el enemigo como zigzag de 3 segmentos) y el cañón. Mientras `respawnMs > 0`, el cañón parpadea cada 100 ms. Mientras `transitionMs > 0`, se escribe `OLEADA N` centrado, con color `#f5ff00` y fuente `16px` + la familia leída en `start()` de `getComputedStyle(canvas).getPropertyValue("--pixel")` (la fuente `Press_Start_2P` de `next/font` en `app/layout.tsx`), o `16px monospace` si la variable viene vacía. El canvas no dibuja score, vidas ni overlays de pausa o game over: todo eso lo muestran el `player-hud` y el modal del reproductor.
7. **Listeners y ciclo de vida** — `keydown`/`keyup` sobre `document` se agregan en `start()` y se quitan en `destroy()`. `ArrowLeft`/`a`/`A` → `keys.left`, `ArrowRight`/`d`/`D` → `keys.right`, `Space` (`e.code === "Space"`) → `keys.fire`. Para esas teclas se llama `e.preventDefault()` y así la página no hace scroll. Mientras `keys.fire` esté presionada, el cañón dispara solo si hay menos de `MAX_PLAYER_BULLETS` disparos propios y `playerFireCooldownMs <= 0`. `start()` hace `initGame()` y arranca el loop. `pause()` cancela el `requestAnimationFrame` y pone todas las `keys` en `false`. `resume()` no hace nada si `over`; si no, reinicia `lastTime = null` y retoma el loop sin salto de `dt`. `restart()` detiene el loop, hace `initGame()` (con `over = false`) y vuelve a arrancar. `forceGameOver()` llama `endGame()`. `endGame()` hace return inmediato si `over`; si no, fija `over = true`, detiene el loop, llama `emitStats()` y luego `onGameOver(score)`. `destroy()` detiene el loop y quita ambos listeners. También se escucha `blur` en `window` (agregado en `start()` y quitado en `destroy()`) para poner las `keys` en `false`.
8. **`app/game/invasores/InvasoresCanvas.tsx`** — client component con el mismo patrón que `app/game/snake/SnakeCanvas.tsx`: `forwardRef<GameEngineHandle, GameCanvasProps>`, `useRef` para el `<canvas width={800} height={600}>` y para la instancia del juego, y `useEffect` que llama `createInvasoresGame` y `start()` al montar y `destroy()` al desmontar. `handleStats` traduce `InvasoresStats` a `GameStats` como `{ score, lives, level: wave }`. `useImperativeHandle` expone `pause`/`resume`/`restart`/`forceGameOver`. El canvas usa el mismo `style` absoluto a pantalla completa que `SnakeCanvas`.
9. **Verificación del motor** — con la entrada de registro de GJ-04.2 ya agregada, correr `npm run dev` y abrir `/game/invasores/play`. Comprobar cada criterio de aceptación de abajo jugando al menos una oleada completa y una partida hasta el game over por vidas. Después forzar el game over por invasión dejando bajar la formación sin disparar.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores de tipos ni de lint.
- [ ] `app/game/invasores/engine.ts`, `app/game/invasores/shapes.ts` y `app/game/invasores/InvasoresCanvas.tsx` existen y ninguno importa imágenes ni audio.
- [ ] `←` y `A` mueven el cañón a la izquierda, y `→` y `D` a la derecha, a 300 px/s, sin salir del tablero.
- [ ] `Espacio` dispara hacia arriba. Nunca hay más de 1 disparo propio en pantalla, y entre dos disparos pasan al menos 250 ms.
- [ ] Mantener `Espacio` presionado dispara de forma continua respetando esas dos reglas, y la página no hace scroll con `Espacio` ni con las flechas.
- [ ] La oleada 1 empieza con 55 invasores (5 filas × 11 columnas), con la fila superior en `y = 80`.
- [ ] Derribar un invasor de la fila 0 suma 30 puntos, de las filas 1-2 suma 20 y de las filas 3-4 suma 10.
- [ ] La formación avanza de lado por pasos de 8 px. Al tocar el margen de 20 px baja 20 px e invierte el sentido.
- [ ] Con 55 invasores vivos, la formación da un paso cada 800 ms. Con 1 invasor vivo en la oleada 1, da un paso cada 60 ms.
- [ ] Nunca hay más de 3 disparos enemigos en pantalla a la vez.
- [ ] Un disparo propio que toca un disparo enemigo destruye ambos y no suma puntos.
- [ ] Los 4 búnkeres pierden un bloque de 3×3 celdas en cada impacto de disparo, pierden celdas cuando un invasor los atraviesa y aparecen completos al empezar cada oleada.
- [ ] La nave nodriza aparece solo con 8 o más invasores vivos, cruza la franja `y = 40`, y derribarla suma 50, 100, 150 o 300 puntos.
- [ ] Un disparo enemigo que toca el cañón resta 1 vida, borra los disparos enemigos, congela la formación 1000 ms y recentra el cañón.
- [ ] Al alcanzar 1500 puntos se suma 1 vida, una sola vez por partida, sin pasar de 6.
- [ ] Eliminar los 55 invasores suma `100 × oleada`, muestra `OLEADA N` durante 1500 ms y arranca una formación nueva 20 px más abajo (tope `y = 160`).
- [ ] En cada oleada nueva el intervalo de fuego enemigo baja 100 ms (piso 400 ms) y la velocidad de los disparos enemigos sube 20 px/s (tope 400 px/s).
- [ ] `onStats` entrega `score`, `lives` y `wave` actualizados, y `InvasoresCanvas` los traduce a `GameStats` con `level = wave`.
- [ ] Perder la última vida llama `onGameOver(score)` exactamente una vez.
- [ ] Que el borde inferior de un invasor vivo alcance `y = 530` llama `onGameOver(score)` exactamente una vez, aunque queden vidas.
- [ ] `forceGameOver()` llama `onGameOver(score)` exactamente una vez, y una segunda llamada no vuelve a disparar el callback.
- [ ] El canvas nunca dibuja un overlay de game over ni de pausa. El único texto que dibuja es `OLEADA N` entre oleadas.
- [ ] `pause()` congela todo, y `resume()` retoma sin que la formación, los disparos ni la nave nodriza salten de posición.
- [ ] Soltar una tecla mientras el juego está pausado o la ventana pierde el foco no deja el cañón moviéndose solo al reanudar.
- [ ] `restart()` deja el estado exacto del inicio: score 0, 3 vidas, oleada 1, 55 invasores en `y = 80`, 4 búnkeres completos, sin disparos y cañón centrado.
- [ ] Después de `destroy()` no quedan un `requestAnimationFrame` activo ni los listeners de `keydown`/`keyup`/`blur`.
- [ ] Ningún archivo bajo `references/` fue modificado.

## Decisiones tomadas y descartadas

- **Sí:** motor escrito desde cero con render geométrico (bitmaps de 1 bit pintados con `fillRect`). `references/started-games/` no tiene un motor de invasores y `references/source-assets/` solo trae `snake-assets`. Decidida por game-jam a partir del pedido — revisar.
- **Sí:** bitmaps propios y genéricos en `app/game/invasores/shapes.ts`, no calcados de ningún juego comercial, a juego con el nombre genérico. Decidida por game-jam a partir del pedido — revisar.
- **No:** usar sprites PNG. No existen en el repo y agregarlos saldría del alcance de una spec de motor.
- **Sí:** oleadas infinitas sin condición de victoria. Así el score crece sin techo y es comparable en el leaderboard. Decidida por game-jam a partir del pedido — revisar.
- **No:** un número fijo de oleadas con victoria final (patrón de arkanoid). Pondría un techo artificial al score.
- **Sí:** dos caminos de derrota (0 vidas o invasión en `y = 530`) que pasan por un único `endGame()` protegido con `over`, como el único camino de fin de partida de arkanoid. Decidida por game-jam a partir del pedido — revisar.
- **Sí:** stats `{ score, lives, wave }`, con vidas como stat secundario (corazones) y la oleada en el slot `level` del HUD. Las vidas no duplican el score. Decidida por game-jam a partir del pedido — revisar.
- **Sí:** 1 disparo propio en pantalla como máximo, más un cooldown de 250 ms. Mantiene la tensión clásica de apuntar y evita que mantener `Espacio` limpie la formación sola. Decidida por game-jam a partir del pedido — revisar.
- **Sí:** controles `←`/`→` + `A`/`D` para moverse y `Espacio` para disparar. Son el mismo par flechas + WASD que `snake` y la tecla de disparo de `asteroides`. Decidida por game-jam a partir del pedido — revisar.
- **No:** control por mouse. Apuntar en un solo eje ya lo cubre arkanoid y no aporta a este juego.
- **Sí:** búnkeres destructibles que se reconstruyen en cada oleada. Son la mecánica que más distingue a este juego de `asteroides` y `arkanoid` (ver la nota de redundancia en `references/game-ideas.md` § INVASORES). Decidida por game-jam a partir del pedido — revisar.
- **Sí:** nave nodriza con puntos al azar entre 50, 100, 150 y 300. Aporta un objetivo de riesgo y recompensa para el leaderboard. Decidida por game-jam a partir del pedido — revisar.
- **No:** puntuación de la nave nodriza según el número de disparos, como en el original. Es un truco oculto sin valor para esta plataforma.
- **Sí:** una sola vida extra a los 1500 puntos. Decidida por game-jam a partir del pedido — revisar.
- **Sí:** congelar la formación 1000 ms tras perder una vida y borrar los disparos enemigos. Evita perder dos vidas seguidas por disparos que ya estaban en el aire. Decidida por game-jam a partir del pedido — revisar.
- **Sí:** texto `OLEADA N` dibujado en canvas entre oleadas. No es un overlay de fin de partida y no hay otra UI del reproductor que marque el cambio de oleada. Decidida por game-jam a partir del pedido — revisar.
- **No:** sonido. Ningún juego sin assets de referencia lo tiene, y el autoplay agrega riesgo sin aportar al leaderboard.
- **Sí:** tope `MAX_DT_MS = 50` por frame. La marcha por pasos y los disparos rápidos atravesarían búnkeres o invasores con un `dt` grande.
- **Sí:** todos los valores de balance fijados aquí son números de partida razonables, ajustables en la verificación manual (paso 9) sin invalidar el resto de la spec. Decidida por game-jam a partir del pedido — revisar.

## Riesgos identificados

| Riesgo                                                                                                                                                  | Mitigación                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un disparo rápido (600 px/s) puede atravesar un búnker o un invasor sin colisionar si el `dt` de un frame es grande (efecto túnel)                      | `dt` se limita a `MAX_DT_MS = 50` (30 px por frame como máximo, menos que la altura de un invasor), y la colisión con búnker se comprueba en todas las celdas que cubre el rectángulo del disparo, no solo en su punto central. |
| Teclas "pegadas": si se suelta una tecla mientras el juego está pausado o la ventana sin foco, `keyup` no llega y el cañón sigue moviéndose al reanudar | `pause()` y el listener de `blur` en `window` ponen todas las `keys` en `false`. Hay un criterio de aceptación dedicado.                                                                                                        |
| Dos caminos de derrota (vidas e invasión) más el botón FIN pueden llamar `onGameOver` más de una vez en el mismo frame                                  | Todo pasa por `endGame()`, que hace return si `over` ya es `true`. `update` deja de procesar colisiones en cuanto `over` cambia.                                                                                                |
| Borrar celdas de búnker celda por celda en cada paso de la formación y en cada disparo puede costar CPU con 4 × 22 × 16 celdas                          | Solo se recorren las celdas dentro del rectángulo de intersección entre el invasor o disparo y el búnker (cálculo por índice, sin recorrer la matriz completa).                                                                 |

## Qué **no** está en esta spec

- Catálogo, registro, portada `.cover-invasores` y migración de Supabase (van en GJ-04.2, `integracion.md`).
- Controles táctiles/móvil.
- Tests automatizados.
- Sonido y música.
- Power-ups e invasores que se lanzan en picado.
- Modo de dos jugadores.
- Cambios a otros juegos o a cualquier archivo bajo `references/`.

Cada uno de estos, si se necesita, va en su propia spec.
