# Seguridad — estado

Mantenido por el agente `security-auditor` (solo audita). Referencias: specs 12, 13 y 14 y
`references/security/security-checklist.md`.

## Resumen

| Alcance | CRÍTICO | ALTO | MEDIO | BAJO | Aceptados | Última revisión |
| ------- | ------- | ---- | ----- | ---- | --------- | --------------- |
| BD      | 0       | 1    | 5     | 0    | 4         | 2026-10-01      |
| App     | 0       | 1    | 2     | 3    | 4         | 2026-10-01      |

## Hallazgos

| id     | Severidad | Dónde                                                          | Resumen                                                                                              | Spec        | Estado    | Detectado  |
| ------ | --------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------- | --------- | ---------- |
| BD-01  | MEDIO     | `supabase/migrations/` vs. `list_migrations`                   | 9 de 10 versiones locales no coinciden con las remotas; 3 migraciones aplicadas sin commit en git    | 12, 13, 14  | ABIERTO   | 2026-10-01 |
| BD-02  | MEDIO     | `public.rls_auto_enable()` + event trigger `ensure_rls`        | Existen en remoto sin migración que los cree; la migración de revoke falla en un entorno limpio      | 14          | ABIERTO   | 2026-10-01 |
| BD-03  | MEDIO     | Grants de `anon`/`authenticated` en `public` + default privileges | DML completo y `TRUNCATE` en las tres tablas; `EXECUTE` por defecto en funciones nuevas           | 12, 13, 14  | ABIERTO   | 2026-10-01 |
| BD-04  | MEDIO     | `public.scores` (`created_at`, `id`)                           | El cliente puede fijar `created_at` (y `id`) al insertar: fechas falsas en ticker y «TOP HOY»       | 13          | ABIERTO   | 2026-10-01 |
| BD-05  | MEDIO     | `public.scores` (`player_name`, `score`)                       | Sin `CHECK` de longitud/caracteres de `player_name` ni de rango de `score`                           | 13          | ABIERTO   | 2026-10-01 |
| BD-06  | ALTO      | `public.scores_before_insert()`                                | `player_name_reserved` se elude con espacios (`'PX_KAI '`) u homoglifos: suplantación visual         | 13          | ABIERTO   | 2026-10-01 |
| APP-01 | ALTO      | `package.json` (`next` 16.3.3)                                 | `npm audit`: crítico GHSA-vcvr-r3jv-pc5j (RCE en `next/og` `ImageResponse`), corregido en 16.3.6+  | —           | ABIERTO   | 2026-10-01 |
| APP-02 | MEDIO     | `app/api/contact/route.ts:10`                                  | Endpoint público que envía email sin rate limit ni CAPTCHA                                           | —           | PROPUESTA | 2026-10-01 |
| APP-03 | MEDIO     | `app/api/contact/route.ts:11-12,27`                            | `request.json()` fuera de `try`, sin validar tipos/longitudes, `name` interpolado en `subject`       | —           | ABIERTO   | 2026-10-01 |
| APP-04 | BAJO      | `app/api/contact/route.ts:31-35`                               | Devuelve `error.message` de Resend al cliente                                                         | —           | ABIERTO   | 2026-10-01 |
| APP-05 | BAJO      | `next.config.ts:17-20`                                         | Cabecera `X-Powered-By: Next.js` expuesta                                                            | 14          | ABIERTO   | 2026-10-01 |
| APP-06 | BAJO      | `.env.local.example:1-2`                                       | No documenta `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `RESEND_API_KEY` ni `CONTACT_TO_EMAIL`                | 14          | ABIERTO   | 2026-10-01 |

Estados: `ABIERTO`, `CORREGIDO` (ya no se reproduce), `PROPUESTA` (necesita spec nueva),
`ACEPTADO` (riesgo aceptado en una spec).

### BD-01 — Deriva de versiones entre `supabase/migrations/` y la BD remota

- Evidencia: `list_migrations` (remoto) frente a los nombres de archivo del repo. Solo
  `20260911235416_remove_dummy_games` coincide. El resto difiere:

  | Nombre                   | Repo             | Remoto           |
  | ------------------------ | ---------------- | ---------------- |
  | `games_scores`           | `20260904000000` | `20260904192052` |
  | `seed_tetris`            | `20260911000000` | `20260911232934` |
  | `seed_arkanoid`          | `20260911000001` | `20260912000256` |
  | `seed_snake`             | `20260915000001` | `20260915230318` |
  | `seed_frogger`           | `20260924000000` | `20260925010354` |
  | `profiles`               | `20260928000000` | `20260930192007` |
  | `scores_user_id`         | `20260930000000` | `20260930235321` |
  | `oauth_username`         | `20260930000001` | `20261001002932` |
  | `revoke_rls_auto_enable` | `20261001000000` | `20261001161351` |

  Además, `20260930000000_scores_user_id.sql`, `20260930000001_oauth_username.sql` y
  `20261001000000_revoke_rls_auto_enable.sql` están aplicadas en remoto pero sin commit en git
  (`git status`: `??`).
- Impacto: `supabase db push` / `migration list` ven 9 migraciones remotas «desconocidas» y 9 locales
  «sin aplicar»; reaplicarlas fallaría o duplicaría objetos. Con el orden local, `seed_arkanoid`
  (`20260911000001`) corre antes que `remove_dummy_games` (`20260911235416`), que borra todo juego
  salvo `asteroides` y `tetris`: un entorno nuevo desde el repo no tendría Arkanoid. Las policies y
  triggers de seguridad (SPEC 13/14) solo viven en git como archivos sin commitear.
- Corrección propuesta: renombrar los archivos locales a la versión remota (o ejecutar
  `supabase migration repair --status applied <versión>` para cada una y `--status reverted` para
  las locales) y commitear las tres migraciones nuevas junto con el cierre de las SPEC 13/14. No
  cambia esquema.
- Spec relacionada: 12, 13, 14 (proceso de `apply_migration`).

### BD-02 — `rls_auto_enable()` y `ensure_rls` sin migración de creación

- Evidencia: `pg_event_trigger` → `ensure_rls` (`ddl_command_end`, `O`, `rls_auto_enable`);
  `pg_proc` → `rls_auto_enable` `security definer`, `search_path=pg_catalog`, sin `EXECUTE` para
  `anon`/`authenticated` (correcto). `grep` en `supabase/migrations/`: solo aparece en
  `20261001000000_revoke_rls_auto_enable.sql`, que hace `revoke` sobre una función que ninguna
  migración crea.
- Impacto: un entorno recreado desde el repo no tendría la red de seguridad «RLS en toda tabla
  nueva» y la migración `revoke_rls_auto_enable` fallaría (`function does not exist`). Objeto de
  seguridad en remoto sin respaldo en el repo.
- Corrección propuesta: migración nueva anterior en orden lógico (o editar la de revoke antes de
  commitearla, ya que aún no está en git) con:

  ```sql
  create or replace function public.rls_auto_enable()
  returns event_trigger language plpgsql security definer
  set search_path = pg_catalog as $$ /* cuerpo actual de pg_get_functiondef */ $$;

  do $$ begin
    if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
      create event trigger ensure_rls on ddl_command_end
        when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
        execute function public.rls_auto_enable();
    end if;
  end $$;

  revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  ```
- Spec relacionada: 14 («No está en ninguna migración del repo»).

### BD-03 — Privilegios de escritura y `TRUNCATE` sin policy que los use

- Evidencia: `information_schema.role_table_grants`: `anon` y `authenticated` tienen
  `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` en `games`, `profiles` y `scores`.
  Solo existen policies de `select` (las tres tablas) e `insert` (`scores`). `pg_default_acl` en
  `public`: tablas `arwdDxtm` y funciones `X` para `anon`/`authenticated` (roles `postgres` y
  `supabase_admin`).
- Impacto: hoy RLS bloquea el DML (no hay policy), pero `TRUNCATE` no pasa por RLS y la única
  barrera es que PostgREST no lo expone. Las default privileges hacen que toda función nueva en
  `public` sea ejecutable vía `/rest/v1/rpc` por `anon` (así nació el aviso de `rls_auto_enable`);
  una futura función `security definer` quedaría expuesta por defecto.
- Corrección propuesta (migración nueva):

  ```sql
  revoke insert, update, delete, truncate, references, trigger
    on public.games, public.profiles from anon, authenticated;
  revoke update, delete, truncate, references, trigger
    on public.scores from anon, authenticated;
  alter default privileges for role postgres in schema public
    revoke execute on functions from public, anon, authenticated;
  alter default privileges for role postgres in schema public
    revoke truncate, references, trigger on tables from anon, authenticated;
  ```

  `handle_new_user()` es `security definer` (dueño `postgres`) y sigue insertando en `profiles`;
  `scores_before_insert()` solo necesita `select` en `profiles`, que se conserva.
- Spec relacionada: 12, 13, 14 (defensa en profundidad).

### BD-04 — `created_at` e `id` de `scores` los puede fijar el cliente

- Evidencia: grant de `INSERT` a nivel de tabla (BD-03) y policies `scores_insert_anon`
  (`user_id is null`) / `scores_insert_authenticated` (`user_id = (select auth.uid())`) que no
  restringen otras columnas; `scores_before_insert()` no toca `created_at` ni `id`.
- Impacto: un invitado puede insertar con `created_at = '2099-01-01'`: queda primero para siempre
  en «ÚLTIMAS PUNTUACIONES» (`getRecentScores` ordena por `created_at desc`) y dentro de «TOP
  JUGADORES · HOY» (`gte('created_at', since)`) indefinidamente; también falsea fechas del Salón.
- Corrección propuesta: en `scores_before_insert()` añadir `new.created_at := now();` y
  `new.id := gen_random_uuid();` al inicio, o grants por columna:

  ```sql
  revoke insert on public.scores from anon, authenticated;
  grant insert (game_id, player_name, score, user_id) on public.scores to anon, authenticated;
  ```

  `insertScore` ya no envía `id` ni `created_at`, así que no hay cambio en la app.
- Spec relacionada: 13.

### BD-05 — `scores` sin restricciones de `player_name` ni de `score`

- Evidencia: `pg_constraint` de `scores`: solo PK y FKs. El cliente limita el nombre a 10
  caracteres (`app/game/[id]/play/page.tsx:319`), pero la BD acepta cualquier texto y cualquier
  `integer` (incluidos negativos y `2147483647`). Señales A.10 hoy limpias: 6 filas, 0 negativas,
  0 con caracteres fuera de `[A-Z0-9_ ]`, longitud máxima 8.
- Impacto: un invitado con `supabase-js` puede guardar nombres de megabytes o con caracteres de
  control (rompen el ticker y el Salón) y puntuaciones imposibles que encabezan cada leaderboard.
- Corrección propuesta (migración nueva, `not valid` para no revalidar filas antiguas):

  ```sql
  alter table public.scores
    add constraint scores_player_name_len
      check (char_length(player_name) between 1 and 10 and player_name !~ '[[:cntrl:]]') not valid,
    add constraint scores_score_range
      check (score >= 0 and score <= 100000000) not valid;
  ```

  Un tope por juego o validar el alfabeto `[A-Z0-9_ ]` cambia la UX del invitado: ver propuesta en
  BD-06.
- Spec relacionada: 13.

### BD-06 — La reserva de usernames se elude con espacios u homoglifos

- Evidencia: `scores_before_insert()` compara `p.username = lower(new.player_name)` sin normalizar.
  El reproductor no recorta el nombre (`app/game/[id]/play/page.tsx:41` y `:319`:
  `e.target.value.toUpperCase().slice(0, 10)`), así que desde la UI normal un invitado puede guardar
  `'PX_KAI '` o `' PX_KAI'` (o `PX_KАI` con «А» cirílica vía `supabase-js`), que se pintan igual que
  el username registrado. Consulta de agregados: 0 filas de invitado así hoy.
- Impacto: rompe la garantía de la SPEC 13 «los invitados no pueden usar un username registrado»:
  suplantación visual en leaderboard, ticker y top.
- Corrección propuesta: en el trigger, normalizar antes de comprobar y guardar:

  ```sql
  -- dentro de la rama de invitado de public.scores_before_insert()
  new.player_name := upper(btrim(regexp_replace(new.player_name, '\s+', ' ', 'g')));
  if new.player_name !~ '^[A-Z0-9_ ]{1,10}$' then
    raise exception 'player_name_invalid';
  end if;
  if exists (select 1 from public.profiles p
             where p.username = lower(replace(new.player_name, ' ', '_'))
                or p.username = lower(new.player_name)) then
    raise exception 'player_name_reserved';
  end if;
  ```

  Y en la app, `trim()` del nombre antes de `insertScore`. Restringir el alfabeto rechaza nombres
  con tildes o «Ñ» que hoy se aceptan: es cambio de UX.
- Propuesta de spec: `15-nombres-invitado-normalizados` — normalizar y restringir `player_name` de
  invitado a `[A-Z0-9_ ]{1,10}` (BD + reproductor, con mensaje «NOMBRE NO VÁLIDO») y cerrar la
  suplantación por espacios u homoglifos.

### APP-01 — `next` 16.3.3 con vulnerabilidad crítica

- Evidencia: `npm audit --omit=dev --json` → 1 crítica: `next` `>=16.2.0 <16.3.6`,
  GHSA-vcvr-r3jv-pc5j «Remote Code Execution in next/og ImageResponse»; `fixAvailable`: `next`
  16.3.8 (no major). `node_modules/next/package.json`: 16.3.3.
- Impacto: RCE en servidor si una ruta usa `next/og` `ImageResponse`. Hoy no hay `next/og`,
  `ImageResponse` ni `opengraph-image`/`icon.tsx` en `app/` (`grep`), así que no es explotable
  directamente; por eso ALTO y no CRÍTICO. Se vuelve CRÍTICO en cuanto se agregue una imagen OG.
- Corrección propuesta: actualizar `next` (y `eslint-config-next`) a `16.3.8` en `package.json`,
  `npm install`, `npm run build` y revisar `node_modules/next/dist/docs/` por cambios.
- Spec relacionada: — (mantenimiento de dependencias).

### APP-02 — `/api/contact` sin rate limit ni CAPTCHA

- Evidencia: `app/api/contact/route.ts:10-29`: `POST` público que llama a `resend.emails.send`
  con cualquier body válido; el formulario de `app/about/page.tsx:56` no tiene Turnstile.
- Impacto: un script puede agotar la cuota de Resend o inundar `CONTACT_TO_EMAIL` (spam/DoS
  barato). El remitente es `onboarding@resend.dev`, sin reputación propia.
- Corrección propuesta: Turnstile en el formulario de `/about` con verificación del token en el
  route handler (`https://challenges.cloudflare.com/turnstile/v0/siteverify` con una secret key de
  servidor) y/o rate limit por IP. Necesita infraestructura nueva (secret key de Turnstile en el
  servidor, almacén para rate limit).
