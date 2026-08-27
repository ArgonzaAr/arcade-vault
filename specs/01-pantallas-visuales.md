# 01 — Pantallas visuales de Arcade Vault

**Estado:** Aprobado
**Depende de:** —
**Fecha:** 2026-08-26

**Objetivo:** Implementar en `app/` (Next.js App Router + TypeScript + Tailwind 4) las cinco pantallas visuales definidas en `references/templates/*.jsx` (biblioteca, detalle de juego, reproductor simulado, auth, salón de la fama), sin implementar lógica de ningún juego real.

## Alcance

**Incluye:**
- Layout global: `Nav` (barra superior + panel móvil), fondo `av-bg`/`av-noise` (ya presentes en `app/layout.tsx`), footer.
- Página **Biblioteca** (`/`): hero, buscador, chips de categoría, grid de `GameCard` con tilt al mouse, estado vacío "NO HAY RESULTADOS".
- Página **Detalle de juego** (`/game/[id]`): portada, tags, descripción, stat-strip, botones JUGAR/VOLVER, leaderboard lateral con datos mock.
- Página **Reproductor** (`/game/[id]/play`): HUD (jugador/puntuación/vidas/nivel), pantalla CRT con arena de juego simulada (CSS puro, sin lógica jugable), controles PAUSA/FIN/SALIR, modal de fin de juego con guardado de puntuación.
- Página **Auth** (`/auth`): tabs iniciar sesión / crear cuenta, botón jugar como invitado, botones sociales decorativos (Google/GitHub, sin funcionalidad real), sin validación de credenciales real.
- Página **Salón de la fama** (`/hall-of-fame`): tabs por juego, podio top 3, tabla de posiciones, fila destacada "tu mejor marca" si hay usuario logueado.
- Datos mock tipados (`GAMES`, `CATS`, `PLAYERS`, `seededScores`) portados a TypeScript.
- Persistencia mock vía `localStorage` (`av_user`, `av_scores`), replicando el comportamiento de `app.jsx`.
- Simulación visual completa del reproductor: el puntaje sube solo con `setInterval` (cada ~220ms), el nivel avanza cada 2500 puntos, sin input real del jugador ni reglas de ningún juego.

**No incluye (fuera de alcance de esta spec):**
- Lógica jugable real de ninguno de los 8 juegos (Bloque Buster, Caída, Serpentina, etc.). El "juego" en `/game/[id]/play` es enteramente decorativo/simulado.
- Backend real, autenticación real, base de datos, API routes.
- Sistema de créditos/monedas funcional (el contador "CRÉDITOS · 03" en el Nav es estático, como en el template).
- Tests automatizados (no hay framework configurado en el repo).
- Internacionalización (la UI queda en español, como los templates; solo los slugs de URL son en inglés).

## Modelo de datos

Todo tipado en `app/lib/data.ts`, migrado de `references/templates/data.jsx`:

```ts
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string; // clase CSS cover-*
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
}

export const GAMES: Game[];
export const CATS: string[]; // ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]
export const PLAYERS: string[];

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}

export function seededScores(seed: number, count?: number): ScoreRow[];
```

Persistencia en `localStorage` (sin módulo propio, acceso directo donde se necesite, igual que el template):

```ts
// av_user
interface StoredUser { name: string }

// av_scores
interface SavedScoreEntry { game: string; score: number; name: string; at: number }
```

## Plan de implementación

1. **`app/lib/data.ts`** — portar `GAMES`, `CATS`, `PLAYERS`, `seededScores` desde `data.jsx` con los tipos de arriba. Sistema funcional standalone (no requiere UI).
2. **`app/components/Nav.tsx`** — portar `nav.jsx`. Client component. Usa `usePathname`/`useRouter` de `next/navigation` en vez de `route`/`navigate` por props; lee usuario desde `localStorage` vía `useState`/`useEffect`. Integrar en `app/layout.tsx` reemplazando el placeholder actual.
3. **`app/components/GameCard.tsx`** — portar el componente `GameCard` de `biblioteca.jsx` (tilt 3D con `onMouseMove`/`onMouseLeave`), recibe `Game` y navega con `next/link` a `/game/[id]`.
4. **`app/page.tsx`** — reemplazar el placeholder actual por la página Biblioteca completa (hero, buscador, chips, grid), client component por el estado de búsqueda/filtro.
5. **`app/game/[id]/page.tsx`** — página Detalle, server component que resuelve `GAMES.find` por `params.id` (404 con `notFound()` si no existe), leaderboard con `seededScores`, botón JUGAR AHORA enlaza a `/game/[id]/play`.
6. **`app/game/[id]/play/page.tsx`** — página Reproductor, client component, portar `reproductor.jsx` (HUD, CRT, simulación de puntaje con `setInterval`, modal de fin de juego, guardado en `av_scores` vía `localStorage`).
7. **`app/auth/page.tsx`** — página Auth, client component, portar `auth.jsx` (tabs, formulario, invitado, sociales decorativos), guarda `av_user` en `localStorage` y redirige a `/` con `useRouter`.
8. **`app/hall-of-fame/page.tsx`** — página Salón de la Fama, client component, portar `salon.jsx` (tabs por juego, podio, tabla, fila "tu mejor marca" si hay usuario en `localStorage`).
9. **Ajustes de footer** — agregar el footer estático de `app.jsx` (`© 2026 ARCADE VAULT...`) en `app/layout.tsx`.
10. **Verificación final** — `npm run build` sin errores de tipos/lint, recorrido manual por las 5 pantallas en el navegador (biblioteca → detalle → reproductor → fin de juego → guardar puntuación → salón de la fama → auth → login/invitado).

