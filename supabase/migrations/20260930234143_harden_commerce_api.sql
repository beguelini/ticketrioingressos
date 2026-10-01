-- Public quote reads only published rows through RLS; it needs no elevated privileges.
alter function public.quote_cart(jsonb) security invoker;

-- Webhook payload identifiers belong outside the exposed Data API schema.
alter table public.webhook_events set schema private;

create index if not exists cart_items_variant_idx on public.cart_items(variant_id);
create index if not exists inquiries_customer_idx on public.inquiries(customer_id);
create index if not exists inquiries_product_idx on public.inquiries(product_id);
create index if not exists event_dates_event_idx on public.event_dates(event_id);
create index if not exists parade_lineup_school_idx on public.parade_lineup(school_id);
create index if not exists products_category_idx on public.store_products(category_id);
create index if not exists products_event_date_idx on public.store_products(event_date_id);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_variant_idx on public.order_items(variant_id);
create index if not exists reservations_variant_idx on public.stock_reservations(variant_id);
create index if not exists stock_movements_variant_idx on public.stock_movements(variant_id);
create index if not exists stock_movements_order_idx on public.stock_movements(order_id);
create index if not exists payments_order_idx on public.payments(order_id);
create index if not exists refunds_payment_idx on public.refunds(payment_id);
create index if not exists order_events_order_idx on public.order_events(order_id);
create index if not exists deliveries_order_item_idx on public.deliveries(order_item_id);
create index if not exists transfer_routes_product_idx on public.transfer_routes(product_id);
create index if not exists transfer_stops_route_idx on public.transfer_stops(route_id);
create index if not exists transfer_passengers_order_item_idx on public.transfer_passengers(order_item_id);
create index if not exists transfer_passengers_customer_idx on public.transfer_passengers(customer_id);
create index if not exists transfer_passengers_route_idx on public.transfer_passengers(route_id);
create index if not exists transfer_passengers_stop_idx on public.transfer_passengers(stop_id);
create index if not exists notification_attempts_order_idx on public.notification_attempts(order_id);
create index if not exists audit_log_actor_idx on public.audit_log(actor_id);
