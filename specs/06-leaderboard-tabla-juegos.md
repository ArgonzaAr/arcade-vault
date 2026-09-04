# 06 — Leaderboard y tabla de juegos en Supabase

**Estado:** Aprobado
**Depende de:** SPEC 04, SPEC 05
**Fecha:** 2026-09-04

**Objetivo:** Crear las tablas `games` y `scores` en Supabase, migrar el catálogo de juegos y el leaderboard de Asteroides a datos reales (con `app/lib/data.ts` como semilla/fallback), dejando el resto del catálogo sin cambios de comportamiento.

## Alcance

**Incluye:**

- Migración SQL versionada (`supabase/migrations/`) que crea las tablas `games` y `scores`, habilita RLS y sus policies, y siembra `games` con las 9 filas hoy definidas en `app/lib/data.ts` (`GAMES`).
- `app/lib/supabase/queries.ts` con funciones de acceso: `getGames()`, `getGameBySlug(slug)`, `getTopScores(slug, limit)`, `insertScore(slug, playerName, score)`. Todas caen de vuelta al array estático `GAMES` (o a `seededScores`, según corresponda) si la consulta a Supabase falla o devuelve vacío.
- `app/biblioteca/page.tsx` pasa de client component a Server Component: hace `getGames()` en el servidor y delega el filtrado (búsqueda + categoría, estado que hoy vive en `useState`) a un nuevo client component `app/components/BibliotecaGrid.tsx` que recibe la lista ya resuelta como prop.
- `app/game/[id]/page.tsx` usa `getGameBySlug(id)` en vez de `GAMES.find`. Para `id === "asteroides"` usa `getTopScores("asteroides", 10)` (datos reales); para cualquier otro id sigue usando `seededScores(...)` exactamente como hoy.
- `app/game/[id]/play/page.tsx`: `saveScore()` se bifurca por `isAsteroids` — para asteroides llama a `insertScore("asteroides", name, score)` contra Supabase (usando el cliente browser); para el resto de juegos el guardado en `localStorage["av_scores"]` no cambia.
- `app/hall-of-fame/page.tsx`: la lista de pestañas sigue viniendo del array estático `GAMES` (sin cambios). Al seleccionar la pestaña `asteroides`, las filas mostradas se obtienen con `getTopScores("asteroides", 12)` vía el cliente browser (`useEffect`); cualquier otra pestaña sigue usando `seededScores(...)` sin cambios.

**Fuera de alcance (para futuras specs):**

- Autenticación real. `player_name` en `scores` sigue siendo el nombre mock de `localStorage["av_user"]` (o el ingresado a mano en el modal), sin vínculo a una cuenta real ni a `auth.uid()`.
- Guardado real de puntuaciones para los otros 8 juegos del catálogo — siguen sin motor real y su guardado sigue siendo mock en `localStorage`.
- Cálculo dinámico de `best`/`plays` a partir de `scores` — quedan como columnas estáticas en `games`, iguales a los valores actuales de `GAMES` (incluido `best: 0, plays: "0"` para asteroides).
- Policies de `UPDATE`/`DELETE` sobre `scores` — el leaderboard es de solo inserción y lectura (append-only), no se permite editar ni borrar puntuaciones desde la app.
- Escritura sobre la tabla `games` desde la aplicación (INSERT/UPDATE/DELETE) — el catálogo solo se modifica vía migración, no hay policies de escritura para el rol `anon` en `games`.
- Endurecer RLS de `scores` con validación de autoría real — queda documentado como riesgo aceptado hasta que exista auth.
- Eliminar o modificar el array `GAMES`/`seededScores` en `app/lib/data.ts` — se conservan íntegros como semilla de la migración y como fallback en runtime.
- Cualquier archivo bajo `references/`.
- Tests automatizados (no hay framework configurado en el repo).

## Modelo de datos

