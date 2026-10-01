-- Exactly nine read-only sample rows were created by the earlier demo migration.
-- The production store now reads store_products; no real customer/catalogue data is here.
drop table public.catalog_products;
