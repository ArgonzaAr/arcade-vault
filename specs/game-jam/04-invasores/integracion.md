# GJ-04.2 — Juego Invasores (integración y leaderboard)

**Estado:** Borrador
**Pedido:** "Invasores" — shooter de invasores alienígenas por oleadas, estilo clásico de marcianitos, con nombre genérico propio
**Depende de:** GJ-04.1, SPEC 06
**Fecha:** 2026-09-23

**Objetivo:** Integrar el motor de GJ-04.1 en el catálogo, el registro y el leaderboard real de Supabase bajo el slug `invasores`, con portada propia `.cover-invasores`.

## Alcance

**Incluye:**

- Nueva entrada `invasores` en `GAMES` (`app/lib/data.ts`), con `cat: "SHOOTER"` y `color: "yellow"`.
- Nueva entrada `invasores` en `app/game/registry.ts`, sin tocar `asteroides`/`tetris`/`arkanoid`/`snake` ni la forma de `GameRegistryEntry`. Lleva `Canvas: InvasoresCanvas`, `hasRealLeaderboard: true`, `secondaryStatLabel: "Vidas"` y `formatSecondaryStat: formatHearts`, sin `screenClassName` porque el canvas es 800×600 (4:3, igual que `.crt-screen` por defecto). La clave es un identificador válido sin guion, así que va sin comillas.
- Migración nueva `supabase/migrations/<timestamp>_seed_invasores.sql` (p.ej. `20260923000000_seed_invasores.sql`), con un timestamp que ordene después de `20260915000001_seed_snake.sql`. Siembra la fila `invasores` en `public.games` con los mismos valores de la entrada de `GAMES` y se aplica con `mcp__supabase__apply_migration`.
- Regla `.cover-invasores` en `app/globals.css`, independiente y junto a `.cover-snake`. Fondo `radial-gradient(circle at 50% 30%, #2a2a00, #0a0a00)` (amarillo muy oscuro). En `::after`, una mini formación de 3 filas × 5 invasores hecha con `linear-gradient` en bloques (fila superior `#ff006e`, fila media `#00f5ff`, fila inferior `var(--yellow)`), con `image-rendering: pixelated` y `drop-shadow` amarillo `rgba(245, 255, 0, 0.4)`. En `::before`, el cañón: una barra de 12 % × 6 px en `var(--green)` a `bottom: 14%` con `box-shadow` de brillo. Es el mismo tratamiento de bloques con brillo que `.cover-arkanoid`/`.cover-snake`.
- **Sin ampliación de tipos:** `SHOOTER` ya existe en la unión `Game.cat` y en `CATS`. `yellow` ya existe en la unión `Game.color`, tiene `--yellow: #f5ff00` en `app/globals.css` y ya tiene rama en el botón de `app/components/GameCard.tsx` (`game.color === "yellow" ? "yellow"`). No se tocan `Game.cat`, `CATS`, `Game.color`, las variables CSS ni `GameCard.tsx`.
- Recorrido en `/game/invasores` (detalle con leaderboard real), `/game/invasores/play` (reproductor con HUD Puntuación / Vidas en corazones / Nivel = oleada), la pestaña INVASORES de `/hall-of-fame` y el filtro `SHOOTER` de la biblioteca (`app/components/BibliotecaGrid.tsx`), que debe listar `ASTEROIDES` e `INVASORES`.

**Fuera de alcance (para futuras specs):**

- El motor, el canvas y las formas (van en GJ-04.1, `motor.md`).
- Cambios a `app/lib/supabase/queries.ts` o `queries.client.ts`: ya son genéricas por slug.
- Tablas o columnas nuevas en Supabase.
- Cálculo dinámico de `best`/`plays`: quedan estáticos (`0`, `"0"`) como en el resto del catálogo.
- Ampliar `Game.cat`, `CATS`, `Game.color` o `GameCard.tsx`, porque la `cat` y el `color` ya existen.
- Controles táctiles/móvil.
- Tests automatizados (no hay framework configurado en el repo).
- Cambios a otros juegos, a sus entradas en `GAMES`/registro o a sus specs.
- Cualquier archivo bajo `references/`, incluida la memoria del `game-planner` (`references/game-ideas.md` sigue marcando INVASORES como `Descartada`; actualizarla es tarea del `game-planner`).

