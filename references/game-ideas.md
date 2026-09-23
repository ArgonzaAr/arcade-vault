# Ideas de juegos evaluadas

Memoria del agente `game-planner`. Cada sección `##` es una idea ya evaluada: el agente la lee
antes de proponer nada y escribe aquí todo lo que evalúa, incluidas las ideas descartadas y su
razón. Complementa a `references/implemented-games.md` (que solo lista lo que ya vive en Supabase).

Estados: `Propuesta` · `Aceptada` (spec en camino) · `Implementada` · `Descartada`.

Última actualización: 2026-09-22

## ASTEROIDES

- **Slug propuesto**: `asteroides`
- **Género**: shooter espacial de inercia
- **Estado**: Implementada
- **Fecha de evaluación**: 2026-09-04
- **Encaje**: canvas 2D, un jugador, score creciente, game over por pérdida de vidas.
- **Hueco que cubre**: control de rotar + propulsar con inercia; ritmo de reflejos.
- **Stat secundario propuesto**: Vidas (corazones)
- **Complejidad estimada**: media
- **Veredicto**: primer juego con motor real y primera integración con Supabase.
- **Spec**: `specs/05-juego-asteroides.md`

## TETRIS

- **Slug propuesto**: `tetris`
- **Género**: puzzle de caída de piezas
- **Estado**: Implementada
- **Fecha de evaluación**: 2026-09-11
- **Encaje**: partida corta, score creciente, game over por desborde del tablero.
- **Hueco que cubre**: primer puzzle reflexivo del catálogo y primer tablero vertical
  (`screenClassName: "crt-screen--narrow"`).
- **Stat secundario propuesto**: Líneas (número)
- **Complejidad estimada**: alta
- **Veredicto**: estableció el precedente de tablero fuera del 4:3 por defecto.
- **Spec**: `specs/07-juego-tetris.md`

## ARKANOID

- **Slug propuesto**: `arkanoid`
- **Género**: rompe-bloques
- **Estado**: Implementada
- **Fecha de evaluación**: 2026-09-12
- **Encaje**: cinco niveles, tres vidas, score creciente.
- **Hueco que cubre**: control lateral de una paleta; física de rebote.
- **Stat secundario propuesto**: Vidas (corazones)
- **Complejidad estimada**: media
- **Veredicto**: portado desde `references/started-games/04-arkanoid/`, con assets propios.
- **Spec**: `specs/08-juego-arkanoid.md`

## SNAKE

- **Slug propuesto**: `snake`
- **Género**: arcade de rejilla
- **Estado**: Implementada
- **Fecha de evaluación**: 2026-09-15
- **Encaje**: tablero toroidal, velocidad creciente, game over por auto-colisión.
- **Hueco que cubre**: control direccional discreto sobre rejilla; stat secundario no vital
  (longitud en vez de vidas).
- **Stat secundario propuesto**: Longitud (número)
- **Complejidad estimada**: baja
- **Veredicto**: creado desde cero (no había motor en `references/started-games/`), con sprites
  en `references/source-assets/snake-assets/`.
- **Spec**: `specs/09-juego-snake.md`

## DEFENSA ORBITAL (Missile Command)

- **Slug propuesto**: `defensa-orbital`
- **Género**: defensa por oleadas con apuntado libre
- **Estado**: Propuesta
- **Fecha de evaluación**: 2026-09-22
- **Encaje**: canvas 2D, un jugador, score creciente por misil interceptado y por ciudad
  superviviente al final de cada oleada; game over cuando caen las seis ciudades. Todo el render
  es vectorial (líneas y círculos en expansión), sin un solo asset.
- **Hueco que cubre**: primer control de **apuntado libre con cursor** (arkanoid usa el mouse,
  pero solo en un eje) y primer juego **defensivo** por oleadas del catálogo — los cuatro
  existentes son ofensivos o de supervivencia.