```sql
-- supabase/migrations/<timestamp>_games_scores.sql

create table public.games (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,           -- mismo valor que Game.id hoy ("asteroides", "rocas", ...)
  title text not null,
  short text not null,
  long text not null,
  cat text not null,                   -- "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS"
  cover text not null,                 -- clase CSS cover-*
  color text not null,                 -- "cyan" | "magenta" | "yellow" | "green"
  best integer not null default 0,
  plays text not null default '0',
  created_at timestamptz not null default now()
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id),
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;
alter table public.scores enable row level security;

create policy "games_select_public" on public.games
  for select to anon, authenticated using (true);
-- sin policies de insert/update/delete: el catálogo solo se siembra por migración

create policy "scores_select_public" on public.scores
  for select to anon, authenticated using (true);
create policy "scores_insert_public" on public.scores
  for insert to anon, authenticated with check (true);
-- sin policies de update/delete: leaderboard append-only

insert into public.games (slug, title, short, long, cat, cover, color, best, plays) values
  ('bloque-buster', 'BLOQUE BUSTER', ..., 'ARCADE', 'cover-bricks', 'cyan', 28450, '12.4K'),
  -- ... una fila por cada entrada actual de GAMES en app/lib/data.ts, mismo orden y valores
  ('asteroides', 'ASTEROIDES', ..., 'SHOOTER', 'cover-asteroides', 'cyan', 0, '0');
```

```ts
// app/lib/supabase/queries.ts
import type { Game, ScoreRow } from "@/app/lib/data";

export async function getGames(): Promise<Game[]>;
// SELECT slug as id, title, short, long, cat, cover, color, best, plays FROM games
// order by el mismo orden de inserción (created_at asc); si falla o devuelve [], retorna GAMES tal cual.

export async function getGameBySlug(slug: string): Promise<Game | undefined>;
// SELECT ... FROM games WHERE slug = $1; si falla o no hay fila, retorna GAMES.find(g => g.id === slug).

export async function getTopScores(
  slug: string,
  limit: number
): Promise<ScoreRow[]>;
// join scores -> games por slug, ORDER BY score DESC LIMIT $2, mapea a ScoreRow (rank calculado en el mapeo).
// si falla, retorna [] (no cae a seededScores: solo se llama para slug === "asteroides", donde
// mostrar 0 filas reales es más correcto que datos inventados).

export async function insertScore(
  slug: string,
  playerName: string,
  score: number
): Promise<{ ok: boolean }>;
// resuelve games.id por slug, luego INSERT INTO scores (game_id, player_name, score).
// si falla (red, RLS, etc.), retorna { ok: false } y el caller mantiene el comportamiento actual del modal
// (saved = true de todas formas, sin bloquear al usuario — ver riesgos).
```

`Game` (interfaz existente en `app/lib/data.ts`) no cambia de forma — `getGames()`/`getGameBySlug()` devuelven ese mismo tipo, mapeando `slug` de la tabla al campo `id` de `Game` para no tocar ningún consumidor (`GameCard`, rutas `/game/[id]`, etc.).

## Plan de implementación

