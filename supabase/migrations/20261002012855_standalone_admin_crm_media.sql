-- Dedicated staff CRM and consented campaign attribution.
alter table public.staff_roles add column email text;
alter table public.staff_roles drop constraint if exists staff_roles_role_check;
alter table public.staff_roles add constraint staff_roles_role_check check (role in ('administrator','commercial','operations','finance','marketing'));
update public.staff_roles s set email = u.email from auth.users u where u.id = s.user_id;
revoke insert,update,delete on public.staff_roles from authenticated;
drop policy if exists admin_assign_staff on public.staff_roles;
create policy staff_crm_colleagues on public.staff_roles for select to authenticated
  using (private.has_staff_role(array['administrator','commercial']) and role in ('administrator','commercial'));

alter table public.inquiries
  add column stage text not null default 'new' check (stage in ('new','contacted','qualified','proposal','won','lost')),
  add column assigned_to uuid references public.staff_roles(user_id) on delete set null,
  add column next_followup_at timestamptz,
  add column estimated_value_cents integer check (estimated_value_cents >= 0),
  add column utm_source text,
  add column utm_medium text,
  add column utm_campaign text,
  add column updated_at timestamptz not null default now();
create index if not exists inquiries_crm_idx on public.inquiries(stage,created_at desc);
create index if not exists inquiries_assignee_idx on public.inquiries(assigned_to,next_followup_at);
create policy inquiries_staff_insert on public.inquiries for insert to authenticated
  with check (private.has_staff_role(array['administrator','commercial']) and length(message) between 1 and 4000);
create policy inquiries_staff_update on public.inquiries for update to authenticated
  using (private.has_staff_role(array['administrator','commercial']))
  with check (private.has_staff_role(array['administrator','commercial']));

create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  note text not null check (length(note) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index crm_activities_inquiry_idx on public.crm_activities(inquiry_id,created_at desc);
alter table public.crm_activities enable row level security;
revoke all on public.crm_activities from public,anon,authenticated;
grant select,insert on public.crm_activities to authenticated;
create policy crm_activities_staff_read on public.crm_activities for select to authenticated
  using (private.has_staff_role(array['administrator','commercial']));
create policy crm_activities_staff_insert on public.crm_activities for insert to authenticated
  with check (actor_id=(select auth.uid()) and private.has_staff_role(array['administrator','commercial']));
create or replace function private.log_crm_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  if new.stage is distinct from old.stage then
    insert into public.crm_activities(inquiry_id,actor_id,note)
      values(new.id,(select auth.uid()),'Etapa alterada: ' || old.stage || ' → ' || new.stage);
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.crm_activities(inquiry_id,actor_id,note)
      values(new.id,(select auth.uid()),'Responsável atualizado.');
  end if;
  return new;
end $$;
create trigger inquiry_crm_history after update of stage,assigned_to on public.inquiries
  for each row when (new.stage is distinct from old.stage or new.assigned_to is distinct from old.assigned_to)
  execute function private.log_crm_change();

create table public.media_spend_daily (
  id uuid primary key default gen_random_uuid(),
  spend_date date not null,
  utm_source text not null check (length(utm_source) between 1 and 80),
  utm_campaign text not null check (length(utm_campaign) between 1 and 120),
  amount_cents integer not null check (amount_cents >= 0),
  notes text check (length(notes) <= 500),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index media_spend_date_idx on public.media_spend_daily(spend_date,utm_source,utm_campaign);
alter table public.media_spend_daily enable row level security;
revoke all on public.media_spend_daily from public,anon,authenticated;
grant select,insert,update,delete on public.media_spend_daily to authenticated;
create policy media_spend_staff_read on public.media_spend_daily for select to authenticated
  using (private.has_staff_role(array['administrator','marketing']));
create policy media_spend_staff_insert on public.media_spend_daily for insert to authenticated
  with check (created_by=(select auth.uid()) and private.has_staff_role(array['administrator','marketing']));
create policy media_spend_staff_update on public.media_spend_daily for update to authenticated
  using (private.has_staff_role(array['administrator','marketing']))
  with check (private.has_staff_role(array['administrator','marketing']));
create policy media_spend_staff_delete on public.media_spend_daily for delete to authenticated
  using (private.has_staff_role(array['administrator','marketing']));

create table public.order_attribution (
  order_id uuid primary key references public.orders(id) on delete cascade,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now()
);
create index order_attribution_campaign_idx on public.order_attribution(utm_source,utm_campaign);
alter table public.order_attribution enable row level security;
revoke all on public.order_attribution from public,anon,authenticated;
grant select,insert on public.order_attribution to service_role;

create or replace function public.media_performance(from_date date, to_date date)
returns table(utm_source text,utm_campaign text,spend_cents bigint,leads bigint,approved_orders bigint,revenue_cents bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_staff_role(array['administrator','marketing']) then raise exception 'forbidden'; end if;
  if from_date is null or to_date is null or to_date < from_date or to_date > from_date + 366 then raise exception 'invalid_period'; end if;
  return query
    with spend as (
      select lower(trim(m.utm_source)) as source,lower(trim(m.utm_campaign)) as campaign,sum(m.amount_cents)::bigint as amount
      from public.media_spend_daily m where m.spend_date between from_date and to_date group by 1,2
    ), lead_counts as (
      select lower(trim(i.utm_source)) as source,lower(trim(i.utm_campaign)) as campaign,count(*)::bigint as amount
      from public.inquiries i where (i.created_at at time zone 'America/Sao_Paulo')::date between from_date and to_date
        and i.utm_source is not null and i.utm_campaign is not null group by 1,2
    ), sales as (
      select lower(trim(a.utm_source)) as source,lower(trim(a.utm_campaign)) as campaign,
        count(*)::bigint as orders,sum(o.total_cents)::bigint as revenue
      from public.order_attribution a join public.orders o on o.id=a.order_id
      where (o.created_at at time zone 'America/Sao_Paulo')::date between from_date and to_date and o.payment_status='approved'
        and a.utm_source is not null and a.utm_campaign is not null group by 1,2
    )
    select coalesce(s.source,l.source,v.source),coalesce(s.campaign,l.campaign,v.campaign),
      coalesce(s.amount,0),coalesce(l.amount,0),coalesce(v.orders,0),coalesce(v.revenue,0)
    from spend s full join lead_counts l using(source,campaign) full join sales v using(source,campaign)
    order by 1,2;
end $$;
revoke all on function public.media_performance(date,date) from public,anon;
grant execute on function public.media_performance(date,date) to authenticated;
