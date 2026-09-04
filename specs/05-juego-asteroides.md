# 05 — Juego Asteroides (primer juego real)

**Estado:** Aprobado
**Depende de:** SPEC 01, SPEC 02
**Fecha:** 2026-09-01

**Objetivo:** Portar el juego Asteroids de `references/started-games/02-asteroids/game.js` a TypeScript y montarlo como juego jugable real en `/game/asteroides/play`, sustituyendo ahí el arena simulada del reproductor genérico.

## Alcance

**Incluye:**

- Nueva entrada en `GAMES` (`app/lib/data.ts`) con `id: "asteroides"`, distinta y sin relación con la entrada mock existente `rocas` (que sigue existiendo tal cual, sin tocarse).
- Port del motor de juego (`Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`, constantes `RADII`/`SPEEDS`/`POINTS`/`POWERUP_*`/`TRIPLE_SPREAD`, utilidades `wrap`/`dist`/`rand`/`randInt`) a un módulo TypeScript nuevo, sin cambiar la mecánica de juego: movimiento, rotación, propulsión, disparo, wrap toroidal, división de asteroides por tamaño, partículas de explosión, invencibilidad temporal al reaparecer, power-up de disparo triple con su probabilidad de drop y duración.
- Controles: solo teclado, idénticos al original (`←`/`→` rotar, `↑` propulsar, `Espacio` disparar).
- Integración con el reproductor existente (`app/game/[id]/play/page.tsx`): cuando `id === "asteroides"`, el `.crt-screen` monta el canvas real del juego en vez del `.game-arena` simulado; el resto de juegos (cualquier otro id) sigue exactamente igual que hoy.
- El `player-hud` existente (Jugador/Puntuación/Vidas/Nivel) se reutiliza tal cual, alimentado por el juego real en vez del temporizador falso que incrementa puntaje al azar.
- Los botones existentes PAUSA / FIN / SALIR controlan el juego real: PAUSA detiene el loop (`requestAnimationFrame`) del motor, FIN fuerza el fin de partida y dispara el modal de guardar puntuación ya existente, SALIR desmonta el canvas (limpiando listeners y el loop) y navega como hoy.
- Fin de partida: reutiliza el modal (`over`) y el flujo de guardado en `localStorage["av_scores"]` ya implementados en `play/page.tsx`, sin cambios en ese mecanismo. El overlay interno de "GAME OVER" que dibuja el `game.js` original queda reemplazado por ese modal — no se muestran ambos a la vez.
- "JUGAR DE NUEVO" en el modal reinicia el motor real (nueva partida limpia), no solo el estado de React.
- Nueva regla CSS `.cover-asteroides` en `app/globals.css` para la tarjeta/portada de esta entrada en biblioteca y detalle (mismo tratamiento visual que `.cover-rocas`, como clase independiente).

**Fuera de alcance (para futuras specs):**

- Controles táctiles/móvil — el juego queda limitado a teclado, igual que la referencia.
- Persistencia real de puntuaciones vía Supabase — sigue usando `localStorage["av_scores"]` como el resto de la plataforma (SPEC 04 solo dejó el cliente configurado, sin tablas).
- Cualquier cambio a la entrada mock `rocas` existente.
- Portar o tocar otros juegos de `references/started-games/` — esta spec es exclusivamente Asteroides.
- Generalizar `/game/[id]/play` con un registro/mapa de componentes por id más allá del `if (id === "asteroides")` puntual — se deja para cuando exista un segundo juego real.
- Ajustes de balance/dificultad respecto al original (puntos, velocidades, probabilidad de power-up, etc.).
- Tests automatizados (no hay framework configurado en el repo).

## Modelo de datos

No se introduce persistencia nueva. Se agregan tipos de integración entre el motor portado y React:

```ts
// app/game/asteroides/engine.ts
export interface AsteroidsStats {
  score: number;
  lives: number;
  level: number;
}

export interface AsteroidsCallbacks {
  onStats: (stats: AsteroidsStats) => void; // se invoca solo cuando cambia algún valor, no por frame
  onGameOver: (finalScore: number) => void; // se invoca una vez al llegar a 0 vidas
}

export interface AsteroidsGame {
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void; // detiene el loop y quita listeners de teclado
}

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks
): AsteroidsGame;
```

```ts
// app/game/asteroides/AsteroidsCanvas.tsx — API expuesta vía ref al contenedor
export interface AsteroidsCanvasHandle {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  forceGameOver: () => void;
}
```

`app/lib/data.ts` gana una entrada más en `GAMES` (mismo tipo `Game` existente, sin cambios de forma):

```ts
{
  id: "asteroides",
  title: "ASTEROIDES",
  short: "Pulveriza asteroides en gravedad cero.",
  long: "Nave triangular a la deriva en un campo de asteroides toroidal. Rota, propulsa y dispara para partir rocas grandes en fragmentos cada vez más pequeños. Un power-up cian ocasional entrega disparo triple por unos segundos.",
  cat: "SHOOTER",
  cover: "cover-asteroides",
  color: "cyan",
  best: 0,
  plays: "0",
}
```

