# 11 — Rendimiento de Frogger

**Estado:** Aprobado
**Depende de:** `specs/game-jam/frogger/01-frogger-core.md`, SPEC 10
**Fecha:** 2026-09-25

**Objetivo:** Que Frogger mantenga 60 fps en escritorio y al menos 30 fps en equipos de gama baja en las tres skins, con una simulación idéntica a cualquier tasa de refresco, sin cambiar su mecánica ni su aspecto.

## Por qué existe esta spec

La auditoría de `app/game/frogger/engine.ts` (2026-09-25) encontró cinco costos evitables:

- La skin `neon` activa `ctx.shadowBlur` en cada entidad y en el HUD en cada frame. Son unas 40 figuras con desenfoque por frame, la operación más cara del canvas 2D, sobre todo en Firefox, Safari y móviles.
- El fondo estático (zonas, líneas de carretera, bocas vacías) se redibuja con primitivas en cada frame.
- `update(dt)` recibe `dt` de hasta 100 ms. En un frame lento o en niveles altos una entidad avanza más de una celda de golpe y el resultado depende de la tasa de refresco.
- En pausa el loop sigue dibujando a la tasa del monitor sin que nada cambie.
- `drawTurtles` crea arrays en cada frame y `laneAt` recorre los carriles con `find` varias veces por frame.

## Alcance

**Incluye:**

- Simulación con paso fijo de 1/120 s y acumulador, con tope de pasos por frame.
- Contexto 2D creado con `{ alpha: false }`.
- Loop detenido en pausa: se pinta un frame al pausar y el loop se reanuda con `resume()`.
- Caché de sprites offscreen por skin para coches, camiones, troncos, tortugas (visibles y sumergidas), rana (en reposo y saltando) y rana en boca ocupada. El glow de `neon` se hornea una vez en cada sprite con `withGlow` de `app/game/skins.ts`.
- Capa de fondo estático cacheada por skin: zonas, líneas discontinuas y bocas vacías con su borde.
- HUD de la fila 0 en una capa cacheada que solo se redibuja cuando cambia `score`, `level` o `lives`. La barra de tiempo se dibuja cada frame recortando un sprite prehorneado.
- Eliminar las asignaciones de memoria por frame en el dibujo y reemplazar `laneAt` por un índice por fila.
- Coordenadas de dibujo redondeadas a píxel entero.
- Contador de FPS en el canvas, activado con el query param `?fps=1` en `/game/frogger/play`.
- Verificación manual en Chrome/Edge (incluida CPU 4× throttling), Firefox, Safari iOS y Chrome Android.

**Fuera de alcance (para futuras specs):**

- Cambios de rendimiento en `asteroides`, `tetris`, `arkanoid` o `snake`.
- Cualquier cambio en `app/game/skins.ts`, `app/game/registry.ts`, `app/game/touch.ts`, la play-page común o `app/globals.css`: `withGlow` se reutiliza tal cual.
- Calidad adaptativa: apagar efectos automáticamente si caen los fps.
- Escalar el backing store del canvas por `devicePixelRatio`: se mantiene en 640 × 600.
- Tope de velocidad por nivel o cualquier otro cambio de balance o mecánica.
- Contador de FPS común reutilizable para todos los juegos.
- Web Workers, `OffscreenCanvas` transferido o WebGL.

## Modelo de datos

La firma pública del motor gana un parámetro opcional de opciones:

```ts
// app/game/frogger/engine.ts
export interface FroggerOptions {
  showFps?: boolean; // dibuja el contador de FPS (lo activa ?fps=1)
}

export function createFroggerGame(
  canvas: HTMLCanvasElement,
  callbacks: FroggerCallbacks,
  skin: SkinId = DEFAULT_SKIN,
  options: FroggerOptions = {}
): FroggerGame;
```

`FroggerStats`, `FroggerCallbacks` y `FroggerGame` no cambian.

Constantes nuevas (internas):

```ts
const STEP_MS = 1000 / 120; // paso fijo de simulación
const MAX_STEPS_PER_FRAME = 12; // ~100 ms; el tiempo que sobra se descarta
const FPS_SAMPLE_MS = 500; // ventana del promedio del contador de FPS
```

Estado interno nuevo dentro de `createFroggerGame`:

```ts
let accumulator = 0; // ms pendientes de simular
let spriteCache = new Map<string, HTMLCanvasElement>(); // se vacía en setSkin
let backgroundLayer: HTMLCanvasElement | null = null; // se invalida en setSkin
let hudLayer: HTMLCanvasElement | null = null; // se invalida al cambiar score/level/lives o skin
const laneByRow: (Lane | undefined)[] = []; // índice por fila, se rehace en buildLanes
```

