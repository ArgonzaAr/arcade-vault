# 09 — Juego Snake

**Estado:** Implementado
**Depende de:** SPEC 05, SPEC 06, SPEC 07, SPEC 08
**Fecha:** 2026-09-11

**Objetivo:** Crear desde cero un motor de Snake clásico (sin referencia en `references/started-games/`, solo assets visuales en `references/source-assets/snake-assets/`) y montarlo como juego jugable real en `/game/snake/play` con leaderboard real en Supabase.

## Alcance

**Incluye:**

- Nueva entrada en `GAMES` (`app/lib/data.ts`) con `id: "snake"`.
- Motor de Snake escrito desde cero (no hay `game.js` de referencia — `references/source-assets/snake-assets/` solo trae `sprites.js` con el atlas de coordenadas de `fruits.png` y la imagen misma) en `app/game/snake/engine.ts`: grid de 40×30 celdas de 20px sobre canvas 800×600, movimiento de la víbora por pasos discretos (tick), wrap toroidal en los cuatro bordes, crecimiento al comer fruta, fin de partida solo por auto-colisión, velocidad progresiva por frutas comidas.
- Copia de `references/source-assets/snake-assets/fruits.png` a `public/games/snake/fruits.png` (los archivos bajo `references/` no se modifican, se copian).
- `app/game/snake/spritesheet.ts`: helper de dibujo por sprites con los frames de fruta portados desde `references/source-assets/snake-assets/sprites.js` (mismo patrón que `app/game/arkanoid/spritesheet.ts`), acotado a un subconjunto de frutas: `apple`, `cherry`, `grape`, `strawberry`, `orange`, `watermelon`.
- Componente canvas `app/game/snake/SnakeCanvas.tsx`, mismo contrato `GameCanvasComponent` que `ArkanoidCanvas`/`TetrisCanvas`.
- Entrada nueva `snake` en `app/game/registry.ts` (el registro ya existe y es genérico — solo se agrega el objeto, sin tocar `asteroides`/`tetris`/`arkanoid`).
- Leaderboard real vía Supabase: migración nueva `supabase/migrations/<timestamp>_seed_snake.sql` que siembra la fila `snake` en `games` (mismo patrón que `20260911000001_seed_arkanoid.sql`), usando las mismas cuatro funciones ya genéricas por slug de `app/lib/supabase/queries.ts` y `queries.client.ts` sin cambios.
- Regla CSS `.cover-snake` en `app/globals.css`, mismo tratamiento que `.cover-arkanoid`/`.cover-tetris` como clase independiente.

**Fuera de alcance (para futuras specs):**

- Controles táctiles/móvil.
- Tests automatizados (no hay framework configurado en el repo).
- Cualquier fruta especial con efecto distinto a sumar puntos y crecer un segmento (venenos, bonus temporales, etc.) — cada fruta comida vale lo mismo y crece un segmento, sin variación de efecto por tipo de sprite.
- Modo de "pared sólida" (game over al tocar el borde) — se descarta explícitamente a favor de wrap toroidal (ver Decisiones).
- Multijugador o modo versus.
- Persistencia de high score fuera de Supabase (no se usa `localStorage` para snake).
- Cualquier cambio a `asteroides`, `tetris`, `arkanoid` o a las specs 05/06/07/08 ya existentes.
- Cualquier archivo bajo `references/`.

## Modelo de datos

```ts
// app/game/snake/engine.ts
export interface SnakeStats {
  score: number;
  length: number; // segmentos de la víbora, incluida la cabeza
  level: number; // sube cada N frutas comidas (velocidad progresiva)
}

export interface SnakeCallbacks {
  onStats: (stats: SnakeStats) => void; // se invoca solo cuando cambia algún valor
  onGameOver: (finalScore: number) => void; // se invoca una vez al chocar contra el propio cuerpo
}

export interface SnakeGame {
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void; // detiene el loop y quita listeners de teclado
}

export function createSnakeGame(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks
): SnakeGame;
```