- **Stat secundario propuesto**: Ciudades (corazones, vía `formatHearts`)
- **Complejidad estimada**: media — trayectorias balísticas, explosiones con radio y detección
  de colisión círculo-punto, tres baterías con munición finita, curva de oleadas.
- **Veredicto**: **recomendado**. Eje de control genuinamente nuevo, cero assets, estética
  vectorial que es literalmente el look CRT de la plataforma, 4:3 sin `screenClassName`, y una
  complejidad entregable frente a la alternativa del laberinto.
- **Spec**: —

## MAZE MUNCHER (laberinto con perseguidores)

- **Slug propuesto**: `maze-muncher`
- **Género**: laberinto con IA de perseguidores
- **Estado**: Propuesta
- **Fecha de evaluación**: 2026-09-22
- **Encaje**: rejilla, score por puntos comidos y por perseguidor capturado durante el power-up,
  vidas finitas, game over claro.
- **Hueco que cubre**: primer juego con **IA de enemigos** y primer laberinto; añade un eje
  táctico (planificar ruta) que hoy solo tetris roza.
- **Stat secundario propuesto**: Vidas (corazones)
- **Complejidad estimada**: alta — cuatro perseguidores con personalidades distintas, modos
  scatter/chase/frightened, pathfinding en rejilla, túneles laterales, diseño del laberinto.
- **Veredicto**: excelente candidato, pero es el más caro del lote. Dejarlo como el siguiente
  después de `defensa-orbital`. Usar nombre genérico para no calcar la marca original.
- **Spec**: —

## SALTO INFINITO (plataformas verticales)

- **Slug propuesto**: `salto-infinito`
- **Género**: plataformas de ascenso infinito
- **Estado**: Propuesta
- **Fecha de evaluación**: 2026-09-22
- **Encaje**: control lateral con salto automático, scroll vertical procedural, game over al
  caer fuera de pantalla. Reutilizaría `screenClassName: "crt-screen--narrow"` de tetris.
- **Hueco que cubre**: primer juego con **salto y gravedad**, y primer generador procedural
  infinito.
- **Stat secundario propuesto**: Altura (número) — **punto débil**: la altura *es* el score, así
  que el stat secundario del HUD quedaría redundante salvo que se use "Plataformas".
- **Complejidad estimada**: baja
- **Veredicto**: el más barato de los tres, pero el más flojo como competencia por puntos: el
  score se solapa con el único stat interesante. Mantener en la recámara.
- **Spec**: —

## INVASORES (Space Invaders)

- **Slug propuesto**: `invasores`
- **Género**: shooter de oleadas con control lateral
- **Estado**: Descartada
- **Fecha de evaluación**: 2026-09-22
- **Encaje**: técnicamente encaja sin fricción alguna.
- **Hueco que cubre**: ninguno. Duplica el género shooter de `asteroides` y el control lateral
  de `arkanoid`, sin aportar un eje nuevo.
- **Stat secundario propuesto**: Vidas (corazones)
- **Complejidad estimada**: baja
- **Veredicto**: **descartada por redundancia**, no por dificultad. Reconsiderar solo si se
  busca deliberadamente un juego barato de añadir al catálogo.
- **Spec**: —

## CRUCE DE CARRILES (Frogger)

- **Slug propuesto**: `cruce-de-carriles`
- **Género**: esquiva por carriles con timing
- **Estado**: Descartada
- **Fecha de evaluación**: 2026-09-22
- **Encaje**: rejilla vertical, score por travesía completada, vidas finitas.
- **Hueco que cubre**: poco. El control direccional discreto ya lo cubre `snake`, y el ritmo de
  reflejos está saturado (tres de cuatro juegos).
- **Stat secundario propuesto**: Vidas (corazones)
- **Complejidad estimada**: media — los troncos flotantes y el arrastre del jugador son la parte
  fina, y sin assets se ve pobre.
- **Veredicto**: **descartada**: aporte marginal al catálogo y dependería de sprites para no
  verse genérico. Reconsiderar si aparece un set de assets propio.
- **Spec**: —
