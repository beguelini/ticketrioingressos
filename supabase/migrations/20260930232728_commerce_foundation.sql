-- Ticket Rio commerce foundation. No real prices, availability, or payment method are seeded.
create extension if not exists pgcrypto with schema extensions;

create table public.staff_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('administrator','commercial','operations','finance')),
  created_at timestamptz not null default now()
);

create schema if not exists private;
create or replace function private.has_staff_role(allowed text[])
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.staff_roles
  where user_id = (select auth.uid()) and role = any(allowed)
) $$;
revoke all on function private.has_staff_role(text[]) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.has_staff_role(text[]) to anon, authenticated;

create table public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  country_code text,
  document_type text,
  document_number text,
  address jsonb,
  updated_at timestamptz not null default now()
);

create table public.store_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_pt text not null,
  name_en text,
  description_pt text,
  description_en text,
  image_url text,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived'))
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title_pt text not null,
  title_en text,
  year integer not null check (year between 2020 and 2100),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  notes text
);
create table public.event_dates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  event_date date not null,
  parade_group text not null,
  starts_at time,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  unique(event_id,event_date,parade_group)
);
create table public.parade_schools (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);
create table public.parade_lineup (
  id uuid primary key default gen_random_uuid(),
  event_date_id uuid not null references public.event_dates(id) on delete cascade,
  school_id uuid not null references public.parade_schools(id),
  parade_order integer not null check (parade_order > 0),
  expected_at time,
  notes text,
  status text not null default 'draft' check (status in ('draft','published')),
  unique(event_date_id,parade_order)
);

create table public.store_products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  kind text not null check (kind in ('ticket','transfer','tour','metro','apparel','package')),
  category_id uuid references public.store_categories(id),
  event_date_id uuid references public.event_dates(id),
  name_pt text not null,
  name_en text,
  summary_pt text,
  summary_en text,
  description_pt text,
  description_en text,
  image_url text,
  gallery jsonb not null default '[]'::jsonb check (jsonb_typeof(gallery) = 'array'),
  video_url text,
  included_pt text,
  excluded_pt text,
  instructions_pt text,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  seo_title_pt text,
  seo_description_pt text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sales_mode text not null default 'inquiry' check (sales_mode in ('online','inquiry')),
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index store_products_public_idx on public.store_products(kind,sort_order) where status='published';

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products(id) on delete cascade,
  sku text not null unique,
  name_pt text not null,
  name_en text,
  price_cents integer check (price_cents >= 0),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  stock_total integer not null default 0 check (stock_total >= 0),
  stock_reserved integer not null default 0 check (stock_reserved >= 0 and stock_reserved <= stock_total),
  available boolean not null default false,
  min_quantity integer not null default 1 check (min_quantity > 0),
  max_quantity integer not null default 10 check (max_quantity >= min_quantity),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  sort_order integer not null default 0,
  check (price_cents is null or price_cents > 0)
);
create index product_variants_product_idx on public.product_variants(product_id);

