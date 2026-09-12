# 08 — Juego Arkanoid (motor real + leaderboard)

**Estado:** Aprobado
**Depende de:** SPEC 05, SPEC 06, SPEC 07
**Fecha:** 2026-09-11

**Objetivo:** Portar el juego de `references/started-games/04-arkanoid/game.js` a un motor TypeScript real registrado en `app/game/registry.ts`, con nueva entrada en el catálogo y leaderboard real en Supabase bajo el slug `arkanoid`.

## Alcance

**Incluye:**

- Nueva entrada en `GAMES` (`app/lib/data.ts`) con `id: "arkanoid"`, distinta y sin relación con la entrada mock existente `bloque-buster` (que sigue existiendo tal cual, sin tocarse) — mismo patrón de convivencia que `asteroides`/`rocas` y `tetris`/`caida`.
- Port del motor de juego a `app/game/arkanoid/engine.ts`: paleta, pelota, bloques, colisiones AABB, rebotes en paredes/paleta, división del score (+10 por bloque), los 5 niveles con sus patrones de bloques y multiplicador de velocidad (`LEVELS` de `references/started-games/04-arkanoid/levels.js`), explosiones al romper bloques, 3 vidas.
- Assets binarios copiados a `public/games/arkanoid/`: `spritesheet-breakout.png`, `ball-bounce.mp3`, `break-sound.mp3`. El helper de dibujo (`assets/spritesheet.js` del original: `loadSpritesheet`, `drawSprite`, `drawFrame`, `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`) se porta a un módulo TypeScript propio del motor que carga la imagen desde esa ruta pública.
- Controles: teclado (`←`/`→` mover paleta) **y** mouse (`mousemove` sobre el canvas mueve la paleta, igual fórmula de escalado que el original). Sin el click de salto de nivel del overlay de pausa original — ese salto queda cubierto por el botón PAUSA/REANUDAR ya existente en el reproductor.
- Integración con `app/game/registry.ts`: nueva entrada `arkanoid` en `gameRegistry` con `Canvas: ArkanoidCanvas`, `hasRealLeaderboard: true`, `secondaryStatLabel: "Vidas"`, `formatSecondaryStat: formatHearts` (reutilizando el mismo formateador de corazones ya definido para asteroides, sin `screenClassName` porque el canvas interno es 800×600 = 4:3, igual que `.crt-screen` por defecto).
- Fin de partida: perder las 3 vidas **o** limpiar el nivel 5 disparan `onGameOver(score)` una sola vez — un solo camino de fin de partida, sin un estado "win" separado en React. Reutiliza el modal de puntuación final ya existente.
- Leaderboard real en Supabase bajo el slug `"arkanoid"`, vía las mismas funciones genéricas de SPEC 06 (`getGameBySlug`, `getTopScores`, `insertScore`), sin cambios en `queries.ts`/`queries.client.ts`.
- Migración nueva `supabase/migrations/20260911000001_seed_arkanoid.sql` que siembra la fila `arkanoid` en `games` (mismo patrón que `20260911000000_seed_tetris.sql`), sin tocar migraciones previas.
- Nueva regla CSS `.cover-arkanoid` en `app/globals.css` para la tarjeta/portada de esta entrada.

**Fuera de alcance (para futuras specs):**

- Controles táctiles/móvil.
- Tests automatizados (no hay framework configurado en el repo).
- Cualquier cambio a la entrada mock `bloque-buster` existente.
- Portar o tocar otros juegos de `references/started-games/` — esta spec es exclusivamente Arkanoid.
- Modificar `app/game/registry.ts` más allá de agregar la entrada `arkanoid` — el registro ya fue generalizado en SPEC 07 y no se vuelve a tocar su forma.
- Ajustes de balance/dificultad respecto al original (puntos por bloque, velocidades de nivel, número de niveles, etc.).
- El click de salto de nivel del overlay de pausa original — se descarta, ver Decisiones.
- Cálculo dinámico de `best`/`plays` — igual que el resto del catálogo, quedan estáticos (`0`, `"0"`) hasta una spec futura.

