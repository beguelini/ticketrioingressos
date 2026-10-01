-- Pagar.me checkout is invoked by Edge Functions with a service-role key only.
-- The storefront's commerce_enabled flag remains off until inventory is approved.
alter table public.orders
  add column if not exists pagarme_link_id text unique,
  add column if not exists pagarme_checkout_url text,
  add column if not exists pagarme_order_id text unique,
  add column if not exists payment_method text;

create or replace function public.reserve_pagarme_order(
  buyer_id uuid, lines jsonb, request_key uuid, accepted_terms_version integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare reserved_id uuid;
begin
  if buyer_id is null or not exists(select 1 from auth.users where id = buyer_id) then
    raise exception 'invalid_buyer';
  end if;
  perform private.release_expired_reservations();
  -- reserve_order performs price, availability, ownership and terms checks atomically.
  perform pg_catalog.set_config('request.jwt.claim.sub', buyer_id::text, true);
  reserved_id := private.reserve_order(lines, request_key, accepted_terms_version);
  -- Boleto can settle days after checkout. Keep inventory until the provider resolves
  -- the charge; a new checkout releases any previously expired reservations.
  update public.orders set expires_at = now() + interval '5 days'
    where id = reserved_id and status = 'pending_payment' and pagarme_link_id is null;
  update public.stock_reservations set expires_at = now() + interval '5 days'
    where order_id = reserved_id and status = 'active';
  return reserved_id;
end $$;
revoke all on function public.reserve_pagarme_order(uuid,jsonb,uuid,integer) from public,anon,authenticated;
grant execute on function public.reserve_pagarme_order(uuid,jsonb,uuid,integer) to service_role;

create or replace function public.record_pagarme_link(
  local_order_id uuid, link_id text, checkout_url text
) returns void language plpgsql security definer set search_path = '' as $$
declare current_order public.orders%rowtype;
begin
  if link_id !~ '^pl_[A-Za-z0-9]+$' or checkout_url !~ '^https://payment-link\.pagar\.me/' then
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

create or replace function public.apply_verified_pagarme_event(
  local_order_id uuid, provider_order_id text, provider_charge_id text,
  provider_method text, verified_status text, verified_amount integer,
  external_event_id text, event_type text, payload_hash text
) returns text language plpgsql security definer set search_path = '' as $$
declare current_order public.orders%rowtype; reservation record; inserted_event uuid;
begin
  if verified_status not in ('paid','pending','failed','canceled','refunded')
    or provider_order_id !~ '^or_[A-Za-z0-9]+$'
    or external_event_id is null or length(external_event_id) > 180
    or payload_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_provider_event'; end if;
  select * into current_order from public.orders where id = local_order_id for update;
  if not found or current_order.pagarme_link_id is null
    or (current_order.pagarme_order_id is not null and current_order.pagarme_order_id <> provider_order_id)
    or current_order.total_cents <> verified_amount then raise exception 'order_mismatch'; end if;
  insert into private.webhook_events(provider,external_event_id,event_type,payload_hash)
    values('pagarme',external_event_id,event_type,payload_hash)
    on conflict (provider,external_event_id) do nothing returning id into inserted_event;
  if inserted_event is null then return 'duplicate'; end if;
  update public.orders set pagarme_order_id = provider_order_id,
    payment_method = left(provider_method,40) where id = local_order_id;
  if provider_charge_id ~ '^ch_[A-Za-z0-9]+$' then
    insert into public.payments(order_id,provider,provider_payment_id,idempotency_key,amount_cents,status)
      values(local_order_id,'pagarme',provider_charge_id,gen_random_uuid(),verified_amount,
        case verified_status when 'paid' then 'approved' when 'refunded' then 'refunded'
          when 'failed' then 'failed' else 'pending' end)
      on conflict (provider,provider_payment_id) do update set status = excluded.status;
  end if;
  if verified_status = 'paid' and current_order.status = 'pending_payment'
    and current_order.expires_at > now() and exists(
      select 1 from public.stock_reservations where order_id = local_order_id and status = 'active'
    ) then
    for reservation in select * from public.stock_reservations
      where order_id = local_order_id and status = 'active' for update loop
      update public.product_variants set stock_total = stock_total - reservation.quantity,
        stock_reserved = stock_reserved - reservation.quantity where id = reservation.variant_id;
      update public.stock_reservations set status = 'confirmed' where id = reservation.id;
      insert into public.stock_movements(variant_id,order_id,delta,reason)
        values(reservation.variant_id,local_order_id,-reservation.quantity,'pagarme_paid');
    end loop;
    update public.orders set status='confirmed',payment_status='approved',
      delivery_status='awaiting_supplier' where id=local_order_id;
    insert into public.deliveries(order_item_id,status)
      select id,'awaiting_supplier' from public.order_items where order_id=local_order_id
      on conflict (order_item_id) do nothing;
    insert into public.order_events(order_id,event_type) values(local_order_id,'payment_approved');
  elsif verified_status = 'paid' and current_order.status <> 'confirmed' then
    insert into public.order_events(order_id,event_type,details)
      values(local_order_id,'payment_requires_manual_review',jsonb_build_object('provider_order_id',provider_order_id));
  elsif verified_status in ('canceled','refunded') and current_order.status = 'pending_payment' then
    for reservation in select * from public.stock_reservations
      where order_id=local_order_id and status='active' for update loop
      update public.product_variants set stock_reserved=stock_reserved-reservation.quantity
        where id=reservation.variant_id;
      update public.stock_reservations set status='released' where id=reservation.id;
    end loop;
    update public.orders set status='cancelled',
      payment_status=case when verified_status='refunded' then 'refunded' else 'failed' end,
      delivery_status='cancelled' where id=local_order_id;
    insert into public.order_events(order_id,event_type) values(local_order_id,'payment_cancelled');
  elsif verified_status = 'refunded' and current_order.status = 'confirmed' then
    update public.orders set payment_status='refunded' where id=local_order_id;
    insert into public.order_events(order_id,event_type) values(local_order_id,'refund_requires_review');
  end if;
  update private.webhook_events set processed_at=now() where id=inserted_event;
  return 'processed';
end $$;
revoke all on function public.apply_verified_pagarme_event(uuid,text,text,text,text,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.apply_verified_pagarme_event(uuid,text,text,text,text,integer,text,text,text) to service_role;
