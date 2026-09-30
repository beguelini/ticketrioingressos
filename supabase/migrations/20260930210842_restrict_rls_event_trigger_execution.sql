-- The RLS auto-enable event trigger is owned by postgres and must not be callable over the public Data API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
