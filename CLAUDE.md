# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Proyecto

Arcade Vault: plataforma para jugar online y competir por puntos. Next.js 16.3.3 (App Router) + React 19 + TypeScript strict + Tailwind CSS 4 + Supabase. Todo el código fuente vive en `app/` (sin monorepo). Alias `@/*` → `./*`.

Auth (specs `12` y `13`): Supabase con email + contraseña y OAuth (Google, GitHub; `signInWithOAuth` → `/auth/callback`), con username único en `public.profiles` creado por el trigger `handle_new_user()` (en OAuth lo genera: `user_name` de GitHub o parte local del email, 7 caracteres + sufijo 2..999). `useAuth()` de `app/lib/auth/AuthProvider.tsx` es la única fuente de sesión en cliente (nunca `getUser()` por página ni `localStorage`); `proxy.ts` en la raíz refresca la sesión y solo protege las rutas de auth (spec `14`): `/auth/reset` sin sesión → `/auth`, `/auth` con sesión → `/biblioteca`; el resto queda abierto al modo invitado. `scores.user_id` liga cada puntuación a su cuenta: con sesión `insertScore` envía `user_id` y el trigger `scores_before_insert` fija `player_name = upper(username)`; los invitados no pueden usar un username registrado (`player_name_reserved`).

Seguridad (spec `14`, checklist en `references/security/security-checklist.md`): headers HTTP en `next.config.ts` (`securityHeaders`, todas las rutas, sin CSP); Turnstile (`@marsidev/react-turnstile`) en los formularios de `/auth` con `NEXT_PUBLIC_TURNSTILE_SITE_KEY` en `.env.local` y `captchaToken` en `signUp`/`signInWithPassword`/`resetPasswordForEmail` (OAuth y `/auth/reset` sin CAPTCHA); `public.rls_auto_enable()` (event trigger `ensure_rls`) sin `EXECUTE` para `public`/`anon`/`authenticated`.

## Workflow: Spec Driven Design

Features grandes se definen en `specs/` antes de escribir código.

### Skills (`.claude/skills/`)

- `/spec` — diseña una spec nueva sección por sección, con preguntas de aclaración.
- `/spec-impl` — implementa una spec aprobada (rama propia, paso a paso).
- `/spec-impl-game` — `/spec-impl` para juegos; al terminar lanza en secuencia (nunca en paralelo) `skin-designer`, `mobile-porter` y `game-performance` (modo encadenado). No hace commits.
- `/juego-nuevo` — `/spec` precargada con la arquitectura de juegos (registro por id + leaderboard Supabase). Solo produce la spec.
- `/frontend-design` — usar siempre para diseñar interfaces de usuario.

### Agentes (`.claude/agents/`)

- `game-planner` — decide qué juego sigue; memoria en `references/game-*.md`.
- `game-jam` — genera specs `motor.md` + `integracion.md` en `specs/game-jam/NN-<slug>/`; luego se promueven a `specs/NN-juego-<slug>.md`.
- `skin-designer` — skins por juego (`clasico`, `neon`, `retro`) + selector en el HUD del reproductor.
- `mobile-porter` — soporte táctil (spec 10) para **un** juego.
- `game-performance` — audita/optimiza FPS (patrón spec 11); niveles `auditar` / `optimizar`.
- `security-auditor` — audita la seguridad de la BD (RLS, policies, funciones, advisors, migraciones) y de la app (secretos, headers, `proxy.ts`, auth, route handlers) contra las specs `12`–`14`; alcance `todo` / `bd` / `app`. Solo lectura: únicamente escribe en `references/auditor-security/` (estado acumulado + informe fechado por auditoría).

Los subagentes no pueden preguntar: si el usuario no nombra juego(s), preguntar antes con `AskUserQuestion` (`mobile-porter` acepta uno solo). Cada agente lleva su estado en `specs/<agente>/`.

## Juegos con motor real

Registro por id en `app/game/registry.ts` (nunca `if (id === "...")` en consumidores). Cada entrada define `Canvas`, `hasRealLeaderboard`, label/formato del stat secundario del HUD, `screenClassName` opcional (si no encaja en 4:3) y `touchControls` obligatorio (`app/game/touch.ts`, spec `10-controles-tactiles-movil.md`). El gamepad virtual despacha `KeyboardEvent` sintéticos: los motores leen solo `e.key`/`e.code` (nunca `keyCode`/`which`/`isTrusted`). Skins en `app/game/skins.ts`.

Implementados (motor en `app/game/<slug>/`):

- **asteroides** — spec `05`, primer motor real e integración Supabase.
- **tetris** — spec `07`, `screenClassName: "crt-screen--narrow"`, stat "Líneas".
- **arkanoid** — spec `08`.
- **snake** — spec `09`, stat "Longitud".
- **frogger** — specs `specs/game-jam/frogger/` + rendimiento `11-frogger-rendimiento.md`.

Detalle por juego: `references/implemented-games.md`.

Leaderboard (spec `06`): funciones genéricas por slug `getGames`, `getGameBySlug` (`app/lib/supabase/queries.ts`), `getTopScores`, `insertScore` (`queries.client.ts`). Juego nuevo solo agrega migración de siembra en `supabase/migrations/`.

## references/templates/

`references/templates/*.jsx` (+ `Arcade Vault.html`) son la **spec literal** de las páginas de `app/`: seguir su estructura y contenido, adaptados a App Router / TypeScript / Tailwind.

## Estado actual

- Sin test framework (no asumir `npm test`). Sin CI.
- Prettier + ESLint (`eslint-config-prettier`, flat config). Hook `PostToolUse` (`.claude/hooks/format-on-write.js`) corre `prettier --write` y `eslint --fix` sobre cada archivo tocado por Write/Edit.
