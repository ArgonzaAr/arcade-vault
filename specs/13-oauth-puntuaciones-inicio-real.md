# 13 — Login con Google/GitHub, puntuaciones ligadas a la cuenta e inicio con datos reales

**Estado:** Aprbobado
**Depende de:** SPEC 02, SPEC 06, SPEC 12
**Fecha:** 2026-09-30

**Objetivo:** Completar las sesiones de Supabase con login por Google y GitHub, ligar cada puntuación a la cuenta que la juega y conectar la home a juegos y puntuaciones reales.

## Por qué existe esta spec

La SPEC 12 dejó la base de la autenticación (`profiles`, trigger, `/auth/callback`, `AuthProvider`, `proxy.ts`) y aplazó explícitamente tres cosas:

- Los botones GOOGLE y GITHUB de `/auth` están deshabilitados con «PRÓXIMAMENTE».
- `scores` no sabe quién jugó: con sesión se guarda `player_name = USERNAME`, pero cualquier invitado puede escribir ese mismo nombre (riesgo aceptado en la SPEC 12).
- La fila «tu mejor marca» de `/hall-of-fame` es un mock (`youRank`, `youScore` y la fecha fija `11/05/2026`).

Además, la home (`app/page.tsx`) sigue siendo 100 % mock: el carrusel usa `GAMES` de `app/lib/data.ts`, y «ÚLTIMAS PUNTUACIONES» y «TOP JUGADORES · HOY» son las constantes `TICKER` y `TOP_PLAYERS`.

El usuario decidió cubrir todo en una sola spec (ver «Decisiones»).

## Alcance

**Incluye:**

_OAuth_

- Migración `supabase/migrations/20260930000001_oauth_username.sql` que reemplaza `public.handle_new_user()` para generar el username cuando no viene en metadata.
- Pasos manuales para crear las apps OAuth de Google y GitHub y activar ambos proveedores en Supabase.
- Botones GOOGLE y GITHUB de `/auth` habilitados con `signInWithOAuth`, reutilizando `/auth/callback`.

_Puntuaciones ligadas a la cuenta_

- Migración `supabase/migrations/20260930000000_scores_user_id.sql`: columna `scores.user_id`, trigger `scores_before_insert` y policies de insert separadas para `anon` y `authenticated`.
- `insertScore` envía `user_id` con sesión y distingue el error «nombre reservado».
- El reproductor muestra «ESE NOMBRE ES DE UN JUGADOR REGISTRADO» si un invitado usa un username existente.
- Posición real del jugador en `/hall-of-fame`: su mejor marca, su rango y la fecha de esa marca.

_Inicio con datos reales_

- `app/page.tsx` pasa a Server Component que consulta Supabase y entrega los datos a `app/components/HomeView.tsx` (la UI actual, `"use client"`).
- «JUEGOS DISPONIBLES AHORA» usa `getGames()`.
- «ÚLTIMAS PUNTUACIONES» muestra las 7 últimas filas de `scores`.
- «TOP JUGADORES · HOY» muestra las 5 mejores puntuaciones individuales de las últimas 24 h.
- Estado vacío en ticker y top cuando no hay filas.
- Con sesión: saludo «▸ HOLA, PX_KAI» en el hero y los CTAs de crear cuenta pasan a llevar a `/biblioteca`.

**Fuera de alcance (para futuras specs):**

- Cifras de la sección STATS («12+ JUEGOS», «MILES DE PARTIDAS», «GLOBAL RANKING»): siguen fijas.
- Actualización en tiempo real (Supabase Realtime) del ticker o del top.
- Elegir o cambiar el username a mano, también para cuentas OAuth.
- Otros proveedores OAuth (Discord, Apple, etc.).
- Desvincular identidades o gestionar cuentas vinculadas desde la UI.
- Asignar a cuentas las puntuaciones antiguas de invitados.
- Ranking agregado por jugador (suma de mejores marcas).
- Página de perfil o menú de cuenta en el Nav.
- Corregir los errores de lint previos a la SPEC 12 (`app/page.tsx`, `play/page.tsx`, `.claude/hooks/`, `references/`).
- Tests automatizados (no hay framework en el repo).

## Modelo de datos

### `scores` (cambio de esquema)

```sql
-- supabase/migrations/20260930000000_scores_user_id.sql
alter table public.scores
  add column user_id uuid references auth.users(id) on delete set null;

create index scores_user_game_idx on public.scores (user_id, game_id);

drop policy "scores_insert_public" on public.scores;

create policy "scores_insert_anon" on public.scores
  for insert to anon with check (user_id is null);

create policy "scores_insert_authenticated" on public.scores
  for insert to authenticated with check (user_id = (select auth.uid()));
-- scores_select_public no cambia.
```

