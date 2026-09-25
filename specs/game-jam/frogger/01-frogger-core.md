# SPEC — Frogger: integración core del juego

**Estado:** Aprobado
**Depende de:** SPEC 05, SPEC 06, SPEC 07, SPEC 08, SPEC 09, SPEC 10
**Fecha:** 2026-05-20 (adaptada a la arquitectura del registro el 2026-09-24)

**Objetivo:** Crear desde cero un motor de Frogger (canvas puro, primitivas sin sprites) y montarlo como juego jugable real en `/game/frogger/play` con id `frogger`, registrado en `app/game/registry.ts` y con leaderboard real en Supabase, conectando score, vidas, nivel y game over con el HUD React y el modal de la play-page común.

## Alcance

**Incluye:**

- Nueva entrada en `GAMES` (`app/lib/data.ts`) con `id: "frogger"`.
- Motor de Frogger escrito desde cero en `app/game/frogger/engine.ts` (no hay referencia en `references/started-games/`): cuadrícula de 16 columnas × 15 filas de 40 × 40 px sobre canvas 640 × 600. Zonas fijas por fila (0 = arriba):
  - fila 0 — HUD interno del canvas + barra de tiempo;
  - fila 1 — 5 bocas destino (cada boca ocupa 2 columnas de las 16);
  - filas 2–7 — río (6 carriles fluviales);
  - fila 8 — zona segura intermedia;
  - filas 9–13 — carretera (5 carriles de tráfico);
  - fila 14 — zona segura de inicio.
- Entidades de carretera: coches (1 celda) y camiones (2–3 celdas) con velocidades y direcciones por carril; se mueven horizontalmente en loop continuo; colisión con la rana es letal.
- Entidades de río: troncos (2–4 celdas) y grupos de tortugas (2–3) por carril; se mueven horizontalmente. La rana solo sobrevive en el río si está encima de un tronco o de tortugas visibles. Las tortugas alternan visible → bajo el agua → visible (3 s visibles / 1.5 s sumergidas, temporizador independiente por grupo); sumergidas no sirven de apoyo.
- Movimiento de la rana por saltos discretos de 1 celda (40 px) en 4 direcciones (flechas ↑ ↓ ← →), con animación de salto de 120 ms. La rana no puede salir por los bordes laterales ni por debajo de la fila de inicio.
- Meta: la rana llega a una de las 5 bocas libres de la fila 1. Una boca ocupada no se puede volver a usar en la misma ronda. Al llenar las 5 bocas se completa la ronda y empieza la siguiente.
- Condiciones de muerte: (a) colisión con vehículo, (b) caída al agua, (c) la tortuga bajo la rana se sumerge, (d) el tronco/tortuga arrastra la rana fuera del borde izquierdo/derecho, (e) se agota el temporizador, (f) saltar a la fila 1 fuera de una boca o sobre una boca ya ocupada.
- Vidas: 3 al empezar; cada muerte resta 1 y se notifica por `onStats`. Con 0 vidas, `onStats` (lives 0) y luego `onGameOver(score)`, y se detiene el loop.
- Puntuación: +10 por cada fila avanzada hacia arriba por primera vez en el trayecto actual de la rana (se reinicia al reaparecer en la fila de inicio); +50 al ocupar una boca; +bonus de tiempo `segundos_restantes × 10` al ocupar una boca; +200 al completar una ronda.
- Temporizador: 15 s por trayecto en nivel 1; se reduce con el nivel (ver constantes). Se reinicia cada vez que la rana reaparece (muerte o boca ocupada).
- HUD interno en la fila 0 del canvas (score a la izquierda, nivel al centro, iconos de rana por vida a la derecha, barra de tiempo con color verde → amarillo → rojo) — doble HUD igual que los demás juegos.
- Listeners de `keydown` en `document` agregados en `start()` y quitados en `destroy()`; el motor solo lee `e.key`/`e.code` (nunca `keyCode`/`which`/`isTrusted`), como exige la spec 10.
- Componente `app/game/frogger/FroggerCanvas.tsx`, mismo contrato `GameCanvasComponent` que `SnakeCanvas`/`ArkanoidCanvas` (props `onStats`, `onGameOver`, `skin`; ref `GameEngineHandle`).
- Entrada nueva `frogger` en `app/game/registry.ts` (sin tocar las existentes), con `skins: ["clasico"]`, `touchControls` de 4 direcciones y `screenClassName: "crt-screen--frogger"`.
- Regla CSS `.crt-screen--frogger` (proporción 16:15) y `.cover-frogger` en `app/globals.css`.
- Leaderboard real: migración nueva `supabase/migrations/20260924000000_seed_frogger.sql` que siembra la fila `frogger` en `games` (mismo patrón que `20260915000001_seed_snake.sql`), reutilizando sin cambios las funciones genéricas de `app/lib/supabase/queries.ts` / `queries.client.ts`.

