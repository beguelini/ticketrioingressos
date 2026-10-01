#!/usr/bin/env python3
"""Build an idempotent, create-only Supabase SQL import from the captured catalog.

Usage: python3 scripts/build-legacy-import.py data/legacy-catalog-2026-10-01.json /tmp/ticket-rio-import.sql
Then run: supabase db query --linked --file /tmp/ticket-rio-import.sql
The command uses the authenticated Supabase CLI; no credentials are stored here.
"""

import json
import sys
from pathlib import Path


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: build-legacy-import.py MANIFEST OUTPUT.sql")
    source = json.loads(Path(sys.argv[1]).read_text())
    products = source["products"]
    urls = [item["source_url"] for item in products]
    skus = [item["sku"] for item in products]
    slugs = [item["slug"] for item in products]
    if len(products) != len(set(urls)) or len(products) != len(set(skus)) or len(products) != len(set(slugs)):
        raise SystemExit("Duplicate source URL, SKU or slug in manifest")
    if any(not item["image_url"] or item["price_cents"] == 0 for item in products):
        raise SystemExit("Invalid image or zero price in manifest")
    if any(item["status"] != "published" or item["sales_mode"] != "inquiry" for item in products):
        raise SystemExit("Unsafe publication mode in manifest")

    payload = json.dumps(products, ensure_ascii=False, separators=(",", ":"))
    sql = f"""-- Ticket Rio public-source snapshot: {source['collected_at']}
-- Create only. Existing products, prices, stock, orders and manual edits are preserved.
begin;
do $$ begin
  if (select count(*) from public.store_categories where slug in ('ingressos','camarotes','city-tours','transfers')) <> 4 then
    raise exception 'Required store categories are missing';
  end if;
  if (select count(*) from public.event_dates where event_date in ('2027-02-05','2027-02-06','2027-02-07','2027-02-08','2027-02-09','2027-02-13')) <> 6 then
    raise exception 'Required 2027 dates are missing';
  end if;
end $$;
create temporary table import_payload (item jsonb) on commit drop;
insert into import_payload(item)
select value from jsonb_array_elements({literal(payload)}::jsonb);
insert into public.store_products
  (sku,slug,kind,category_id,event_date_id,name_pt,summary_pt,description_pt,image_url,gallery,video_url,attributes,status,sales_mode)
select
  i.item->>'sku', i.item->>'slug', i.item->>'kind', c.id, d.id,
  i.item->>'name_pt', i.item->>'summary_pt', i.item->>'description_pt',
  i.item->>'image_url', i.item->'gallery', i.item->>'video_url',
  i.item->'attributes', 'published', 'inquiry'
from import_payload i
join public.store_categories c on c.slug=i.item->>'category_slug'
left join public.event_dates d on d.event_date=(i.item->>'event_date')::date
where not exists (
  select 1 from public.store_products p
  where p.attributes->>'source_url'=i.item->>'source_url'
)
on conflict do nothing;
insert into public.product_variants
  (product_id,sku,name_pt,price_cents,stock_total,stock_reserved,available,attributes)
select p.id, i.item->>'variant_sku', i.item->>'variant_name_pt',
  (i.item->>'price_cents')::integer, 0, 0, false,
  jsonb_build_object('source_url',i.item->>'source_url','stock_validation','pending')
from import_payload i
join public.store_products p on p.sku=i.item->>'sku' and p.attributes->>'source_url'=i.item->>'source_url'
on conflict do nothing;
commit;
select count(*) as imported_products,
       count(*) filter (where status='published' and sales_mode='inquiry') as published_inquiry
from public.store_products where attributes ? 'source_url';
"""
    Path(sys.argv[2]).write_text(sql)
    print(f"Generated {sys.argv[2]} for {len(products)} source products; existing rows are not updated.")


if __name__ == "__main__":
    main()
