alter table public.store_products
  add column promotion_label text,
  add column promotion_color text check (promotion_color in ('blue','yellow','red'));
alter table public.product_variants
  add column compare_at_cents integer check (compare_at_cents > 0 and (price_cents is null or compare_at_cents > price_cents));
revoke update on public.product_variants from authenticated;
grant update (
  product_id,sku,name_pt,name_en,price_cents,compare_at_cents,currency,stock_total,
  available,min_quantity,max_quantity,attributes,sort_order
) on public.product_variants to authenticated;
insert into public.home_blocks(block_key,visible,sort_order) values
  ('categories',true,1),('featured',true,2),('calendar',true,3),
  ('tours',true,4),('transfers',true,5),('benefits',true,6),('faq',true,7);