create table public.store_pages (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  title_pt text not null,
  title_en text,
  body_pt text,
  body_en text,
  status text not null default 'draft' check (status in ('draft','published')),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved')),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);
create table public.store_faqs (
  id uuid primary key default gen_random_uuid(),
  question_pt text not null,
  answer_pt text not null,
  question_en text,
  answer_en text,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published'))
);
create table public.store_banners (
  id uuid primary key default gen_random_uuid(),
  title_pt text not null,
  title_en text,
  image_url text,
  target_url text,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published'))
);
create table public.home_blocks (
  block_key text primary key,
  visible boolean not null default false,
  sort_order integer not null default 0
);
create table public.store_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.store_settings(key,value) values ('commerce_enabled','false'::jsonb);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete set null,
  product_id uuid references public.store_products(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  message text not null,
  status text not null default 'new' check (status in ('new','in_progress','closed')),
  created_at timestamptz not null default now()
);

create table public.shopping_carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create table public.cart_items (
  user_id uuid not null references public.shopping_carts(user_id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 20),
  primary key(user_id,variant_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id),
  order_number bigint generated always as identity unique,
  idempotency_key uuid not null,
  status text not null default 'pending_payment' check (status in ('pending_payment','confirmed','cancelled','expired')),
  payment_status text not null default 'pending' check (payment_status in ('pending','approved','failed','expired','refunded')),
  delivery_status text not null default 'awaiting_payment' check (delivery_status in ('awaiting_payment','awaiting_supplier','processing','available_official_app','missing_data','delivery_issue','cancelled')),
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'BRL',
  terms_version integer not null,
  accepted_terms_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(customer_id,idempotency_key)
);
create index orders_customer_created_idx on public.orders(customer_id,created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  product_sku text not null,
  variant_name text not null,
  variant_sku text not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  attributes jsonb not null default '{}'::jsonb,
  line_total_cents integer generated always as (quantity * unit_price_cents) stored
);
create table public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  quantity integer not null check (quantity > 0),
  status text not null default 'active' check (status in ('active','confirmed','released')),
  expires_at timestamptz not null,
  unique(order_id,variant_id)
);
create index stock_reservations_expiry_idx on public.stock_reservations(expires_at) where status='active';
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id),
  order_id uuid references public.orders(id),
  delta integer not null,
  reason text not null,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  provider text not null,
  provider_payment_id text,
  idempotency_key uuid not null unique,
  amount_cents integer not null check (amount_cents > 0),
  status text not null check (status in ('pending','approved','failed','expired','refunded')),
  created_at timestamptz not null default now(),
  unique(provider,provider_payment_id)
);
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'requested' check (status in ('requested','approved','rejected','completed')),
  provider_refund_id text,
  created_at timestamptz not null default now()
);
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  payload_hash text not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider,external_event_id)
);
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items(id) on delete cascade,
  supplier text,
  external_reference text,
  recipient_email text,
  available_at timestamptz,
  instructions text,
  status text not null default 'awaiting_supplier' check (status in ('awaiting_supplier','processing','available_official_app','missing_data','delivery_issue','cancelled'))
);
create table public.transfer_routes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products(id),
  service_date date not null,
  sambadrome_side text not null check (sambadrome_side in ('even','odd')),
  instructions_outbound text,
  instructions_return text,
  details_due_before_checkout boolean not null default false,
  capacity integer check (capacity >= 0)
);
create table public.transfer_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.transfer_routes(id) on delete cascade,
  hotel_or_stop text not null,
  pickup_at time,
  sort_order integer not null default 0
);
create table public.transfer_passengers (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  customer_id uuid not null references auth.users(id),
  full_name text,
  route_id uuid references public.transfer_routes(id),
  stop_id uuid references public.transfer_stops(id),
  status text not null default 'missing_data' check (status in ('missing_data','complete')),
  updated_at timestamptz not null default now()
);
create table public.notification_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id),
  channel text not null check (channel in ('email','whatsapp')),
  template_key text not null,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  error_code text,
  attempted_at timestamptz
);
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  entity text not null,
  entity_id text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Every public table is protected, including event and audit tables without browser policies.
do $$
declare table_name text;
begin
  for table_name in select unnest(array[
    'staff_roles','customer_profiles','store_categories','events','event_dates','parade_schools',
    'parade_lineup','store_products','product_variants','store_pages','store_faqs','store_banners',
    'home_blocks','store_settings','inquiries','shopping_carts','cart_items','orders','order_items',
    'stock_reservations','stock_movements','payments','refunds','webhook_events','order_events',
    'deliveries','transfer_routes','transfer_stops','transfer_passengers','notification_attempts','audit_log'
  ]) loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on public.%I from public, anon, authenticated',table_name);
  end loop;
end $$;

grant select on public.store_categories,public.events,public.event_dates,public.parade_schools,
  public.parade_lineup,public.store_products,public.product_variants,public.store_pages,
  public.store_faqs,public.store_banners,public.home_blocks to anon,authenticated;
grant select,insert,update,delete on public.store_categories,public.events,public.event_dates,
  public.parade_schools,public.parade_lineup,public.store_products,public.product_variants,
  public.store_pages,public.store_faqs,public.store_banners,public.home_blocks to authenticated;
grant select,insert,update on public.customer_profiles,public.shopping_carts,public.cart_items,
  public.inquiries,public.transfer_passengers to authenticated;
grant delete on public.cart_items to authenticated;
grant select on public.staff_roles,public.store_settings,public.orders,public.order_items,
  public.stock_reservations,public.stock_movements,public.payments,public.refunds,public.order_events,
  public.deliveries,public.transfer_routes,public.transfer_stops,public.notification_attempts,public.audit_log
  to authenticated;
grant insert,update,delete on public.staff_roles to authenticated;
grant select,insert,update,delete on public.transfer_routes,public.transfer_stops,public.deliveries to authenticated;
grant select,update on public.orders to authenticated;

