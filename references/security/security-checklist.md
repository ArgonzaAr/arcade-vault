## Checklist de seguridad básico

  - [x] RLS: Row Level Security habilitado en ambas tablas: `games` y `scores`
    — **Cumplido** (SPEC 14). `games`, `scores` y `profiles` con `relrowsecurity = true`; el event trigger `ensure_rls` lo activa en toda tabla nueva de `public`.
  - [ ] Minimum password length — mínimo 8 caracteres
    — **Pendiente** (SPEC 14, paso 6). En cliente sí (`PASSWORD_MIN = 8`); falta verificar el valor del panel.
  - [ ] Leaked password protection — (el warning 4)
    — **No aplica: plan Free** (SPEC 14). Solo existe en el plan Pro; riesgo aceptado.
  - [ ] Max signup rate — limitar signups por IP (anti-bot)
    — **Pendiente** (SPEC 14, pasos 4–6). Turnstile ya está en `/auth` (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`); falta crear el widget en Cloudflare, activar CAPTCHA en Supabase y anotar los rate limits.
  - [x] Headers de seguridad en Next.js
    — **Cumplido** (SPEC 14). `next.config.ts` envía en todas las rutas los tres de abajo + `Strict-Transport-Security` y `Permissions-Policy`.
  
  Ej:

```ts
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

// En la config de Next.js:
headers: async () => [
  { source: '/(.*)', headers: securityHeaders }
]
```

## Por el ladod e Supabase:

> **Resuelto** (SPEC 14): la migración `20261001000000_revoke_rls_auto_enable.sql` revoca `EXECUTE` sobre `public.rls_auto_enable()` a `public`, `anon` y `authenticated`. Los dos avisos ya no aparecen en `get_advisors`; solo queda `auth_leaked_password_protection`.

| name                                               | title                                                 | level | facing   | categories   | description                                                                                                                                                                                                              | detail                                                                                                                                                                                                                               | remediation                                                                                                            | metadata                                                                                                 | cache_key                                                                  | observed_at              |
| -------------------------------------------------- | ----------------------------------------------------- | ----- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------ |
| anon_security_definer_function_executable          | Public Can Execute SECURITY DEFINER Function          | WARN  | EXTERNAL | ["SECURITY"] | Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.       | Function `public.rls_auto_enable()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/rls_auto_enable`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.          | https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable          | {"schema":"public","name":"rls_auto_enable","language":"plpgsql","arguments":"","security_definer":true} | anon_security_definer_function_executable_public_rls_auto_enable_          | 2026-10-01T00:27:00.635Z |
| authenticated_security_definer_function_executable | Signed-In Users Can Execute SECURITY DEFINER Function | WARN  | EXTERNAL | ["SECURITY"] | Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it. | Function `public.rls_auto_enable()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/rls_auto_enable`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. | https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable | {"schema":"public","name":"rls_auto_enable","language":"plpgsql","arguments":"","security_definer":true} | authenticated_security_definer_function_executable_public_rls_auto_enable_ | 2026-10-01T00:27:00.635Z |
