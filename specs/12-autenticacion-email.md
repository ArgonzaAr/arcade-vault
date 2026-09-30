# 12 — Registro, login y autenticación con email

**Estado:** Implementado
**Depende de:** SPEC 01, SPEC 04, SPEC 06
**Fecha:** 2026-09-28

**Objetivo:** Reemplazar el login falso de `/auth` (`localStorage["av_user"]`) por autenticación real de Supabase con email y contraseña, con username único en `profiles`, confirmación de correo y recuperación de contraseña.

## Por qué existe esta spec

Hoy `/auth` sigue visualmente la plantilla `references/templates/auth.jsx`, pero no autentica nada:

- `app/auth/page.tsx` guarda `{ name }` en `localStorage["av_user"]` con lo que se escriba en «Usuario» y no valida la contraseña.
- `av_user` se lee en tres sitios: `app/components/Nav.tsx` (mostrar usuario y SALIR), `app/game/[id]/play/page.tsx` (nombre precargado y editable al guardar puntuación) y `app/hall-of-fame/page.tsx` («tu posición»).
- No hay `proxy.ts`, así que la sesión de Supabase no se refrescaría aunque existiera (la spec 04 lo dejó explícitamente fuera).

El login con Google/GitHub de la plantilla se separa en la SPEC 13. Esta spec deja lista la base (`profiles`, trigger, `/auth/callback`, `AuthProvider`) para que la 13 solo agregue los proveedores.

## Alcance

**Incluye:**

- Migración `supabase/migrations/20260928000000_profiles.sql`: tabla `public.profiles`, RLS y trigger `on_auth_user_created` que crea el profile al registrarse.
- Registro (pestaña CREAR CUENTA) con Usuario, Correo electrónico y Contraseña vía `supabase.auth.signUp`, con el username en `options.data.username`.
- Confirmación de correo obligatoria: tras registrarse se muestra «Revisa tu correo» y el enlace vuelve a `/auth/callback`.
- Login (pestaña INICIAR SESIÓN) con Correo electrónico y Contraseña vía `supabase.auth.signInWithPassword`.
- Recuperación de contraseña: modo «recuperar» dentro de la misma tarjeta de `/auth`, envío con `resetPasswordForEmail` y nueva pantalla `/auth/reset` para escribir la contraseña nueva.
- Route handler `app/auth/callback/route.ts` que canjea el `code` por sesión (`exchangeCodeForSession`) y redirige a `next`.
- `proxy.ts` en la raíz que refresca la sesión en cada request. No protege ninguna ruta.
- `AuthProvider` + hook `useAuth()` en `app/lib/auth/AuthProvider.tsx`, montado en `app/layout.tsx`.
- Migrar `Nav.tsx`, `game/[id]/play/page.tsx` y `hall-of-fame/page.tsx` a `useAuth()`, y eliminar `localStorage["av_user"]` del código.
- Con sesión, el nombre al guardar puntuación es el username en MAYÚSCULAS y el input queda de solo lectura. Los invitados siguen escribiendo su nombre.
- `/auth` redirige a `/biblioteca` si ya hay sesión.
- Mensajes de error en español para los casos listados en el modelo de datos.
- Los botones GOOGLE y GITHUB de la plantilla se quedan visibles pero deshabilitados, con el texto «PRÓXIMAMENTE».
- Pasos manuales en el panel de Supabase, documentados en el plan: Site URL, Redirect URLs, confirmación de email activada y longitud mínima de contraseña 8.

**Fuera de alcance (para futuras specs):**

- OAuth con Google y GitHub, y la generación automática de username para esas cuentas (SPEC 13).
- Columna `scores.user_id` y RLS de `scores` basada en `auth.uid()`. `scores` no cambia de esquema ni de policies.
- Cambiar el username, el email o borrar la cuenta.
- Página de perfil del jugador.
- Rutas protegidas. Todo sigue abierto a invitados.
- Plantillas de email personalizadas (se usan las de Supabase por defecto).
- Reenviar el email de confirmación desde la UI.
- Calcular la posición real del jugador en `/hall-of-fame` (`youRank` sigue siendo el mock actual).
- Tests automatizados (no hay framework en el repo).

## Modelo de datos

### Base de datos