Claves del caché de sprites: `"<tipo>:<variante>"`, por ejemplo `car:0` (color del carril), `truck:3:1` (ancho y sentido), `log:4`, `turtle:up`, `turtle:down`, `frog:idle`, `frog:hop`, `frog:goal`, `timebar`. Todos los sprites de la skin activa comparten el mapa, que se vacía en `setSkin`.

`app/game/frogger/FroggerCanvas.tsx` lee `new URLSearchParams(window.location.search).get("fps") === "1"` dentro de su `useEffect` y lo pasa como `options.showFps`.

## Plan de implementación

1. **Paso fijo y contexto opaco.** En `loop`, acumular `dt` real y ejecutar `update(STEP_MS)` mientras `accumulator >= STEP_MS`, hasta `MAX_STEPS_PER_FRAME` pasos. El resto por encima del tope se descarta. Crear el contexto con `canvas.getContext("2d", { alpha: false })`. Prueba manual: el juego se ve y se juega igual que antes.
2. **Loop detenido en pausa.** `pause()` detiene el loop y pinta un frame. `resume()` reinicia el loop con `lastTime = null` y `accumulator = 0`. `setSkin` sigue repintando un frame cuando el loop está detenido. Prueba manual: PAUSA congela la imagen y REANUDAR continúa sin salto.
3. **Sin asignaciones por frame.** Crear `laneByRow` en `buildLanes`/`initGame`/`completeRound` y usarlo en `laneAt`. Pasar los offsets de escamas de `drawTurtles` a una constante de módulo. Redondear a entero las coordenadas `x`/`y` de todo `drawImage`/`fillRect` por frame.
4. **Infraestructura del caché de sprites.** Función interna `getSprite(key, w, h, paint)`. Si la clave no está, crea un canvas de `w × h`, llama a `paint(ctx)` y, si `palette.glow > 0`, lo envuelve con `withGlow(sprite, palette.glow, color)`. Lo guarda en `spriteCache` y lo devuelve con su `pad`. `setSkin` vacía el caché.
5. **Entidades como sprites.** `drawCar`, `drawTruck`, `drawLog` y `drawTurtles` pasan a pintarse una vez dentro de `getSprite` con el mismo dibujo actual. El dibujo por frame solo hace `drawImage` en `(x - pad, y - pad)`.
6. **Rana como sprite.** `frog:idle`, `frog:hop` (patas extendidas) y `frog:goal` (escala 0.8 para bocas ocupadas) pasan a sprites.
7. **Fondo cacheado.** `backgroundLayer` de 640 × 600 con zonas, líneas discontinuas y bocas vacías con borde (y glow en `neon`), construido una vez por skin. `draw()` empieza con un único `drawImage(backgroundLayer, 0, 0)`.
8. **HUD cacheado.** `hudLayer` de 640 × 40 con score, nivel e iconos de vida, reconstruido solo cuando cambian `score`, `level` o `lives` o la skin. La barra de tiempo usa el sprite `timebar` del color correspondiente (verde/amarillo/rojo), recortado al ancho proporcional con `drawImage(src, 0, 0, w, h, x, y, w, h)`.
9. **Sin `shadowBlur` por frame.** Eliminar `glowOn`/`glowOff` y el reset de `shadowBlur` de `draw()`. `shadowBlur` solo aparece dentro de `withGlow` y de los constructores de sprites y capas.
10. **Contador de FPS.** Con `options.showFps`, promediar frames cada `FPS_SAMPLE_MS` y dibujar `FPS <n>` en la esquina inferior izquierda de la fila de inicio, fuera de la caché. `FroggerCanvas.tsx` pasa `showFps` desde `?fps=1`.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores de TypeScript ni de ESLint.
- [ ] Solo cambian `app/game/frogger/engine.ts` y `app/game/frogger/FroggerCanvas.tsx`.
- [ ] En `engine.ts`, `shadowBlur` no se asigna en ninguna función que corra en cada frame (`draw` y lo que llama por frame). Solo aparece en la construcción de sprites y capas.
- [ ] `/game/frogger/play?fps=1` muestra el contador de FPS. Sin el parámetro no aparece.
- [ ] Chrome, escritorio, sin throttling: el contador marca ≥ 58 fps durante 30 s de juego en `clasico`, `neon` y `retro`.
- [ ] Chrome DevTools con CPU 4× throttling: el contador marca ≥ 30 fps durante 30 s de juego en las tres skins.
- [ ] Firefox escritorio: el contador marca ≥ 55 fps durante 30 s de juego en `neon`.
- [ ] Safari iOS y Chrome Android: el contador marca ≥ 30 fps durante 30 s de juego en las tres skins, con el gamepad táctil visible.
- [ ] Con CPU 6× throttling en Chrome, el temporizador de 15 s del nivel 1 se agota en 15 s ± 0.5 s, medido con reloj.
- [ ] Un camión de la fila 9 tarda lo mismo (± 5 %) en cruzar el tablero sin throttling y con CPU 6× throttling.
- [ ] Con 6× throttling, dejarse atropellar 5 veces en la fila 10 (la más rápida) produce 5 muertes; ningún coche atraviesa a la rana sin colisión.
- [ ] En pausa, la pestaña Performance de Chrome no registra frames de animación del juego durante 5 s. REANUDAR continúa sin que las entidades salten de posición.
- [ ] Cambiar de skin en partida, en pausa y tras el game over repinta con la skin nueva; la puntuación, las vidas y el nivel no cambian.
- [ ] Las tres skins se ven igual que antes de esta spec: mismos colores, formas, glow de `neon` y ausencia de suavizado en `retro` (comparación visual lado a lado con capturas de la rama anterior).
- [ ] La mecánica no cambia: saltos de 120 ms, colisiones, tortugas 3 s / 1.5 s, puntuación, bocas, rondas y vidas se comportan como en la spec de Frogger core.
- [ ] Los demás juegos no cambian de comportamiento.

