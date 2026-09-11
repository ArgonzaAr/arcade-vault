# 07 — Juego Tetris (segundo juego real, con registro de motores)

**Estado:** Aprobado
**Depende de:** SPEC 04, SPEC 05, SPEC 06
**Fecha:** 2026-09-11

**Objetivo:** Portar el juego de `references/started-games/03-tetris/game.js` a TypeScript, montarlo como segundo juego jugable real en `/game/tetris/play` con leaderboard en Supabase, y generalizar el `if (id === "asteroides")` actual a un registro de motores por id.

## Alcance

**Incluye:**

- Crear `app/game/registry.ts`: un registro por id (`Record<string, { Canvas, hasRealLeaderboard: boolean }>` o forma equivalente) que reemplaza los tres condicionales `game.id === "asteroides"` hoy hardcodeados en:
  - `app/game/[id]/play/page.tsx` (líneas 10-11, 23, 99: import de `AsteroidsCanvas`/`AsteroidsStats`, `isAsteroids`, `insertScore("asteroides", ...)`).
  - `app/game/[id]/page.tsx` (líneas 15-16: `id === "asteroides" ? await getTopScores("asteroides", 10) : ...`).
  - `app/hall-of-fame/page.tsx` (líneas 16, 26, 28, 37: `asteroidesRows`, `tab !== "asteroides"`, `getTopScores("asteroides", 12)`, `tab === "asteroides" ? asteroidesRows : seeded`).
    El comportamiento para `asteroides` y para cualquier id sin entrada real (sigue con `seededScores`/`localStorage`) no cambia.
- Nueva entrada `tetris` en `GAMES` (`app/lib/data.ts`), distinta y sin relación con la entrada mock existente `caida` (que sigue existiendo tal cual, sin tocarse).
- Port del motor de juego (`board`, `randomPiece`, `collide`, `rotateCW`/`tryRotate`, `merge`, `clearLines`, `ghostY`, `hardDrop`/`softDrop`/`lockPiece`, constantes `COLS`/`ROWS`/`BLOCK`/`COLORS`/`PIECES`/`LINE_SCORES`) a un módulo TypeScript nuevo, sin cambiar la mecánica: tablero 10×20, 8 tipos de pieza (incluida la pieza `N` "tuerca" de 3×3), wall kicks `[0,-1,1,-2,2]` al rotar, pieza fantasma (ghost) a `alpha 0.2`, puntuación por línea (`LINE_SCORES × level`), +2/celda en hard drop, +1/fila en soft drop, velocidad de caída `max(100, 1000 - (level-1)*90)` ms, nivel = `floor(lines/10)+1`, panel de siguiente pieza (next-canvas 120×120).
- Controles: solo teclado, idénticos al original (`←`/`→` mover, `↓` soft drop, `↑` o `X` rotar, `Espacio` hard drop). La tecla `P` de pausa interna del original **no** se porta — la pausa se controla solo desde el botón PAUSA del reproductor, igual que Asteroides.
- Integración con el reproductor existente vía el registro nuevo (punto 1): para `id === "tetris"`, el `.crt-screen` monta el canvas real del juego en vez del `.game-arena` simulado.
- Canvas del tablero a resolución nativa 300×600 (10×30 + 20×30), centrado dentro de su contenedor, sin forzar el `aspect-ratio: 4/3` que usa hoy `.crt-screen` para Asteroides — este juego usa una variante de contenedor más angosta (ver plan de implementación, paso de CSS).
- El `player-hud` existente (Jugador/Puntuación/Vidas/Nivel) se reutiliza tal cual; el slot "Vidas" muestra el número de líneas eliminadas (`lines`) para este juego — sin ocultar el campo ni renombrar el label globalmente.
- Los botones existentes PAUSA / FIN / SALIR controlan el juego real: PAUSA detiene el loop (`requestAnimationFrame`), FIN fuerza el fin de partida y dispara el modal de guardar puntuación ya existente, SALIR desmonta el canvas (limpiando listeners y el loop) y navega como hoy.
- Fin de partida: se dispara cuando una pieza nueva (`spawn()`) colisiona de inmediato contra el tablero (tablero lleno en la zona de aparición) — equivalente exacto a `endGame()` del original. Reutiliza el modal (`over`) y el flujo de guardado ya existentes. El overlay interno de "GAME OVER"/"PAUSA" que dibuja el `game.js` original queda reemplazado por ese modal — no se muestran ambos a la vez.
- "JUGAR DE NUEVO" en el modal reinicia el motor real (tablero vacío, score/lines en 0, nivel 1), no solo el estado de React.
- Leaderboard real vía Supabase para `tetris`, igual patrón que Asteroides: fila de siembra nueva en una migración bajo `supabase/migrations/` (no se toca la migración de SPEC 06), y las mismas cuatro funciones de `app/lib/supabase/queries.ts`/`queries.client.ts` (`getGames`, `getGameBySlug`, `getTopScores`, `insertScore`) funcionando para el slug `tetris` sin cambios de código en esas funciones (ya son genéricas por slug).
- Nueva regla CSS `.cover-tetris` en `app/globals.css` para la tarjeta/portada de esta entrada (mismo tratamiento visual que `.cover-tetro`, como clase independiente).