```sql
-- supabase/migrations/20260928000000_profiles.sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,10}$')
);

alter table public.profiles enable row level security;

create policy "profiles_select_public" on public.profiles
  for select to anon, authenticated using (true);
-- Sin policies de insert/update/delete: solo escribe el trigger.
```

- `public.handle_new_user()`: `security definer`, `set search_path = ''`. Inserta `(new.id, lower(new.raw_user_meta_data->>'username'))` en `public.profiles`.
- Si el username falta, no cumple el formato o ya existe, el insert falla y Supabase rechaza el `signUp` completo. No queda ningún usuario sin profile.
- Trigger `on_auth_user_created`: `after insert on auth.users for each row`.
- La SPEC 13 reemplaza esta función para generar el username cuando no viene en metadata (OAuth).

### Reglas de validación (cliente)

```ts
// app/lib/auth/validation.ts
export const USERNAME_RE = /^[a-z0-9_]{3,10}$/; // se valida tras lower()
export const PASSWORD_MIN = 8;
```

- El username se escribe libre y se normaliza a minúsculas antes de validar y enviar.
- Antes de `signUp` se comprueba si está libre con `select id from profiles where username = $1`.
- Se muestra siempre en MAYÚSCULAS (Nav, HUD, `player_name`).

### Estado de sesión (cliente)

```ts
// app/lib/auth/AuthProvider.tsx
export interface Profile {
  id: string;
  username: string; // minúsculas, tal cual en la BD
}

interface AuthState {
  user: User | null; // de @supabase/supabase-js
  profile: Profile | null;
  loading: boolean; // true hasta resolver la sesión inicial
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState;
```

- `AuthProvider` (`"use client"`) llama a `getUser()` al montar y se suscribe a `onAuthStateChange`.
- Cuando hay `user` carga su fila de `profiles`. Cuando no hay, `profile = null`.
- `signOut()` llama a `supabase.auth.signOut()`. El estado se limpia vía `onAuthStateChange`.

### Estado de la pantalla `/auth`

```ts
type AuthMode = "in" | "up" | "recover";
type AuthStatus = "idle" | "submitting" | "error" | "check-email";
```

- `"in"` y `"up"` son las pestañas de la plantilla.
- `"recover"` se abre con el enlace «¿OLVIDASTE TU CONTRASEÑA?» bajo el formulario de login. Muestra solo el email, el botón ENVIAR ENLACE y el enlace VOLVER.
- `"check-email"` reemplaza el formulario por un aviso tras registrarse o pedir el reset.

### Mensajes de error

`app/lib/auth/errors.ts` exporta `authErrorMessage(error): string`, que traduce por `error.code`:

| Caso                                                | Mensaje                                        |
| --------------------------------------------------- | ---------------------------------------------- |
| `invalid_credentials`                               | CORREO O CONTRASEÑA INCORRECTOS                |
| `email_not_confirmed`                               | CONFIRMA TU CORREO ANTES DE ENTRAR             |
| `weak_password`                                     | LA CONTRASEÑA DEBE TENER AL MENOS 8 CARACTERES |
| `over_email_send_rate_limit`                        | DEMASIADOS INTENTOS. ESPERA UNOS MINUTOS       |
| `signUp` sin error pero con `user.identities` vacío | ESE CORREO YA TIENE CUENTA                     |
| Username ocupado (pre-chequeo o fallo del trigger)  | ESE USUARIO YA EXISTE                          |
| Username con formato inválido                       | USUARIO: 3–10 CARACTERES, LETRAS, NÚMEROS O \_ |
| `/auth?error=callback`                              | EL ENLACE ES INVÁLIDO O CADUCÓ                 |
| Cualquier otro                                      | ALGO FALLÓ. INTÉNTALO DE NUEVO                 |

El envío de recuperación muestra siempre el mismo aviso («Si el correo existe, te enviamos un enlace»), exista o no la cuenta.

### Rutas y redirecciones

| Ruta                           | Comportamiento                                                                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/auth`                        | Formulario. Con sesión → `router.replace("/biblioteca")`.                                                                                                 |
| `/auth/callback?code=…&next=…` | `exchangeCodeForSession(code)` → redirige a `next`. Sin `code` o con error → `/auth?error=callback`.                                                      |
| `/auth/reset`                  | Con sesión: Contraseña nueva + Repetir contraseña → `updateUser({ password })` → `/biblioteca`. Sin sesión: aviso de enlace inválido con botón a `/auth`. |

- `next` solo se acepta si empieza por `/` y no por `//`. Si no, se usa `/biblioteca`.
- `emailRedirectTo` del registro: `${location.origin}/auth/callback?next=/biblioteca`.
- `redirectTo` del reset: `${location.origin}/auth/callback?next=/auth/reset`.
- Tras login con contraseña se redirige a `/biblioteca`, como en la plantilla.
- JUGAR COMO INVITADO solo navega a `/biblioteca` y no toca la sesión.