## Plan de implementación

1. **Motor portado** — crear `app/game/asteroides/engine.ts`: portar `game.js` completo (clases, constantes, funciones de update/draw/loop) a TypeScript tipado, encapsulando lo que hoy son variables globales (`ship`, `bullets`, `asteroids`, `particles`, `powerUps`, `score`, `lives`, `level`, `state`, `deadTimer`, etc.) dentro del closure devuelto por `createAsteroidsGame(canvas, callbacks)`. `W`/`H` fijos en 800×600 igual que el original. `onStats` se dispara tras cada `update()` en que cambie score/vidas/nivel. Al llegar `lives <= 0`, en vez de entrar al estado interno `'gameover'` con su overlay dibujado y reinicio por Espacio, el motor detiene el loop y llama `onGameOver(score)` una sola vez.
2. **Ciclo de vida y listeners** — los `addEventListener('keydown'/'keyup', ...)` se agregan dentro de `start()` y se remueven en `destroy()` (no a nivel de módulo como el original), para no dejar listeners vivos al navegar fuera de `/game/asteroides/play`. `pause()` detiene el `requestAnimationFrame` sin reiniciar el estado; `resume()` lo retoma; `restart()` reinicializa todo el estado interno (equivalente a `initGame()` del original) y vuelve a arrancar el loop.
3. **`app/game/asteroides/AsteroidsCanvas.tsx`** — client component con `<canvas width={800} height={600}>` a `100%` de su contenedor (el `.crt-screen` ya tiene `aspect-ratio: 4/3`, igual que 800×600, así que el canvas se escala por CSS sin distorsión). Usa `useRef` para el `<canvas>` y `useEffect` para llamar `createAsteroidsGame` al montar y `destroy()` al desmontar. Expone `pause`/`resume`/`restart`/`forceGameOver` vía `useImperativeHandle` sobre un `ref` reenviado (`forwardRef`), donde `forceGameOver` llama internamente a la misma ruta que dispara `onGameOver` (pone vidas a 0 y notifica).
4. **`app/game/[id]/play/page.tsx`** — cuando `game.id === "asteroides"`: renderizar `<AsteroidsCanvas ref={engineRef} onStats={...} onGameOver={...} />` dentro de `.crt-screen` en vez de `.game-arena`; quitar para este id los dos `useEffect` actuales que simulan el puntaje (timer aleatorio y level-up por umbral de score), ya que ahora `score`/`lives`/`level` de React se actualizan desde `onStats`; conectar el botón PAUSA a `engineRef.current.pause()/resume()` (alternando con el estado `paused` ya existente), el botón FIN a `engineRef.current.forceGameOver()`, y en el modal el botón "JUGAR DE NUEVO" a `engineRef.current.restart()` además del reseteo de estado React (`score`, `lives`, `level`, `paused`, `over`, `saved`) que ya existe. Para cualquier otro id, el comportamiento actual (arena simulada, timer falso) no cambia.
5. **`app/lib/data.ts`** — agregar la entrada `asteroides` a `GAMES` tal como se define en el modelo de datos, sin modificar la entrada `rocas` existente.
6. **`app/globals.css`** — agregar regla `.cover-asteroides` (mismo tratamiento visual que `.cover-rocas`: fondo radial oscuro + destellos, ver líneas 472-490 actuales) como clase independiente para no acoplar dos entradas del catálogo distintas.
7. **Verificación final** — `npm run build` sin errores de tipos/lint; recorrido manual en `/game/asteroides/play`: nave rota/propulsa/dispara con teclado, asteroides se parten al ser destruidos, power-up cian da disparo triple, el HUD (`player-hud`) refleja puntaje/vidas/nivel reales, PAUSA detiene el juego y REANUDAR lo retoma, perder las 3 vidas dispara el modal existente (no el overlay interno de `game.js`), guardar puntuación escribe en `localStorage["av_scores"]`, "JUGAR DE NUEVO" reinicia una partida limpia, SALIR navega sin dejar el loop corriendo en segundo plano (verificar que no siga sumando CPU/eventos tras salir); confirmar que `/game/rocas/play` y el resto de juegos no cambiaron de comportamiento.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores.
- [ ] `GAMES` incluye la entrada `asteroides` con los campos definidos, sin alterar la entrada `rocas`.
- [ ] `/game/asteroides` (detalle) muestra la portada `.cover-asteroides`, título ASTEROIDES y lleva a `/game/asteroides/play`.
- [ ] En `/game/asteroides/play` la nave se controla con `←`/`→`/`↑`/`Espacio` exactamente como en `references/started-games/02-asteroids`.
- [ ] Los asteroides grandes se dividen en medianos y estos en pequeños al ser destruidos; los pequeños no se dividen.
- [ ] El power-up cian aparece según la misma lógica del original (garantizado a los 5 kills sin drop previo, o probabilidad 15% antes) y otorga disparo triple por 5 segundos.
- [ ] El `player-hud` (Jugador/Puntuación/Vidas/Nivel) muestra los valores reales del motor, actualizados durante la partida.
- [ ] El botón PAUSA detiene visiblemente el juego (nave/asteroides dejan de moverse) y REANUDAR lo retoma sin perder el estado.
- [ ] El botón FIN fuerza el fin de partida inmediato y muestra el modal existente de puntuación final.
- [ ] Perder las 3 vidas jugando muestra el modal de puntuación final (no un overlay dibujado dentro del canvas).
- [ ] Guardar la puntuación desde el modal persiste en `localStorage["av_scores"]` igual que hoy para el resto de juegos.
- [ ] "JUGAR DE NUEVO" arranca una partida nueva del motor real (asteroides reposicionados, vidas en 3, puntaje en 0).
- [ ] "SALIR" navega a `/game/asteroides` y no deja el `requestAnimationFrame` ni los listeners de teclado activos.
- [ ] Ningún otro juego (`/game/rocas/play`, etc.) cambió de comportamiento respecto al mock actual.
- [ ] Ningún archivo bajo `references/` fue modificado.

