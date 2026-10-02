drop policy if exists inquiries_own_insert on public.inquiries;
create policy inquiries_own_insert on public.inquiries for insert to authenticated
  with check (
    customer_id=(select auth.uid()) and length(message) between 1 and 4000
    and status='new' and stage='new' and assigned_to is null
    and next_followup_at is null and estimated_value_cents is null
  );
alter table public.inquiries
  add constraint inquiries_utm_source_length check (utm_source is null or length(utm_source) <= 80),
  add constraint inquiries_utm_medium_length check (utm_medium is null or length(utm_medium) <= 80),
  add constraint inquiries_utm_campaign_length check (utm_campaign is null or length(utm_campaign) <= 120);
