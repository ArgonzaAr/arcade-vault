# 14 — Checklist de seguridad básico

**Estado:** Aprobado
**Depende de:** SPEC 04, SPEC 12, SPEC 13
**Fecha:** 2026-10-01

**Objetivo:** Cumplir el checklist de `references/security/security-checklist.md` con headers HTTP de seguridad, CAPTCHA Turnstile en `/auth`, el aviso de `rls_auto_enable()` resuelto y la configuración de Auth verificada.

## Por qué existe esta spec

`references/security/security-checklist.md` lista cinco puntos básicos más dos avisos del Security Advisor de Supabase. Estado comprobado el 2026-10-01 (BD y `get_advisors`):

| Punto del checklist                    | Estado actual                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| RLS en `games` y `scores`              | Ya cumplido. `games`, `scores` y `profiles` tienen RLS activo.                                                     |
| Contraseña mínima de 8                 | En cliente sí (`PASSWORD_MIN = 8`). El panel se configuró en la SPEC 12, pero no está verificado.                  |
| Leaked password protection             | Aviso `auth_leaked_password_protection` activo. Solo existe en el plan Pro y el proyecto está en Free.             |
| Limitar signups por IP (anti-bot)      | Solo los rate limits por defecto de Supabase. No hay CAPTCHA.                                                      |
| Headers de seguridad en Next.js        | `next.config.ts` no define `headers`.                                                                              |
| `rls_auto_enable()` ejecutable por API | Avisos `anon_security_definer_function_executable` y `authenticated_security_definer_function_executable` activos. |

`public.rls_auto_enable()` es la función del event trigger `ensure_rls`, que activa RLS en toda tabla nueva de `public`. No está en ninguna migración del repo. Es útil y se conserva: solo sobra que `anon` y `authenticated` puedan llamarla por `/rest/v1/rpc/rls_auto_enable`.

## Alcance

**Incluye:**

_Next.js_

- `headers()` en `next.config.ts` con cinco headers para todas las rutas.

_Base de datos_

- Migración `supabase/migrations/20261001000000_revoke_rls_auto_enable.sql` que revoca `EXECUTE` sobre `public.rls_auto_enable()` a `public`, `anon` y `authenticated`.
- Verificación de RLS activo en `games`, `scores` y `profiles`.

_Anti-bot_

- Cloudflare Turnstile (modo «Managed») en los formularios CREAR CUENTA, INICIAR SESIÓN y ¿OLVIDASTE TU CONTRASEÑA? de `/auth`, con el paquete `@marsidev/react-turnstile`.
- `captchaToken` enviado en `signUp`, `signInWithPassword` y `resetPasswordForEmail`.
- Variable de entorno pública `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- Mensajes de error nuevos para el CAPTCHA.
- Pasos manuales para crear el widget en Cloudflare y activar CAPTCHA en Supabase.

_Configuración de Auth (manual)_

- Verificar que «Minimum password length» es 8 en el panel.
- Revisar Authentication → Rate Limits y anotar sus valores en esta spec. Sin cambios si las ventanas de confirmación de signup y de recuperación están en 60 s.

_Documentación_

- `references/security/security-checklist.md` marcado con el resultado de cada punto.
- Línea de seguridad en `CLAUDE.md`.

- Proyetcción de rutas con Proxy Next.js, Información sobre proxy aqui:
  https://nextjs.org/docs/app/getting-started/proxy

  Ejemplo: proxy.ts
  ```ts
    import { NextResponse } from 'next/server'
    import type { NextRequest } from 'next/server'
    
    // This function can be marked `async` if using `await` inside
    export function proxy(request: NextRequest) {
      return NextResponse.redirect(new URL('/home', request.url))
    }
    
    // Alternatively, you can use a default export:
    // export default function proxy(request: NextRequest) { ... }
    
    export const config = {
      matcher: '/about/:path*',
    }

  ```

**Fuera de alcance (para futuras specs):**

- Activar leaked password protection: requiere plan Pro. Queda como riesgo aceptado.
- Content-Security-Policy. Exige nonces o `'unsafe-inline'` para Next.js y listar Supabase, Cloudflare y Google Fonts. Riesgo alto de romper la app.
- CAPTCHA o rate limit en el guardado de puntuaciones de invitados (`scores_insert_anon`).
- SMTP propio (único modo de cambiar el límite de emails por hora).
- MFA para los usuarios.
- `supabase/config.toml` para el entorno local de la CLI.
- Cambiar los valores de rate limits del panel.
- Tests automatizados (no hay framework en el repo).

## Modelo de datos

### Headers (`next.config.ts`)

```ts
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];
// headers: async () => [{ source: "/(.*)", headers: securityHeaders }]
```

- `allowedDevOrigins` se conserva.
- HSTS sin `preload`. El navegador lo ignora en `http://localhost`.
- `Permissions-Policy` no bloquea `fullscreen` ni `gamepad`.