## Criterios de aceptación

- [ ] `npm run build` completa sin errores.
- [ ] `/` muestra el grid de 8 juegos, el buscador filtra por título, los chips filtran por categoría, y buscar algo inexistente muestra "NO HAY RESULTADOS".
- [ ] Click en una `GameCard` o su botón JUGAR navega a `/game/[id]` con la información correcta del juego (portada, descripción, stats, leaderboard con 10 filas).
- [ ] `/game/[id]` con un `id` inexistente responde 404.
- [ ] Botón "JUGAR AHORA" en detalle navega a `/game/[id]/play`.
- [ ] En `/game/[id]/play`, el puntaje sube solo automáticamente, PAUSA detiene el incremento, FIN abre el modal de fin de juego con el puntaje final.
- [ ] Guardar puntuación en el modal persiste una entrada en `localStorage["av_scores"]` y muestra el toast "PUNTUACIÓN GUARDADA_".
- [ ] `/auth` permite cambiar entre tabs, "JUGAR COMO INVITADO" navega a `/` sin usuario logueado, enviar el formulario de login navega a `/` con usuario logueado (persistido en `localStorage["av_user"]`).
- [ ] El Nav refleja el estado de sesión: botón "Iniciar Sesión" si no hay usuario, nombre de usuario si lo hay; cerrar sesión limpia `localStorage["av_user"]`.
- [ ] `/hall-of-fame` muestra podio top 3 y tabla completa por cada juego seleccionado en las tabs; si hay usuario logueado, muestra la fila "tu mejor marca".
- [ ] El menú móvil (hamburguesa) abre/cierra el panel lateral en viewports angostos.
- [ ] Ningún archivo bajo `references/templates/` fue modificado (siguen siendo la spec de referencia).

## Decisiones tomadas y descartadas

- **Rutas reales de Next en vez de hash routing SPA** — se descarta replicar `location.hash` + estado `route` de `app.jsx`; se usan rutas de archivo estándar del App Router (`/`, `/game/[id]`, `/game/[id]/play`, `/auth`, `/hall-of-fame`) con `next/link` y `useRouter`, por ser lo idiomático en este framework y lo que espera el resto del repo.
- **Slugs de URL en inglés** (`/game/[id]`, `/hall-of-fame`) mientras la UI visible queda en español — decisión explícita del usuario, separa contenido de identificadores técnicos.
- **Persistencia mock con `localStorage`** (`av_user`, `av_scores`) — se mantiene igual al template en vez de usar estado en memoria, para preservar el comportamiento (login persiste entre recargas, puntuaciones se acumulan) sin necesidad de backend.
- **Reproductor con simulación de puntaje activa** (`setInterval` incrementando puntaje) — se mantiene el "teatro" de juego del template completo, ya que la instrucción del usuario fue "solo la parte visual, no implementar ningún juego": la simulación es visual/decorativa, no una implementación jugable de ninguno de los 8 títulos.
- **Botones sociales (Google/GitHub) decorativos sin handler real** — se mantienen igual que el template, ya que son parte de la UI de referencia y no prometen funcionalidad que no existe (no hay copy engañoso adicional).
- **Estructura `app/components/` compartida** en vez de co-locar componentes por ruta — evita duplicar `Nav`/`GameCard`, sigue convención estándar de Next App Router.
- **`app/lib/data.ts`** como único módulo de datos mock, tipado con interfaces `Game` y `ScoreRow` — reemplaza el archivo `data.jsx` global de `window.GAMES` del template SPA.

## Riesgos identificados

- El componente `GameCard` usa manipulación directa de `style.transform` vía `ref` en `onMouseMove`; en un client component de Next esto es válido pero debe marcarse explícitamente `"use client"` en el archivo que lo contenga.
- `useSearchParams`/`usePathname` en `Nav` requieren que el layout raíz permita client components anidados sin romper el server component de `RootLayout`; se resuelve dejando `Nav` como client component independiente importado desde el layout server.
- Los estilos CSS-only para las portadas (`cover-bricks`, `cover-tetro`, etc.) y la arena del reproductor ya están completos en `app/globals.css`; no se anticipan gaps, pero conviene verificar visualmente cada portada tras el port.
