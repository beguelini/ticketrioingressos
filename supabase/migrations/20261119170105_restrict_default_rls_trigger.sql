-- The default project event trigger is not a public application RPC.
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
