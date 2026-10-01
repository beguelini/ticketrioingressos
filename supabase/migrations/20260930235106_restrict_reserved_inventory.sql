-- Reservation counters are modified only by SECURITY DEFINER order/expiry functions.
revoke update on public.product_variants from authenticated;
grant update (
  product_id,sku,name_pt,name_en,price_cents,currency,stock_total,available,
  min_quantity,max_quantity,attributes,sort_order
) on public.product_variants to authenticated;