**Fuera de alcance:**

- Sprites bitmap externos: todo se dibuja con primitivas canvas.
- Skins `neon` y `retro` y el selector: los agrega después el agente `skin-designer` (esta spec solo deja la skin `clasico`, y el motor acepta `skin`/`setSkin` para que el agente pueda extenderlo).
- Ajustes táctiles más allá de declarar `touchControls` (encaje en móvil con `--ar-w`/`--ar-h`, auditoría de entrada): los hace después el agente `mobile-porter`.
- Animaciones de muerte elaboradas (explosiones, partículas) — spec secundaria.
- Power-ups (mosca en boca, cocodrilo disfrazado de tronco) — spec secundaria.
- Play-page propia: se usa la ruta común `app/game/[id]/play/page.tsx` sin cambios (su modal, su guardado en Supabase y su botón JUGAR DE NUEVO).
- Cualquier cambio a `asteroides`, `tetris`, `arkanoid`, `snake` o a las specs 05–10.
- Supabase Auth, RLS y Realtime.
- Tests automatizados (no hay framework configurado).
- Cualquier archivo bajo `references/`.

## Modelo de datos

```ts
// app/game/frogger/engine.ts
export interface FroggerStats {
  score: number;
  lives: number;
  level: number; // ronda actual (sube al llenar las 5 bocas)
}

export interface FroggerCallbacks {
  onStats: (stats: FroggerStats) => void; // se invoca solo cuando cambia algún valor
  onGameOver: (finalScore: number) => void; // una vez, al llegar a 0 vidas
}

export interface FroggerGame {
  start: () => void;
  pause: () => void; // congela update(); draw() sigue pintando
  resume: () => void;
  restart: () => void;
  forceGameOver: () => void;
  setSkin: (skin: SkinId) => void; // solo repinta
  destroy: () => void; // detiene el loop y quita listeners de teclado
}

export function createFroggerGame(
  canvas: HTMLCanvasElement,
  callbacks: FroggerCallbacks,
  skin: SkinId = DEFAULT_SKIN
): FroggerGame;
```

Tipos internos (no exportados):

```ts
type Direction = "up" | "down" | "left" | "right";
interface Entity {
  col: number; // posición en celdas (puede ser fraccionaria)
  width: number; // en celdas
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean; // solo tortugas
  cycleT?: number; // ms dentro del ciclo de inmersión (solo tortugas)
}
interface Lane {
  row: number;
  speed: number; // celdas por segundo (ya escalada por nivel)
  dir: 1 | -1;
  entities: Entity[];
}
interface Frog {
  col: number; // puede ser fraccionaria al ir sobre un tronco/tortuga
  row: number;
  animating: boolean;
  animT: number; // ms
  targetCol: number;
  targetRow: number;
}
```

Constantes:

```ts
const COLS = 16;
const ROWS = 15;
const CELL = 40; // px
const CANVAS_W = COLS * CELL; // 640
const CANVAS_H = ROWS * CELL; // 600
const ROW_HUD = 0;
const ROW_GOALS = 1;
const ROW_RIVER_TOP = 2;
const ROW_RIVER_BOT = 7;
const ROW_SAFE_MID = 8;
const ROW_ROAD_TOP = 9;
const ROW_ROAD_BOT = 13;
const ROW_START = 14;
const GOAL_COLS = [1, 4, 7, 10, 13]; // columna izquierda de cada boca (ocupa col y col+1)
const START_LIVES = 3;
const HOP_MS = 120;
const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGED_MS = 1500;
const LEVEL_SPEED_FACTOR = 1.15; // +15 % de velocidad por nivel
const TIMER_BASE_S = 15;
const TIMER_MIN_S = 8;
const TIMER_STEP_S = 1; // segundos menos por nivel: max(TIMER_MIN_S, TIMER_BASE_S - (level - 1) * TIMER_STEP_S)
const POINTS_PER_ROW = 10;
const POINTS_PER_GOAL = 50;
const POINTS_PER_SECOND_LEFT = 10;
const POINTS_PER_ROUND = 200;
```