- Las filas existentes quedan con `user_id = null` y cuentan como partidas de invitado.
- Si se borra la cuenta, sus filas pasan a `user_id = null` y conservan el `player_name`.

Trigger `scores_before_insert` (`before insert on public.scores for each row`), función `public.scores_before_insert()` con `set search_path = ''` y sin `security definer`:

- **Con `user_id`:** busca el username en `public.profiles` y sobrescribe `new.player_name = upper(username)`. Si no hay profile, lanza una excepción. El cliente no puede falsear el nombre.
- **Sin `user_id` (invitado):** si `lower(new.player_name)` coincide con algún `profiles.username`, lanza una excepción con mensaje `player_name_reserved`.

### `handle_new_user()` (reemplazo)

```sql
-- supabase/migrations/20260930000001_oauth_username.sql
-- create or replace function public.handle_new_user() ...
```

- Si `raw_user_meta_data->>'username'` existe (registro por email, SPEC 12), se usa tal cual en minúsculas. Si no cumple el formato o está ocupado, el insert falla, igual que en la SPEC 12.
- Si no existe (OAuth), se genera así:
  1. Base = `raw_user_meta_data->>'user_name'` (GitHub). Si falta, la parte local de `new.email` (Google). Si ambos faltan, `player`.
  2. Minúsculas, todo carácter fuera de `[a-z0-9_]` pasa a `_`, recortado a 7 caracteres.
  3. Si la base queda con menos de 3 caracteres, se usa `player`.
  4. Si la base está libre, se usa. Si no, se prueba `base || n` con `n` de 2 a 999 y se usa el primero libre. El resultado nunca supera 10 caracteres.
- Mantiene `security definer`, `set search_path = ''` y el `revoke execute` de la SPEC 12.
- El trigger `on_auth_user_created` no cambia.

Vincular una identidad OAuth a una cuenta existente con el mismo email verificado no crea fila en `auth.users`, así que no dispara el trigger. La cuenta conserva su username.

### Consultas nuevas

```ts
// app/lib/supabase/queries.ts (servidor, para la home)
export interface RecentScore {
  player: string; // player_name
  game: string; // games.title
  color: Game["color"]; // games.color, para el color del ticker
  score: number;
  ago: string; // «ahora», «hace 5 min», «hace 2 h», «hace 3 d»
}
export async function getRecentScores(limit: number): Promise<RecentScore[]>;

export interface TodayTopScore {
  rank: number;
  player: string;
  score: number;
}
// Mejores puntuaciones individuales con created_at >= now() - 24 h, de cualquier juego.
export async function getTodayTopScores(
  limit: number
): Promise<TodayTopScore[]>;
```

```ts
// app/lib/supabase/queries.client.ts
export async function insertScore(
  slug: string,
  playerName: string,
  score: number,
  userId: string | null
): Promise<{ ok: boolean; reason?: "name_reserved" }>;

export interface PlayerBest {
  rank: number; // 1 + nº de filas del juego con score mayor
  score: number;
  date: string; // dd/mm/aaaa, es-ES
}
export async function getPlayerBest(
  slug: string,
  userId: string
): Promise<PlayerBest | null>; // null si no tiene partidas en ese juego
```

- Todas devuelven `[]` o `null` ante error, igual que las consultas de la SPEC 06.
- `ago` se calcula en el servidor: menos de 1 min → «ahora»; menos de 60 min → «hace N min»; menos de 24 h → «hace N h»; resto → «hace N d».

### Home

```ts
// app/page.tsx (Server Component)
const [games, recent, top] = await Promise.all([
  getGames(),
  getRecentScores(7),
  getTodayTopScores(5),
]);
return <HomeView games={games} recent={recent} top={top} />;
```

- `HomeView` es el contenido actual de `app/page.tsx` sin `TICKER` ni `TOP_PLAYERS`. `FEATURES`, `STATS`, el pricing y el FAQ quedan igual.
- Ticker vacío: «AÚN NO HAY PARTIDAS · SÉ EL PRIMERO».
- Top vacío: «AÚN NO HAY PARTIDAS HOY · SÉ EL PRIMERO».

Con sesión (`useAuth().profile` no nulo):

| Elemento                | Sin sesión             | Con sesión                       |
| ----------------------- | ---------------------- | -------------------------------- |
| Eyebrow del hero        | ▸ INSERTA UNA MONEDA_  | ▸ HOLA, PX_KAI_                  |
| CTA secundario del hero | ✦ CREAR CUENTA → /auth | ▶ SEGUIR JUGANDO → /biblioteca   |
| CTA del plan en PRECIOS | EMPEZAR GRATIS → /auth | IR A LA BIBLIOTECA → /biblioteca |