### Migración

```sql
-- supabase/migrations/20261001000000_revoke_rls_auto_enable.sql
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
```

- La función y el event trigger `ensure_rls` no cambian. Postgres no comprueba `EXECUTE` al disparar un event trigger, así que RLS se sigue activando solo en tablas nuevas.

### Turnstile en `/auth`

```ts
// app/auth/page.tsx (estado nuevo)
const [captchaToken, setCaptchaToken] = useState<string | null>(null);
const turnstileRef = useRef<TurnstileInstance>(null);
// <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
//   options={{ theme: "dark" }}
//   onSuccess={setCaptchaToken}
//   onExpire={() => setCaptchaToken(null)}
//   onError={() => fail("captcha_unavailable")} />
```

- Un único widget dentro de `auth-card`, justo encima del botón de enviar. Aparece en los modos `in`, `up` y `recover`.
- El botón de enviar queda deshabilitado mientras `captchaToken` sea `null`.
- Las llamadas pasan `options: { captchaToken }` (en `resetPasswordForEmail`, `captchaToken` va junto a `redirectTo`).
- El token es de un solo uso. Tras cada envío, con éxito o con error, se llama a `turnstileRef.current?.reset()` y `captchaToken` vuelve a `null`.
- Cambiar de modo (`switchMode`) también resetea el widget.
- Los botones GOOGLE y GITHUB y `/auth/reset` no usan CAPTCHA.

### Variables de entorno

| Variable                         | Dónde                         | Valor                         |
| -------------------------------- | ----------------------------- | ----------------------------- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `.env.local` (no se commitea) | Site key del widget Turnstile |

La secret key de Turnstile vive solo en el panel de Supabase (Authentication → Attack Protection).

### Mensajes nuevos (`app/lib/auth/errors.ts`)

| Caso                                              | Mensaje                                               |
| ------------------------------------------------- | ----------------------------------------------------- |
| Supabase rechaza el token (`captcha_failed`)      | VERIFICACIÓN ANTI-BOT FALLIDA · INTÉNTALO DE NUEVO    |
| El widget no carga (`onError`, p. ej. bloqueador) | NO SE PUDO CARGAR LA VERIFICACIÓN · RECARGA LA PÁGINA |

### Rate limits (se rellena en el paso 6)

| Ajuste del panel                       | Valor observado |
| -------------------------------------- | --------------- |
| Sign-ups and sign-ins (por IP, 5 min)  | —               |
| Token verifications (por IP, 5 min)    | —               |
| Token refreshes (por IP, 5 min)        | —               |
| Signup confirmation (ventana)          | —               |
| Password reset (ventana)               | —               |
| Emails por hora (SMTP integrado, fijo) | —               |

Esta tabla es la única parte de la spec que se edita durante la implementación.

## Plan de implementación

