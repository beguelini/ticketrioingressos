-- Run only on a disposable database or when orders is empty. Entire fixture is rolled back.
begin;
insert into auth.users(id,email) values
  ('00000000-0000-4000-8000-000000000101','commerce-test-a@example.invalid'),
  ('00000000-0000-4000-8000-000000000102','commerce-test-b@example.invalid');
insert into public.store_products(id,sku,slug,kind,name_pt,status,sales_mode)
values ('00000000-0000-4000-8000-000000000201','COMMERCE-TEST','commerce-test','ticket','Teste de ingresso','published','online');
insert into public.product_variants(id,product_id,sku,name_pt,price_cents,stock_total,available)
values ('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000201','COMMERCE-TEST-V','Setor teste',12345,2,true);
update public.store_pages set status='published',approval_status='approved' where slug='termos-de-compra';
update public.store_settings set value='true'::jsonb where key='commerce_enabled';

set local role anon;
do $$
declare result jsonb;
begin
  result := public.quote_cart('[{"variant_id":"00000000-0000-4000-8000-000000000301","quantity":2,"price_cents":1}]');
  if (result->>'total_cents')::integer <> 24690 then raise exception 'browser price affected total'; end if;
  if private.has_staff_role(array['administrator']) then raise exception 'anonymous user is staff'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
set local role authenticated;
do $$
begin
  if private.has_staff_role(array['administrator']) then raise exception 'ordinary user is staff'; end if;
  begin
    perform private.reserve_order(
      '[{"variant_id":"00000000-0000-4000-8000-000000000301","quantity":2}]',
      '00000000-0000-4000-8000-000000000401',1);
    raise exception 'browser accessed server-only reservation';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
declare first_id uuid; second_id uuid;
begin
  first_id := private.reserve_order(
    '[{"variant_id":"00000000-0000-4000-8000-000000000301","quantity":2,"price_cents":1}]',
    '00000000-0000-4000-8000-000000000401',1);
  second_id := private.reserve_order(
    '[{"variant_id":"00000000-0000-4000-8000-000000000301","quantity":2,"price_cents":999999}]',
    '00000000-0000-4000-8000-000000000401',1);
  if first_id <> second_id then raise exception 'idempotency failed'; end if;
  if (select total_cents from public.orders where id=first_id) <> 24690 then raise exception 'server amount invalid'; end if;
  begin
    perform private.reserve_order(
      '[{"variant_id":"00000000-0000-4000-8000-000000000301","quantity":1}]',
      '00000000-0000-4000-8000-000000000402',1);
    raise exception 'overselling was allowed';
  exception when others then
    if sqlerrm = 'overselling was allowed' then raise; end if;
  end;
end $$;
set local role authenticated;
do $$
begin
  if (select count(*) from public.orders) <> 1 then raise exception 'order isolation failed for owner'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.orders) <> 0 then raise exception 'other customer can view order'; end if;
  if (select count(*) from public.order_items) <> 0 then raise exception 'other customer can view items'; end if;
end $$;
reset role;

insert into public.staff_roles(user_id,role)
values ('00000000-0000-4000-8000-000000000101','administrator');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
set local role authenticated;
do $$
begin
  begin
    update public.product_variants set stock_reserved=0 where sku='COMMERCE-TEST-V';
    raise exception 'staff altered reserved counter';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

update public.stock_reservations set expires_at=now()-interval '1 minute'
where order_id in (select id from public.orders where customer_id='00000000-0000-4000-8000-000000000101');
do $$
begin
  if private.release_expired_reservations() <> 1 then raise exception 'expiry did not release reservation'; end if;
  if (select stock_reserved from public.product_variants where sku='COMMERCE-TEST-V') <> 0 then raise exception 'stock was not restored'; end if;
end $$;
rollback;