## Decisiones

- **Sí:** meta de 60 fps en escritorio y ≥ 30 fps en gama baja (CPU 4× en DevTools y móviles reales), en las tres skins. Decisión del usuario.
- **No:** exigir 60 fps también con throttling. Obligaría a recortar el look de `neon`.
- **Sí:** glow prehorneado en sprites offscreen con `withGlow`, el mismo patrón que usa Snake. Mantiene el aspecto y deja el costo por frame casi en cero. Decisión del usuario.
- **No:** glow falso con halos dibujados. Cambia el look.
- **No:** apagar el glow automáticamente en gama baja. Decisión del usuario: no hay calidad adaptativa.
- **Sí:** contador de FPS activado con `?fps=1`, para medir en cualquier dispositivo sin DevTools. Decisión del usuario.
- **Sí:** paso fijo de 1/120 s con acumulador. La simulación es la misma a 30, 60 o 144 Hz, y un paso chico evita que las entidades rápidas atraviesen a la rana. Decisión del usuario.
- **No:** sub-pasos variables. La simulación variaría con la tasa de refresco.
- **Sí:** `MAX_STEPS_PER_FRAME = 12` y descarte del tiempo sobrante. Evita la espiral en la que un equipo lento simula cada vez más pasos por frame.
- **Sí:** fondo estático en una capa cacheada por skin. Decisión del usuario.
- **Sí:** HUD en una capa que solo se reconstruye cuando cambian sus valores. El texto con glow es costoso y cambia pocas veces por segundo.
- **Sí:** el loop se detiene en pausa. Revierte la decisión de la spec de Frogger core ("`draw()` sigue en pausa"), para ahorrar CPU y batería. Decisión del usuario.
- **Sí:** `{ alpha: false }` en el contexto. El tablero es opaco y el navegador puede saltarse la composición con transparencia.
- **No:** escalar por `devicePixelRatio`. Multiplicaría los píxeles por frame en móviles de alta densidad, lo contrario de esta spec.
- **Sí:** solo Frogger. `skins.ts` se reutiliza sin cambios. Decisión del usuario.
- **Sí:** el contador de FPS lo lee `FroggerCanvas.tsx` desde `window.location` y lo pasa como opción, para que el motor no dependa de la URL.

## Riesgos identificados

| Riesgo                                                                                                                                                             | Mitigación                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Los sprites con glow tienen un margen `pad = glow * 2`; mal aplicado, las entidades se ven desplazadas                                                             | Todo `drawImage` de sprite resta el `pad` que devuelve `getSprite`. Criterio de comparación visual lado a lado.  |
| `retro` usa `imageSmoothingEnabled = false`; un sprite dibujado en coordenadas fraccionarias se vería tembloroso                                                   | Coordenadas redondeadas a entero (paso 3).                                                                       |
| Las velocidades crecen 15 % por nivel sin tope; en niveles muy altos (≈ 30) una entidad podría avanzar más de 1.7 celdas por paso de 1/120 s y atravesar a la rana | Fuera de alcance: requiere un tope de velocidad, que es un cambio de balance. Se documenta para una spec futura. |
| Con `MAX_STEPS_PER_FRAME`, un equipo que no llega a ~10 fps ve el juego en cámara lenta                                                                            | Aceptado: por debajo de ese umbral no hay forma de simular en tiempo real sin saltos. La meta mínima es 30 fps.  |
| Construir los sprites de golpe al cambiar de skin puede causar un frame lento                                                                                      | El caché es perezoso: cada sprite se crea la primera vez que se usa. Son pocos y pequeños.                       |

## Qué **no** está en esta spec

- Rendimiento de los demás juegos.
- Cambios en `skins.ts`, el registro, la play-page común o el CSS.
- Calidad adaptativa.
- Escalado por `devicePixelRatio`.
- Tope de velocidad por nivel o cambios de balance.
- Contador de FPS común para todos los juegos.

Cada uno de esos, si llega, va en su propia spec.