## Modelo de datos

No se introduce persistencia nueva más allá de lo ya definido en SPEC 06 (tablas `games`/`scores` genéricas por slug). Se agregan tipos de integración entre el motor portado y React, con la misma forma que `AsteroidsStats`/`AsteroidsCallbacks`/`AsteroidsGame` de SPEC 05:

```ts
// app/game/arkanoid/engine.ts
export interface ArkanoidStats {
  score: number;
  lives: number;
  level: number; // 1..5
}

export interface ArkanoidCallbacks {
  onStats: (stats: ArkanoidStats) => void; // se invoca solo cuando cambia algún valor
  onGameOver: (finalScore: number) => void; // se invoca una vez: 0 vidas O nivel 5 limpiado
}

export interface ArkanoidGame {
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void; // detiene el loop y quita listeners de teclado/mouse
}

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  callbacks: ArkanoidCallbacks
): ArkanoidGame;
```

```ts
// app/game/arkanoid/ArkanoidCanvas.tsx — implementa GameCanvasComponent del registro (SPEC 07)
// Misma forma que AsteroidsCanvasHandle/TetrisCanvas: forwardRef exponiendo
// pause/resume/restart/forceGameOver vía useImperativeHandle.
```

`app/lib/data.ts` gana una entrada más en `GAMES` (mismo tipo `Game` existente, sin cambios de forma):

```ts
{
  id: "arkanoid",
  title: "ARKANOID",
  short: "Rebota, rompe bloques y limpia 5 niveles.",
  long: "Controla una paleta con teclado o mouse y rebota una pelota para pulverizar cinco tableros de bloques cromáticos cada vez más veloces. Tres vidas, cero piedad.",
  cat: "ARCADE",
  cover: "cover-arkanoid",
  color: "magenta",
  best: 0,
  plays: "0",
}
```

`app/game/registry.ts` gana una entrada más en `gameRegistry` (sin cambiar su forma, ver Alcance):

```ts
arkanoid: {
  Canvas: ArkanoidCanvas as ComponentType<unknown> as GameCanvasComponent,
  hasRealLeaderboard: true,
  secondaryStatLabel: "Vidas",
  formatSecondaryStat: formatHearts,
},
```

## Plan de implementación

