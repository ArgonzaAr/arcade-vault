# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Proyecto

Arcade Vault: plataforma para jugar online y competir por puntos. Next.js 16.3.3 (App Router) + React 19 + TypeScript strict + Tailwind CSS 4 + Supabase. Todo el código fuente vive en `app/` (sin monorepo). Alias `@/*` → `./*`.

Auth (spec `12`): Supabase con email + contraseña y username único en `public.profiles` (creado por trigger). `useAuth()` de `app/lib/auth/AuthProvider.tsx` es la única fuente de sesión en cliente (nunca `getUser()` por página ni `localStorage`); `proxy.ts` en la raíz solo refresca la sesión, no protege rutas.

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