create policy own_profile_select on public.customer_profiles for select to authenticated using (user_id=(select auth.uid()) or private.has_staff_role(array['administrator','commercial']));
create policy own_profile_insert on public.customer_profiles for insert to authenticated with check (user_id=(select auth.uid()));
create policy own_profile_update on public.customer_profiles for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy own_staff_role on public.staff_roles for select to authenticated using (user_id=(select auth.uid()) or private.has_staff_role(array['administrator']));
create policy admin_assign_staff on public.staff_roles for all to authenticated
  using (private.has_staff_role(array['administrator']))
  with check (private.has_staff_role(array['administrator']));

create policy categories_read on public.store_categories for select to anon,authenticated using (status='published' or private.has_staff_role(array['administrator','commercial']));
create policy events_read on public.events for select to anon,authenticated using (status='published' or private.has_staff_role(array['administrator','commercial','operations']));
create policy event_dates_read on public.event_dates for select to anon,authenticated using (status='published' or private.has_staff_role(array['administrator','commercial','operations']));
create policy schools_read on public.parade_schools for select to anon,authenticated using (exists(select 1 from public.parade_lineup l join public.event_dates d on d.id=l.event_date_id where l.school_id=parade_schools.id and l.status='published' and d.status='published') or private.has_staff_role(array['administrator','commercial','operations']));
create policy lineup_read on public.parade_lineup for select to anon,authenticated using (status='published' and exists(select 1 from public.event_dates d where d.id=event_date_id and d.status='published') or private.has_staff_role(array['administrator','commercial','operations']));
create policy products_read on public.store_products for select to anon,authenticated using (status='published' or private.has_staff_role(array['administrator','commercial','operations']));
create policy variants_read on public.product_variants for select to anon,authenticated using (exists(select 1 from public.store_products p where p.id=product_id and p.status='published') or private.has_staff_role(array['administrator','commercial','operations']));
create policy pages_read on public.store_pages for select to anon,authenticated using (status='published' or private.has_staff_role(array['administrator','commercial']));
create policy faqs_read on public.store_faqs for select to anon,authenticated using (status='published' or private.has_staff_role(array['administrator','commercial']));
create policy banners_read on public.store_banners for select to anon,authenticated using (status='published' or private.has_staff_role(array['administrator','commercial']));
create policy blocks_read on public.home_blocks for select to anon,authenticated using (visible or private.has_staff_role(array['administrator','commercial']));

do $$
declare table_name text;
begin
  for table_name in select unnest(array['store_categories','events','event_dates','parade_schools','parade_lineup','store_products','product_variants','store_pages','store_faqs','store_banners','home_blocks']) loop
    execute format('create policy staff_write on public.%I for all to authenticated using (private.has_staff_role(array[''administrator'',''commercial''])) with check (private.has_staff_role(array[''administrator'',''commercial'']))',table_name);
  end loop;
end $$;
create policy settings_staff on public.store_settings for select to authenticated using (private.has_staff_role(array['administrator']));
create policy inquiries_own on public.inquiries for select to authenticated using (customer_id=(select auth.uid()) or private.has_staff_role(array['administrator','commercial']));
create policy inquiries_own_insert on public.inquiries for insert to authenticated with check (customer_id=(select auth.uid()) and length(message) between 1 and 4000);
create policy cart_own on public.shopping_carts for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy cart_items_own on public.cart_items for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy orders_own on public.orders for select to authenticated using (customer_id=(select auth.uid()) or private.has_staff_role(array['administrator','commercial','operations','finance']));
create policy order_items_own on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=(select auth.uid()) or private.has_staff_role(array['administrator','commercial','operations','finance']))));
create policy reservations_staff on public.stock_reservations for select to authenticated using (private.has_staff_role(array['administrator','operations']));
create policy movements_staff on public.stock_movements for select to authenticated using (private.has_staff_role(array['administrator','operations']));
create policy payments_own on public.payments for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=(select auth.uid()) or private.has_staff_role(array['administrator','finance']))));
create policy refunds_staff on public.refunds for select to authenticated using (private.has_staff_role(array['administrator','finance']));
create policy order_events_own on public.order_events for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=(select auth.uid()) or private.has_staff_role(array['administrator','commercial','operations','finance']))));
create policy deliveries_own on public.deliveries for select to authenticated using (exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id where i.id=order_item_id and (o.customer_id=(select auth.uid()) or private.has_staff_role(array['administrator','commercial','operations']))));
create policy deliveries_staff_write on public.deliveries for all to authenticated using (private.has_staff_role(array['administrator','operations'])) with check (private.has_staff_role(array['administrator','operations']));
create policy transfer_routes_staff on public.transfer_routes for all to authenticated using (private.has_staff_role(array['administrator','commercial','operations'])) with check (private.has_staff_role(array['administrator','operations']));
create policy transfer_stops_staff on public.transfer_stops for all to authenticated using (private.has_staff_role(array['administrator','commercial','operations'])) with check (private.has_staff_role(array['administrator','operations']));
create policy passengers_own on public.transfer_passengers for select to authenticated using (customer_id=(select auth.uid()) or private.has_staff_role(array['administrator','operations']));
create policy passengers_own_update on public.transfer_passengers for update to authenticated using (customer_id=(select auth.uid()) or private.has_staff_role(array['administrator','operations'])) with check (customer_id=(select auth.uid()) or private.has_staff_role(array['administrator','operations']));
create policy attempts_staff on public.notification_attempts for select to authenticated using (private.has_staff_role(array['administrator','commercial','operations']));
create policy audit_admin on public.audit_log for select to authenticated using (private.has_staff_role(array['administrator']));