- Propuesta de spec: `16-contacto-anti-abuso` — Turnstile verificado en servidor y límite por IP
  para `/api/contact`.

### APP-03 — `/api/contact` sin validación del body

- Evidencia: `app/api/contact/route.ts:11` `await request.json()` fuera del `try` (JSON inválido →
  500 no controlado); `:12-14` solo comprueba truthiness (un objeto o número pasa); sin límites de
  longitud; `:27` `subject: \`Nuevo mensaje de contacto de ${name}\`` interpola `name` sin quitar
  `\r\n`; `email` no se valida como email.
- Impacto: mensajes de tamaño arbitrario, `[object Object]` en el correo, posible inyección de
  cabeceras si el proveedor no sanea `subject` (Resend usa API JSON; no verificado en vivo).
- Corrección propuesta: mover `request.json()` dentro de `try` con 400 ante error; validar
  `typeof === "string"`, `name` ≤ 50, `email` ≤ 254 con regex simple, `msg` ≤ 2000; quitar
  `[\r\n]` de `name` antes de usarlo en `subject`.
- Spec relacionada: —.

### APP-04 — `/api/contact` devuelve el mensaje de error de Resend

- Evidencia: `app/api/contact/route.ts:31-35` `{ ok: false, error: error.message }`, que
  `app/about/page.tsx` muestra al usuario.
