# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Proyecto

Arcade Vault: plataforma para jugar online y competir por puntos. Next.js 16.3.3 (App Router) + React 19 + TypeScript strict + Tailwind CSS 4. Todo el código fuente vive en `app/` (sin monorepo). Alias `@/*` → `./*`.

## Workflow: Spec Driven Design

Este repo sigue spec-driven design: features grandes se definen en `specs/` antes de escribir código.

- `/spec` — diseña una spec nueva sección por sección, hace preguntas de aclaración antes de proponer estructura. Usar antes de empezar una feature grande.
- `/spec-impl` — implementa una spec ya escrita.

Ambas skills están symlinkeadas en `.claude/skills/` desde `E:\Users\1187574\Documents\skills_offline_claude\fernando-skills-main` (instalación offline; el paquete `Klerith/fernando-skills` vía `npx skills@latest add` falla por red en este entorno — usar el script `scripts/install-to-agent.sh claude` de esa carpeta si hace falta reinstalar).

## references/templates/

`references/templates/*.jsx` (`app.jsx`, `nav.jsx`, `auth.jsx`, `biblioteca.jsx`, `detalle.jsx`, `reproductor.jsx`, `salon.jsx`, `data.jsx`, `Arcade Vault.html`) son la **spec literal** de las páginas a implementar en `app/` — no son solo inspiración visual. Al construir una página real, seguir su estructura y contenido, adaptándolos al App Router / TypeScript / Tailwind del proyecto.

## Estado actual

- Sin test framework configurado — no asumir que existe `npm test` funcional.
- Sin CI (`.github/workflows` no existe).
- Prettier configurado (`.prettierrc`, `.prettierignore`), integrado con ESLint vía `eslint-config-prettier` (flat config en `eslint.config.mjs`). Cada Write/Edit dispara un hook `PostToolUse` (`.claude/settings.json`) que corre `prettier --write` y, en archivos JS/TS, `eslint --fix` automáticamente sobre el archivo tocado.

##Skills

Usa siempre /frontend-design para diseñar interfaces de usuarios.