## Decisiones tomadas y descartadas

- **Sí:** juego nuevo con id `asteroides`, sin relación con la entrada mock `rocas`. Decisión explícita del usuario — son juegos distintos aunque compartan temática.
- **No:** reemplazar o renombrar la entrada `rocas`. Queda intacta.
- **Sí:** port mínimo del motor envuelto en `useEffect`/`useRef`, conservando las clases y la estructura del `game.js` original casi 1:1, solo tipado y encapsulado en un closure en vez de variables globales de módulo. Decisión explícita del usuario — menor riesgo de romper el gameplay ya afinado que una reescritura a hooks de React.
- **No:** reescribir la lógica del juego con `useState`/`useReducer` por objeto. Se descarta por el mismo motivo.
- **Sí:** sincronización del HUD mediante callback (`onStats`) del motor hacia el estado de React del contenedor, reutilizando el `player-hud` ya existente sin cambios visuales. Decisión explícita del usuario.
- **No:** ocultar `player-hud` y dejar que el motor dibuje su propio HUD dentro del canvas (`drawHUD` del original). Se descarta a favor de reutilizar el HUD de React.
- **Sí:** los botones PAUSA/FIN/SALIR del contenedor controlan el motor real vía una API expuesta por `ref` (`pause`/`resume`/`forceGameOver`/`restart`). Decisión explícita del usuario.
- **Sí:** el overlay interno de "GAME OVER" del `game.js` original (dibujado en el canvas, reinicio con Espacio) se reemplaza por el modal React ya existente — evita mostrar dos pantallas de fin de partida superpuestas.
- **No:** controles táctiles/móvil en esta spec. Decisión explícita del usuario — el original tampoco los tiene.
- **Sí:** el power-up de disparo triple (`PowerUp`, `tripleShot`, `POWERUP_DROP_CHANCE`, `POWERUP_DURATION`, `TRIPLE_SPREAD`) se porta igual, sin cambios de balance. Decisión explícita del usuario.
- **Sí:** canvas interno fijo en 800×600, escalado por CSS dentro de `.crt-screen` (que ya usa `aspect-ratio: 4/3`, coincidente). No se rediseña como responsive de resolución variable.
- **Sí:** `.cover-asteroides` como regla CSS nueva e independiente de `.cover-rocas`, aunque visualmente similar, para no acoplar dos entradas de catálogo distintas.
- **No:** generalizar `/game/[id]/play` con un registro de componentes por id. Se resuelve con un `if (id === "asteroides")` puntual; se revisita cuando exista un segundo juego real.

## Riesgos identificados

| Riesgo                                                                                                                                                                                                       | Mitigación                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Listeners de teclado (`keydown`/`keyup`) o el `requestAnimationFrame` del motor quedan vivos tras salir de `/game/asteroides/play`, afectando otras pantallas                                                | `destroy()` debe cancelar el `requestAnimationFrame` pendiente y remover explícitamente los listeners agregados en `start()`; verificar en el paso 7 que no sigan disparando tras SALIR.                        |
| Modificar `play/page.tsx` con la rama condicional rompe el mock existente para otros juegos                                                                                                                  | Cambio acotado a un `if (game.id === "asteroides")` alrededor del contenido de `.crt-screen` y de los `useEffect` de simulación; verificar manualmente `/game/rocas/play` (u otro id) sin cambios tras la spec. |
| El motor original asume `dt` en segundos capado a 50ms vía `requestAnimationFrame`; si el componente React lo pausa/reanuda de forma imprecisa puede producirse un salto de física (`dt` grande) al reanudar | Al hacer `resume()`, reiniciar la referencia de `lastTime` a `null` (como hace `loop()` en el primer frame) para que el primer `dt` tras reanudar sea 0, igual que al iniciar.                                  |