1. **Migración SQL** — crear `supabase/migrations/<timestamp>_games_scores.sql` con el DDL de arriba: tablas `games`/`scores`, RLS + policies, y el `insert` que siembra las 9 filas actuales de `GAMES` (mismos valores, mismo orden). Aplicar con `mcp__supabase__apply_migration` contra el proyecto configurado en `.env.local`.
2. **`app/lib/supabase/queries.ts`** — implementar `getGames`, `getGameBySlug`, `getTopScores`, `insertScore` usando el cliente de servidor (`app/lib/supabase/server.ts`) para las dos primeras y el cliente browser (`app/lib/supabase/client.ts`) para `insertScore` (se llama desde un client component). Cada función maneja el error de Supabase con `try/catch` y aplica el fallback descrito en el modelo de datos.
3. **`app/biblioteca/page.tsx` → Server Component** — quitar `"use client"`, hacerlo `async`, llamar `getGames()`, y mover el estado de búsqueda/categoría (`q`, `cat`, `filtered`, el JSX de filtros y grilla) a un nuevo `app/components/BibliotecaGrid.tsx` (`"use client"`) que recibe `games: Game[]` como prop. `CATS` sigue importado de `app/lib/data.ts` sin cambios.
4. **`app/game/[id]/page.tsx`** — reemplazar `GAMES.find(...)` por `await getGameBySlug(id)`; para `id === "asteroides"` reemplazar `seededScores(...)` por `await getTopScores("asteroides", 10)`; cualquier otro id sigue con `seededScores(id.length * 17 + 3, 10)` sin cambios.
5. **`app/game/[id]/play/page.tsx`** — en `saveScore()`, si `isAsteroids`, llamar `await insertScore("asteroides", name, score)` (usando el cliente browser) en vez de escribir en `localStorage`; si la llamada falla, igual mostrar `saved = true` (no bloquear el flujo del jugador por un error de red, ver riesgos). Para cualquier otro `game.id`, `saveScore()` no cambia (sigue escribiendo en `localStorage["av_scores"]`).
6. **`app/hall-of-fame/page.tsx`** — agregar `useEffect` que, cuando `tab === "asteroides"`, llama `getTopScores("asteroides", 12)` vía cliente browser y reemplaza las `rows` mostradas por el resultado real (podio + tabla); para cualquier otra pestaña, `rows` sigue viniendo de `seededScores(...)` como hoy. La lista de pestañas (`GAMES.map(...)`) no cambia.
7. **Verificación final** — `npm run build` sin errores de tipos/lint; recorrido manual: `/biblioteca` muestra las 9 tarjetas leídas de Supabase (confirmar con `mcp__supabase__execute_sql` que la tabla `games` tiene 9 filas); jugar una partida en `/game/asteroides/play`, guardar puntuación, confirmar la fila nueva en `scores` (`execute_sql`) y que aparece en `/game/asteroides` (detalle) y en la pestaña ASTEROIDES de `/hall-of-fame`; confirmar que `/game/rocas` (detalle), su `play`, y las demás pestañas de `/hall-of-fame` no cambiaron de comportamiento; probar el fallback apagando temporalmente la URL de Supabase en `.env.local` (o forzando un error) y confirmar que `/biblioteca` sigue mostrando las 9 tarjetas desde `GAMES`.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores.
- [ ] Existe la migración en `supabase/migrations/` y, tras aplicarla, `select count(*) from games` devuelve 9.
- [ ] `/biblioteca` muestra las 9 tarjetas leídas desde la tabla `games` (búsqueda y filtro por categoría siguen funcionando igual que hoy).
- [ ] `/game/asteroides` (detalle) muestra las puntuaciones reales de la tabla `scores` (no `seededScores`).
- [ ] Jugar una partida en `/game/asteroides/play`, terminarla y guardar la puntuación inserta una fila nueva en `scores` con el `player_name` y `score` correctos.
- [ ] La pestaña ASTEROIDES de `/hall-of-fame` muestra las filas reales de `scores`, actualizadas tras guardar una nueva partida.
- [ ] `/game/rocas` (detalle y play) y el resto de juegos no cambiaron de comportamiento respecto a hoy (siguen con `seededScores` y `localStorage["av_scores"]`).
- [ ] Las demás pestañas de `/hall-of-fame` (distintas de ASTEROIDES) siguen mostrando `seededScores` sin cambios.
- [ ] Si Supabase no responde o la tabla `games` está vacía, `/biblioteca` sigue mostrando las 9 tarjetas del array estático `GAMES` (fallback verificado manualmente).
- [ ] RLS está habilitado en `games` y `scores`; `anon` puede hacer `SELECT` en ambas e `INSERT` solo en `scores`.
- [ ] `app/lib/data.ts` (`GAMES`, `seededScores`) no fue modificado.
- [ ] Ningún archivo bajo `references/` fue modificado.

## Decisiones tomadas y descartadas

