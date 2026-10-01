-- Keep the transfer's parade date and boarding point with the paid order.
-- The buyer may only choose a published parade date and a boarding point
-- already configured on that transfer product.
create or replace function public.reserve_pagarme_order(
  buyer_id uuid, lines jsonb, request_key uuid, accepted_terms_version integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  reserved_id uuid;
  line jsonb;
  transfer_product record;
  pickup text;
  service_day text;
  existing_attributes jsonb;
begin
  if buyer_id is null or not exists(select 1 from auth.users where id = buyer_id) then
    raise exception 'invalid_buyer';
  end if;
  if jsonb_typeof(lines) <> 'array' or jsonb_array_length(lines) not between 1 and 20 then
    raise exception 'invalid_cart';
  end if;
  for line in select value from jsonb_array_elements(lines) loop
    select p.kind,p.attributes into transfer_product
      from public.product_variants v join public.store_products p on p.id = v.product_id
      where v.id = (line->>'variant_id')::uuid;
    if found and transfer_product.kind = 'transfer' then
      pickup := line->>'pickup_point';
      service_day := line->>'service_date';
      if service_day is null or not exists(
        select 1 from public.event_dates d
          where d.event_date::text = service_day and d.status = 'published'
      ) then raise exception 'transfer_date_required'; end if;
      if pickup is null or length(pickup) > 180 or not exists(
        select 1 from jsonb_array_elements(coalesce(transfer_product.attributes->'source_options','[]'::jsonb)) option
          where option->>'name' = 'embarque' and (option->'options') ? pickup
      ) then raise exception 'transfer_pickup_required'; end if;
    end if;
  end loop;
  perform private.release_expired_reservations();
  perform pg_catalog.set_config('request.jwt.claim.sub', buyer_id::text, true);
  reserved_id := private.reserve_order(lines, request_key, accepted_terms_version);
  update public.orders set expires_at = now() + interval '5 days'
    where id = reserved_id and status = 'pending_payment' and pagarme_link_id is null;
  update public.stock_reservations set expires_at = now() + interval '5 days'
    where order_id = reserved_id and status = 'active';
  for line in select value from jsonb_array_elements(lines) loop
    select p.kind into transfer_product from public.product_variants v
      join public.store_products p on p.id = v.product_id
      where v.id = (line->>'variant_id')::uuid;
    if transfer_product.kind = 'transfer' then
      select attributes into existing_attributes from public.order_items
        where order_id = reserved_id and variant_id = (line->>'variant_id')::uuid for update;
      if existing_attributes ? 'service_date' and (
        existing_attributes->>'service_date' is distinct from line->>'service_date' or
        existing_attributes->>'pickup_point' is distinct from line->>'pickup_point'
      ) then raise exception 'transfer_selection_changed'; end if;
      update public.order_items set attributes = attributes || jsonb_build_object(
        'service_date',line->>'service_date','pickup_point',line->>'pickup_point'
      ) where order_id = reserved_id and variant_id = (line->>'variant_id')::uuid;
    end if;
  end loop;
  return reserved_id;
end $$;
revoke all on function public.reserve_pagarme_order(uuid,jsonb,uuid,integer) from public,anon,authenticated;
grant execute on function public.reserve_pagarme_order(uuid,jsonb,uuid,integer) to service_role;
