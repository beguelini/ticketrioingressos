-- Refreshed Rio City Tour covers; retain each product's own original poster as its gallery.
-- Apply only after the new static images are live in Production.
with artwork(slug, image_url) as (
  values
  ('barco-pirata-angra-dos-reis-e-ilha-grande', '/images/city-tours/barco-pirata-angra-dos-reis-e-ilha-grande.jpg'),
  ('buzios-de-bardot-rio', '/images/city-tours/buzios-de-bardot-rio.jpg'),
  ('cristo-city-tour-almoco-rio', '/images/city-tours/cristo-city-tour-almoco-rio.jpg'),
  ('favela-tour-rio', '/images/city-tours/favela-tour-rio.jpg')
),
updated as (
  update public.store_products as p
  set image_url = a.image_url, gallery = jsonb_build_array(p.image_url)
  from artwork as a
  where p.slug = a.slug
    and p.kind = 'tour'
    and p.status = 'published'
    and p.image_url like '%/legacy-catalog/%'
  returning p.slug
)
select count(*) as updated_products from updated;