Velocidades base (nivel 1), expresadas en px/frame a 60 fps como en la spec original y convertidas a celdas/s en `buildLanes`: carretera entre 1.5 y 4 px/frame, río entre 1 y 3 px/frame.

`app/lib/data.ts` gana una entrada más en `GAMES`:

```ts
{
  id: "frogger",
  title: "FROGGER",
  short: "Cruza la carretera y el río sin convertirte en papilla.",
  long: "Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.",
  cat: "ARCADE",
  cover: "cover-frogger",
  color: "green",
  best: 0,
  plays: "0",
}
```

`app/game/registry.ts` gana una entrada más (sin tocar las existentes):

```ts
frogger: {
  Canvas: FroggerCanvas as ComponentType<unknown> as GameCanvasComponent,
  hasRealLeaderboard: true,
  secondaryStatLabel: "Vidas",
  formatSecondaryStat: formatHearts,
  screenClassName: "crt-screen--frogger",
  skins: ["clasico"],
  touchControls: {
    buttons: {
      up: { emit: KEY_UP },
      down: { emit: KEY_DOWN },
      left: { emit: KEY_LEFT },
      right: { emit: KEY_RIGHT },
    },
  },
},
```

Migración `supabase/migrations/20260924000000_seed_frogger.sql`:

```sql
-- Siembra la fila del catálogo para el juego Frogger (motor real).

insert into public.games (slug, title, short, long, cat, cover, color, best, plays) values
  ('frogger', 'FROGGER', 'Cruza la carretera y el río sin convertirte en papilla.', 'Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.', 'ARCADE', 'cover-frogger', 'green', 0, '0');
```

No se introducen tablas nuevas ni tipos compartidos nuevos.

## Plan de implementación

