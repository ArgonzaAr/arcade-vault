# Rendimiento de juegos — estado

Mantenido por el agente `game-performance`. Referencia: `specs/11-frogger-rendimiento.md`
(paso fijo, loop detenido en pausa, sprites y capas cacheadas, cero `shadowBlur` por frame).

## Estado por juego

| game-id   | FPS antes (1× / 4×) | FPS después (1× / 4×) | Paso fijo | Sprites/capas | shadowBlur/frame | Estado     | Última revisión |
| --------- | ------------------- | --------------------- | --------- | ------------- | ---------------- | ---------- | --------------- |
| `frogger` | —                   | —                     | 1/120 s   | sí            | 0                | SPEC 11    | 2026-09-25      |
| `snake`   | 60 / 60             | 60 / 60               | 1/120 s   | sí            | 0                | OPTIMIZADO | 2026-09-25      |

Estados: `OPTIMIZADO`, `AUDITADO` (solo auditoría, sin cambios), `OK` (ya cumplía la meta),
`SPEC 11` (cubierto por la spec 11), `ERROR` (ver historial), `PROPUESTA` (la meta necesita
cambios fuera de los límites del agente).

## Detalle por juego

### frogger

- Cubierto por `specs/11-frogger-rendimiento.md` (implementación de referencia en
  `app/game/frogger/engine.ts` y `app/game/frogger/FroggerCanvas.tsx`). Sin revisión propia de
  este agente.

### snake

- Auditoría (2026-09-25, sobre el código previo; líneas del archivo original):
  - **Alto** — `engine.ts:303-330`: `draw()` redibuja toda la escena en cada frame de rAF (60/s)
    aunque la escena solo cambia en cada paso de la víbora (cada 60-150 ms, ≤ 17/s): ~75-90 % de
    los frames repintan lo mismo.
  - **Medio** — `engine.ts:255` y `engine.ts:267`: `"seg:" + color` / `"fruit:" + name` y una
    closure `() => {...}` nuevas por segmento y por frame en `neon` (strings y closures por frame,
    crecen con la longitud de la víbora).
  - **Medio** — `engine.ts:323-328`: en `clasico`/`retro` cada segmento cambia `fillStyle` (dos
    veces por segmento en `retro`), con parseo de color por asignación.
  - **Medio** — `engine.ts:336-354`: el acumulador consume `tickMs` sin tope de pasos por frame;
    tras un frame largo (GC, pestaña lenta) la víbora avanza varias celdas de golpe sin que se vea
    ni se pueda girar. La simulación ya era discreta y no depende de la tasa de refresco.
  - **Bajo** — `engine.ts:146`: contexto 2D sin `{ alpha: false }` con tablero opaco en las tres
    skins.
  - **Bajo** — `spritesheet.ts:64` (vía `engine.ts:294`): en `clasico` la fruta se escala cada
    frame desde la hoja de 3000 px (110×160 → 20×20).
  - **Bajo** — `engine.ts:403-405`: `pause()` detiene el loop pero no pinta un frame (sin efecto
    visible: el último frame ya está en pantalla).
  - **Bajo** — `engine.ts:177-178`: `isOccupied` usa `snake.some` con closure; corre por paso
    (≤ 17/s), no por frame. Se deja igual.
  - Sin hallazgo: `startLoop()` ya evita cadenas duplicadas (`engine.ts:359`, corrección de la
    spec 11); el loop se detiene en game over y en `destroy()` y el listener se limpia;
    `emitStats` solo llama a `onStats` cuando cambian los valores; `SnakeCanvas.tsx` no tiene
    `ResizeObserver` ni re-renders por frame; `neon` ya horneaba el glow con `withGlow` (0
    `shadowBlur` por frame antes y después).