1. **Assets** — copiar `references/started-games/04-arkanoid/assets/spritesheet-breakout.png`, `assets/sounds/ball-bounce.mp3` y `assets/sounds/break-sound.mp3` a `public/games/arkanoid/` (sin modificar los originales bajo `references/`).
2. **Helper de sprites portado** — crear `app/game/arkanoid/spritesheet.ts`: portar `loadSpritesheet`/`drawSprite`/`drawFrame`/`SPRITES`/`EXPLOSION_FRAMES`/`EXPLOSION_DURATION` de `references/started-games/04-arkanoid/assets/spritesheet.js` a TypeScript tipado, apuntando la carga de imagen a `/games/arkanoid/spritesheet-breakout.png`.
3. **Motor portado** — crear `app/game/arkanoid/levels.ts`: portar `LEVELS` de `levels.js` tal cual (5 niveles, mismos patrones de bloques y multiplicadores de velocidad). Crear `app/game/arkanoid/engine.ts`: portar `game.js` completo (estado, `update`/`draw`/`loop`, colisiones, paleta, pelota, bloques, explosiones) encapsulado en el closure de `createArkanoidGame(canvas, callbacks)`, usando `Audio` para los dos efectos de sonido apuntando a `/games/arkanoid/`. `W`/`H` fijos en 800×600 igual que el original. Al perder la 3ª vida o limpiar el nivel 5, el motor detiene el loop y llama `onGameOver(score)` una sola vez (sin el overlay interno de `gameover`/`win` dibujado en canvas ni el overlay de pausa con botones de salto de nivel).
4. **Ciclo de vida y listeners** — `keydown`/`keyup` y `mousemove` se agregan en `start()` y se remueven en `destroy()`. `pause()`/`resume()` siguen el mismo patrón que asteroides (reset de `lastTime` a `null` al reanudar para evitar saltos de `dt`). `restart()` reinicializa todo el estado (equivalente a `initPaddle()` + `loadLevel(1)` + `lives = 3`, `score = 0`) y vuelve a arrancar el loop.
5. **`app/game/arkanoid/ArkanoidCanvas.tsx`** — client component con `<canvas width={800} height={600}>`, mismo patrón `forwardRef`/`useImperativeHandle`/`useEffect` que `AsteroidsCanvas.tsx`, implementando el tipo `GameCanvasComponent` del registro (SPEC 07).
6. **`app/game/registry.ts`** — agregar la entrada `arkanoid` tal como se define en el modelo de datos, sin tocar las entradas `asteroides`/`tetris` ni la forma de `GameRegistryEntry`.
7. **`app/lib/data.ts`** — agregar la entrada `arkanoid` a `GAMES` tal como se define en el modelo de datos, sin modificar la entrada `bloque-buster` existente.
8. **Migración SQL** — crear `supabase/migrations/20260911000001_seed_arkanoid.sql` con el `insert` que siembra la fila `arkanoid` en `games` (mismos valores de la entrada de `GAMES`), aplicar con `mcp__supabase__apply_migration`.
9. **`app/globals.css`** — agregar regla `.cover-arkanoid` (mismo tratamiento visual que `.cover-tetris`/`.cover-asteroides` como clase independiente).
10. **Verificación final** — `npm run build` sin errores de tipos/lint; recorrido manual en `/game/arkanoid/play`: paleta se mueve con `←`/`→` y con el mouse, la pelota rebota en paredes/paleta/bloques, los bloques explotan y suman 10 puntos c/u, al limpiar un nivel carga el siguiente con más velocidad, el HUD (`player-hud`) refleja score/vidas/nivel reales, PAUSA detiene el juego y REANUDAR lo retoma, perder las 3 vidas o limpiar el nivel 5 dispara el modal existente de puntuación final, guardar puntuación inserta una fila real en `scores` con `slug = "arkanoid"` (confirmar con `mcp__supabase__execute_sql`), la fila aparece en `/game/arkanoid` (detalle) y en la pestaña ARKANOID de `/hall-of-fame`, "JUGAR DE NUEVO" reinicia limpio, SALIR no deja listeners/loop corriendo; confirmar que `/game/bloque-buster`, `/game/asteroides`, `/game/tetris` y el resto del catálogo no cambiaron de comportamiento.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores.
- [ ] `GAMES` incluye la entrada `arkanoid` con los campos definidos, sin alterar la entrada `bloque-buster`.
- [ ] `app/game/registry.ts` incluye la entrada `arkanoid` sin alterar `asteroides`/`tetris`.
- [ ] `/game/arkanoid` (detalle) muestra la portada `.cover-arkanoid`, título ARKANOID y lleva a `/game/arkanoid/play`.
- [ ] En `/game/arkanoid/play` la paleta se controla con `←`/`→` y con `mousemove` sobre el canvas.
- [ ] Los bloques se destruyen al ser golpeados, suman 10 puntos cada uno y disparan la animación de explosión con los sprites portados.
- [ ] Limpiar todos los bloques de un nivel carga el siguiente nivel (hasta 5) con la velocidad de pelota correspondiente.
- [ ] El `player-hud` muestra score/vidas/nivel reales, actualizados durante la partida.
- [ ] El botón PAUSA detiene visiblemente el juego y REANUDAR lo retoma sin perder el estado.
- [ ] El botón FIN fuerza el fin de partida inmediato y muestra el modal existente de puntuación final.
- [ ] Perder las 3 vidas o limpiar el nivel 5 dispara `onGameOver` y muestra el modal (no un overlay dibujado en el canvas).
- [ ] Guardar la puntuación inserta una fila real en la tabla `scores` con `slug = "arkanoid"` (verificable con `execute_sql`).
- [ ] La pestaña ARKANOID de `/hall-of-fame` muestra las filas reales de `scores` tras guardar una partida.
- [ ] "JUGAR DE NUEVO" arranca una partida nueva del motor real (nivel 1, vidas en 3, puntaje en 0).
- [ ] "SALIR" navega a `/game/arkanoid` y no deja el `requestAnimationFrame` ni los listeners de teclado/mouse activos.
- [ ] `/game/bloque-buster`, `/game/asteroides`, `/game/tetris` y el resto del catálogo no cambiaron de comportamiento.
- [ ] Ningún archivo bajo `references/` fue modificado.

