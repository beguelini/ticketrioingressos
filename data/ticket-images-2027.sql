-- Ticket Rio 2027 editorial ticket imagery. Run only after these assets are live.
-- Updates imported ticket imagery only; later manual image edits remain untouched.
begin;
with image_map(slug, hero, companion) as (
  values
  ('arquibancada-sabado-serie-ouro-setor-02-06-02-2027', '/images/ingressos/01-panorama.jpg', '/images/ingressos/08-avenida.jpg'),
  ('arquibancada-sabado-serie-ouro-setor-03-06-02-2027', '/images/ingressos/02-bateria.jpg', '/images/ingressos/09-publico.jpg'),
  ('arquibancada-sabado-serie-ouro-setor-04-06-02-2027', '/images/ingressos/03-alegoria.jpg', '/images/ingressos/10-escultura.jpg'),
  ('arquibancada-sabado-serie-ouro-setor-05-06-02-2027', '/images/ingressos/04-passista.jpg', '/images/ingressos/11-desfile.jpg'),
  ('arquibancada-sabado-serie-ouro-setor-06-06-02-2027', '/images/ingressos/05-arquibancada.jpg', '/images/ingressos/12-editorial.jpg'),
  ('arquibancada-sabado-serie-ouro-setor-07-06-02-2027', '/images/ingressos/06-detalhes.jpg', '/images/ingressos/13-editorial.jpg'),
  ('arquibancada-sabado-serie-ouro-setor-08-06-02-2027', '/images/ingressos/07-porta-bandeira.jpg', '/images/ingressos/14-editorial.jpg'),
  ('arquibancada-sabado-serie-ouro-setor-09-numerada-06-02-2027', '/images/ingressos/08-avenida.jpg', '/images/ingressos/15-editorial.jpg'),
  ('arquibancada-sabado-serie-ouro-setor-10-06-02-2027', '/images/ingressos/09-publico.jpg', '/images/ingressos/16-editorial.jpg'),
  ('arquibancada-sabado-serie-ouro-setor-11-06-02-2027', '/images/ingressos/10-escultura.jpg', '/images/ingressos/17-editorial.jpg'),
  ('arquibancada-sexta-serie-ouro-setor-02-05-02-2027', '/images/ingressos/11-desfile.jpg', '/images/ingressos/18-editorial.jpg'),
  ('arquibancada-sexta-serie-ouro-setor-03-05-02-2027', '/images/ingressos/12-editorial.jpg', '/images/ingressos/19-editorial.jpg'),
  ('arquibancada-sexta-serie-ouro-setor-04-05-02-2027', '/images/ingressos/13-editorial.jpg', '/images/ingressos/20-editorial.jpg'),
  ('arquibancada-sexta-serie-ouro-setor-05-05-02-2027', '/images/ingressos/14-editorial.jpg', '/images/ingressos/21-editorial.jpg'),
  ('arquibancada-sexta-serie-ouro-setor-06-05-02-2027', '/images/ingressos/15-editorial.jpg', '/images/ingressos/01-panorama.jpg'),
  ('arquibancada-sexta-serie-ouro-setor-08-05-02-2027', '/images/ingressos/16-editorial.jpg', '/images/ingressos/02-bateria.jpg'),
  ('arquibancada-sexta-serie-ouro-setor-09-05-02-2027', '/images/ingressos/17-editorial.jpg', '/images/ingressos/03-alegoria.jpg'),
  ('arquibancada-sexta-serie-ouro-setor-10-05-02-2027', '/images/ingressos/18-editorial.jpg', '/images/ingressos/04-passista.jpg'),
  ('arquibancada-sexta-serie-ouro-setor-11-05-02-2027', '/images/ingressos/19-editorial.jpg', '/images/ingressos/05-arquibancada.jpg'),
  ('cadeira-de-pista-sabado-serie-ouro-setor-12-06-02-2027', '/images/ingressos/20-editorial.jpg', '/images/ingressos/06-detalhes.jpg'),
  ('cadeira-de-pista-sexta-feira-serie-ouro-setor-12-05-02-2027', '/images/ingressos/21-editorial.jpg', '/images/ingressos/07-porta-bandeira.jpg')
), updated as (
  update public.store_products as product
  set image_url = image_map.hero,
      gallery = jsonb_build_array(image_map.companion)
  from image_map
  where product.slug = image_map.slug
    and product.kind = 'ticket'
    and product.status = 'published'
    and product.image_url like 'https://xylnlwtinrahtvgacxoc.supabase.co/storage/v1/object/public/ticket-rio-media/legacy-catalog/%'
  returning product.slug
)
select count(*) as updated_ticket_images from updated;
commit;