1. **Constantes, tipos y esqueleto del motor** — crear `app/game/frogger/engine.ts` con las constantes y tipos del modelo de datos y `createFroggerGame(canvas, callbacks, skin)` devolviendo la interfaz `FroggerGame` (loop por `requestAnimationFrame` con `dt` en ms, `start`/`pause`/`resume`/`restart`/`forceGameOver`/`setSkin`/`destroy`). Estado inicial: `lives = 3`, `score = 0`, `level = 1`, rana en `ROW_START`, columna central (7).
2. **`buildLanes(level)`** — 5 carriles de carretera (filas 9–13) con sentidos alternos, coches/camiones precargados con huecos atravesables; 6 carriles de río (filas 2–7) con troncos de 2–4 celdas separados por al menos 1 celda y grupos de tortugas de 2–3 con ciclo de inmersión desfasado por grupo. Cada carril con al menos 2 entidades. Las velocidades base se multiplican por `LEVEL_SPEED_FACTOR ** (level - 1)`.
3. **`update(dt)`** — si está en pausa no hace nada. Avanza cada entidad (`col += speed * dir * dt / 1000`), la reintroduce por el lado opuesto al salir (`col = COLS` o `col = -width`) y avanza el ciclo de las tortugas. Input: si la rana no está animando y hay `pendingDir`, inicia el salto (`targetCol/targetRow` redondeando `col` a entero y respetando bordes y fila de inicio). Si está animando: `animT += dt`; al llegar a `HOP_MS` completa el salto y resuelve la celda destino (puntos por fila nueva, meta, muerte). Si está en el río y no animando, se desplaza con su soporte; si sale del borde, muere. Decrementa el temporizador; en 0, muerte por tiempo. Emite `onStats` solo si score/lives/level cambiaron.
4. **Colisiones y soporte** — `checkRoadCollision`: la rana (rango `[col, col + 1)`, con un pequeño margen) se solapa con alguna entidad de su carril de carretera. `getSupport`: entidad del carril de río que cubre el centro de la rana, o `null` si no hay o es tortuga sumergida. `checkGoal`: en `ROW_GOALS`, busca la boca de `GOAL_COLS` que contiene la columna de la rana; si está libre la ocupa (+50 + bonus de tiempo) y la rana reaparece; si está ocupada o no hay boca, muerte.
5. **`completeRound()`** — +200, vacía las bocas, `level++`, reconstruye carriles con `buildLanes(level)`, recalcula el temporizador, rana al inicio; `onStats` refleja el nuevo nivel.
6. **`killFrog()`** — `lives--` y `onStats`. Si `lives === 0`: detener el loop y llamar `onGameOver(score)` una sola vez. Si no: rana al inicio y temporizador reiniciado.
7. **`draw()`** — fondo por zonas (HUD negro, bocas verde claro con borde dorado y silueta de rana si están ocupadas, río azul oscuro, zonas seguras verde oscuro, carretera negra con líneas); coches (rectángulo de color con ruedas circulares), camiones (gris con cabina diferenciada), troncos (marrón con líneas), tortugas visibles (círculos verdes con escamas) y sumergidas (contorno semitransparente); rana (elipse 28 × 24 verde brillante, ojos blancos/negros, patas extendidas mientras salta, interpolando la posición durante la animación); HUD de la fila 0 (score, nivel, iconos de vida y barra de tiempo verde → amarillo → rojo). Los colores salen de una paleta por skin con solo `clasico` definida.
8. **Teclado** — `keydown` en `document` para flechas (`e.key`/`e.code`), registrado en `start()` y quitado en `destroy()`, con `preventDefault` en las flechas. P/Esc no pausan el motor (la pausa la maneja la play-page).
9. **`app/game/frogger/FroggerCanvas.tsx`** — client component con `<canvas width={640} height={600}>`, mismo patrón `forwardRef`/`useImperativeHandle`/`useEffect` y `setSkin` que `SnakeCanvas.tsx`, mapeando `FroggerStats` a `GameStats` directamente.
10. **Registro y catálogo** — agregar import y entrada `frogger` en `app/game/registry.ts` y la entrada `frogger` en `GAMES` (`app/lib/data.ts`) tal como se definen en el modelo de datos.
11. **CSS** — en `app/globals.css`: `.crt-screen--frogger` (`aspect-ratio: 16 / 15`, con ancho máximo y centrado como `.crt-screen--narrow`) y `.cover-frogger` (mismo tratamiento que `.cover-snake`, paleta verde/azul).
12. **Migración** — crear `supabase/migrations/20260924000000_seed_frogger.sql` con el SQL del modelo de datos y aplicarla con `mcp__supabase__apply_migration`, sin tocar migraciones previas.
13. **Verificación final** — `npm run build` sin errores; recorrido manual en `/game/frogger/play` (movimiento, colisiones, tortugas, bocas, rondas, pausa, modal de fin, guardado en `scores` con `slug = "frogger"` confirmado con `mcp__supabase__execute_sql`); confirmar que los demás juegos no cambiaron.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores de TypeScript.
- [ ] La fila `frogger` existe en `games` de Supabase con los valores de la migración.
- [ ] `GAMES` incluye `frogger` sin alterar las entradas existentes; la card aparece en la biblioteca con cover `cover-frogger` y color `green`.
- [ ] `app/game/registry.ts` incluye `frogger` (con `touchControls`, `skins` y `screenClassName`) sin modificar las demás entradas.
- [ ] `/game/frogger/play` carga sin errores de SSR y el canvas 640 × 600 se ve con proporción 16:15.
- [ ] Las zonas se distinguen visualmente: HUD, bocas, río, zona segura intermedia, carretera y zona de inicio.
- [ ] La rana aparece centrada en la fila de inicio al empezar.
- [ ] La rana salta exactamente una celda por pulsación de flecha, con animación de 120 ms.
- [ ] La rana no puede salir por los bordes laterales ni por debajo de la fila de inicio.
- [ ] Coches y camiones se mueven en loop por sus carriles y reaparecen por el lado opuesto.
- [ ] Troncos y tortugas se mueven en loop por sus carriles y arrastran a la rana.
- [ ] Las tortugas alternan visible (3 s) / sumergida (1.5 s).
- [ ] La rana muere al chocar con un vehículo, al caer al agua, cuando su tortuga se sumerge, cuando es arrastrada fuera del borde y al agotarse el tiempo.
- [ ] Al morir, el slot "Vidas" del `player-hud` baja en uno y la rana vuelve a la fila de inicio.
- [ ] Llegar a una boca libre la marca y suma 50 + bonus de tiempo; llegar a una boca ocupada o fuera de una boca mata a la rana.
- [ ] Al llenar las 5 bocas: +200, empieza la siguiente ronda y el `player-hud` muestra el nivel incrementado.
- [ ] Con cada nivel aumenta la velocidad de las entidades y baja el temporizador (hasta el mínimo).
- [ ] El `player-hud` refleja en tiempo real puntuación, vidas (corazones) y nivel.
- [ ] El HUD interno (score, nivel, iconos de vida, barra de tiempo) se dibuja en la fila 0.
- [ ] PAUSA congela el juego y REANUDAR lo retoma; P/Esc no pausan el motor por su cuenta.
- [ ] Con 0 vidas aparece el modal existente de fin de partida.
- [ ] Guardar desde el modal inserta una fila en `scores` con `slug = "frogger"`, visible en el detalle y el salón de la fama al recargar.
- [ ] "JUGAR DE NUEVO" reinicia una partida limpia (3 vidas, score 0, nivel 1).
- [ ] "SALIR" no deja ni el `requestAnimationFrame` ni los listeners de teclado activos.
- [ ] `asteroides`, `tetris`, `arkanoid` y `snake` no cambiaron de comportamiento; ninguna ruta existente devuelve 500.
- [ ] Ningún archivo bajo `references/` fue modificado.