## Decisiones tomadas y descartadas

- **Sí:** juego nuevo con id `arkanoid`, sin relación con la entrada mock `bloque-buster`. Decisión explícita del usuario — mismo patrón que asteroides/rocas y tetris/caída.
- **No:** reemplazar o renombrar `bloque-buster`. Queda intacta.
- **Sí:** registro por id ya generalizado en SPEC 07 (`app/game/registry.ts`) — esta spec solo agrega una entrada, no vuelve a tocar `play/page.tsx`, `[id]/page.tsx` ni `hall-of-fame/page.tsx` directamente. Decisión fija de la skill `/juego-nuevo`, no se reabre.
- **Sí:** leaderboard real vía Supabase bajo el slug `arkanoid`, reutilizando `getGames`/`getGameBySlug`/`getTopScores`/`insertScore` sin cambios. Decisión fija de la skill `/juego-nuevo`, no se reabre.
- **Sí:** portar el spritesheet PNG y los dos efectos de sonido del original en vez de redibujar con shapes planas. Decisión explícita del usuario — mantiene el arte original 1:1, a diferencia de asteroides/tetris que no tenían assets binarios de referencia. Introduce el primer helper de dibujo por sprites y el primer uso de `Audio` en un motor de este repo.
- **No:** controlar la paleta solo con teclado. Decisión explícita del usuario — se porta también el control por mouse (`mousemove`) del original.
- **No:** portar el click de salto de nivel del overlay de pausa original. Ese overlay se descarta junto con el resto de overlays dibujados en canvas (game over/win/pausa), reemplazados por los controles y el modal ya existentes del reproductor — el salto manual de nivel no tiene equivalente en la UI actual y no se agrega una nueva.
- **Sí:** completar el nivel 5 dispara `onGameOver(score)` igual que perder las 3 vidas, sin un estado "win" separado en React. Decisión explícita del usuario — un solo camino de fin de partida, reutilizando el modal existente sin nueva UI de victoria.
- **No:** controles táctiles/móvil en esta spec. Decisión explícita del usuario — el original tampoco los tiene fuera del mouse de escritorio.
- **Sí:** `.cover-arkanoid` como regla CSS nueva e independiente, color de acento `magenta` (distinto del `cyan` de `bloque-buster`) para diferenciar visualmente ambas entradas en el catálogo.
- **Sí:** assets copiados a `public/games/arkanoid/` (carpeta nueva, namespaced por juego) en vez de a la raíz de `public/`, para no mezclarlos con los íconos genéricos de Next.js ya presentes ahí.

## Riesgos identificados

| Riesgo                                                                                                                          | Mitigación                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El listener de `mousemove` en el canvas puede seguir activo tras salir de `/game/arkanoide/play` si `destroy()` no lo remueve   | `destroy()` debe remover explícitamente el listener de `mousemove` del canvas además de los de teclado; verificar en el paso 10 que no siga respondiendo tras SALIR.                           |
| `Audio`/`cloneNode().play()` del original puede fallar o generar warnings en navegadores que bloquean autoplay sin gesto previo | Aceptado como riesgo menor — el primer sonido se dispara tras una tecla/mouse move del jugador (gesto de usuario), igual que el original; no se agrega manejo de error nuevo.                  |
| Agregar una segunda entrada a `gameRegistry` puede introducir una regresión si se rompe la forma de `GameRegistryEntry`         | El motor de arkanoid implementa `GameCanvasComponent` exactamente igual que `AsteroidsCanvas`/`TetrisCanvas`; verificar `npm run build` y que asteroides/tetris sigan jugables tras el cambio. |