Mientras `loading` sea `true` se muestra la versión sin sesión.

### Mensajes nuevos

| Caso                                           | Mensaje                                  |
| ---------------------------------------------- | ---------------------------------------- |
| Invitado guarda con un username registrado     | ESE NOMBRE ES DE UN JUGADOR REGISTRADO   |
| Fallo de OAuth (vuelve sin `code` al callback) | EL ENLACE ES INVÁLIDO O CADUCÓ (SPEC 12) |

### OAuth

- `signInWithOAuth({ provider: "google" | "github", options: { redirectTo: `${location.origin}/auth/callback?next=/biblioteca` } })`.
- Los dos botones funcionan igual en las pestañas INICIAR SESIÓN y CREAR CUENTA.
- Mientras redirige, el botón pulsado muestra «CONECTANDO…» y los dos quedan deshabilitados.

No hay variables de entorno nuevas. Los secretos de OAuth viven solo en el panel de Supabase.

## Plan de implementación

1. **Puntuaciones ligadas a la cuenta.** Crear `20260930000000_scores_user_id.sql` (columna, índice, trigger, policies) y aplicarla con `mcp__supabase__apply_migration`. En el mismo paso, `insertScore` recibe `userId`, lo envía como `user_id` y devuelve `reason: "name_reserved"` si el error contiene `player_name_reserved`. `game/[id]/play/page.tsx` pasa `profile?.id ?? null` y muestra el mensaje nuevo bajo el input sin cerrar el modal. Verificar con `get_advisors` (security) que no hay avisos nuevos. Van en un solo paso porque la policy nueva de `authenticated` rechaza inserts sin `user_id`.
2. **Posición real en `/hall-of-fame`.** Agregar `getPlayerBest` a `queries.client.ts`. En `hall-of-fame/page.tsx`, reemplazar `youRank`, `youScore` y la fecha fija. La fila «tu mejor marca» solo aparece con sesión y si `getPlayerBest` devuelve datos.
3. **Consultas de la home.** Agregar `getRecentScores` y `getTodayTopScores` a `app/lib/supabase/queries.ts`. Nadie las consume todavía.
4. **Home con datos reales.** Mover la UI de `app/page.tsx` a `app/components/HomeView.tsx` (`"use client"`), que recibe `games`, `recent` y `top` por props. `app/page.tsx` queda como Server Component con las tres consultas. Eliminar `TICKER` y `TOP_PLAYERS`, y agregar los estados vacíos.
5. **Home con sesión.** En `HomeView`, usar `useAuth()` para el saludo y los dos CTAs de la tabla.
6. **Username para OAuth.** Crear `20260930000001_oauth_username.sql` con el reemplazo de `handle_new_user()` y aplicarla. Verificar con `get_advisors` (security). El registro por email de la SPEC 12 debe seguir funcionando igual.
7. **Configuración OAuth (manual, la hace el usuario).** Google Cloud Console: cliente OAuth tipo «Aplicación web» con redirect URI `https://fchwogbyatwsghxvexmb.supabase.co/auth/v1/callback`. GitHub: OAuth App con el mismo callback. Supabase → Authentication → Providers: activar Google y GitHub con sus client ID y secret. El plan se detiene aquí hasta que el usuario lo confirme.
8. **Botones OAuth en `/auth`.** Quitar «PRÓXIMAMENTE» y `disabled`, y llamar a `signInWithOAuth` con el `redirectTo` del modelo de datos. Estado «CONECTANDO…» mientras redirige. Retirar los estilos `.auth-soon` y `.social .btn:disabled` si quedan sin uso.
9. **Documentación.** Actualizar la línea de Auth en `CLAUDE.md` (OAuth y `scores.user_id` con el trigger que fija `player_name`).

## Criterios de aceptación