## Decisiones

- **Sí: registro por id y play-page común** — `frogger` es una entrada en `app/game/registry.ts` y se juega en `app/game/[id]/play/page.tsx`. Reemplaza la play-page propia (`app/games/frogger/play/page.tsx`) y el componente en `components/games/` de la versión original de esta spec, que no seguían la arquitectura del repo. Decisión del usuario (2026-09-24).
- **Sí: contrato `GameCanvasComponent`** (`onStats` + `onGameOver` + `skin`, ref `GameEngineHandle`) en lugar de las props `paused`/`onScoreChange`/`onLivesChange`/`onLevelChange` originales: la pausa llega por `pause()`/`resume()` y los tres valores por `onStats`. Consecuencia directa de la decisión anterior.
- **Sí: guardado de score con el modal existente** de la play-page común (con su manejo propio del nombre), no con `av_player_name`. Misma razón.
- **Sí: canvas 640 × 600 (16 × 15 celdas) con una fila dedicada al HUD** — resuelve la contradicción de la versión original (480 × 640 en el alcance, 640 × 560 en el plan, y la barra de tiempo sobre la fila de metas). Se respetan los 6 carriles de río y los 5 de carretera. Decisión del usuario (2026-09-24).
- **Sí: color `green`** en lugar de `lime`, porque `Game.color` solo admite `cyan | magenta | yellow | green`. Decisión del usuario (2026-09-24).
- **Sí: seed por migración** en `supabase/migrations/` (columna `slug`, más `best`/`plays`) en lugar de un INSERT manual en el SQL Editor, igual que las specs 07–09.
- **Sí: `touchControls` y `skins: ["clasico"]` declarados** — son campos obligatorios del registro. La auditoría táctil y el encaje en móvil los hace `mobile-porter`; las skins `neon`/`retro`, `skin-designer`.
- **Sí: primitivas canvas sin sprites bitmap** — no hay assets de Frogger en el repo.
- **Sí: cuadrícula discreta con saltos de 120 ms** — mecánica canónica y colisiones simples por fila.
- **Sí: doble HUD**, **3 vidas**, **tortugas con ciclo de inmersión**, **temporizador** y **5 bocas** — como en la versión original.
- **Sí: valores concretos de balance** (`GOAL_COLS`, reducción del temporizador `TIMER_STEP_S`/`TIMER_MIN_S`) fijados aquí porque la versión original solo decía "reducido en niveles altos". Se pueden ajustar en la verificación manual.
- **Sí: el temporizador y los puntos por fila avanzada se reinician por trayecto** (cada vez que la rana reaparece), para que cada rana de la ronda pueda puntuar y tenga tiempo completo.
- **No: movimiento continuo**, **cocodrilo/mosca**, **componente genérico `CanvasGame`**, **RLS**, **Realtime** — como en la versión original.
