# 02 — Pantalla Home

**Estado:** Aprobado
**Depende de:** SPEC 01
**Fecha:** 2026-08-27

**Objetivo:** Implementar en `app/` la pantalla Home (landing page) definida en `references/templates/home-about/home.jsx`, moviendo la Biblioteca actual de `/` a `/biblioteca` para que Home ocupe la raíz del sitio; la pantalla About queda fuera de esta spec.

## Alcance

**Incluye:**
- Página **Home** (`/`): las 7 secciones completas del template — hero con siluetas flotantes y CTAs, "¿Por qué Arcade Vault?" (feature grid), "Juegos disponibles ahora" (preview de 6 juegos + CTA), stats, "Actividad en vivo" (ticker de puntuaciones + top jugadores), pricing/FAQ, CTA final.
- Reubicar la Biblioteca actual: mover el contenido hoy en `app/page.tsx` a `app/biblioteca/page.tsx` (ruta `/biblioteca`), sin cambios de comportamiento.
- Actualizar `app/components/Nav.tsx`: agregar link "Inicio" → `/`, cambiar el link "Biblioteca" para apuntar a `/biblioteca`, actualizar `isActive` en desktop y panel móvil.
- Animación reveal-on-scroll (`useReveal` con `IntersectionObserver`, clases `.reveal`/`.in`) portada igual que el template.
- Portar a `app/globals.css` las clases CSS nuevas que usa Home y que no existen hoy (`home-hero`, `home-silos`/`.silo`, `feature-grid`/`.feature-card`, `mini-rail`/`.mini-card`, `home-stats`/`.stat-block`, `activity-grid`/`.ticker`/`.top-list`, `pricing-grid`/`.price-card`/`.faq-item`, `home-final`, etc.), comparando `references/templates/home-about/styles.css` contra `app/globals.css` actual.
- Datos de "Actividad en vivo" y "Stats": mock estático hardcodeado igual que el template (arrays fijos de jugadores/puntajes/tiempos), sin conectar a `localStorage["av_scores"]` ni a `seededScores`.
- CTAs "EXPLORAR JUEGOS" (hero) y "VER TODOS LOS JUEGOS →" (games preview) navegan a `/biblioteca`. Las `MiniCard` de la sección de juegos navegan a `/game/[id]`.

**No incluye (fuera de alcance de esta spec):**
- Página About (`about.jsx` del template) — no se implementa ninguna ruta `/about`.
- Link "Acerca de" en el Nav — se omite hasta que exista una spec/implementación de About.
- Cualquier lógica jugable real, backend, autenticación real o API routes (igual que SPEC 01).
- Conectar la "Actividad en vivo" o el "Top jugadores" a datos reales de `localStorage` o a `seededScores`.
- Tests automatizados (no hay framework configurado en el repo).

## Modelo de datos

No se introduce ningún dato nuevo tipado en `app/lib/data.ts`. La sección "Juegos disponibles ahora" reutiliza `GAMES` (ya portado). Los arrays de "Actividad en vivo" (ticker de puntuaciones, top jugadores) y de "Stats" quedan como constantes locales dentro del componente Home, hardcodeadas tal como en `home.jsx` (no se tipan como parte de `data.ts` porque son contenido decorativo fijo, no datos del dominio).

## Plan de implementación