_General_

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` no reporta errores en ningún archivo creado o modificado por esta spec.
- [ ] `get_advisors` (security) no reporta avisos nuevos relacionados con `scores`, `scores_before_insert` ni `handle_new_user`.
- [ ] Ningún archivo bajo `references/templates/` fue modificado.

_Puntuaciones_

- [ ] `public.scores` tiene la columna `user_id` (nullable, FK a `auth.users` con `on delete set null`).
- [ ] Las filas de `scores` anteriores a la migración siguen existiendo con `user_id = null`.
- [ ] `scores` tiene exactamente tres policies: `scores_select_public`, `scores_insert_anon` y `scores_insert_authenticated`.
- [ ] Con sesión como `px_kai`, terminar una partida y guardar crea una fila con `user_id` = id de `px_kai` y `player_name = 'PX_KAI'`.
- [ ] Un insert con sesión y `player_name = 'OTRO'` (hecho con `supabase-js` desde la consola del navegador) guarda `player_name = 'PX_KAI'`.
- [ ] Un insert con sesión y `user_id` de otro usuario es rechazado.
- [ ] Sin sesión, guardar con el nombre `PX_KAI` (o `px_kai`) muestra «ESE NOMBRE ES DE UN JUGADOR REGISTRADO», no crea fila y deja cambiar el nombre y reintentar.
- [ ] Sin sesión, guardar con un nombre que no es username crea una fila con `user_id = null`.

_Salón de la Fama_

- [ ] Con sesión y al menos una partida en un juego, la fila «tu mejor marca» muestra su mejor score real, el rango `1 + nº de filas con score mayor` y la fecha de esa marca.
- [ ] Con sesión y sin partidas en ese juego, la fila «tu mejor marca» no aparece.
- [ ] Sin sesión, la fila «tu mejor marca» no aparece.

_Home_

- [ ] «JUEGOS DISPONIBLES AHORA» muestra los juegos de la tabla `games` (los mismos que `/biblioteca`, máx. 6).
- [ ] «ÚLTIMAS PUNTUACIONES» muestra las 7 filas más recientes de `scores`, con el título y el color del juego y el tiempo relativo.
- [ ] Guardar una puntuación y recargar `/` la muestra primera en el ticker con «ahora».
- [ ] «TOP JUGADORES · HOY» muestra las 5 mayores puntuaciones de las últimas 24 h, ordenadas de mayor a menor.
- [ ] Sin filas en las últimas 24 h, el top muestra «AÚN NO HAY PARTIDAS HOY · SÉ EL PRIMERO».
- [ ] `app/page.tsx` no contiene `TICKER`, `TOP_PLAYERS` ni importa `GAMES`.
- [ ] Con sesión, el hero muestra «▸ HOLA, PX_KAI» y los CTAs «▶ SEGUIR JUGANDO» e «IR A LA BIBLIOTECA →» llevan a `/biblioteca`.
- [ ] Sin sesión, el hero y los CTAs son los de hoy.
- [ ] Las secciones FEATURES, STATS, PRECIOS (salvo el CTA) y el FAQ no cambian.

_OAuth_

- [ ] GOOGLE y GITHUB aparecen habilitados en `/auth`, sin «PRÓXIMAMENTE».
- [ ] Entrar con GitHub por primera vez termina en `/biblioteca` con sesión, y el Nav muestra el username generado.
- [ ] Entrar con Google por primera vez termina en `/biblioteca` con sesión, y el Nav muestra el username generado.
- [ ] El username generado cumple `^[a-z0-9_]{3,10}$` y hay una fila en `profiles` para el usuario.
- [ ] Una segunda cuenta OAuth cuya base ya está ocupada recibe la base con sufijo numérico (p. ej. `px_kai2`).
- [ ] Entrar con Google usando el email de una cuenta creada por email accede a esa misma cuenta: mismo `user.id` y mismo username.
- [ ] Cancelar el consentimiento en Google o GitHub vuelve a `/auth` con «EL ENLACE ES INVÁLIDO O CADUCÓ».
- [ ] El registro por email de la SPEC 12 sigue funcionando: `px_test` crea `profiles.username = 'px_test'` y un username ocupado sigue mostrando «ESE USUARIO YA EXISTE».

## Decisiones tomadas y descartadas

- **Sí:** una sola spec para OAuth, puntuaciones ligadas y home real. Decisión del usuario, pese a la recomendación de separarla en tres (13 OAuth, 14 puntuaciones, 15 home). El plan va ordenado para que cada paso deje la app funcional por sí solo.
- **Sí:** cerrar la SPEC 12 (criterios verificados, estado Implementado y commit) antes de implementar esta. Decisión del usuario.
- **Sí:** username generado automáticamente para OAuth (user_name de GitHub o parte local del email, 7 caracteres + sufijo 2..999). Decisión del usuario. No añade pantallas ni un estado de «perfil incompleto».
- **No:** pantalla «elige tu usuario» tras el primer login OAuth. Añade ruta, estado intermedio y un camino más que probar.
- **No:** username aleatorio (`player1234`). Menos reconocible para el jugador.
- **Sí:** mismo email con otro proveedor = misma cuenta, usando el enlace automático de Supabase para emails verificados. Decisión del usuario. Conserva username y puntuaciones.
- **No:** cuentas separadas por proveedor. Duplica jugadores con el mismo correo.
- **Sí:** los invitados siguen guardando puntuaciones, pero la BD rechaza un `player_name` que coincida con un username registrado. Decisión del usuario. Mantiene el modo invitado y cierra la suplantación.
- **No:** marcar filas «verificadas» en la UI dejando cualquier nombre. Señala la suplantación pero no la impide.
- **No:** leaderboard solo con sesión. Contradice «puedes jugar como invitado» de la home.
- **Sí:** el trigger `scores_before_insert` fija `player_name = upper(username)` cuando hay `user_id`. Decisión del usuario. La BD es la garantía y el cliente no puede falsearlo.
- **No:** confiar en el `player_name` que envía el cliente con solo RLS.
- **Sí:** la policy de `authenticated` exige `user_id = auth.uid()`. Con sesión nunca se guarda como invitado.
- **Sí:** filas antiguas de `scores` con `user_id = null`. Decisión del usuario. No se adivina a quién pertenecen.
- **No:** borrar las puntuaciones existentes. Destructivo e irreversible.
- **Sí:** posición real en `/hall-of-fame`, contando filas (no jugadores), igual que la tabla que ya muestra el Salón. Decisión del usuario.
- **Sí:** home con juegos, últimas puntuaciones y top reales. Decisión del usuario. STATS queda fija.
- **Sí:** «TOP JUGADORES · HOY» = 5 mejores puntuaciones individuales de las últimas 24 h, de cualquier juego. Decisión del usuario. Consulta simple y fiel al «HOY», aunque mezcle escalas de juegos distintos.
- **No:** ranking por suma de mejores marcas por jugador. Necesita vista o RPC de agregación.
- **Sí:** estado vacío honesto en ticker y top. Decisión del usuario. No se mezclan datos falsos con reales.
- **Sí:** carga en el servidor al pedir `/` (Server Component + `HomeView` cliente), como `/biblioteca`. Decisión del usuario.
- **No:** Supabase Realtime para el ticker. Más complejidad y configuración para un beneficio menor.
- **Sí:** con sesión, saludo en el hero y CTAs de cuenta que llevan a `/biblioteca`. Decisión del usuario. El texto exacto («▶ SEGUIR JUGANDO», «IR A LA BIBLIOTECA →») lo propone esta spec.
- **Sí:** el criterio de lint se limita a los archivos que toca esta spec. El repo ya tenía errores de lint previos a la SPEC 12 que quedan fuera de alcance.

## Riesgos identificados

| Riesgo                                                                                                | Mitigación                                                                                                                     |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| La policy nueva de `authenticated` rechaza inserts sin `user_id` si el cliente viejo sigue desplegado | Migración y cambio de `insertScore` van en el mismo paso del plan.                                                             |
| Filas antiguas de invitado con un `player_name` igual a un username registrado                        | Se aceptan como históricas. La regla de nombre reservado solo aplica a inserts nuevos.                                         |
| Dos altas OAuth simultáneas con la misma base eligen el mismo sufijo y el insert en `profiles` falla  | Caso muy improbable. El alta falla y vuelve a `/auth?error=callback`; reintentar genera otro sufijo.                           |
| Más de 999 cuentas con la misma base                                                                  | El trigger falla y el alta vuelve a `/auth?error=callback`. Aceptado: no es realista en este proyecto.                         |
| La app de Google en modo «Testing» solo admite usuarios de prueba                                     | El paso 7 indica añadir los emails de prueba en la pantalla de consentimiento. Publicar la app queda fuera de alcance.         |
| GitHub sin email público                                                                              | Supabase pide el email primario con el scope `user:email`. Si aun así falta, la base es `user_name`, que GitHub siempre envía. |
| El top de «HOY» compara puntuaciones de juegos con escalas muy distintas (Tetris frente a Snake)      | Decisión aceptada por el usuario. Un ranking normalizado iría en otra spec.                                                    |
| La home pasa a depender de Supabase en cada request                                                   | Las consultas devuelven `[]` ante error, se muestra el estado vacío y `getGames()` mantiene su fallback al mock.               |

## Qué **no** está en esta spec

- Cifras reales en STATS.
- Tiempo real en el ticker o el top.
- Elegir o cambiar el username, perfil o menú de cuenta.
- Otros proveedores OAuth o gestión de identidades vinculadas.
- Reasignar puntuaciones antiguas a cuentas.
- Ranking agregado por jugador.
- Arreglar los errores de lint previos.

Cada una de esas, si llega, va en su propia spec.