1. **Headers.** Agregar `headers()` con `securityHeaders` a `next.config.ts`, conservando `allowedDevOrigins`. Verificar con `curl -I http://localhost:3000/` y `curl -I http://localhost:3000/auth` en `npm run dev`.
2. **Revocar `rls_auto_enable()`.** Crear `20261001000000_revoke_rls_auto_enable.sql` y aplicarla con `mcp__supabase__apply_migration`. Comprobar con `execute_sql` que crear una tabla de prueba en `public` la deja con `relrowsecurity = true`, y borrarla. Verificar con `get_advisors` (security) que los dos avisos de `rls_auto_enable` desaparecen.
3. **Turnstile en el cliente.** Instalar `@marsidev/react-turnstile`. Agregar el widget, `captchaToken`, el reset tras cada envío y los dos mensajes nuevos a `app/auth/page.tsx` y `app/lib/auth/errors.ts`. Con CAPTCHA aún desactivado en Supabase, el token se ignora y la app sigue funcionando.
4. **Widget de Cloudflare (manual, lo hace el usuario).** Cloudflare → Turnstile: crear un widget «Managed» con hostnames `localhost` y `10.51.146.3`. Copiar la site key a `NEXT_PUBLIC_TURNSTILE_SITE_KEY` en `.env.local` y reiniciar `npm run dev`. El plan se detiene aquí hasta que el usuario lo confirme.
5. **CAPTCHA en Supabase (manual, lo hace el usuario).** Authentication → Attack Protection: activar «Enable Captcha protection», proveedor Turnstile, con la secret key. Va después del paso 3: antes, el panel rechazaría todos los logins. El plan se detiene aquí hasta que el usuario lo confirme.
6. **Auth del panel (manual, lo hace el usuario).** Confirmar «Minimum password length» = 8 en Authentication → Providers → Email. Leer Authentication → Rate Limits y rellenar la tabla «Rate limits» de esta spec. El plan se detiene aquí hasta que el usuario lo confirme.
7.**Protección de rutas con Proxy Next.js.**
8. **Documentación.** Marcar en `references/security/security-checklist.md` cada punto como cumplido, o como «no aplica: plan Free» en leaked password protection, con referencia a esta spec. Agregar a `CLAUDE.md` una línea de seguridad: headers en `next.config.ts`, Turnstile en `/auth` con `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `rls_auto_enable()` sin `EXECUTE` público.

## Criterios de aceptación

_General_

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` no reporta errores en ningún archivo creado o modificado por esta spec.
- [ ] Ningún archivo bajo `references/templates/` fue modificado.
- [ ] `.env.local` no está en git y `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no aparece en ningún archivo commiteado.

_Headers_

- [ ] `curl -I http://localhost:3000/` devuelve los cinco headers con los valores exactos del modelo de datos.
- [ ] `/auth`, `/biblioteca` y `/game/asteroides/play` también devuelven los cinco headers.
- [ ] Los cinco juegos con motor real cargan y se juegan sin errores nuevos en la consola.
- [ ] El acceso desde `10.51.146.3` en `npm run dev` sigue funcionando.

_Base de datos_

- [ ] `games`, `scores` y `profiles` tienen `relrowsecurity = true`.
- [ ] `has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')` y el mismo con `authenticated` devuelven `false`.
- [ ] Una tabla nueva creada en `public` tras la migración queda con RLS activo.
- [ ] `get_advisors` (security) solo reporta `auth_leaked_password_protection`.

_Turnstile_

- [ ] En `/auth`, los modos INICIAR SESIÓN, CREAR CUENTA y ¿OLVIDASTE TU CONTRASEÑA? muestran el widget encima del botón de enviar.
- [ ] El botón de enviar está deshabilitado hasta que el widget entrega un token.
- [ ] Con CAPTCHA activo en Supabase, iniciar sesión con credenciales correctas lleva a `/biblioteca`.
- [ ] Con CAPTCHA activo, registrarse con datos válidos muestra «Revisa tu correo».
- [ ] Con CAPTCHA activo, la recuperación muestra el aviso de correo enviado.
- [ ] Una contraseña incorrecta muestra «CORREO O CONTRASEÑA INCORRECTOS». Reintentar con la correcta funciona sin recargar la página.
- [ ] Una llamada a `signInWithPassword` sin `captchaToken` (desde la consola del navegador con `supabase-js`) es rechazada.
- [ ] Bloquear `challenges.cloudflare.com` en DevTools muestra «NO SE PUDO CARGAR LA VERIFICACIÓN · RECARGA LA PÁGINA» y el botón sigue deshabilitado.
- [ ] GOOGLE y GITHUB siguen funcionando sin CAPTCHA.
- [ ] `/auth/reset` guarda una contraseña nueva sin CAPTCHA.

_Configuración de Auth_

- [ ] Registrarse con una contraseña de 7 caracteres llamando a `signUp` directamente (sin la validación del cliente) es rechazado con `weak_password`.
- [ ] La tabla «Rate limits» de esta spec tiene todos sus valores rellenados.

_Documentación_

- [ ] `references/security/security-checklist.md` tiene los cinco puntos marcados con su resultado y referencia a la SPEC 14.
- [ ] `CLAUDE.md` tiene la línea de seguridad del paso 7.

## Decisiones tomadas y descartadas

