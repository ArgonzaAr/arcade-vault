-- public.rls_auto_enable() es la función del event trigger ensure_rls, que
-- activa RLS en toda tabla nueva de public. Se conserva, pero ya no se puede
-- llamar por /rest/v1/rpc/rls_auto_enable (SPEC 14). Postgres no comprueba
-- EXECUTE al disparar un event trigger, así que ensure_rls sigue funcionando.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