## Modelo de datos

Esta spec no introduce tablas ni columnas nuevas. Reutiliza `public.games` y `public.scores` de SPEC 06, donde `scores` se relaciona con `games` por `game_id` (no tiene columna `slug`). Solo se agrega una fila de siembra en `games`.

`app/lib/data.ts` gana una entrada más en `GAMES` (mismo tipo `Game`, sin cambios de forma):

```ts
{
  id: "invasores",
  title: "INVASORES",
  short: "Frena la invasión fila por fila antes de que aterrice.",
  long: "Cincuenta y cinco invasores marchan de lado a lado y bajan un escalón en cada borde, cada vez más rápido cuanto menos quedan. Mueve tu cañón, cúbrete tras cuatro búnkeres que se desmoronan y derriba la nave nodriza por puntos extra. Oleadas infinitas, tres vidas.",
  cat: "SHOOTER",
  cover: "cover-invasores",
  color: "yellow",
  best: 0,
  plays: "0",
}
```

`app/game/registry.ts` gana un import (`import InvasoresCanvas from "./invasores/InvasoresCanvas";`) y una entrada más, con la misma forma que las existentes:

```ts
invasores: {
  Canvas: InvasoresCanvas as ComponentType<unknown> as GameCanvasComponent,
  hasRealLeaderboard: true,
  secondaryStatLabel: "Vidas",
  formatSecondaryStat: formatHearts,
},
```

Fila de siembra (columnas de `public.games`, mismos valores que la entrada de `GAMES`):

```text
slug='invasores', title='INVASORES', short=<short>, long=<long>, cat='SHOOTER',
cover='cover-invasores', color='yellow', best=0, plays='0'
```

Estado de tipos existentes (verificado en `app/lib/data.ts`, sin cambios):

```ts
cat: "PUZZLE" | "SHOOTER" | "ARCADE"; // SHOOTER ya existe
color: "cyan" | "magenta" | "yellow" | "green"; // yellow ya existe
CATS = ["TODOS", "PUZZLE", "SHOOTER", "ARCADE"]; // SHOOTER ya existe
```

## Plan de implementación

1. **Tipos `cat`/`color`** — no aplica. `SHOOTER` y `yellow` ya existen en `app/lib/data.ts`, `--yellow` ya existe en `app/globals.css` y `GameCard.tsx` ya resuelve el botón amarillo. Solo se confirma leyendo esos tres archivos antes de seguir.
2. **`app/game/registry.ts`** — agregar el import de `InvasoresCanvas` y la entrada `invasores` definida en el modelo de datos, al final de `gameRegistry`, sin modificar las entradas existentes ni `formatHearts`/`formatNumber`.
3. **`app/lib/data.ts`** — agregar la entrada `invasores` al final de `GAMES`, tal como se define en el modelo de datos.
4. **Migración `supabase/migrations/<timestamp>_seed_invasores.sql`** — antes de aplicarla, confirmar con `mcp__supabase__execute_sql` (`select slug from public.games where slug = 'invasores';`) que no hay fila previa. El slug `invasores` existió como juego mock en `20260904000000_games_scores.sql` y se borró en `20260911235416_remove_dummy_games.sql`. Crear el archivo con un comentario de cabecera (`-- Siembra la fila del catálogo para el juego Invasores (motor real, GJ-04).`) y un solo `insert into public.games (slug, title, short, long, cat, cover, color, best, plays) values (...)`, mismo patrón que `20260915000001_seed_snake.sql`. Aplicar con `mcp__supabase__apply_migration` sin tocar migraciones previas.
5. **`app/globals.css`** — agregar `.cover-invasores`, `.cover-invasores::after` y `.cover-invasores::before` después de `.cover-snake::before`, con la paleta y el tratamiento descritos en el Alcance.
6. **Verificación final end-to-end:**
   - `npm run build` sin errores.
   - La biblioteca muestra la tarjeta INVASORES con la portada `.cover-invasores`, la etiqueta `SHOOTER` y el botón JUGAR amarillo. El filtro `SHOOTER` lista ASTEROIDES e INVASORES.
   - `/game/invasores` muestra el detalle y lleva a `/game/invasores/play`.
   - En el reproductor, el HUD muestra Puntuación, "Vidas" como `♥ ♥ ♥` y Nivel = oleada.
   - Jugar hasta el game over abre el modal existente. Al guardar la puntuación, confirmar la fila con `mcp__supabase__execute_sql`: `select s.player_name, s.score, s.created_at from public.scores s join public.games g on g.id = s.game_id where g.slug = 'invasores' order by s.created_at desc limit 5;`.
   - La fila aparece en el leaderboard de `/game/invasores` y en la pestaña INVASORES de `/hall-of-fame`.
   - JUGAR DE NUEVO reinicia una partida limpia (score 0, 3 vidas, oleada 1).
   - SALIR navega sin dejar el loop ni los listeners activos.
   - `asteroides`, `tetris`, `arkanoid` y `snake` se ven y se juegan igual que antes.
   - `git status` no muestra cambios bajo `references/`.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores.