No hay variables de entorno nuevas: se reutilizan `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Plan de implementación

1. **Migración `profiles`.** Crear `supabase/migrations/20260928000000_profiles.sql` con la tabla, la RLS, `handle_new_user()` y el trigger. Aplicarla con `mcp__supabase__apply_migration`. Verificar con `mcp__supabase__list_tables` y `mcp__supabase__get_advisors` (sin avisos de seguridad nuevos). La app no cambia de comportamiento.
2. **Configuración del panel de Supabase (manual, la hace el usuario).** En Authentication: Site URL `http://localhost:3000`; Redirect URLs `http://localhost:3000/auth/callback`; Confirm email activado; Password min length 8. El plan se detiene aquí hasta que el usuario lo confirme.
3. **`proxy.ts`.** Crear `proxy.ts` en la raíz (convención de Next 16; `middleware.ts` está deprecado). Crea un `createServerClient` con las cookies de `request`/`response`, llama a `supabase.auth.getUser()` y devuelve la respuesta. El `matcher` excluye `_next/static`, `_next/image`, `favicon.ico` y archivos de imagen. No redirige nada.
4. **`app/auth/callback/route.ts`.** Crear el `GET` que lee `code` y `next`, canjea con el cliente de `app/lib/supabase/server.ts` y redirige según la tabla de rutas.
5. **`app/lib/auth/validation.ts` y `app/lib/auth/errors.ts`.** Crear las constantes de validación y `authErrorMessage` con la tabla de mensajes.
6. **`AuthProvider` + `useAuth`.** Crear `app/lib/auth/AuthProvider.tsx` y envolver `<Nav />` y `<main>` en `app/layout.tsx`. Por ahora nadie lo consume.
7. **`/auth` real.** Reescribir la lógica de `app/auth/page.tsx` sin cambiar la estructura de la plantilla: login con Correo electrónico + Contraseña; registro con Usuario + Correo electrónico + Contraseña (pre-chequeo de username y `signUp`); estados `submitting` (botón deshabilitado con «CONECTANDO…»), `error` (mensaje bajo el formulario) y `check-email`; redirección si ya hay sesión; lectura de `?error=callback`; GOOGLE/GITHUB deshabilitados con «PRÓXIMAMENTE». Quitar todo uso de `av_user`.
8. **Recuperación de contraseña.** Agregar el modo `recover` en `app/auth/page.tsx` y crear `app/auth/reset/page.tsx` con la misma tarjeta `auth-card`. Valida longitud mínima y que ambas contraseñas coincidan.
9. **Migrar consumidores de sesión.** En `Nav.tsx`: `useAuth()` para mostrar `profile.username` en mayúsculas y que SALIR llame a `signOut()` y navegue a `/`. En `game/[id]/play/page.tsx`: con `profile`, `name = profile.username.toUpperCase()` y el input en `readOnly`; sin sesión se mantiene el comportamiento actual (`INVITADO` editable). En `hall-of-fame/page.tsx`: `user` pasa a venir de `useAuth()`. Confirmar con `grep` que `av_user` ya no aparece en `app/`.
10. **Documentación.** Agregar a `CLAUDE.md` una línea en «Proyecto» sobre la auth (`useAuth()` de `app/lib/auth/AuthProvider.tsx` como única fuente de sesión en cliente y `proxy.ts` para el refresco).

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] Tras aplicar la migración, `public.profiles` existe con RLS activada y una sola policy (`select` para `anon` y `authenticated`).
- [ ] `get_advisors` (security) no reporta avisos nuevos relacionados con `profiles` ni con `handle_new_user`.
- [ ] Registrarse con usuario `px_kai`, un email válido y una contraseña de 8 caracteres muestra el aviso «Revisa tu correo» y crea una fila en `profiles` con `username = 'px_kai'`.
- [ ] Antes de confirmar el correo, iniciar sesión con esas credenciales muestra «CONFIRMA TU CORREO ANTES DE ENTRAR».
- [ ] Abrir el enlace de confirmación termina en `/biblioteca` con sesión iniciada, y el Nav muestra `PX_KAI`.
- [ ] Registrarse con un username ya existente (en cualquier combinación de mayúsculas) muestra «ESE USUARIO YA EXISTE» y no crea usuario en `auth.users`.
- [ ] Registrarse con un username de 2 caracteres, con guion o con 11 caracteres muestra el mensaje de formato y no llama a `signUp`.
- [ ] Registrarse con una contraseña de 7 caracteres muestra el mensaje de longitud y no llama a `signUp`.
- [ ] Iniciar sesión con una contraseña incorrecta muestra «CORREO O CONTRASEÑA INCORRECTOS».
- [ ] Iniciar sesión con credenciales válidas redirige a `/biblioteca`.
- [ ] Recargar la página con sesión iniciada mantiene la sesión y el Nav sigue mostrando el username.
- [ ] SALIR cierra la sesión: el Nav vuelve al estado de invitado y al recargar sigue sin sesión.
- [ ] Visitar `/auth` con sesión iniciada redirige a `/biblioteca`.
- [ ] «¿OLVIDASTE TU CONTRASEÑA?» → email → ENVIAR ENLACE muestra el mismo aviso con un email registrado y con uno no registrado.
- [ ] El enlace de recuperación abre `/auth/reset`. Guardar una contraseña nueva redirige a `/biblioteca`, y después se puede entrar con la nueva y no con la anterior.
- [ ] En `/auth/reset`, dos contraseñas distintas muestran un error y no llaman a `updateUser`.
- [ ] Abrir `/auth/reset` sin sesión muestra el aviso de enlace inválido.
- [ ] `/auth/callback` sin `code`, o con un `code` inválido, redirige a `/auth?error=callback` y se muestra «EL ENLACE ES INVÁLIDO O CADUCÓ».
- [ ] `/auth/callback?code=…&next=//evil.com` no redirige fuera del sitio.
- [ ] Con sesión, al terminar una partida de un juego con `hasRealLeaderboard` el input de nombre muestra el username en MAYÚSCULAS, no se puede editar y la fila de `scores` guarda ese `player_name`.
- [ ] Sin sesión, el input de nombre se comporta como hoy (`INVITADO`, editable, máx. 10 caracteres).
- [ ] JUGAR COMO INVITADO navega a `/biblioteca` sin iniciar sesión.
- [ ] Los botones GOOGLE y GITHUB aparecen deshabilitados con «PRÓXIMAMENTE» y no hacen nada al pulsarlos.
- [ ] `grep -r "av_user" app/` no devuelve resultados.
- [ ] Ninguna ruta existente exige sesión: `/`, `/biblioteca`, `/game/[id]`, `/game/[id]/play`, `/hall-of-fame` y `/about` cargan igual sin sesión.
- [ ] El esquema y las policies de `scores` no cambiaron.
- [ ] Ningún archivo bajo `references/templates/` fue modificado.

