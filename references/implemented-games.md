# Juegos implementados

Datos extraídos de Supabase (tablas `games` y `scores`) el 2026-09-28.

## ASTEROIDES

- **Slug**: `asteroides`
- **Categoría**: SHOOTER
- **Color**: cyan
- **Descripción corta**: Pulveriza asteroides en gravedad cero.
- **Descripción larga**: Nave triangular a la deriva en un campo de asteroides toroidal. Rota, propulsa y dispara para partir rocas grandes en fragmentos cada vez más pequeños. Un power-up cian ocasional entrega disparo triple por unos segundos.
- **Motor real**: sí (`app/game/asteroides/`), primer juego con motor real y primera integración con Supabase.
- **Spec**: `specs/05-juego-asteroides.md`
- **Stat secundario del HUD**: Vidas (corazones)
- **Puntajes registrados**: 1 (mejor: 4080)
- **Creado**: 2026-09-04

## TETRIS

- **Slug**: `tetris`
- **Categoría**: PUZZLE
- **Color**: cyan
- **Descripción corta**: Encaja piezas antes de que el tablero se desborde.
- **Descripción larga**: Ocho tipos de pieza caen por un tablero de 10x20. Rótalas con wall kicks, usa la pieza fantasma para apuntar y limpia líneas para subir de nivel. La velocidad de caída aumenta cada 10 líneas.
- **Motor real**: sí (`app/game/tetris/`), tablero angosto (`screenClassName: "crt-screen--narrow"`).
- **Spec**: `specs/07-juego-tetris.md`
- **Stat secundario del HUD**: Líneas (número)
- **Puntajes registrados**: 1 (mejor: 164)
- **Creado**: 2026-09-11

## ARKANOID

- **Slug**: `arkanoid`
- **Categoría**: ARCADE
- **Color**: magenta
- **Descripción corta**: Rebota, rompe bloques y limpia 5 niveles.
- **Descripción larga**: Controla una paleta con teclado o mouse y rebota una pelota para pulverizar cinco tableros de bloques cromáticos cada vez más veloces. Tres vidas, cero piedad.
- **Motor real**: sí (`app/game/arkanoid/`)
- **Spec**: `specs/08-juego-arkanoid.md`
- **Stat secundario del HUD**: Vidas (corazones)
- **Puntajes registrados**: 1 (mejor: 50)
- **Creado**: 2026-09-12

## SNAKE

- **Slug**: `snake`
- **Categoría**: ARCADE
- **Color**: green
- **Descripción corta**: Come, crece y no te muerdas la cola.
- **Descripción larga**: Víbora clásica sobre un tablero toroidal: atraviesa los bordes sin penalidad, come frutas para crecer y ganar puntos, y evita chocar contra tu propio cuerpo mientras la velocidad aumenta con cada fruta.
- **Motor real**: sí (`app/game/snake/`)
- **Spec**: `specs/09-juego-snake.md`
- **Stat secundario del HUD**: Longitud (número)
- **Puntajes registrados**: 1 (mejor: 240)
- **Creado**: 2026-09-15

## FROGGER

- **Slug**: `frogger`
- **Categoría**: ARCADE
- **Color**: green
- **Descripción corta**: Cruza la carretera y el río sin convertirte en papilla.
- **Descripción larga**: Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.
- **Motor real**: sí (`app/game/frogger/`), pantalla propia (`screenClassName: "crt-screen--frogger"`).
- **Spec**: `specs/game-jam/frogger/` (motor + integración) y `specs/11-frogger-rendimiento.md`
- **Stat secundario del HUD**: Vidas (corazones)
- **Puntajes registrados**: 1 (mejor: 410)
- **Creado**: 2026-09-25

---

Todos los juegos usan el patrón genérico de cuatro funciones por slug (`getGames`, `getGameBySlug` en `app/lib/supabase/queries.ts`; `getTopScores`, `insertScore` en `queries.client.ts`), y están registrados en `app/game/registry.ts` con `touchControls` y skins `clasico`/`neon`/`retro`.