```ts
// app/game/snake/SnakeCanvas.tsx — mismo contrato que GameCanvasComponent (registry.ts)
// props: GameCanvasProps { onStats, onGameOver }; ref: GameEngineHandle { pause, resume, restart, forceGameOver }
```

Constantes de balance (nuevas, sin referencia previa que portar):

```ts
const CELL = 20; // px por celda
const COLS = 40;
const ROWS = 30; // 800x600 / 20
const INITIAL_LENGTH = 3;
const INITIAL_TICK_MS = 150; // ms por paso de movimiento
const MIN_TICK_MS = 60; // velocidad máxima
const TICK_DECREASE_PER_FRUIT = 5; // ms que baja el tick por cada fruta (hasta el mínimo)
const FRUITS_PER_LEVEL = 5; // frutas comidas para subir 1 nivel
const POINTS_PER_FRUIT = 10;
const FRUIT_SPRITE_KEYS = [
  "apple",
  "cherry",
  "grape",
  "strawberry",
  "orange",
  "watermelon",
] as const;
```

`app/lib/data.ts` gana una entrada más en `GAMES`:

```ts
{
  id: "snake",
  title: "SNAKE",
  short: "Come, crece y no te muerdas la cola.",
  long: "Víbora clásica sobre un tablero toroidal: atraviesa los bordes sin penalidad, come frutas para crecer y ganar puntos, y evita chocar contra tu propio cuerpo mientras la velocidad aumenta con cada fruta.",
  cat: "ARCADE",
  cover: "cover-snake",
  color: "green",
  best: 0,
  plays: "0",
}
```

`app/game/registry.ts` gana una entrada más (sin tocar las existentes):

```ts
snake: {
  Canvas: SnakeCanvas as ComponentType<unknown> as GameCanvasComponent,
  hasRealLeaderboard: true,
  secondaryStatLabel: "Longitud",
  formatSecondaryStat: (value: number) => String(value),
},
```

## Plan de implementación