## Decisiones tomadas y descartadas

- **Sí:** dividir la auth en dos specs: esta (email) y la SPEC 13 (Google/GitHub). Decisión del usuario. Esta se puede cerrar sin configurar apps OAuth externas, y la 13 reutiliza callback, trigger y `AuthProvider`.
- **Sí:** tabla `public.profiles` con username único, creada por trigger `security definer`. Decisión del usuario. Garantiza unicidad en la BD y deja los usernames consultables por RLS.
- **No:** guardar el username solo en `user_metadata`. No se puede exigir unicidad ni hacer joins.
- **Sí:** el login usa email + contraseña. Decisión del usuario. El campo «Usuario» de la pestaña INICIAR SESIÓN pasa a «Correo electrónico», única desviación de contenido respecto a la plantilla.
- **No:** login por username. Requiere una RPC `security definer` que resuelva el email y permite enumerar cuentas.
- **Sí:** el username se valida en el trigger además del pre-chequeo en el cliente. El pre-chequeo da un mensaje claro; el trigger cubre la carrera entre dos registros simultáneos.
- **Sí:** username de 3–10 caracteres `[a-z0-9_]`, guardado en minúsculas y mostrado en MAYÚSCULAS. Decisión del usuario. El límite de 10 coincide con el `slice(0, 10)` actual de `player_name`.
- **Sí:** confirmación de email obligatoria. Decisión del usuario. Evita cuentas con emails ajenos. Por eso el botón CREAR Y JUGAR no deja jugando de inmediato, sino que muestra el aviso.
- **Sí:** contraseña mínima de 8 caracteres, validada en cliente y configurada igual en el panel. Decisión del usuario.
- **Sí:** recuperación de contraseña en esta spec. Decisión del usuario. Reutiliza `/auth/callback` con `next=/auth/reset`.
- **Sí:** la solicitud de recuperación es un tercer modo dentro de la tarjeta de `/auth`, no una ruta nueva. Mantiene la estructura de la plantilla y evita una pantalla sin referencia visual. Solo `/auth/reset` es nueva, porque es el destino del enlace del email.
- **Sí:** mensaje de recuperación idéntico exista o no la cuenta. No revela qué emails están registrados.
- **Sí:** `AuthProvider` + `useAuth()` como única fuente de sesión en cliente. Decisión del usuario. Evita consultas duplicadas y que el Nav se desincronice.
- **No:** que cada página llame a `getUser()` por su cuenta.
- **Sí:** eliminar `localStorage["av_user"]` por completo. Dos fuentes de «usuario» se contradirían.
- **Sí:** `proxy.ts` que solo refresca la sesión, sin rutas protegidas. Decisión del usuario. El modo invitado de la plantilla sigue funcionando en todas las pantallas.
- **No:** `middleware.ts`. Está deprecado en Next 16 y renombrado a `proxy`.
- **Sí:** con sesión, `player_name = username` y el input queda de solo lectura, sin tocar el esquema de `scores`. Decisión del usuario. Vincular `user_id` y endurecer la RLS de `scores` va en una spec propia.
- **Sí:** redirigir a `/biblioteca` tras login y confirmación, como en la plantilla. El código actual redirige a `/`, y eso se corrige.
- **Sí:** GOOGLE/GITHUB visibles pero deshabilitados con «PRÓXIMAMENTE». Se respeta la plantilla sin simular una función que no existe.
- **Sí:** `redirectTo` construido con `location.origin` en vez de una variable de entorno nueva. Funciona igual en local y en cualquier dominio, siempre que esté en las Redirect URLs del panel.