- Plan aplicado (numeración de la spec 11):
  1. Paso fijo y contexto opaco — **aplicado**. `update(STEP_MS)` con `STEP_MS = 1000/120` hasta
     `MAX_STEPS_PER_FRAME = 12` y descarte del sobrante; `update` avanza un reloj `tickElapsed` y
     mueve la víbora cada `tickMs` con el mismo orden que antes (paso y luego resta del `tickMs`
     vigente), así que el periodo medio entre pasos no cambia. `{ alpha: false }`.
  2. Loop detenido en pausa — **aplicado** (ya se detenía): `pause()` ahora pinta un frame;
     `startLoop()` reinicia `lastTime`, `accumulator` y `tickElapsed` (como antes, el progreso
     hacia el siguiente paso se reinicia al reanudar); `setSkin` repinta si el loop está detenido.
  3. Sin asignaciones por frame — **aplicado**: claves de caché constantes (`seg:head`,
     `seg:body`, `FRUIT_CACHE_KEYS`), pintores definidos una vez, sprites de cabeza/cuerpo
     obtenidos una vez por `draw()`; coordenadas enteras (celdas × 20, `pad` entero).
  4. Infraestructura del caché — **aplicado**: `getSprite(key, w, h, glowColor, paint)` con
     `withGlow` si `palette.glow > 0`, devuelve `{ sprite, pad }`; `setSkin` vacía `spriteCache`.
  5. Entidades como sprites — **aplicado**: la fruta es sprite en las tres skins (`clasico` usa el
     mismo `recolorSprite` sin mapa que ya usaba `neon`).
  6. Jugador como sprite — **aplicado**: `seg:head` y `seg:body` (con el cuadro interior en
     `retro`) en todas las skins; por frame solo `drawImage`.
  7. Fondo cacheado — **no aplica**: el fondo es un color sólido; un `fillRect` cuesta menos que
     `drawImage` de una capa de 800 × 600.
  8. HUD cacheado — **no aplica**: el HUD está en React (play-page), no en el canvas.
  9. Sin `shadowBlur` por frame — **ya cumplía** (glow horneado con `withGlow` desde
     `skin-designer`); se conserva.
  10. Contador de FPS — **aplicado**: `SnakeOptions.showFps`, promedio cada `FPS_SAMPLE_MS`,
      `FPS <n>` abajo a la izquierda con el color de la cabeza; `SnakeCanvas.tsx` lo pasa desde
      `?fps=1`.
  11. Bug de pausa — **ya cumplía**: `startLoop()` empieza con
      `if (animationFrameId !== null) return;` y `togglePause`
      (`app/game/[id]/play/page.tsx:117-124`) llama al motor fuera del updater de `setPaused`.
  - Extra: **redibujo solo cuando cambia la escena** (`needsDraw`): se marca en cada paso de la
    víbora, en `initGame`, al cargar la hoja de frutas, en `setSkin` con el loop activo y al
    rearmar la etiqueta de FPS. Justificado por el hallazgo alto; no hay animación entre pasos,
    así que el aspecto es el mismo.
- Criterios de aceptación (adaptados de la spec 11):
  - [x] `npm run build` sin errores de TypeScript ni de ESLint (`npx eslint app/game/snake/`
        limpio).
  - [x] Solo cambian archivos de `app/game/snake/` (más este archivo de estado).
  - [x] `shadowBlur` no se asigna en `draw` ni en lo que llama por frame (grep: solo aparece en
        comentarios; el glow está en `withGlow`). Medido: 0 asignaciones por frame en las tres
        skins.
  - [x] `/game/snake/play?fps=1` muestra el contador; sin el parámetro no aparece (capturas).
  - [x] Chrome sin throttling ≥ 58 fps en todas las skins (10 s por skin en headless; pendiente
        repetir 30 s en navegador real).
  - [x] Chrome con CPU 4× ≥ 30 fps en todas las skins (10 s por skin en headless; ídem).
  - [ ] Firefox escritorio ≥ 55 fps en `neon` — pendiente manual.
  - [ ] Safari iOS y Chrome Android ≥ 30 fps con el gamepad táctil visible — pendiente manual.
  - [x] Con CPU 6×, la entidad de referencia (cabeza de la víbora, 40 pasos) mantiene el periodo:
        148,2 ms a 1× vs 148,0 ms a 6× (−0,1 %). Sin temporizadores propios.
  - [x] Colisiones con CPU 6×: el movimiento es de una celda por paso y la auto-colisión se
        comprueba en cada paso; con el tope de 12 pasos fijos (100 ms) hay como máximo 2 pasos
        por frame a velocidad máxima, sin saltos de celdas. No hay entidades que puedan atravesar
        (verificado por análisis; la auto-colisión no se forzó en headless).
  - [x] En pausa no hay frames del juego durante 5 s (0 llamadas a rAF y 0 dibujos); REANUDAR
        continúa sin salto.
  - [x] PAUSA → REANUDAR ×3: cada pausa congela (0 rAF) y en marcha hay una sola cadena (1 rAF
        por frame).
  - [x] Cambio de skin en partida (fondo `neon` inmediato), en pausa (repinta 1 frame) y tras el
        game over (fondo `retro`) sin cambiar puntuación, longitud ni nivel.
  - [x] Todas las skins se ven igual que la línea base: región de la víbora idéntica píxel a
        píxel en `clasico`, `neon` (glow incluido) y `retro`; fruta de `clasico` con el nuevo
        camino: 5 de 6 sprites idénticos y `apple` con 2 canales a ±1 nivel (imperceptible).
  - [x] La mecánica no cambia: mismo tick (150 → 60 ms), crecimiento, puntuación, wrap, control
        (ArrowUp verificado con `KeyboardEvent` sintético) y reinicio del progreso del tick al
        reanudar.
