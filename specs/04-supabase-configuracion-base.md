# 04 — Configuración base de Supabase

**Estado:** Aprobado
**Depende de:** —
**Fecha:** 2026-09-01

**Objetivo:** Instalar y configurar el cliente de Supabase (browser y server) en el proyecto Next.js, dejando la base lista para que futuras specs implementen auth, puntuaciones y salón de la fama reales.

## Alcance

**Incluye:**

- Agregar dependencias `@supabase/supabase-js` y `@supabase/ssr` a `package.json`.
- `app/lib/supabase/client.ts` — cliente de Supabase para browser (`createBrowserClient` de `@supabase/ssr`), usado en client components.
- `app/lib/supabase/server.ts` — cliente de Supabase para server (`createServerClient` de `@supabase/ssr`, usando `cookies()` de `next/headers`), usado en Server Components y Route Handlers.
- Variables de entorno en `.env.local` (no versionado, ya cubierto por `.gitignore`) con placeholders: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, sin valores reales — el usuario los completa manualmente con los datos de su proyecto Supabase.
- `.env.local.example` con las mismas claves sin valores, versionado, documentando qué variables hacen falta.

**Fuera de alcance (para futuras specs):**

- Autenticación real (email/password, OAuth Google/GitHub) — reemplazo del login/registro mock de `/auth` (`localStorage["av_user"]`).
- Tabla `profiles` u otra estructura de usuario en la base de datos.
- Persistencia real de puntuaciones (reemplazo de `localStorage["av_scores"]`).
- Salón de la fama con datos reales desde Supabase (sigue usando `seededScores` mock).
- Cualquier tabla, migración o esquema en la base de datos — el proyecto Supabase queda sin tablas nuevas tras esta spec.
- `middleware.ts` para refresco de sesión — no aplica sin auth implementada todavía.
- Cualquier página, ruta o log que ejecute una llamada real contra Supabase para verificar la conexión.
- Tests automatizados (no hay framework configurado en el repo).

## Modelo de datos

Esta spec no introduce tablas ni estructuras en la base de datos — el proyecto Supabase queda con 0 tablas al finalizar. Introduce únicamente los tipos de configuración de entorno:

```ts
// .env.local / .env.local.example
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

## Plan de implementación

1. **Dependencias** — agregar `@supabase/supabase-js` y `@supabase/ssr` a `package.json` (`npm install @supabase/supabase-js @supabase/ssr`).
2. **Variables de entorno** — crear `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` vacíos; crear `.env.local.example` con las mismas claves sin valores.
3. **`app/lib/supabase/client.ts`** — exporta una función `createClient()` que envuelve `createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)` de `@supabase/ssr`, para uso en client components.
4. **`app/lib/supabase/server.ts`** — exporta una función `createClient()` (async, server-only) que envuelve `createServerClient(...)` de `@supabase/ssr` leyendo/escribiendo cookies vía `cookies()` de `next/headers`, para uso en Server Components y Route Handlers.
5. **Verificación final** — `npm run build` sin errores de tipos/lint; confirmar que `app/lib/supabase/client.ts` y `server.ts` compilan sin ejecutar ninguna llamada real (no hay página que los importe todavía); confirmar que `.env.local` no queda versionado en git y `.env.local.example` sí.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores.
- [ ] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr`.
- [ ] `app/lib/supabase/client.ts` exporta un cliente de browser correctamente tipado, sin errores de TypeScript.
- [ ] `app/lib/supabase/server.ts` exporta un cliente de server correctamente tipado, sin errores de TypeScript.
- [ ] `.env.local` existe con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` como placeholders vacíos, y no aparece en `git status` (ignorado).
- [ ] `.env.local.example` existe, versionado, con las mismas claves sin valores reales.
- [ ] Ninguna pantalla existente (`/`, `/biblioteca`, `/game/[id]`, `/auth`, `/hall-of-fame`, `/about`) cambia de comportamiento.
- [ ] El proyecto de Supabase sigue sin tablas nuevas (0 tablas en `public`) al finalizar esta spec.
- [ ] Ningún archivo bajo `references/templates/` fue modificado.

## Decisiones tomadas y descartadas

- **Sí:** `@supabase/supabase-js` + `@supabase/ssr`, no solo `supabase-js`. Decisión explícita del usuario — es el patrón oficial de Supabase para Next.js App Router, maneja cookies de sesión entre server y cliente para cuando exista auth real.
- **Sí:** archivos separados `app/lib/supabase/client.ts` y `server.ts`, en vez de un único cliente. Decisión explícita del usuario — sigue el patrón recomendado por Supabase para distinguir contexto browser vs. server en App Router.
- **No:** obtener credenciales reales vía MCP y completarlas automáticamente. Decisión explícita del usuario — `.env.local` queda con placeholders vacíos, el usuario los completa manualmente.
- **No:** `middleware.ts` para refresco de sesión. Fuera de alcance hasta que exista auth real (spec futura).
- **No:** tabla `profiles`, tablas de scores, ni ninguna migración. Esta spec es solo instalación y configuración de cliente, sin tocar la base de datos.
- **No:** página o ruta de prueba que ejecute una llamada real contra Supabase. Decisión explícita del usuario — sin auth ni tablas, no hay nada real que verificar en runtime; basta con que el build compile.
- **No:** modo invitado, métodos de login, ni tabla de perfil de usuario definidos en esta spec — el usuario indicó explícitamente no registrar esas respuestas aquí; quedan para la spec futura de autenticación.

## Riesgos identificados

| Riesgo                                                                                                                                                   | Mitigación                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env.local` con placeholders vacíos hace que cualquier código que sí llame a Supabase falle en runtime hasta que el usuario complete los valores reales | Aceptado — esta spec no tiene ningún código que ejecute llamadas reales; el riesgo se materializa recién en la spec de auth, donde debe documentarse de nuevo. |
| `@supabase/ssr` cambia de API entre versiones mayores (createServerClient, manejo de cookies)                                                            | Fijar la versión instalada en `package.json` (`npm install` sin `--force`) y no actualizar sin revisar el changelog oficial de Supabase.                       |
