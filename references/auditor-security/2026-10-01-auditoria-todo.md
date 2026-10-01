# Auditoría de seguridad — 2026-10-01

- **Modo:** directo. **Alcance:** `todo` (BD + App).
- **Rama:** `spec-14-checklist-seguridad-basico` (cambios sin commit de las SPEC 13 y 14).
- **Estado acumulado:** `references/auditor-security/security-status.md` (detalle, evidencia y SQL
  propuesto de cada hallazgo).

## Totales

| Alcance | CRÍTICO | ALTO | MEDIO | BAJO | Aceptados |
| ------- | ------- | ---- | ----- | ---- | --------- |
| BD      | 0       | 1    | 5     | 0    | 4         |
| App     | 0       | 1    | 2     | 3    | 4         |

Delta: primera auditoría (12 nuevos, 0 corregidos).

## ALTO

- **BD-06** — `public.scores_before_insert()` / `app/game/[id]/play/page.tsx:319`: la reserva de
  usernames compara sin normalizar; `'PX_KAI '` u homoglifos pasan y suplantan visualmente a un
  registrado. Corrección: normalizar (`btrim`, espacios, alfabeto `[A-Z0-9_ ]{1,10}`) en el trigger
  y `trim()` en el cliente. Propuesta de spec `15-nombres-invitado-normalizados`.
- **APP-01** — `package.json` `next` 16.3.3: crítico GHSA-vcvr-r3jv-pc5j (RCE en `next/og`); no se
  usa `next/og` hoy. Corrección: subir a `next` 16.3.8.

## MEDIO

- **BD-01** — 9 de 10 versiones de migración del repo no coinciden con las remotas; 3 aplicadas sin
  commit. Renombrar o `supabase migration repair` y commitear.
- **BD-02** — `rls_auto_enable()` / `ensure_rls` sin migración de creación; el revoke falla en un
  entorno limpio. Migración `create or replace` + event trigger idempotente.
- **BD-03** — `anon`/`authenticated` con DML y `TRUNCATE` en las tres tablas y `EXECUTE` por defecto
  en funciones nuevas. `revoke` + `alter default privileges`.
- **BD-04** — `scores.created_at`/`id` los fija el cliente (ticker y «TOP HOY» falseables). Forzar
  en el trigger o grants por columna.
- **BD-05** — `scores` sin `CHECK` de longitud de `player_name` ni rango de `score`. Constraints
  `not valid`.
- **APP-02** — `app/api/contact/route.ts:10` sin rate limit ni CAPTCHA. Propuesta de spec
  `16-contacto-anti-abuso`.
- **APP-03** — `app/api/contact/route.ts:11-12,27`: `request.json()` fuera de `try`, sin validar
  tipos/longitudes, `name` en `subject` sin quitar `\r\n`.

## BAJO

- **APP-04** — `app/api/contact/route.ts:31-35` devuelve `error.message` de Resend.
- **APP-05** — `X-Powered-By: Next.js`; añadir `poweredByHeader: false` en `next.config.ts`.
- **APP-06** — `.env.local.example` sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `RESEND_API_KEY`,
  `CONTACT_TO_EMAIL`.

## Verificado sin hallazgo

- RLS activo en `games`, `profiles`, `scores`; policies exactamente las de las SPEC 12/13
  (`auth.uid()` envuelto en `select`); sin `update`/`delete`/`for all`.
- `handle_new_user()` `security definer`, `search_path = ''`, sin `EXECUTE` para `anon`/
  `authenticated`; `scores_before_insert()` invoker con `search_path = ''`; `rls_auto_enable()` sin
  `EXECUTE` público. Triggers `on_auth_user_created`, `scores_before_insert` y `ensure_rls` activos.
- Sin vistas en `public`; sin extensiones en `public`; advisors de rendimiento sin avisos de RLS.
- Señales de abuso (A.10): 6 filas, 0 negativas, 0 caracteres raros, máx. 1 insert/min de invitado,
  0 nombres reservados tras la SPEC 13.
- `.env*` ignorado y fuera de git (historial solo con `.env.local.example` vacío); sin
  `service_role`, `sb_secret_` ni JWT en el repo ni en el historial; variables de servidor solo en
  `app/api/contact/route.ts`.
- Headers de la SPEC 14 verificados en vivo en `:3000`; `proxy.ts` con `getUser()` y
  redirecciones con cookies (`/auth/reset` sin sesión → 307 `/auth`); `/auth/callback` con
  `safeNext` (rechaza `//` y `/\` por comprobación de origin).
- `useAuth()` única fuente de sesión (sin `av_user`, sin `getSession()`, `getUser()` solo en
  `AuthProvider` y `proxy.ts`); sin `dangerouslySetInnerHTML`/`innerHTML`/`eval`.
- Turnstile en los tres formularios con reset y botón deshabilitado; recuperación sin enumerar;
  `authErrorMessage` sin mensajes crudos; `insertScore` sin `id`/`created_at` y con
  `name_reserved`.

## Pendientes manuales

Ver la sección homónima del archivo de estado (panel de Auth, CAPTCHA, rate limits, URL
Configuration, Turnstile hostnames, OAuth redirect URIs, prueba de tabla nueva con RLS, saneo de
`subject` en Resend y servidor antiguo en `:3100`).