- [ ] `GAMES` incluye la entrada `invasores` con exactamente los campos del modelo de datos, y las demás entradas no cambiaron.
- [ ] `app/game/registry.ts` incluye la entrada `invasores` con `hasRealLeaderboard: true`, `secondaryStatLabel: "Vidas"` y `formatSecondaryStat: formatHearts`, sin `screenClassName`, y las otras cuatro entradas no cambiaron.
- [ ] `Game.cat`, `CATS`, `Game.color`, las variables CSS de color y `app/components/GameCard.tsx` no fueron modificados.
- [ ] Existe `supabase/migrations/<timestamp>_seed_invasores.sql`, con un timestamp posterior a `20260915000001`, y está aplicada: `select count(*) from public.games where slug = 'invasores'` devuelve 1.
- [ ] La fila `invasores` de `public.games` tiene `title = 'INVASORES'`, `cat = 'SHOOTER'`, `cover = 'cover-invasores'`, `color = 'yellow'`, `best = 0` y `plays = '0'`.
- [ ] `app/globals.css` contiene `.cover-invasores` con sus pseudo-elementos `::after` y `::before`, y las reglas `.cover-*` existentes no cambiaron.
- [ ] La tarjeta INVASORES de la biblioteca muestra la portada `.cover-invasores`, la etiqueta `SHOOTER` y el botón JUGAR con estilo `yellow`.
- [ ] El filtro `SHOOTER` de la biblioteca muestra ASTEROIDES e INVASORES, y ningún juego de otra categoría.
- [ ] `/game/invasores` muestra el título INVASORES, la portada y el leaderboard real (vacío o con filas de `scores`), y su botón lleva a `/game/invasores/play`.
- [ ] En `/game/invasores/play` el `player-hud` muestra la puntuación real, "Vidas" en corazones y el Nivel igual a la oleada actual.
- [ ] El game over (por vidas o por invasión) y el botón FIN muestran el modal existente de puntuación final, no un overlay dibujado en el canvas.
- [ ] Guardar la puntuación inserta una fila en `public.scores` cuyo `game_id` es el de `games.slug = 'invasores'`, verificable con el `join` del plan vía `mcp__supabase__execute_sql`.
- [ ] La fila guardada aparece en el leaderboard de `/game/invasores` y en la pestaña INVASORES de `/hall-of-fame`.
- [ ] "JUGAR DE NUEVO" arranca una partida nueva del motor real con score 0, 3 vidas y oleada 1.
- [ ] "SALIR" navega a `/game/invasores` sin dejar el `requestAnimationFrame` ni los listeners de teclado activos.
- [ ] `asteroides`, `tetris`, `arkanoid` y `snake` no cambiaron de comportamiento en biblioteca, detalle, reproductor ni hall-of-fame.
- [ ] Ningún archivo bajo `references/` fue modificado.

## Decisiones tomadas y descartadas

