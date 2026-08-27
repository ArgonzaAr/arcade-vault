# 03 — Pantalla About + Formulario de Contacto

**Estado:** Aprobado
**Depende de:** SPEC 01, SPEC 02
**Fecha:** 2026-08-27

**Objetivo:** Implementar en `app/` la pantalla About (`/about`) definida en `references/templates/home-about/about.jsx`, con su formulario de contacto enviando correos reales vía Resend a través de un API route.

## Alcance

**Incluye:**

- Página **About** (`/about`): sección hero (kicker, título, misión, 3 highlights con iconos SVG) y sección de contacto (intro + tips + formulario), tal como en `about.jsx`.
- Formulario de contacto funcional: campos NOMBRE, CORREO ELECTRÓNICO, MENSAJE. Validación cliente: los 3 campos son requeridos (igual que el template — shake en el form si falta alguno).
- Envío real de correo vía **Resend**: API route `app/api/contact/route.ts` (POST) que recibe `{ name, email, msg }`, llama a `resend.emails.send(...)` y responde éxito/error.
- Añadir dependencia `resend` a `package.json`.
- Variables de entorno en `.env.local` (no versionado, ya cubierto por `.gitignore`): `RESEND_API_KEY` y `CONTACT_TO_EMAIL=argonza_roan@outlook.com`. Se crea también `.env.local.example` con las claves sin valores reales, para que el repo documente qué variables hacen falta.
- Remitente (`from`) fijo: `onboarding@resend.dev` (no requiere dominio verificado).
- Estados del formulario: `idle` (campos editables) → `loading` (botón deshabilitado mientras se espera la respuesta del API route) → `success` (pantalla terminal-success del template, con el mensaje real de confirmación) **o** `error` (mensaje de error visible en el propio form, campos conservados, el usuario puede reintentar).
- Agregar link "Acerca de" al `Nav` (desktop y panel móvil), apuntando a `/about`, con su propio estado `isActive`.
- Portar a `app/globals.css` las clases CSS nuevas que usa About y que no existen hoy (`about-hero`, `about-mission`, `highlight-row`/`.highlight`, `about-divider`/`.div-bar`/`.div-pixels`, `about-contact`/`.contact-grid`/`.contact-intro`/`.contact-title`/`.contact-tips`/`.tip`, `contact-form`/`.field`/`.shake`, `terminal-success`/`.term-bar`/`.term-body`/`.line`, etc.), comparando `references/templates/home-about/styles.css` contra `app/globals.css` actual (mismo método de diff selectivo que SPEC 02).
- Animación reveal-on-scroll (`useReveal`/`IntersectionObserver`, clases `.reveal`/`.in`) portada igual que en Home (SPEC 02), reutilizada en las secciones marcadas `reveal` de About.

**Fuera de alcance (para futuras specs):**

- Cualquier backend de almacenamiento de mensajes (DB, tabla de leads, etc.) — el mensaje solo se envía por correo, no se persiste en el proyecto.
- Rate limiting, protección anti-spam (honeypot, captcha) o validación de dominio de correo más allá de `type="email"` del input.
- Dominio propio verificado en Resend / remitente personalizado — se usa `onboarding@resend.dev` fijo.
- Confirmación por correo al usuario que llenó el formulario (solo se notifica al destino `CONTACT_TO_EMAIL`).
- Tests automatizados (no hay framework configurado en el repo, igual que SPEC 01/02).

## Modelo de datos

Esta feature no introduce estructuras en `app/lib/data.ts`. Introduce sí un contrato de API entre el form y el route handler:

```ts
// POST /api/contact — request body
type ContactRequest = {
  name: string;
  email: string;
  msg: string;
};

// POST /api/contact — response
type ContactResponse =
  | { ok: true }
  | { ok: false; error: string };
```

El estado del formulario en el componente `About` se modela como:

```ts
type FormStatus = "idle" | "loading" | "success" | "error";
```

## Plan de implementación