- Medición (2026-09-25): Chrome 64-bit headless (`--headless=new`) por CDP sobre
  `next start -p 3101` (el 3100 estaba ocupado por otro proceso), `/game/snake/play?fps=1`, 10 s
  por skin; FPS con un `requestAnimationFrame` inyectado; instrumentación de
  `CanvasRenderingContext2D.prototype` (setter de `shadowBlur`, `drawImage`, `fillRect`,
  `fillText`) solo en el canvas visible. Víbora de longitud 3 (sin comer): en headless los FPS
  absolutos son orientativos y quedan en el tope de 60.

  | Skin    | FPS antes 1× / 4× | FPS después 1× / 4× | Llamadas/frame antes (drawImage + fillRect) | Llamadas/frame después (drawImage + fillRect + fillText) | shadowBlur/frame |
  | ------- | ----------------- | ------------------- | ------------------------------------------- | -------------------------------------------------------- | ---------------- |
  | clasico | 60,0 / 60,0       | 60,0 / 60,0         | 1 + 4                                       | 0,57 + 0,14 + 0,14                                       | 0 → 0            |
  | neon    | 60,1 / 60,0       | 59,9 / 60,0         | 4 + 1                                       | 0,56 + 0,14 + 0,14                                       | 0 → 0            |
  | retro   | 60,0 / 59,9       | 60,0 / 60,0         | 1 + 6                                       | 0,56 + 0,14 + 0,14                                       | 0 → 0            |

  Tras el cambio se redibuja en ~14 % de los frames (≈ 6,7 pasos/s + 2 refrescos de la etiqueta
  de FPS); sin `?fps=1` bajan a ≈ 11 % (estimado, no medido). El costo por redibujo es 1 `fillRect` + 1 `drawImage` por
  segmento y fruta, sin cambios de `fillStyle` por segmento. Pausa: 0 rAF y 0 dibujos en 5 s;
  PAUSA → REANUDAR ×3 con 1 rAF por frame. Periodo de paso 1× vs 6×: 148,2 / 148,0 ms (antes
  148,2 / 147,8 ms).

- Archivos tocados: `app/game/snake/engine.ts`, `app/game/snake/SnakeCanvas.tsx`.
  `spritesheet.ts` sin cambios (`drawFruit` queda exportado pero ya no lo usa el motor).
- Riesgos: la velocidad máxima es `MIN_TICK_MS = 60` (una celda por paso), así que ninguna
  entidad avanza más de una celda por paso en ningún nivel. `MAX_STEPS_PER_FRAME` deja cámara
  lenta por debajo de ~10 fps (aceptado, como en la spec 11). El caché es perezoso (≤ 8 sprites
  por skin).
- Propuestas (infraestructura común o balance): ninguna necesaria para la meta. El contador de
  FPS común para todos los juegos sigue fuera de alcance (spec propia).
- Pendientes manuales: Firefox escritorio (`neon`), Safari iOS y Chrome Android con
  `?fps=1` y el gamepad visible durante 30 s; DevTools → Performance para confirmar que la pausa
  no genera frames; una partida larga (víbora > 100 segmentos) con CPU 4× en DevTools.

## Historial

- 2026-09-25 — `frogger` — sembrado con estado `SPEC 11` a partir de
  `specs/11-frogger-rendimiento.md`.
- 2026-09-25 — `snake` — modo directo — resultado: OPTIMIZADO; paso fijo 1/120 s con tope,
  `{ alpha: false }`, sprites `seg:*`/`fruit:*` en las tres skins, redibujo solo al cambiar la
  escena y contador `?fps=1`; 60/60 fps antes y después en headless, llamadas de dibujo por frame
  −85 %, 0 `shadowBlur` por frame, aspecto idéntico a la línea base.