1. **Assets** — copiar `references/source-assets/snake-assets/fruits.png` a `public/games/snake/fruits.png` (sin modificar el original bajo `references/`).
2. **`app/game/snake/spritesheet.ts`** — portar de `references/source-assets/snake-assets/sprites.js` los frames `{x,y,w,h}` de las 6 frutas listadas en el modelo de datos, con el mismo formato `SpriteFrame` que usa `app/game/arkanoid/spritesheet.ts` (renombrando `x/y/w/h` a `sx/sy/sw/sh` para consistencia con ese patrón).
3. **Motor `app/game/snake/engine.ts`** — implementar desde cero dentro del closure de `createSnakeGame(canvas, callbacks)`: estado interno (segmentos de la víbora como array de celdas `{col, row}`, dirección actual/pendiente, posición y sprite de la fruta activa, `score`, `level`, `tickMs`, `running`); loop por `requestAnimationFrame` acumulando tiempo y avanzando un paso cada `tickMs`; wrap toroidal (`(col + COLS) % COLS`, análogo en filas); colisión: si la nueva posición de cabeza coincide con algún segmento del cuerpo, detener el loop y llamar `onGameOver(score)`; al comer fruta (cabeza sobre la celda de la fruta): sumar `POINTS_PER_FRUIT`, agregar un segmento, reposicionar fruta en celda libre aleatoria con sprite aleatorio de `FRUIT_SPRITE_KEYS`, bajar `tickMs` (mínimo `MIN_TICK_MS`), y cada `FRUITS_PER_LEVEL` frutas subir `level`. `onStats` se dispara tras cada cambio de score/length/level.
4. **Listeners de teclado** — flechas y WASD agregados en `start()` y removidos en `destroy()` (mismo patrón que `AsteroidsCanvas`); cambio de dirección se guarda como "pendiente" y se aplica en el siguiente tick, ignorando una reversión de 180° sobre la dirección actual (p.ej. si va a la derecha, `←`/`A` no se aplica).
5. **`app/game/snake/SnakeCanvas.tsx`** — client component con `<canvas width={800} height={600}>`, mismo patrón de `useRef`/`useEffect`/`forwardRef`/`useImperativeHandle` que `ArkanoidCanvas.tsx` (`pause`/`resume`/`restart`/`forceGameOver`), implementando el contrato `GameCanvasComponent` de `registry.ts` directamente (sin wrapper adicional).
6. **`app/game/registry.ts`** — agregar el import de `SnakeCanvas` y la entrada `snake` definida en el modelo de datos, sin modificar las entradas existentes.
7. **`app/lib/data.ts`** — agregar la entrada `snake` a `GAMES` tal como se define en el modelo de datos.
8. **Migración `supabase/migrations/<timestamp>_seed_snake.sql`** — insertar la fila `snake` en `games` (mismos campos que la entrada de `GAMES`), aplicada con `mcp__supabase__apply_migration`, sin tocar migraciones previas.
9. **`app/globals.css`** — agregar regla `.cover-snake` (mismo tratamiento visual que `.cover-arkanoid`/`.cover-tetris`, con paleta verde) como clase independiente.
10. **Verificación final** — `npm run build` sin errores; recorrido manual en `/game/snake/play`: la víbora se mueve con flechas/WASD, atraviesa los bordes sin penalidad, crece y suma puntos al comer fruta (con sprite variable), la velocidad aumenta progresivamente, chocar contra el propio cuerpo dispara el modal de fin de partida existente; guardar puntuación inserta fila real en `scores` con `slug = "snake"` (confirmar con `mcp__supabase__execute_sql`); PAUSA/REANUDAR/SALIR funcionan igual que en los otros juegos; confirmar que `asteroides`, `tetris` y `arkanoid` no cambiaron de comportamiento; confirmar que ningún archivo bajo `references/` fue modificado.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores.
- [ ] `GAMES` incluye la entrada `snake` con los campos definidos, sin alterar las entradas existentes.
- [ ] `app/game/registry.ts` incluye la entrada `snake` sin modificar `asteroides`/`tetris`/`arkanoid`.
- [ ] `/game/snake` (detalle) muestra la portada `.cover-snake`, título SNAKE y lleva a `/game/snake/play`.
- [ ] En `/game/snake/play` la víbora se controla con flechas y WASD; presionar la dirección opuesta a la actual no la mata instantáneamente (se ignora la reversión de 180°).
- [ ] La víbora atraviesa los cuatro bordes del tablero y reaparece del lado opuesto sin penalidad.
- [ ] Comer una fruta suma `POINTS_PER_FRUIT` puntos, agrega un segmento y hace aparecer una nueva fruta en una celda libre con un sprite del atlas.
- [ ] La velocidad de movimiento aumenta con cada fruta comida hasta el límite `MIN_TICK_MS`.
- [ ] El `player-hud` muestra Puntuación real, "Longitud" (segmentos actuales) en el slot secundario, y Nivel real.
- [ ] Chocar contra el propio cuerpo dispara el modal existente de fin de partida (no un overlay dibujado en canvas).
- [ ] Tocar el borde del tablero NO termina la partida (wrap confirmado).
- [ ] PAUSA detiene visiblemente el movimiento y REANUDAR lo retoma sin perder el estado.
- [ ] Guardar la puntuación desde el modal inserta una fila real en `scores` con `slug = "snake"` (verificable con `execute_sql`).
- [ ] "JUGAR DE NUEVO" reinicia una partida limpia (víbora de longitud 3, score 0, nivel 1, velocidad inicial).
- [ ] "SALIR" navega sin dejar el `requestAnimationFrame` ni los listeners de teclado activos.
- [ ] `asteroides`, `tetris` y `arkanoid` no cambiaron de comportamiento.
- [ ] Ningún archivo bajo `references/` fue modificado (los assets se copiaron a `public/games/snake/`, no se movieron ni editaron).

## Decisiones tomadas y descartadas