- **Sí:** registro por id: solo se agrega la entrada `invasores` en `app/game/registry.ts`, sin tocar las existentes ni la forma de la entrada, y nunca con `if (id === "invasores")` en los consumidores. Decisión fija de /juego-nuevo — no se reabre.
- **Sí:** leaderboard real en Supabase por slug, reutilizando `getGames`/`getGameBySlug`/`getTopScores`/`insertScore` de `app/lib/supabase/queries.ts` y `queries.client.ts` sin cambios, con solo una migración nueva de siembra. Nunca `localStorage`. Decisión fija de /juego-nuevo — no se reabre.
- **Sí:** `game-id` `invasores`, el slug que ya proponía `references/game-ideas.md` § INVASORES. No choca con `GAMES`, el registro, `specs/` ni jams previos. El slug solo existió como fila mock en Supabase, borrada en `20260911235416_remove_dummy_games.sql`. Decidida por game-jam a partir del pedido — revisar.
- **Sí:** título `INVASORES`, genérico y sin marca registrada. Decidida por game-jam a partir del pedido — revisar.
- **Sí:** especificar el juego pese a que `references/game-ideas.md` lo marca como `Descartada` por redundancia con `asteroides` (shooter) y `arkanoid` (control lateral). El pedido fue explícito y la propia nota dice "reconsiderar solo si se busca deliberadamente un juego barato de añadir". Para reducir la redundancia, el motor suma búnkeres destructibles y nave nodriza (ver GJ-04.1). Decidida por game-jam a partir del pedido — revisar.
- **Sí:** `cat: "SHOOTER"`. Es la categoría natural del género y ya existe, así que no hay que ampliar tipos. Decidida por game-jam a partir del pedido — revisar.
- **Sí:** `color: "yellow"`. Ya existe en el tipo, en `--yellow` y en `GameCard.tsx`, y ningún juego real lo usa todavía, así que la tarjeta se distingue del `cyan` de `asteroides` (el otro SHOOTER). Decidida por game-jam a partir del pedido — revisar.
- **No:** un color nuevo (p.ej. `red` o `orange`). Obligaría a ampliar `Game.color`, `app/globals.css` y `GameCard.tsx` sin ninguna ganancia para este juego.
- **No:** `color: "green"` (el que tenía la fila mock borrada). Ya lo usa `snake`, y la tarjeta se confundiría en la biblioteca.
- **Sí:** stat secundario "Vidas" con `formatHearts`, igual que `asteroides`/`arkanoid`. Las vidas no duplican el score, y la oleada viaja en el slot `level`. Decidida por game-jam a partir del pedido — revisar.
- **Sí:** sin `screenClassName`, porque el canvas 800×600 encaja en el 4:3 por defecto de `.crt-screen`.
- **Sí:** verificar antes de migrar que no quede una fila `invasores` en `public.games`, porque el slug existió como mock. Así se evita un choque con la restricción `unique` de `slug`.
- **No:** `on conflict (slug) do nothing` en la migración. Rompería el patrón de las siembras previas y ocultaría una fila huérfana inesperada, que es mejor detectar en el paso 4.

## Riesgos identificados

| Riesgo                                                                                                                                                           | Mitigación                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El slug `invasores` existió como fila mock en Supabase. Si en algún entorno no se aplicó `20260911235416_remove_dummy_games.sql`, el `insert` falla por `unique` | El paso 4 consulta la fila con `mcp__supabase__execute_sql` antes de aplicar la migración. Si existe, se detiene la implementación y se reporta, en vez de editar migraciones previas.                                                                  |
| Agregar la quinta entrada al registro puede romper el tipado si `InvasoresCanvas` no implementa exactamente `GameCanvasComponent`                                | Mismo cast `as ComponentType<unknown> as GameCanvasComponent` que las demás entradas. `npm run build` es el primer punto de la verificación, y se prueba que los otros cuatro juegos siguen jugables.                                                   |
| La portada `.cover-invasores` puede verse casi igual que `.cover-arkanoid` (ambas son bloques de colores en filas)                                               | La formación es de 3 × 5 bloques pequeños con huecos entre sí (invasores sueltos, no un muro continuo), sobre un fondo amarillo oscuro en vez de magenta, y con el cañón en verde. La comparación se hace a simple vista en la biblioteca en el paso 6. |

## Qué **no** está en esta spec

- El motor, el canvas y las formas del juego (van en GJ-04.1).
- Cambios a `queries.ts`/`queries.client.ts` o tablas nuevas en Supabase.
- Ampliaciones de `Game.cat`, `CATS`, `Game.color` o `GameCard.tsx`.
- Cálculo dinámico de `best`/`plays`.
- Controles táctiles/móvil y tests automatizados.
- Actualizar la memoria del `game-planner` o cualquier archivo bajo `references/`.

Cada uno de estos, si se necesita, va en su propia spec.