## Riesgos identificados

| Riesgo                                                                                                               | Mitigación                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Con la confirmación activada, `signUp` con un email ya registrado no devuelve error (Supabase evita la enumeración)  | Se detecta por `user.identities` vacío y se muestra «ESE CORREO YA TIENE CUENTA».                                          |
| El SMTP por defecto de Supabase limita los emails por hora y puede bloquear pruebas repetidas                        | Se muestra el mensaje de `over_email_send_rate_limit`. Configurar un SMTP propio queda fuera de esta spec.                 |
| Redirect URLs mal configuradas en el panel: los enlaces del email caen en el Site URL sin `code`                     | El paso 2 del plan es bloqueante. `/auth/callback` sin `code` lleva a `/auth?error=callback` en vez de fallar en silencio. |
| Un fallo del trigger devuelve un error genérico de Supabase («Database error saving new user»)                       | El pre-chequeo de username cubre el caso normal. Si aun así ocurre, se muestra «ESE USUARIO YA EXISTE».                    |
| `AuthProvider` resuelve la sesión en el cliente y el Nav puede mostrar el estado de invitado un instante             | Mientras `loading` sea `true` el Nav no muestra el bloque de usuario ni el de ENTRAR.                                      |
| Open redirect vía `next` en `/auth/callback`                                                                         | Solo se aceptan rutas relativas que empiezan por `/` y no por `//`. Hay un criterio de aceptación específico.              |
| `scores` sigue aceptando inserts de `anon` con cualquier `player_name`, así que alguien podría suplantar un username | Riesgo heredado de la SPEC 06 y aceptado. Se resuelve en la spec que agregue `scores.user_id`.                             |

## Qué **no** está en esta spec

- Login con Google o GitHub (SPEC 13).
- `scores.user_id` ni cambios en las policies de `scores`.
- Cambiar el username o el email, borrar la cuenta o una página de perfil.
- Rutas que exijan sesión.
- Plantillas de email propias, SMTP propio o reenviar la confirmación.
- Posición real del jugador en el Salón de la Fama.

Cada una de esas, si llega, va en su propia spec.