-- Validate carts against authoritative variants. No browser-supplied price is accepted.
create or replace function public.quote_cart(lines jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare line jsonb; v record; quantity integer; total bigint := 0; details jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(lines) <> 'array' or jsonb_array_length(lines) not between 1 and 20 then raise exception 'invalid_cart'; end if;
  if (select count(*) from jsonb_array_elements(lines)) <> (select count(distinct value->>'variant_id') from jsonb_array_elements(lines)) then raise exception 'duplicate_variant'; end if;
  for line in select * from jsonb_array_elements(lines) loop
    if (line->>'quantity') !~ '^[0-9]+$' then raise exception 'invalid_quantity'; end if;
    quantity := (line->>'quantity')::integer;
    select pv.*, p.name_pt, p.sku as product_sku, p.sales_mode, p.status
      into v from public.product_variants pv join public.store_products p on p.id=pv.product_id
      where pv.id=(line->>'variant_id')::uuid;
    if not found or v.status <> 'published' or v.sales_mode <> 'online' or not v.available or v.price_cents is null
      or quantity < v.min_quantity or quantity > v.max_quantity or quantity > v.stock_total-v.stock_reserved
      then raise exception 'unavailable_variant'; end if;
    total := total + quantity::bigint * v.price_cents;
    details := details || jsonb_build_array(jsonb_build_object('variant_id',v.id,'name',v.name_pt,'sku',v.sku,'quantity',quantity,'unit_price_cents',v.price_cents,'line_total_cents',quantity * v.price_cents));
  end loop;
  if total > 2147483647 then raise exception 'cart_total_too_large'; end if;
  return jsonb_build_object('currency','BRL','total_cents',total,'items',details);
end $$;
revoke all on function public.quote_cart(jsonb) from public;
grant execute on function public.quote_cart(jsonb) to anon,authenticated;

-- The store is deliberately disabled until a payment provider and real catalogue are configured.
create or replace function public.reserve_order(lines jsonb, request_key uuid, accepted_terms_version integer)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare buyer uuid := (select auth.uid()); existing uuid; line jsonb; v record; quantity integer;
  total bigint := 0; new_order uuid; expiry timestamptz := now() + interval '15 minutes';
begin
  if buyer is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.store_settings where key='commerce_enabled' and value='true'::jsonb) then raise exception 'commerce_disabled'; end if;
  if request_key is null or accepted_terms_version is null or not exists(
    select 1 from public.store_pages where slug='termos-de-compra' and version=accepted_terms_version and status='published' and approval_status='approved'
  ) then raise exception 'terms_not_accepted'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(buyer::text || request_key::text,0));
  select id into existing from public.orders where customer_id=buyer and idempotency_key=request_key;
  if found then return existing; end if;
  if jsonb_typeof(lines) <> 'array' or jsonb_array_length(lines) not between 1 and 20 then raise exception 'invalid_cart'; end if;
  if (select count(*) from jsonb_array_elements(lines)) <> (select count(distinct value->>'variant_id') from jsonb_array_elements(lines)) then raise exception 'duplicate_variant'; end if;
  -- Lock variants in deterministic order to avoid overselling and deadlocks.
  for line in select value from jsonb_array_elements(lines) order by value->>'variant_id' loop
    if (line->>'quantity') !~ '^[0-9]+$' then raise exception 'invalid_quantity'; end if;
    quantity := (line->>'quantity')::integer;
    select pv.*, p.name_pt as product_name, p.sku as product_sku, p.status, p.sales_mode
      into v from public.product_variants pv join public.store_products p on p.id=pv.product_id
      where pv.id=(line->>'variant_id')::uuid for update of pv;
    if not found or v.status <> 'published' or v.sales_mode <> 'online' or not v.available or v.price_cents is null
      or quantity < v.min_quantity or quantity > v.max_quantity or quantity > v.stock_total-v.stock_reserved
      then raise exception 'unavailable_variant'; end if;
    total := total + quantity::bigint * v.price_cents;
  end loop;
  if total > 2147483647 then raise exception 'cart_total_too_large'; end if;
  insert into public.orders(customer_id,idempotency_key,total_cents,terms_version,accepted_terms_at,expires_at)
    values(buyer,request_key,total::integer,accepted_terms_version,now(),expiry) returning id into new_order;
  for line in select value from jsonb_array_elements(lines) order by value->>'variant_id' loop
    quantity := (line->>'quantity')::integer;
    select pv.*, p.name_pt as product_name, p.sku as product_sku into v
      from public.product_variants pv join public.store_products p on p.id=pv.product_id
      where pv.id=(line->>'variant_id')::uuid;
    update public.product_variants set stock_reserved=stock_reserved+quantity where id=v.id;
    insert into public.order_items(order_id,variant_id,product_name,product_sku,variant_name,variant_sku,quantity,unit_price_cents,attributes)
      values(new_order,v.id,v.product_name,v.product_sku,v.name_pt,v.sku,quantity,v.price_cents,v.attributes);
    insert into public.stock_reservations(order_id,variant_id,quantity,expires_at)
      values(new_order,v.id,quantity,expiry);
  end loop;
  insert into public.order_events(order_id,event_type,actor_id) values(new_order,'order_reserved',buyer);
  return new_order;