**Fuera de alcance (para futuras specs):**

- Controles táctiles/móvil.
- Tests automatizados (no hay framework configurado en el repo).
- Cualquier cambio a la entrada mock `caida` existente.
- Portar o tocar otros juegos de `references/started-games/` — esta spec es exclusivamente Tetris.
- Ajustes de balance/dificultad respecto al original (puntajes, velocidad de caída, wall kicks, etc.).
- Tema claro/oscuro del `theme-toggle` del `index.html` original — el reproductor ya tiene su propio tema, no se porta ese selector.
- Modificar el registro para ningún otro id existente más allá de generalizar los tres condicionales de Asteroides (punto 1 del alcance) — el resto del catálogo mock sigue exactamente igual.

## Modelo de datos

No se introduce persistencia nueva más allá de la tabla `scores`/`games` ya creada en SPEC 06 (se reutiliza, solo se agrega una fila de siembra). Se agregan tipos de integración entre el motor portado y React:

```ts
// app/game/tetris/engine.ts
export interface TetrisStats {
  score: number;
  lines: number;
  level: number;
}

export interface TetrisCallbacks {
  onStats: (stats: TetrisStats) => void; // se invoca solo cuando cambia algún valor, no por frame
  onGameOver: (finalScore: number) => void; // se invoca una vez cuando spawn() colisiona de inmediato
}

export interface TetrisGame {
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void; // detiene el loop y quita listeners de teclado
}

export function createTetrisGame(
  boardCanvas: HTMLCanvasElement,
  nextCanvas: HTMLCanvasElement,
  callbacks: TetrisCallbacks
): TetrisGame;
```

```ts
// app/game/tetris/TetrisCanvas.tsx — API expuesta vía ref al contenedor
export interface TetrisCanvasHandle {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  forceGameOver: () => void;
}
```

```ts
// app/game/registry.ts
export interface GameRegistryEntry {
  Canvas: React.ComponentType<{
    onStats: (stats: unknown) => void;
    onGameOver: (finalScore: number) => void;
    ref: React.Ref<{
      pause: () => void;
      resume: () => void;
      restart: () => void;
      forceGameOver: () => void;
    }>;
  }>;
  hasRealLeaderboard: boolean; // true → usa getTopScores/insertScore contra Supabase; false → seededScores/localStorage
}

export const gameRegistry: Record<string, GameRegistryEntry> = {
  asteroides: { Canvas: AsteroidsCanvas, hasRealLeaderboard: true },
  tetris: { Canvas: TetrisCanvas, hasRealLeaderboard: true },
};
```

