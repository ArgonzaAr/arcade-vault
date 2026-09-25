# Soporte táctil de juegos — estado

Mantenido por el agente `mobile-porter`. Base: `specs/10-controles-tactiles-movil.md` (gamepad
virtual con `KeyboardEvent` sintéticos, campo obligatorio `touchControls` en el registro).

## Estado por juego

| game-id      | Botones           | repeat | Cambios en el motor | Escalado | Estado       | Última revisión |
| ------------ | ----------------- | ------ | ------------------- | -------- | ------------ | --------------- |
| `asteroides` | ← → ↑ · A DISPARO | —      | ninguno             | no       | SPEC 10      | 2026-09-24      |
| `tetris`     | ↑ ↓ ← → · A CAÍDA | ← → ↓  | ninguno             | sí       | SPEC 10      | 2026-09-24      |
| `arkanoid`   | ← →               | —      | ninguno             | no       | SPEC 10      | 2026-09-24      |
| `snake`      | ↑ ↓ ← →           | —      | ninguno             | no       | SPEC 10      | 2026-09-24      |
| `frogger`    | ↑ ↓ ← →           | —      | ninguno             | no       | IMPLEMENTADO | 2026-09-24      |

Estados: `IMPLEMENTADO`, `SPEC 10` (cubierto por la spec 10), `ERROR` (ver historial),
`BLOQUEADO` (necesita cambios en la infraestructura de la spec 10).

## Detalle por juego

### frogger

- Auditoría de entrada: un único listener `keydown` en `document`
  (`app/game/frogger/engine.ts:797`, quitado en `destroy()` en `:819`). `onKeyDown`
  (`engine.ts:772-778`) resuelve la dirección con `KEY_TO_DIRECTION[e.key] ?? KEY_TO_DIRECTION[e.code]`
  (mapa `ArrowUp/Down/Left/Right` en `engine.ts:190-195`), hace `preventDefault` y descarta
  `e.repeat`, pausa y fin. No lee `keyCode`/`which` ni `isTrusted`, no escucha `keyup` ni
  ratón/puntero/touch. Las cuatro direcciones son acciones **por pulsación** (un salto por
  `keydown`, guardado en `pendingDir`); no hay acción principal ni secundaria, y la pausa la
  maneja el reproductor.
- Mapeo elegido: `up`/`down`/`left`/`right` → `KEY_UP`/`KEY_DOWN`/`KEY_LEFT`/`KEY_RIGHT`, sin
  `repeat` y sin `A`/`B` (el valor que ya traía el registro; se confirmó sin cambios).
  Descartado `repeat: true`: con teclado físico el motor ignora `e.repeat` (mantener no encadena
  saltos), pero los `keydown` sintéticos llegan con `repeat = false`, así que el auto-repeat
  haría saltar a la rana en cadena al mantener el botón, con un comportamiento distinto al del
  teclado. Tampoco se declara `A` (no hay acción que asignarle).
- Encaje en pantalla: `screenClassName: "crt-screen--frogger"` (16:15). Se agregó en el bloque
  de la spec 10 de `app/globals.css` `.av-player .crt-screen--frogger { --ar-w: 16; --ar-h: 15; }`.
  No hace falta escalar: `FroggerCanvas.tsx` pinta un único canvas de 640×600 con
  `width/height: 100%` en posición absoluta, sin paneles de tamaño fijo.
- Archivos tocados: `app/globals.css` (regla nueva de 4 líneas dentro del bloque de la spec 10).
  El motor, el canvas y `registry.ts` quedaron sin cambios.
- Verificación: `npx tsc --noEmit -p .` limpio; `npx eslint app/game/registry.ts app/game/frogger`
  sin errores; `npm run build` completo. Emulación por CDP (Chrome headless, `mobile: true` y
  touch emulado) sobre `/game/frogger/play`:
  - 360×740: `pointer: coarse` activo, 4 `.touch-btn` (solo la cruceta), `scrollWidth` 360 = `innerWidth`,
    `.crt-screen` de 309×290 (16:15), gamepad terminando en y = 715 de 740, tablero completo.
  - 740×360: `scrollWidth` 740 = `innerWidth`, borde inferior de `.crt` en 354 ≤ 360, cruceta a la
    izquierda del monitor, tablero completo (234×219).
  - Cada flecha (toque de 500 ms) emite exactamente un `keydown` + un `keyup` con `key`/`code`
    `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`; la rana saltó (puntuación 10 en la captura).
  - Pendiente para el usuario: prueba en un teléfono real (`npm run dev` en la red local), rotar a
    mitad de partida, doble toque en iOS y teclado del teléfono en el modal de fin.
- Propuestas a la spec 10 (no bloqueantes, afectan a todos los juegos con corazones): en
  horizontal, el valor de "Vidas" (`♥ ♥`) se parte en dos líneas y el HUD crece a unos 85 px, lo
  que reduce el monitor. Un `white-space: nowrap` en `.hud-stat .v` dentro del layout
  `.play-stage--sides` lo evitaría.

## Historial

- 2026-09-24 — `asteroides`, `tetris`, `arkanoid`, `snake` — sembrados con estado `SPEC 10` a
  partir de su `touchControls` actual.
- 2026-09-24 — `frogger` — resultado: IMPLEMENTADO; motor sin cambios (ya lee `e.key`/`e.code` en
  `document`), cruceta de 4 direcciones sin `repeat`, proporción 16:15 en móvil, verificado en
  360×740 y 740×360.