- **Sí:** RLS solo se verifica. Ya está activo en `games`, `scores` y `profiles` desde las SPEC 04 y 12.
- **Sí:** revocar `EXECUTE` sobre `rls_auto_enable()` y conservar la función. Mantiene la activación automática de RLS y elimina los dos avisos.
- **No:** borrar `rls_auto_enable()` o el event trigger `ensure_rls`. Perdería una red de seguridad útil.
- **No:** pasarla a `security invoker`. Un event trigger necesita privilegios para alterar tablas ajenas.
- **Sí:** leaked password protection queda fuera. Decisión del usuario: el proyecto está en el plan Free y la función es solo de Pro. El aviso se acepta y se documenta.
- **Sí:** Turnstile + revisión de rate limits para el anti-bot. Decisión del usuario. Supabase no tiene un límite configurable de «signups por IP» aparte del de sign-ups/sign-ins por defecto, y el CAPTCHA es la defensa real contra bots.
- **No:** solo rate limits del panel. No frena bots que rotan IPs.
- **No:** hCaptcha. Turnstile es gratuito, menos intrusivo y Supabase lo soporta igual.
- **Sí:** `@marsidev/react-turnstile`. Decisión del usuario. Resuelve reset, expiración y desmontaje.
- **No:** script propio con `next/script`. Más código que mantener.
- **Sí:** modo «Managed» sobre el botón de enviar. Decisión del usuario. Es una desviación visible de la plantilla, aceptada.
- **No:** modo invisible. Si Cloudflare duda, el usuario no puede resolver el desafío.
- **Sí:** CAPTCHA en los tres formularios. Decisión del usuario. Supabase lo exige a la vez en signup, login con contraseña y recuperación.
- **Sí:** rate limits revisados y documentados, sin cambiar valores. Decisión del usuario.
- **Sí:** cinco headers (los tres del checklist + HSTS + Permissions-Policy). Decisión del usuario.
- **No:** CSP en esta spec. Riesgo alto de romper Next.js, Supabase o Turnstile. Iría en su propia spec.
- **Sí:** la configuración del panel queda como pasos manuales del plan, igual que en las SPEC 12 y 13. Decisión del usuario.
- **No:** `supabase/config.toml`. Solo afecta al entorno local de la CLI, que el proyecto no usa.
- **Sí:** el código de Turnstile (paso 3) va antes de activar CAPTCHA en Supabase (paso 5). Así ningún paso deja el login roto.
- **Sí:** los textos de los dos mensajes de error nuevos los propone esta spec.

## Riesgos identificados

| Riesgo                                                                                         | Mitigación                                                                                                      |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Activar CAPTCHA en Supabase antes de desplegar el cliente rompe login, registro y recuperación | El paso 5 va después del paso 3. Si pasa, desactivar CAPTCHA en el panel lo revierte al instante.               |
| Un bloqueador de anuncios impide cargar Turnstile y el usuario no puede entrar                 | Mensaje «NO SE PUDO CARGAR LA VERIFICACIÓN · RECARGA LA PÁGINA». OAuth sigue disponible como alternativa.       |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` falta en `.env.local`                                         | El widget no entrega token y el botón queda deshabilitado. El paso 4 la crea antes de activar CAPTCHA.          |
| Hostname no registrado en el widget (p. ej. otra IP de desarrollo)                             | El widget falla con el mensaje de carga. Añadir el hostname en Cloudflare.                                      |
| HSTS en un futuro dominio HTTPS obliga a HTTPS durante 2 años, también en subdominios          | Es lo deseado en producción. Sin `preload`, retirarlo deja de aplicar cuando caduca.                            |
| `X-Frame-Options: DENY` impide incrustar la app en un iframe                                   | Ningún flujo actual usa iframes. Si alguno lo necesita, se cambia a `SAMEORIGIN` en otra spec.                  |
| Revocar `EXECUTE` rompe la activación automática de RLS                                        | Postgres no comprueba `EXECUTE` al disparar event triggers. El paso 2 lo comprueba creando una tabla de prueba. |
| Contraseñas filtradas siguen aceptándose (plan Free)                                           | Riesgo aceptado por el usuario. Mínimo de 8 caracteres y CAPTCHA reducen el impacto del credential stuffing.    |
| Esta spec toca `app/auth/page.tsx`, que la SPEC 13 aún no tiene commiteado                     | Cerrar la SPEC 13 (criterios, estado Implementado y commit) antes de implementar esta.                          |

## Qué **no** está en esta spec

- Leaked password protection (requiere plan Pro).
- Content-Security-Policy.
- CAPTCHA o límites en el guardado de puntuaciones de invitados.
- SMTP propio o cambio de valores de rate limits.
- MFA.
- `supabase/config.toml`.

Cada una de esas, si llega, va en su propia spec.