1. **Dependencia y entorno** — agregar `resend` a `package.json` (`npm install resend`); crear `.env.local` con `RESEND_API_KEY` (clave real del usuario) y `CONTACT_TO_EMAIL=argonza_roan@outlook.com`; crear `.env.local.example` con las mismas claves sin valores.
2. **API route** — crear `app/api/contact/route.ts`: exporta `POST`, valida que `name`/`email`/`msg` vengan no vacíos (400 si falta alguno), instancia `Resend(process.env.RESEND_API_KEY)`, llama `resend.emails.send({ from: "onboarding@resend.dev", to: process.env.CONTACT_TO_EMAIL, subject: ..., text/html con name/email/msg })`, devuelve `{ ok: true }` (200) o `{ ok: false, error }` (500) si Resend lanza error.
3. **Diff de estilos** — comparar `references/templates/home-about/styles.css` contra `app/globals.css` y portar las reglas nuevas de About (`about-*`, `highlight-*`, `contact-*`, `field`, `terminal-success`/`term-*`/`line`, `shake`), sin duplicar reglas ya existentes (`.btn`, `.pixel`, `.kicker`, colores `neon-*`, `.reveal`/`.in` ya portados en SPEC 02).
4. **`app/about/page.tsx`** — portar `about.jsx` como client component (`"use client"`): hero + highlights + divider + sección de contacto con el formulario. Sub-componente local `HighlightIcon` (SVGs) definido en el mismo archivo, igual criterio que `FeatureIcon`/`MiniCard` en Home (SPEC 02).
5. **Formulario con envío real** — reemplazar el `onSubmit` simulado del template por: validar campos (shake si falta alguno) → `setStatus("loading")` → `fetch("/api/contact", { method: "POST", body: JSON.stringify(form) })` → si `ok:true` mostrar `terminal-success` (reemplazando el `[OK]` estático del template por el resultado real) → si falla (network error o `ok:false`), `setStatus("error")` y mostrar el mensaje de error dentro del form, conservando los valores escritos.
6. **`app/components/Nav.tsx`** — agregar link "Acerca de" (apunta a `/about`) después de "Salón de la Fama", en desktop y en el panel móvil; agregar `"about"` a los tipos de `isActive` y su condición (`pathname === "/about"`).
7. **Verificación final** — `npm run build` sin errores de tipos/lint; recorrido manual: `/about` muestra hero + highlights + contacto; enviar el form con `RESEND_API_KEY` válida entrega el correo real a `argonza_roan@outlook.com` y muestra `terminal-success`; simular fallo (API key inválida o sin red) muestra el estado de error sin perder lo escrito; Nav resalta "Acerca de" en `/about`.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores.
- [ ] `/about` muestra el hero con kicker, título, misión y los 3 highlights (HEART/BROWSER/PLANT) con sus iconos.
- [ ] La sección de contacto marcada `reveal` aparece con animación de entrada al hacer scroll.
- [ ] Enviar el formulario con los 3 campos vacíos o parcialmente vacíos NO llama al API route y dispara el efecto `shake`.
- [ ] Enviar el formulario completo con `RESEND_API_KEY` válida en `.env.local` entrega un correo real a `argonza_roan@outlook.com` con nombre, correo y mensaje del form.
- [ ] Tras un envío exitoso, el form muestra la pantalla `terminal-success` con el nombre del usuario en mayúsculas.
- [ ] Si el envío falla (Resend responde error o no hay red), el form muestra un mensaje de error visible y conserva los valores escritos en los campos.
- [ ] Mientras la petición está en curso, el botón de envío queda deshabilitado (estado `loading`).
- [ ] El botón "ENVIAR OTRO MENSAJE" en la pantalla de éxito limpia el form y vuelve al estado `idle`.
- [ ] El Nav muestra "Acerca de" como link (desktop y móvil), resalta activo en `/about`, y no rompe el resaltado existente de "Inicio"/"Biblioteca"/"Salón de la Fama".
- [ ] `.env.local` no queda versionado en git (`git status` no lo muestra); `.env.local.example` sí queda versionado, sin valores reales.
- [ ] Ningún archivo bajo `references/templates/` fue modificado.

## Decisiones tomadas y descartadas

- **Sí:** API route propio (`app/api/contact/route.ts`) llamando a Resend desde el servidor. Necesario porque `RESEND_API_KEY` no puede exponerse en el cliente.
- **No:** SDK de Resend en el cliente. Expondría la API key en el bundle del navegador.
- **Sí:** remitente fijo `onboarding@resend.dev`. Decisión explícita del usuario — no hay dominio propio verificado en Resend todavía; evita bloquear la spec por eso.
- **No:** dominio propio verificado. Queda fuera de alcance hasta que el usuario configure uno en Resend.
- **Sí:** destino fijo `CONTACT_TO_EMAIL=argonza_roan@outlook.com` vía variable de entorno (no hardcodeado en el route handler). Permite cambiarlo sin tocar código.
- **Sí:** estado de error visible en el form (no éxito falso). Decisión explícita del usuario — evita que el usuario crea que su mensaje llegó cuando no fue así.
- **Sí:** link "Acerca de" agregado al Nav en esta spec. Decisión explícita del usuario — revierte la omisión deliberada de SPEC 02, ahora que la página existe.
- **No:** persistencia del mensaje en base de datos o `localStorage`. El correo es el único registro; no hay backend de datos en el proyecto (consistente con SPEC 01/02).
- **No:** protección anti-spam (captcha/honeypot). Fuera de alcance, el proyecto no lo tiene en ningún otro formulario (`auth.jsx` tampoco).
- **Sí:** `HighlightIcon` como sub-componente local a `app/about/page.tsx`, no reutilizable. Mismo criterio que `FeatureIcon`/`MiniCard` en SPEC 02 — no se usa en otra pantalla.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| `onboarding@resend.dev` solo entrega a la propia cuenta de Resend del usuario, no a cualquier destinatario | Documentado en el alcance; si `CONTACT_TO_EMAIL` no coincide con la cuenta de Resend usada, el envío puede fallar o no llegar — verificar en el paso 7 con un envío real antes de dar la spec por completa. |
| `RESEND_API_KEY` ausente o inválida en producción/despliegue | El API route debe responder `ok:false` con error claro (no un 500 sin cuerpo) para que el form muestre el estado de error en vez de colgarse. |
| Diff de estilos entre `globals.css` y `home-about/styles.css` puede colisionar con clases ya usadas (`.field`, `.line`, `.tip`, nombres genéricos) | Portar sección por sección y verificar visualmente las demás pantallas (auth, biblioteca, detalle) después del cambio, mismo riesgo ya identificado en SPEC 02. |