- **Sí:** registro por id (`app/game/registry.ts`) ya generalizado por las specs 07/08 — esta spec solo agrega la entrada `snake`, sin tocar los otros tres `if`/lookups ya migrados. Decisión fija de la skill `/juego-nuevo`.
- **Sí:** leaderboard real vía Supabase desde el día uno (slug `snake`, mismas cuatro funciones genéricas de `queries.ts`/`queries.client.ts`). Decisión fija de la skill `/juego-nuevo` — nunca `localStorage` para un juego con motor real.
- **Sí:** motor escrito desde cero, no portado. `references/source-assets/snake-assets/` no trae `game.js`, solo `sprites.js` (atlas) y `fruits.png`. Confirmado explícitamente por el usuario en Fase 2.
- **Sí:** wrap toroidal en los cuatro bordes (igual criterio que asteroides), en vez de pared sólida. Decisión explícita del usuario — el único game over es la auto-colisión.
- **No:** pared sólida como condición de derrota adicional. Descartada explícitamente por el usuario junto con la elección de wrap.
- **Sí:** controles flechas + WASD simultáneos. Decisión explícita del usuario, distinto del resto del catálogo (que usa solo flechas/espacio).
- **Sí:** `id: "snake"` (no `vibora`), `color: "green"`, `cat: "ARCADE"`. Decisiones explícitas del usuario.
- **Sí:** segundo stat de HUD es "Longitud" (segmentos de la víbora), análogo a "Líneas" en tetris. Decisión explícita del usuario.
- **Sí:** existe progresión de nivel/velocidad (sube cada `FRUITS_PER_LEVEL` frutas comidas), en vez de `level` fijo en 1. Decisión explícita del usuario.
- **Sí:** fruta aleatoria entre 6 sprites del atlas (`apple`, `cherry`, `grape`, `strawberry`, `orange`, `watermelon`) en vez de una sola fruta fija. Decisión explícita del usuario.
- **No:** efectos distintos por tipo de fruta (veneno, bonus, etc.) — cada fruta vale igual, la variedad es solo visual. No se preguntó explícitamente pero se documenta como descartado para no inventar mecánica no pedida.
- **Sí:** canvas fijo 800×600 con grid de celdas de 20px (40×30 casillas), mismo aspect-ratio 4:3 que asteroides/arkanoid, sin `screenClassName` especial en el registro. Decisión explícita del usuario.
- **Sí:** valores concretos de balance (`INITIAL_TICK_MS`, `MIN_TICK_MS`, `TICK_DECREASE_PER_FRUIT`, `FRUITS_PER_LEVEL`, `POINTS_PER_FRUIT`, `INITIAL_LENGTH`) fijados en esta spec como números de partida razonables, al no existir un `game.js` de referencia que los defina. Ajustables en implementación si en la verificación manual (paso 10) resultan demasiado fáciles/difíciles, sin que eso invalide el resto de la spec.
- **No:** frutas especiales con power-ups (como el disparo triple de asteroides). Fuera de alcance — no se pidió y agregarla sería inventar mecánica no solicitada.

## Riesgos identificados

| Riesgo                                                                                                                                                                                                                      | Mitigación                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sin `game.js` de referencia, los valores de balance (velocidad inicial, incremento por fruta, puntos por fruta) son inventados en esta spec y pueden sentirse mal calibrados en el primer playtest                          | Aceptado explícitamente — se documentan como constantes ajustables (ver Decisiones); el paso 10 de verificación incluye jugar una partida completa para validar que se sienten jugables antes de dar la spec por implementada.    |
| Reposicionar la fruta en una celda libre aleatoria puede requerir reintentos si la víbora ocupa gran parte del tablero (colisión con el propio cuerpo)                                                                      | El motor debe descartar posiciones ocupadas por algún segmento de la víbora antes de fijar la nueva celda de fruta (loop de reintento acotado, ej. hasta encontrar una celda libre entre las `COLS * ROWS` disponibles).          |
| Cambiar de dirección dos veces en el mismo tick (ej. arriba→derecha→abajo antes del siguiente paso) podría permitir una reversión de 180° efectiva si no se valida contra la dirección ya aplicada, no la de teclado previa | La dirección "pendiente" se valida contra la dirección **actualmente en movimiento** (la del último tick aplicado), no contra la última tecla presionada, evitando que dos pulsaciones rápidas maten a la víbora contra sí misma. |