1. **Mover Biblioteca a `/biblioteca`** — crear `app/biblioteca/page.tsx` con el contenido actual de `app/page.tsx` (hero, buscador, chips, grid `GameCard`), sin cambios funcionales.
2. **Diff de estilos** — comparar `references/templates/home-about/styles.css` contra `app/globals.css` y portar únicamente las reglas CSS nuevas necesarias para Home (secciones `home-*`, `feature-*`, `mini-*`, `stat-*`, `activity-*`/`ticker`/`top-list`, `pricing-*`/`price-*`/`faq-*`, silos `.silo`/`.s1`–`.s8`, clase `.reveal`/`.in`), evitando duplicar o pisar reglas ya existentes (nav, botones, `cover-*`, etc.).
3. **`app/page.tsx`** — reemplazar el contenido actual (Biblioteca) por la página Home completa: portar `home.jsx` como client component (`"use client"`, usa `useEffect`/`IntersectionObserver` y navegación), con sub-componentes locales `FloatingSilhouettes`, `MiniCard` y `FeatureIcon` definidos en el mismo archivo (no reutilizables fuera de Home, no se colocan en `app/components/`). Reemplazar `navigate({name:...})` por `next/link` (`Link`) o `useRouter().push` según corresponda a cada botón.
4. **`app/components/Nav.tsx`** — agregar el link "Inicio" (apunta a `/`) antes de "Biblioteca" en desktop y en el panel móvil; actualizar el link "Biblioteca" para apuntar a `/biblioteca`; ajustar `isActive` para que `"home"` matchee `pathname === "/"` y `"biblioteca"` matchee `pathname === "/biblioteca" || pathname.startsWith("/game/")`. No agregar link "Acerca de".
5. **Verificación final** — `npm run build` sin errores de tipos/lint; recorrido manual: `/` muestra Home completo con las 7 secciones, animación reveal al hacer scroll, CTAs navegan a `/biblioteca`; `/biblioteca` muestra el catálogo igual que antes; Nav resalta "Inicio" en `/` y "Biblioteca" en `/biblioteca` y en `/game/[id]`.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores.
- [ ] `/` muestra la pantalla Home con sus 7 secciones (hero, por qué, juegos disponibles, stats, actividad en vivo, pricing/FAQ, CTA final).
- [ ] Las secciones marcadas `reveal` en el template aparecen con la animación de entrada al hacer scroll (no todas visibles de golpe al cargar).
- [ ] El hero muestra las siluetas flotantes decorativas y los botones "EXPLORAR JUEGOS" y "CREAR CUENTA" navegan a `/biblioteca` y `/auth` respectivamente.
- [ ] La sección "Juegos disponibles ahora" muestra 6 `MiniCard` (de `GAMES`), cada una navega a `/game/[id]`; el botón "VER TODOS LOS JUEGOS →" navega a `/biblioteca`.
- [ ] La sección "Actividad en vivo" muestra el ticker de puntuaciones y el top 5 de jugadores con los datos mock del template; el botón "VER SALÓN →" navega a `/hall-of-fame`.
- [ ] La sección Pricing muestra el plan único y las 3 preguntas frecuentes; el botón "EMPEZAR GRATIS →" navega a `/auth`.
- [ ] El CTA final navega a `/biblioteca`.
- [ ] `/biblioteca` reproduce exactamente el comportamiento que antes tenía `/` (buscador, chips de categoría, grid, estado "NO HAY RESULTADOS").
- [ ] El Nav muestra "Inicio" y "Biblioteca" como links separados; "Inicio" resalta activo en `/`, "Biblioteca" resalta activo en `/biblioteca` y en `/game/[id]`; no aparece ningún link "Acerca de".
- [ ] El menú móvil (hamburguesa) incluye "Inicio" y abre/cierra correctamente en viewports angostos.
- [ ] Ningún archivo bajo `references/templates/` fue modificado.

## Decisiones tomadas y descartadas

- **Home ocupa `/`, Biblioteca se mueve a `/biblioteca`** — decisión explícita del usuario; sigue la estructura del template (`nav.jsx` de `home-about` trata Inicio y Biblioteca como rutas distintas) en vez de mantener Biblioteca en la raíz.
- **Se omite el link "Acerca de" en el Nav** — decisión explícita del usuario; evita un link a una ruta `/about` inexistente hasta que exista spec/implementación de About.
- **CSS portado selectivamente (diff), no reemplazo completo de `globals.css`** — decisión explícita del usuario; evita el riesgo de romper estilos ya usados por biblioteca/detalle/reproductor/auth/salón por diferencias entre versiones del theme (`app/globals.css` tiene 952 líneas vs 1744 de `home-about/styles.css`).
- **Actividad en vivo y stats como mock estático hardcodeado, igual al template** — decisión explícita del usuario; no se conecta a `seededScores` ni a `localStorage["av_scores"]`, consistente con que toda la spec 01/02 es visual/mock.
- **Sub-componentes de Home (`FloatingSilhouettes`, `MiniCard`, `FeatureIcon`) locales al archivo de la página, no en `app/components/`** — no se reutilizan en ninguna otra pantalla, evita abstracción prematura.
- **Todas las 7 secciones del template entran en el alcance** — decisión explícita del usuario tras aclarar una respuesta contradictoria; no se recorta Pricing/FAQ ni Actividad en vivo.
- **`useReveal` (IntersectionObserver) portado tal cual** — decisión explícita del usuario, mantiene el efecto visual de aparición progresiva de secciones.

## Riesgos identificados

- El diff de estilos entre `globals.css` y `home-about/styles.css` puede tener nombres de clase que colisionen con los ya usados por biblioteca/detalle/reproductor (por ejemplo variantes de `.btn`, `.pixel`, colores `neon-*`); conviene portar sección por sección y verificar visualmente cada pantalla existente después del cambio, no solo Home.
- Mover Biblioteca de `/` a `/biblioteca` cambia una URL que ya pudo haber sido referenciada (por ejemplo desde `Nav` o enlaces internos ya escritos en SPEC 01); requiere revisar que ningún otro archivo (`GameCard`, páginas de detalle/reproductor/auth/salón) tenga un `Link href="/"` que hoy asuma que ahí vive la Biblioteca y deba seguir apuntando al nuevo Home en vez de a `/biblioteca`.
