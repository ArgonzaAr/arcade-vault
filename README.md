# Arcade Vault

Plataforma para jugar clásicos arcade en el navegador y competir por la mayor cantidad de puntos en un leaderboard global. Se puede jugar como invitado o con cuenta (email + contraseña, Google o GitHub), en escritorio o en móvil con controles táctiles.

## Stack

- [Next.js](https://nextjs.org) 16.3.3 (App Router) + React 19
- TypeScript (modo `strict`)
- Tailwind CSS 4
- [Supabase](https://supabase.com): Postgres, Auth y RLS (`@supabase/ssr`, `@supabase/supabase-js`)
- [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) (`@marsidev/react-turnstile`) como CAPTCHA en `/auth`
- [Resend](https://resend.com) para el formulario de contacto
- ESLint (flat config) + Prettier

## Juegos

Cada juego tiene motor propio en `app/game/<slug>/` y se registra por id en `app/game/registry.ts`.

| Juego      | Categoría | Stat del HUD | Spec                                                         |
| ---------- | --------- | ------------ | ------------------------------------------------------------ |
| Asteroides | SHOOTER   | Vidas        | `specs/05-juego-asteroides.md`                               |
| Tetris     | PUZZLE    | Líneas       | `specs/07-juego-tetris.md`                                   |
| Arkanoid   | ARCADE    | Vidas        | `specs/08-juego-arkanoid.md`                                 |
| Snake      | ARCADE    | Longitud     | `specs/09-juego-snake.md`                                    |
| Frogger    | ARCADE    | Vidas        | `specs/game-jam/frogger/`, `specs/11-frogger-rendimiento.md` |

Todos los juegos incluyen:

- **Skins** `clasico`, `neon` y `retro` (`app/game/skins.ts`), seleccionables desde el HUD.
- **Controles táctiles**: gamepad virtual que despacha `KeyboardEvent` sintéticos (`app/game/touch.ts`, spec `10`).
- **Leaderboard real** en Supabase (spec `06`).

Detalle por juego en `references/implemented-games.md`.

## Rutas

| Ruta              | Descripción                                        |
| ----------------- | -------------------------------------------------- |
| `/`               | Home                                               |
| `/biblioteca`     | Catálogo de juegos                                 |
| `/game/[id]`      | Ficha del juego                                    |
| `/game/[id]/play` | Reproductor del juego                              |
| `/hall-of-fame`   | Leaderboard por juego                              |
| `/about`          | Acerca de + formulario de contacto                 |
| `/auth`           | Inicio de sesión / registro / recuperar contraseña |
| `/auth/reset`     | Nueva contraseña (requiere sesión de recuperación) |
| `/auth/callback`  | Retorno de OAuth y enlaces de email                |
| `/api/contact`    | `POST` del formulario de contacto (Resend)         |

## Puesta en marcha

### Requisitos

- Node.js 20+
- Un proyecto de Supabase
- (Opcional) Site key de Turnstile y API key de Resend

### Instalación

```bash
npm install
cp .env.local.example .env.local
```

### Variables de entorno (`.env.local`)

| Variable                               | Uso                                                   |
| -------------------------------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL del proyecto de Supabase                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key de Supabase                           |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`       | Site key de Turnstile para los formularios de `/auth` |
| `RESEND_API_KEY`                       | API key de Resend (`/api/contact`)                    |
| `CONTACT_TO_EMAIL`                     | Destinatario de los mensajes de contacto              |

> El secret key de Turnstile se configura en Supabase (Authentication → Attack Protection), no en la app.

### Base de datos

Las migraciones viven en `supabase/migrations/` (tablas `games` y `scores`, siembra de cada juego, `profiles`, `scores.user_id`, usernames para OAuth y endurecimiento de RLS). Aplícalas con la CLI de Supabase:

```bash
supabase db push
```

Para OAuth, habilita los proveedores Google y GitHub en Supabase y agrega `<tu-dominio>/auth/callback` a las Redirect URLs.

### Scripts

```bash
npm run dev      # servidor de desarrollo en http://localhost:3000
npm run build    # build de producción
npm run start    # sirve el build
npm run lint     # ESLint
npm run format   # Prettier sobre todo el proyecto
```

No hay framework de tests ni CI configurados.

## Autenticación y puntuaciones

- `useAuth()` (`app/lib/auth/AuthProvider.tsx`) es la única fuente de sesión en el cliente.
- Cada cuenta tiene un **username único** en `public.profiles`, creado por el trigger `handle_new_user()`. En OAuth se genera automáticamente (`user_name` de GitHub o parte local del email).
- `proxy.ts` refresca la sesión y protege solo las rutas de auth: `/auth/reset` sin sesión → `/auth`; `/auth` con sesión → `/biblioteca`. El resto del sitio es accesible como invitado.
- Con sesión, `insertScore` envía `user_id` y el trigger `scores_before_insert` fija `player_name = upper(username)`. Los invitados no pueden usar un username registrado.

## Seguridad

Basada en la spec `14` y en `references/security/security-checklist.md`:

- Headers HTTP de seguridad en `next.config.ts` para todas las rutas.
- CAPTCHA Turnstile en registro, login y recuperación de contraseña.
- RLS en todas las tablas; la función `public.rls_auto_enable()` no es ejecutable por `public`/`anon`/`authenticated`.

## Estructura

```
app/
  components/       # Nav, HomeView, GameCard, BibliotecaGrid
  game/             # registry, skins, touch, gamepad virtual y un motor por juego
  lib/auth/         # AuthProvider, validación y mensajes de error
  lib/supabase/     # clientes (browser/server) y queries
  api/contact/      # route handler del contacto
proxy.ts            # refresco de sesión y redirecciones de auth
specs/              # specs numeradas (Spec Driven Design)
references/         # plantillas de UI, juegos implementados, seguridad
supabase/migrations/
```

## Workflow: Spec Driven Design

Las features grandes se definen primero como spec en `specs/` (numeradas `01`–`14`) y luego se implementan. Las páginas siguen literalmente las plantillas de `references/templates/`.

Skills de Claude Code incluidas en `.claude/skills/`:

- `/spec` — diseña una spec nueva sección por sección.
- `/spec-impl` — implementa una spec aprobada paso a paso.
- `/frontend-design` — guía para diseñar interfaces.

Basado en las buenas prácticas de [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills):

```bash
npx skills@latest add Klerith/fernando-skills
```

Para añadir un juego nuevo: spec en `specs/`, motor en `app/game/<slug>/`, entrada en `app/game/registry.ts` (con `touchControls` y skins) y una migración de siembra en `supabase/migrations/`.
