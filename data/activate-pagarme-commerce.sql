-- Run only after the Pagar.me functions, secret, checkout UI, legal notices and
-- webhook endpoint are deployed. The merchant approved the legacy prices and
-- contractual sale without a per-product stock cap on 2026-10-01.
begin;
do $$
declare priced_count integer; mismatch_count integer;
begin
  select count(*), count(*) filter (where v.price_cents is distinct from (p.attributes->>'source_price_cents')::integer)
    into priced_count,mismatch_count
    from public.product_variants v join public.store_products p on p.id=v.product_id
    where p.status='published' and p.kind in ('ticket','package','transfer')
      and p.attributes ? 'source_price_cents' and (p.event_date_id is not null or p.kind='transfer');
  if priced_count <> 35 or mismatch_count <> 0 then
    raise exception 'Catalog price review required: %, %', priced_count, mismatch_count;
  end if;
  if not exists(select 1 from public.store_pages where slug='termos-de-compra' and version=3
    and status='published' and approval_status='approved') then raise exception 'Purchase terms v3 missing'; end if;
end $$;

update public.product_variants v set
  available=true,
  stock_total=1000000,
  max_quantity=least(v.max_quantity,10)
from public.store_products p
where p.id=v.product_id and p.status='published' and p.kind in ('ticket','package','transfer')
  and p.attributes ? 'source_price_cents' and v.price_cents=(p.attributes->>'source_price_cents')::integer
  and (p.event_date_id is not null or p.kind='transfer');

update public.store_products p set sales_mode='online',
  attributes=p.attributes || '{"stock_policy":"contractual_unlimited","price_approval":"merchant_approved_2026-10-01"}'::jsonb
where p.status='published' and p.kind in ('ticket','package','transfer')
  and p.attributes ? 'source_price_cents' and (p.event_date_id is not null or p.kind='transfer')
  and exists(select 1 from public.product_variants v where v.product_id=p.id and v.available and v.price_cents>0);

update public.store_settings set value='true'::jsonb,updated_at=now() where key='commerce_enabled';
commit;