end $$;
revoke all on function public.reserve_order(jsonb,uuid,integer) from public,anon;
grant execute on function public.reserve_order(jsonb,uuid,integer) to authenticated;

create or replace function private.release_expired_reservations()
returns integer language plpgsql security definer set search_path = ''
as $$
declare r record; released integer := 0;
begin
  for r in select * from public.stock_reservations where status='active' and expires_at <= now() for update skip locked loop
    update public.stock_reservations set status='released' where id=r.id;
    update public.product_variants set stock_reserved=stock_reserved-r.quantity where id=r.variant_id;
    update public.orders set status='expired',payment_status='expired' where id=r.order_id and status='pending_payment';
    insert into public.order_events(order_id,event_type) values(r.order_id,'reservation_expired');
    released := released+1;
  end loop;
  return released;
end $$;
revoke all on function private.release_expired_reservations() from public,anon,authenticated;

-- Sensitive edits receive a metadata-only audit trail; no passwords or documents are copied.
create or replace function private.audit_store_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare record_id text;
begin
  record_id := coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id',to_jsonb(new)->>'user_id',to_jsonb(old)->>'user_id',to_jsonb(new)->>'slug',to_jsonb(old)->>'slug');
  insert into public.audit_log(actor_id,entity,entity_id,action)
    values((select auth.uid()),tg_table_name,coalesce(record_id,'unknown'),tg_op);
  return coalesce(new,old);
end $$;
revoke all on function private.audit_store_change() from public,anon,authenticated;
create trigger audit_products after insert or update or delete on public.store_products for each row execute function private.audit_store_change();
create trigger audit_variants after insert or update or delete on public.product_variants for each row execute function private.audit_store_change();
create trigger audit_pages after insert or update or delete on public.store_pages for each row execute function private.audit_store_change();
create trigger audit_roles after insert or update or delete on public.staff_roles for each row execute function private.audit_store_change();
create trigger audit_deliveries after insert or update or delete on public.deliveries for each row execute function private.audit_store_change();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
  ('ticket-rio-media','ticket-rio-media',true,10485760,array['image/jpeg','image/png','image/webp']),
  ('ticket-rio-documents','ticket-rio-documents',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;
create policy ticket_rio_media_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id='ticket-rio-media' and private.has_staff_role(array['administrator','commercial']));
create policy ticket_rio_media_staff_update on storage.objects for update to authenticated
  using (bucket_id='ticket-rio-media' and private.has_staff_role(array['administrator','commercial']))
  with check (bucket_id='ticket-rio-media' and private.has_staff_role(array['administrator','commercial']));