`app/lib/data.ts` gana una entrada más en `GAMES` (mismo tipo `Game` existente, sin cambios de forma):

```ts
{
  id: "tetris",
  title: "TETRIS",
  short: "Encaja piezas antes de que el tablero se desborde.",
  long: "Ocho tipos de pieza caen por un tablero de 10x20. Rótalas con wall kicks, usa la pieza fantasma para apuntar y limpia líneas para subir de nivel. La velocidad de caída aumenta cada 10 líneas.",
  cat: "PUZZLE",
  cover: "cover-tetris",
  color: "cyan",
  best: 0,
  plays: "0",
}
```

Migración de siembra: se agrega una fila nueva a `public.games` (mismo esquema de SPEC 06) para `slug: "tetris"`, con los mismos valores de arriba, en una migración SQL nueva y separada (no se edita `<timestamp>_games_scores.sql`).

## Plan de implementación

1. **`app/game/registry.ts`** — crear el registro generalizando los tres condicionales `id === "asteroides"` de `app/game/[id]/play/page.tsx`, `app/game/[id]/page.tsx` y `app/hall-of-fame/page.tsx`. Cada archivo pasa a hacer `gameRegistry[id]` (o `gameRegistry[game.id]`) en vez de comparar contra el string `"asteroides"` literal; si no hay entrada, el comportamiento es el mock actual (arena simulada, `seededScores`, `localStorage`). Verificar en este mismo paso que Asteroides sigue funcionando igual (build + recorrido manual básico) antes de seguir.
2. **Motor portado** — crear `app/game/tetris/engine.ts`: portar `game.js` completo (funciones y constantes listadas en el alcance) a TypeScript tipado, encapsulando el estado del módulo (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId`) dentro del closure devuelto por `createTetrisGame(boardCanvas, nextCanvas, callbacks)`. `onStats` se dispara tras cada cambio de score/lines/level (igual que `updateHUD()` del original, pero vía callback en vez de tocar el DOM). Al colisionar `spawn()`, en vez de dibujar el overlay interno, el motor detiene el loop y llama `onGameOver(score)` una sola vez. El listener de `KeyP` no se porta.
3. **Ciclo de vida y listeners** — el `addEventListener('keydown', ...)` se agrega dentro de `start()` y se remueve en `destroy()` (no a nivel de módulo como el original). `pause()` cancela el `requestAnimationFrame` sin reiniciar estado; `resume()` reinicia `lastTime` a `performance.now()` antes de retomar el loop (igual que hace `togglePause()` original) para evitar un salto de `dt`; `restart()` reinicializa todo el estado (equivalente a `init()`) y vuelve a arrancar el loop.
4. **`app/game/tetris/TetrisCanvas.tsx`** — client component con `<canvas width={300} height={600}>` (tablero) y `<canvas width={120} height={120}>` (siguiente pieza), ambos centrados en un contenedor propio dentro de `.crt-screen`. Usa `useRef` para ambos `<canvas>` y `useEffect` para llamar `createTetrisGame` al montar y `destroy()` al desmontar. Expone `pause`/`resume`/`restart`/`forceGameOver` vía `useImperativeHandle` sobre un `ref` reenviado (`forwardRef`).
5. **`app/globals.css`** — agregar una variante de contenedor para `.crt-screen` (o una clase adicional aplicada solo cuando `id === "tetris"`) que permita el layout angosto 300×600 + panel lateral de siguiente pieza sin forzar `aspect-ratio: 4/3`; agregar regla `.cover-tetris` (mismo tratamiento visual que `.cover-tetro`) como clase independiente.
6. **`app/lib/data.ts`** — agregar la entrada `tetris` a `GAMES` tal como se define en el modelo de datos, sin modificar la entrada `caida` existente.
7. **Migración SQL de siembra** — crear `supabase/migrations/<timestamp>_seed_tetris.sql` con el `insert into public.games (...)` de la fila `tetris` (mismo esquema de SPEC 06, sin tocar la migración original). Aplicar con `mcp__supabase__apply_migration`.
8. **Verificación final** — `npm run build` sin errores de tipos/lint; recorrido manual en `/game/tetris/play`: piezas caen y se controlan con `←`/`→`/`↓`/`↑`(o `X`)/`Espacio`, rotación con wall kicks funciona cerca de los bordes, pieza fantasma se dibuja, líneas completas se limpian y suman puntaje, el HUD (`player-hud`) refleja puntaje/líneas(en el slot Vidas)/nivel reales, PAUSA detiene el juego y REANUDAR lo retoma sin salto de velocidad, llenar el tablero dispara el modal existente (no el overlay interno), guardar puntuación inserta fila real en `scores` con `slug: "tetris"` (confirmar con `mcp__supabase__execute_sql`), "JUGAR DE NUEVO" reinicia una partida limpia, SALIR navega sin dejar el loop corriendo; confirmar que `/game/asteroides/play`, `/game/caida/play` y el resto del catálogo no cambiaron de comportamiento tras generalizar el registro.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores.
- [ ] `app/game/registry.ts` existe y `app/game/[id]/play/page.tsx`, `app/game/[id]/page.tsx`, `app/hall-of-fame/page.tsx` usan el registro en vez de `id === "asteroides"` hardcodeado.
- [ ] `/game/asteroides/play`, `/game/asteroides` (detalle) y la pestaña ASTEROIDES de `/hall-of-fame` no cambiaron de comportamiento tras la generalización del registro.
- [ ] `GAMES` incluye la entrada `tetris` con los campos definidos, sin alterar la entrada `caida`.
- [ ] `/game/tetris` (detalle) muestra la portada `.cover-tetris`, título TETRIS y lleva a `/game/tetris/play`.
- [ ] En `/game/tetris/play` las piezas se controlan con `←`/`→`/`↓`/`↑`(o `X`)/`Espacio` exactamente como en `references/started-games/03-tetris`.
- [ ] Los wall kicks (`[0,-1,1,-2,2]`) permiten rotar piezas cerca de los bordes igual que el original.
- [ ] Completar una fila la elimina, desplaza el resto hacia abajo y suma puntaje según `LINE_SCORES × level`.
- [ ] El nivel sube cada 10 líneas y la velocidad de caída aumenta según `max(100, 1000 - (level-1)*90)`.
- [ ] El panel de siguiente pieza se actualiza al encajar la pieza actual.
- [ ] El `player-hud` muestra puntuación real, líneas (en el slot "Vidas") y nivel real, actualizados durante la partida.
- [ ] El botón PAUSA detiene visiblemente el juego y REANUDAR lo retoma sin salto de velocidad de caída.
- [ ] El botón FIN fuerza el fin de partida inmediato y muestra el modal existente de puntuación final.
- [ ] Llenar el tablero (colisión inmediata al aparecer una pieza) muestra el modal de puntuación final, no un overlay dibujado en el canvas.
- [ ] Guardar la puntuación desde el modal inserta una fila real en `scores` con `slug: "tetris"` (verificable con `execute_sql`).
- [ ] "JUGAR DE NUEVO" arranca una partida nueva del motor real (tablero vacío, score/líneas en 0, nivel 1).
- [ ] "SALIR" navega a `/game/tetris` y no deja el `requestAnimationFrame` ni los listeners de teclado activos.
- [ ] `/game/caida` (detalle y play) y el resto del catálogo mock no cambiaron de comportamiento.
- [ ] Ningún archivo bajo `references/` fue modificado.

## Decisiones tomadas y descartadas

- **Sí:** generalizar `app/game/registry.ts` en esta spec, migrando los tres `if (id === "asteroides")` de `play/page.tsx`, `[id]/page.tsx` y `hall-of-fame/page.tsx`. Decisión ya fijada por esta skill (`/juego-nuevo`) para todo juego nuevo con motor real — no se reabre.
- **Sí:** leaderboard de `tetris` conectado a Supabase (`getGames`/`getGameBySlug`/`getTopScores`/`insertScore`) igual que Asteroides, nunca `localStorage`. Decisión ya fijada por esta skill — no se reabre.
- **Sí:** juego nuevo con id `tetris`, sin relación con la entrada mock `caida`. Decisión explícita del usuario — conviven igual que `rocas`/`asteroides`.
- **No:** reemplazar o renombrar la entrada `caida`. Queda intacta.
- **Sí:** port mínimo del motor envuelto en `useEffect`/`useRef`, conservando las funciones y constantes del `game.js` original casi 1:1, solo tipado y encapsulado en un closure. Mismo criterio que Asteroides — menor riesgo de romper el gameplay ya afinado que una reescritura.
- **Sí:** controles idénticos al original (`←`/`→`/`↓`/`↑`|`X`/`Espacio`). Decisión explícita del usuario.
- **No:** portar la tecla `P` de pausa interna del original. Decisión explícita del usuario — la pausa se controla solo desde el botón PAUSA del reproductor, para no duplicar el mecanismo (mismo patrón que Asteroides, que tampoco expone un atajo de teclado para pausar).
- **Sí:** slot "Vidas" del `player-hud` reutilizado para mostrar `lines` en este juego, sin rediseñar el HUD ni ocultar el campo. Decisión explícita del usuario — evita tocar el componente `player-hud` compartido por una diferencia cosmética de un solo juego.
- **Sí:** canvas del tablero a resolución nativa 300×600, sin forzar el `aspect-ratio: 4/3` de `.crt-screen`. Decisión explícita del usuario — evita distorsionar el tablero; requiere una variante de contenedor angosta en CSS.
- **Sí:** incluir el panel de siguiente pieza (next-canvas) en el alcance. Decisión explícita del usuario.
- **Sí:** `.cover-tetris` como regla CSS nueva e independiente de `.cover-tetro`, mismo patrón que `.cover-asteroides`/`.cover-rocas`.
- **Sí:** migración SQL de siembra separada (`<timestamp>_seed_tetris.sql`), sin tocar la migración de SPEC 06. Mismo criterio de versionado que el resto del esquema.
- **No:** portar el `theme-toggle` del `index.html` original. Fuera de alcance — el reproductor ya tiene su propio tema.

## Riesgos identificados

| Riesgo                                                                                                                                                          | Mitigación                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generalizar el registro en los tres archivos puede introducir una regresión en Asteroides si el lookup no cubre exactamente los mismos casos que el `if` actual | Paso 1 del plan se verifica de forma aislada (build + recorrido manual de Asteroides) antes de escribir código de Tetris; criterios de aceptación incluyen verificación explícita de que Asteroides no cambió. |
| El contenedor `.crt-screen` (pensado para 4:3) puede verse mal centrado o con espacios vacíos grandes al alojar un tablero angosto 300×600 + panel lateral      | Se define una variante de contenedor específica para `tetris` en el paso 5 del plan, en vez de reusar el `aspect-ratio: 4/3` tal cual.                                                                         |
| Listeners de teclado o el `requestAnimationFrame` del motor quedan vivos tras salir de `/game/tetris/play`                                                      | `destroy()` debe cancelar el `requestAnimationFrame` pendiente y remover explícitamente el listener agregado en `start()`; verificar en el paso 8 que no sigan disparando tras SALIR.                          |

## Qué **no** está en esta spec

- Controles táctiles/móvil.
- Tests automatizados.
- Cambios a la entrada mock `caida` o a cualquier otro juego del catálogo más allá de la generalización puntual del registro.
- Balance/dificultad distinto al original.
- Tema claro/oscuro portado del `index.html` de referencia.

Cada uno de estos, si se necesita, va en su propia spec.