- **Sí:** tabla `games` con el catálogo completo (9 filas), no solo asteroides. Decisión explícita del usuario. `app/lib/data.ts` queda como semilla de la migración y como fallback en runtime, no se borra.
- **Sí:** `player_name` en `scores` sigue siendo el nombre mock de `av_user`/input manual, sin auth real. Decisión explícita del usuario — evita bloquear esta spec detrás de una spec de autenticación todavía no diseñada.
- **Sí:** el leaderboard real (`scores`) reemplaza `localStorage["av_scores"]`/`seededScores` **solo para asteroides**, que es el único juego con motor real (SPEC 05). El resto del catálogo sigue exactamente igual (mock).
- **No:** conectar el guardado de puntuación de los otros 8 juegos a Supabase. Fuera de alcance — no tienen motor real, guardar puntuaciones inventadas en una tabla real no aporta valor.
- **Sí:** `best`/`plays` quedan estáticos en `games` (sin agregación sobre `scores`). Decisión explícita del usuario — se puede calcular dinámico en spec futura.
- **Sí:** RLS con `INSERT` público (rol `anon`) en `scores`, sin autoría verificada. Riesgo aceptado explícitamente por el usuario — es el mismo nivel de "confianza" que existe hoy con `localStorage` (cualquiera puede falsear su puntuación editando el cliente).
- **No:** permitir `INSERT`/`UPDATE`/`DELETE` de `anon` sobre `games`. El catálogo es de solo lectura desde la app; se modifica únicamente vía migración.
- **No:** `UPDATE`/`DELETE` sobre `scores` desde la app. El leaderboard es append-only.
- **Sí:** `games.id` es `uuid` autogenerado, con columna `slug text unique` separada para las rutas (`/game/[id]`) y el campo `Game.id` de la aplicación. Decisión explícita del usuario, distinta de usar el slug como PK directamente. Las consultas resuelven `games.id` a partir de `slug` cuando hace falta el FK (por ejemplo en `insertScore`).
- **Sí:** migración SQL versionada en `supabase/migrations/`, aplicada con `mcp__supabase__apply_migration`. Decisión explícita del usuario — deja rastro del esquema en el repo en vez de aplicar DDL suelto solo vía MCP.
- **Sí:** `app/biblioteca/page.tsx` pasa a Server Component; el estado de filtros se mueve a un client component nuevo (`BibliotecaGrid`). Es el único cambio de arquitectura de render necesario para leer `games` server-side sin duplicar lógica de fetch en el cliente.
- **No:** convertir `app/hall-of-fame/page.tsx` completo a Server Component. Se mantiene `"use client"` con un `useEffect` acotado solo para la pestaña asteroides, para no rediseñar la pantalla completa en esta spec.
- **Sí:** `getTopScores` retorna `[]` en vez de caer a `seededScores` si la consulta a Supabase falla — mostrar "sin puntuaciones todavía" es más honesto que datos inventados para un juego con leaderboard real. `getGames`/`getGameBySlug` sí caen al mock, porque ahí el fallback reemplaza contenido estático por otro contenido estático equivalente.

## Riesgos identificados

| Riesgo                                                                                                                                           | Mitigación                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `INSERT` público en `scores` sin autoría real permite falsear puntuaciones directamente contra la API de Supabase (bypaseando el juego)          | Aceptado por el usuario como riesgo temporal, igual al de `localStorage` hoy. Se revisita cuando exista una spec de autenticación real con policies basadas en `auth.uid()`.               |
| Fallo de red o RLS mal configurada al guardar una puntuación de asteroides deja al jugador sin feedback de error                                 | `saveScore()` no bloquea el modal: si `insertScore` falla, igual marca `saved = true`; se documenta como comportamiento intencional, no se agrega manejo de reintentos en esta spec.       |
| La migración de siembra (`insert into games`) queda desincronizada de `GAMES` si alguien edita `app/lib/data.ts` después de aplicar la migración | Aceptado — `GAMES` es semilla/fallback, no fuente de verdad en runtime una vez migrado; cualquier cambio posterior al catálogo real se hace con una migración nueva, no editando el array. |
| Convertir `app/biblioteca/page.tsx` a Server Component puede introducir un salto visual (sin loading state) si Supabase responde lento           | Aceptado — el fallback a `GAMES` cubre el caso de error; no se agrega Suspense/skeleton en esta spec por no estar en el alcance original.                                                  |