create policy ticket_rio_media_staff_delete on storage.objects for delete to authenticated
  using (bucket_id='ticket-rio-media' and private.has_staff_role(array['administrator','commercial']));
create policy ticket_rio_media_staff_select on storage.objects for select to authenticated
  using (bucket_id='ticket-rio-media' and private.has_staff_role(array['administrator','commercial']));
create policy ticket_rio_documents_own_select on storage.objects for select to authenticated
  using (bucket_id='ticket-rio-documents' and ((storage.foldername(name))[1]=(select auth.uid())::text or private.has_staff_role(array['administrator','operations'])));
create policy ticket_rio_documents_own_insert on storage.objects for insert to authenticated
  with check (bucket_id='ticket-rio-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Existing published mock catalogue is withdrawn from public access.
update public.catalog_products set is_published=false where is_published=true;

-- Real records remain drafts until validated by Ticket Rio.
insert into public.store_categories(slug,name_pt,name_en,sort_order) values
 ('ingressos','Ingressos','Tickets',1),('transfers','Transfers','Transfers',2),
 ('city-tours','Rio City Tour','Rio City Tours',3),('metro','Metrô','Metro',4),
 ('camisetas','Camisetas e abadás','T-shirts and costumes',5),('camarotes','Camarotes','VIP lounges',6);
insert into public.store_pages(slug,title_pt,body_pt) values
 ('politica-de-privacidade','Política de privacidade','Conteúdo pendente de aprovação pela Ticket Rio.'),
 ('termos-de-compra','Termos de compra','Conteúdo pendente de aprovação pela Ticket Rio.'),
 ('cancelamento-e-reembolso','Cancelamento e reembolso','Conteúdo pendente de aprovação pela Ticket Rio.');
insert into public.events(title_pt,year,notes) values
 ('Carnaval do Rio de Janeiro',2027,'Datas citadas no site anterior; aguardam validação oficial.');
insert into public.event_dates(event_id,event_date,parade_group,status)
select e.id,dates.event_date,dates.parade_group,'draft'
from public.events e cross join (values
  ('2027-02-05'::date,'Série Ouro'),('2027-02-06'::date,'Série Ouro'),
  ('2027-02-07'::date,'Grupo Especial'),('2027-02-08'::date,'Grupo Especial'),
  ('2027-02-09'::date,'Grupo Especial'),('2027-02-13'::date,'Campeãs')
) as dates(event_date,parade_group) where e.year=2027;

-- Reference names only. All records are drafts, under inquiry, with no invented price or inventory.
insert into public.store_products(sku,slug,kind,category_id,name_pt,summary_pt,status,sales_mode)
select v.sku,v.slug,v.kind,c.id,v.name_pt,'Registro de referência pendente de validação.','draft','inquiry'
from (values
  ('REF-CAM-KING','camarote-king','package','camarotes','Camarote King'),
  ('REF-CAM-LOUNGE-CARIOCA','lounge-carioca','package','camarotes','Lounge Carioca'),
  ('REF-CAM-ATMOSFERA','camarote-atmosfera','package','camarotes','Camarote Atmosfera'),
  ('REF-CAM-SAPUCAI','camarote-sapucai','package','camarotes','Camarote Sapucaí'),
  ('REF-TOUR-CRISTO','cristo-city-tour-almoco','tour','city-tours','Cristo + City Tour + Almoço'),
  ('REF-TOUR-FAVELA','favela-tour','tour','city-tours','Favela Tour'),
  ('REF-TOUR-BUZIOS','buzios-de-bardot','tour','city-tours','Búzios de Bardot'),
  ('REF-TOUR-ANGRA','barco-pirata-angra-ilha-grande','tour','city-tours','Barco Pirata Angra dos Reis e Ilha Grande'),
  ('REF-TRANSFER-PAR','transfer-sambodromo-lado-par','transfer','transfers','Transfer Sambódromo · lado par'),
  ('REF-TRANSFER-IMPAR','transfer-sambodromo-lado-impar','transfer','transfers','Transfer Sambódromo · lado ímpar'),
  ('REF-METRO','ticket-metro','metro','metro','Ticket de metrô'),
  ('REF-ABADA','camiseta-abada','apparel','camisetas','Camiseta ou abadá')
) as v(sku,slug,kind,category_slug,name_pt)
join public.store_categories c on c.slug=v.category_slug;
