# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Proyecto

Arcade Vault: plataforma para jugar online y competir por puntos. Next.js 16.3.3 (App Router) + React 19 + TypeScript strict + Tailwind CSS 4. Todo el código fuente vive en `app/` (sin monorepo). Alias `@/*` → `./*`.

## Workflow: Spec Driven Design

Este repo sigue spec-driven design: features grandes se definen en `specs/` antes de escribir código.

- `/spec` — diseña una spec nueva sección por sección, hace preguntas de aclaración antes de proponer estructura. Usar antes de empezar una feature grande.
- `/spec-impl` — implementa una spec ya escrita.
- `/juego-nuevo` — variante especializada de `/spec` precargada con la arquitectura ya fijada para juegos (registro por id + leaderboard real en Supabase). Usar antes de portar un juego de `references/started-games/` o crear uno desde cero; solo produce la spec en `specs/`, no implementa.

Antes de `/juego-nuevo`, cuando aún no está decidido qué juego sigue, usar el agente `game-planner` (`.claude/agents/game-planner.md`). Su memoria son `references/game-ideas.md` (todas las ideas evaluadas, incluidas las descartadas) y `references/game-todo-collections.md` (cola priorizada con briefs listos para `/juego-nuevo`) y `references/game-suggestions-todo.md` (To do con cada sugerencia accionable, ids `S-NNN`): siempre los lee antes de proponer y los actualiza al terminar.

Para especificar un juego pedido, usar el agente `game-jam` (`.claude/agents/game-jam.md`): recibe el juego concreto (o un tema, del que elige un solo juego) y genera de forma automática una única carpeta `specs/game-jam/NN-<slug>/` con al menos `motor.md` e `integracion.md` completas en el formato de las specs 07-09 (más specs extra solo si la complejidad lo justifica), suficientes para la integración completa del juego, más un índice en `specs/game-jam/README.md`. Solo escribe specs (no implementa ni toca `references/`); la spec elegida se promueve después a `specs/NN-juego-<slug>.md` para `/spec-impl`.

Para revisar las skins de los juegos, usar el agente `skin-designer` (`.claude/agents/skin-designer.md`): implementa directamente en el código que cada juego pedido tenga al menos tres skins (`clasico` por defecto, `neon` y `retro`), junto con la infraestructura común (`app/game/skins.ts`, prop `skin` en el registro) y el selector de skin dentro del HUD del reproductor (`.player-hud` en `app/game/[id]/play/page.tsx`). Lleva el estado por juego en `specs/skin-designer/skins-games-design.md` (lo lee al empezar y lo actualiza al terminar). Acepta uno, varios o `todos` los juegos. **Antes de invocarlo, si el usuario no nombró ningún juego, preguntar con `AskUserQuestion` si revisar todos los juegos o uno/varios en específico** (el subagente no puede preguntar; si le llega sin juegos, no modifica nada y devuelve esa misma pregunta). Las specs previas en `specs/skins/` solo le sirven como referencia de diseño.

Estas tres skills están symlinkeadas en `.claude/skills/` desde `E:\Users\1187574\Documents\skills_offline_claude\fernando-skills-main` (instalación offline; el paquete `Klerith/fernando-skills` vía `npx skills@latest add` falla por red en este entorno — usar el script `scripts/install-to-agent.sh claude` de esa carpeta si hace falta reinstalar).

## Juegos con motor real

Cada juego con motor real se registra por id en `app/game/registry.ts` (nunca `if (id === "...")` encadenados en los consumidores). Una entrada define `Canvas`, `hasRealLeaderboard`, el label/formato del stat secundario del HUD (p.ej. vidas como corazones, líneas o longitud como número) y opcionalmente `screenClassName` cuando el tablero no encaja en el 4:3 por defecto.

Juegos portados hasta ahora (motor + leaderboard en Supabase por slug, vía `app/lib/supabase/queries.ts` / `queries.client.ts`):

- **asteroides** (`app/game/asteroides/`) — spec `05-juego-asteroides.md`, primer juego con motor real y primera integración con Supabase.
- **tetris** (`app/game/tetris/`) — spec `07-juego-tetris.md`, tablero angosto (`screenClassName: "crt-screen--narrow"`), stat secundario "Líneas".
- **arkanoid** (`app/game/arkanoid/`) — spec `08-juego-arkanoid.md`.
- **snake** (`app/game/snake/`) — spec `09-juego-snake.md`, stat secundario "Longitud".

y mas...
(visita: \references\implemented-games.md) cuando necesites ver qué juegos están implementados y cómo implementar nuevos

El leaderboard general (`06-leaderboard-tabla-juegos.md`) y su patrón de cuatro funciones genéricas por slug (`getGames`, `getTopScores`, `insertScore`) se reutilizan sin cambios para cada juego nuevo — solo se agrega la fila de siembra en una migración de Supabase (`supabase/migrations/`).

## references/templates/

`references/templates/*.jsx` (`app.jsx`, `nav.jsx`, `auth.jsx`, `biblioteca.jsx`, `detalle.jsx`, `reproductor.jsx`, `salon.jsx`, `data.jsx`, `Arcade Vault.html`) son la **spec literal** de las páginas a implementar en `app/` — no son solo inspiración visual. Al construir una página real, seguir su estructura y contenido, adaptándolos al App Router / TypeScript / Tailwind del proyecto.

## Estado actual

- Sin test framework configurado — no asumir que existe `npm test` funcional.
- Sin CI (`.github/workflows` no existe).
- Prettier configurado (`.prettierrc`, `.prettierignore`), integrado con ESLint vía `eslint-config-prettier` (flat config en `eslint.config.mjs`). Cada Write/Edit dispara un hook `PostToolUse` (`.claude/settings.json`) que corre `prettier --write` y, en archivos JS/TS, `eslint --fix` automáticamente sobre el archivo tocado.

##Skills

Usa siempre /frontend-design para diseñar interfaces de usuarios.