- Impacto: filtra detalles del proveedor (dominio no verificado, cuota, destinatario).
- Corrección propuesta: registrar `error` en servidor (`console.error`) y devolver el mensaje
  genérico «No se pudo enviar el mensaje. Intenta de nuevo.».
- Spec relacionada: —.

### APP-05 — `X-Powered-By: Next.js`

- Evidencia: `curl -sI http://localhost:3000/` → `X-Powered-By: Next.js`; `next.config.ts:17-20`
  sin `poweredByHeader: false` (opción documentada en
  `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/poweredByHeader.md`).
- Impacto: revela el framework (facilita buscar CVE como APP-01). Higiene.
- Corrección propuesta: `poweredByHeader: false` en `nextConfig`.
- Spec relacionada: 14 (headers).

### APP-06 — `.env.local.example` incompleto

- Evidencia: `.env.local.example:1-2` solo declara `NEXT_PUBLIC_SUPABASE_URL` y
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (vacías, correcto). Faltan `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  (SPEC 14), `RESEND_API_KEY` y `CONTACT_TO_EMAIL`.
- Impacto: quien clone el repo arranca sin site key (botón de `/auth` deshabilitado) y puede
  acabar pegando claves en sitios equivocados. Higiene.
- Corrección propuesta: agregar los tres nombres con valor vacío y un comentario indicando cuáles
  son solo de servidor.
- Spec relacionada: 14.

## Riesgos aceptados

| Riesgo                                                                                       | Spec  | Se reabre si…                                                     |
| -------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------- |
| `auth_leaked_password_protection` (único aviso de `get_advisors` security)                   | 14    | El proyecto pasa a plan Pro.                                      |
| Sin Content-Security-Policy                                                                  | 14    | Aparece una spec de CSP o contenido HTML de usuarios.             |
| Sin CAPTCHA ni rate limit en el guardado de puntuaciones de invitados                        | 14    | Hay señales de abuso en `scores` (A.10: hoy 1 insert de invitado en 7 días, máx. 1/min). |
| Sin SMTP propio, sin MFA, sin `supabase/config.toml`                                         | 14    | —                                                                 |
| Filas antiguas de invitado con `player_name` igual a un username                             | 13    | Aparecen filas así creadas después de la SPEC 13 (hoy: 0 en total). |
| Lectura pública (`select` para `anon`) de `games`, `scores`, `profiles`                      | 06/12 | `profiles` o `scores` exponen columnas sensibles nuevas. `scores.user_id` (SPEC 13) es nueva pero es el mismo UUID ya público en `profiles.id`: no reabre. |
| `X-Frame-Options: DENY` impide iframes                                                       | 14    | —                                                                 |
| `signUp` con email ya registrado muestra «ESE CORREO YA TIENE CUENTA» (enumeración de emails) | 12    | Se decide ocultarlo (decisión explícita de la SPEC 12, riesgo 1). |

## Pendientes manuales

- [ ] Supabase → Authentication → Providers → Email — «Minimum password length» = 8 y «Confirm
      email» activo.
- [ ] Supabase → Authentication → Providers → Email — «Secure password change» y «Secure email
      change» activos (`/auth/reset` cambia la contraseña solo con sesión).
- [ ] Supabase → Authentication → Attack Protection — CAPTCHA activo con Turnstile (sin esto,
      `captchaToken` se ignora y los bots pueden llamar a `signUp`/`signInWithPassword` directamente).
- [ ] Supabase → Authentication → Rate Limits — rellenar la tabla «Rate limits» de la SPEC 14 (hoy
      todas las celdas con «—»).
- [ ] Supabase → Authentication → URL Configuration — Site URL y Redirect URLs exactas
      (`http://localhost:3000/auth/callback`, `http://10.51.146.3:3000/auth/callback`), sin `**`.
