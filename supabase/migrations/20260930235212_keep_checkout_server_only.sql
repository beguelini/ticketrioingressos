-- A future verified payment backend will call the reservation function through a direct
-- server-side DB session. It must not be callable from the browser while checkout is disabled.
revoke execute on function public.reserve_order(jsonb,uuid,integer) from authenticated;
alter function public.reserve_order(jsonb,uuid,integer) set schema private;
revoke all on function private.reserve_order(jsonb,uuid,integer) from public,anon,authenticated;

-- Explicit deny documents that webhook event data is server-only.
create policy webhook_events_no_browser_access on private.webhook_events
  for all to anon,authenticated using (false) with check (false);
