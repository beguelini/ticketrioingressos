-- Pagar.me now returns hosted checkout links on payment-link-v3.pagar.me.
-- Keep the original host valid for links already issued.
create or replace function public.record_pagarme_link(
  local_order_id uuid, link_id text, checkout_url text
) returns void language plpgsql security definer set search_path = '' as $$
declare current_order public.orders%rowtype;
begin
  if link_id !~ '^pl_[A-Za-z0-9]+$'
    or checkout_url !~ '^https://payment-link(-v3)?\.pagar\.me/pl_[A-Za-z0-9]+$' then
    raise exception 'invalid_payment_link';
  end if;
  select * into current_order from public.orders where id = local_order_id for update;
  if not found or current_order.status <> 'pending_payment' then raise exception 'invalid_order'; end if;
  if current_order.pagarme_link_id is not null and current_order.pagarme_link_id <> link_id then
    raise exception 'different_payment_link';
  end if;
  update public.orders set pagarme_link_id = link_id, pagarme_checkout_url = checkout_url
    where id = local_order_id;
end $$;
revoke all on function public.record_pagarme_link(uuid,text,text) from public,anon,authenticated;
grant execute on function public.record_pagarme_link(uuid,text,text) to service_role;