- [ ] Cloudflare → Turnstile — hostnames del widget limitados a `localhost` y `10.51.146.3` (y el
      dominio de producción cuando exista).
- [ ] Google Cloud Console y GitHub → OAuth Apps — redirect URI exacta
      `https://fchwogbyatwsghxvexmb.supabase.co/auth/v1/callback`.
- [ ] BD — comprobar que una tabla nueva en `public` queda con `relrowsecurity = true` (requiere
      `create table`; no se puede hacer en modo solo lectura).
- [ ] App — comprobar si Resend sanea `\r\n` en `subject` (requiere enviar un email real, APP-03).
- [ ] App — hay otro servidor en `:3100` (PID 39212) que no envía los headers de la SPEC 14 y
      responde 404 en `/auth/reset`: parece un build antiguo; detenerlo o confirmar que no es el
      que se expone.

## Checklist base (`references/security/security-checklist.md`)

| Punto                                         | Estado observado                    | Evidencia                                                                                                    |
| --------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| RLS en `games` y `scores`                     | Cumplido                            | `relrowsecurity = true` en `games`, `scores`, `profiles`; `ensure_rls` activo (`O`).                         |
| Minimum password length = 8                   | Parcial (pendiente manual)          | Cliente `PASSWORD_MIN = 8`; panel no verificable.                                                            |
| Leaked password protection                    | Aceptado (plan Free)                | `get_advisors` security: solo `auth_leaked_password_protection`.                                             |
| Max signup rate / anti-bot                    | Parcial (pendiente manual)          | Turnstile y `captchaToken` en `signUp`/`signInWithPassword`/`resetPasswordForEmail` (`app/auth/page.tsx:80,108,125`), botón deshabilitado sin token (`:287`), reset tras envío y al cambiar de modo (`:67,164`). CAPTCHA del panel y rate limits sin verificar. |
| Headers de seguridad en Next.js               | Cumplido                            | `next.config.ts:3-19`; `curl -sI` en `:3000` para `/`, `/auth`, `/biblioteca`, `/game/asteroides/play`, `/auth/reset`: los cinco headers exactos. |
| Avisos `anon/authenticated_security_definer_function_executable` (`rls_auto_enable`) | Cumplido | `has_function_privilege` `anon`/`authenticated` = `false`; avisos ausentes en `get_advisors`. Ver BD-02 (falta la migración de creación). |

## Historial

- 2026-10-01 — todo — directo — resultado: primera auditoría. BD: 1 ALTO (BD-06), 5 MEDIO; App:
  1 ALTO (APP-01), 2 MEDIO, 3 BAJO; 8 riesgos aceptados; garantías de las SPEC 12-14 verificadas
  salvo la reserva de nombres (BD-06). Nota: un `grep` recursivo de secretos leyó `.env.local` por
  accidente (sigue ignorado y fuera de git); su valor no se reproduce aquí.
