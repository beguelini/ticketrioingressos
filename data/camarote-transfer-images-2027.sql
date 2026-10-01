-- Editorial product artwork for the published 2027 camarotes and shuttles.
-- Apply after the corresponding static assets are live in Production.
with artwork(slug, image_url, gallery) as (
  values
   ('camarote-atmosfera-campeas-13-02-2027-1-vaga-pessoa', '/images/camarotes/camarote-atmosfera-campeas-13-02-2027-1-vaga-pessoa.jpg', '["/images/camarotes/logo-atmosfera-original.jpg"]'::jsonb),
  ('camarote-atmosfera-domingo-especial-07-02-2027-1-vaga-pessoa', '/images/camarotes/camarote-atmosfera-domingo-especial-07-02-2027-1-vaga-pessoa.jpg', '["/images/camarotes/logo-atmosfera-original.jpg"]'::jsonb),
  ('camarote-atmosfera-sabado-serie-ouro-06-02-2027-1-vaga-pessoa', '/images/camarotes/camarote-atmosfera-sabado-serie-ouro-06-02-2027-1-vaga-pessoa.jpg', '["/images/camarotes/logo-atmosfera-original.jpg"]'::jsonb),
  ('camarote-atmosfera-segunda-especial-08-02-2027-1-vaga-pessoa', '/images/camarotes/camarote-atmosfera-segunda-especial-08-02-2027-1-vaga-pessoa.jpg', '["/images/camarotes/logo-atmosfera-original.jpg"]'::jsonb),
  ('camarote-atmosfera-sexta-serie-ouro-05-02-2027-1-vaga-pessoa', '/images/camarotes/camarote-atmosfera-sexta-serie-ouro-05-02-2027-1-vaga-pessoa.jpg', '["/images/camarotes/logo-atmosfera-original.jpg"]'::jsonb),
  ('camarote-atmosfera-terca-especial-09-02-2027-1-vaga-pessoa', '/images/camarotes/camarote-atmosfera-terca-especial-09-02-2027-1-vaga-pessoa.jpg', '["/images/camarotes/logo-atmosfera-original.jpg"]'::jsonb),
  ('camarote-lounge-carioca-domingo-especial-07-02-2027-1-vaga-pessoa', '/images/camarotes/camarote-lounge-carioca-domingo-especial-07-02-2027-1-vaga-pessoa.jpg', '["/images/camarotes/logo-lounge-carioca-original.png"]'::jsonb),
  ('camarote-lounge-carioca-sabado-das-campeas-13-02-2027-1-vaga-pessoa', '/images/camarotes/camarote-lounge-carioca-sabado-das-campeas-13-02-2027-1-vaga-pessoa.jpg', '["/images/camarotes/logo-lounge-carioca-original.png"]'::jsonb),
  ('camarote-lounge-carioca-sabado-serie-ouro-06-02-2027-1-vaga-pessoa', '/images/camarotes/camarote-lounge-carioca-sabado-serie-ouro-06-02-2027-1-vaga-pessoa.jpg', '["/images/camarotes/logo-lounge-carioca-original.png"]'::jsonb),
  ('camarote-lounge-carioca-segunda-especial-08-02-2027-1-vaga-pessoa', '/images/camarotes/camarote-lounge-carioca-segunda-especial-08-02-2027-1-vaga-pessoa.jpg', '["/images/camarotes/logo-lounge-carioca-original.png"]'::jsonb),
  ('camarote-lounge-carioca-sexta-serie-ouro-05-02-2027-1-vaga-pessoa', '/images/camarotes/camarote-lounge-carioca-sexta-serie-ouro-05-02-2027-1-vaga-pessoa.jpg', '["/images/camarotes/logo-lounge-carioca-original.png"]'::jsonb),
  ('camarote-lounge-carioca-terca-especial-09-02-2027-1-vaga-pessoa', '/images/camarotes/camarote-lounge-carioca-terca-especial-09-02-2027-1-vaga-pessoa.jpg', '["/images/camarotes/logo-lounge-carioca-original.png"]'::jsonb),
  ('shuttle-sambodromo-carnaval-2027-ida-volta-guia-lado-impar', '/images/transfers/shuttle-sambodromo-carnaval-2027-ida-volta-guia-lado-impar.jpg', '["/images/transfers/shuttle-sambodromo-carnaval-2027-ida-volta-guia-lado-par.jpg"]'::jsonb),
  ('shuttle-sambodromo-carnaval-2027-ida-volta-guia-lado-par', '/images/transfers/shuttle-sambodromo-carnaval-2027-ida-volta-guia-lado-par.jpg', '["/images/transfers/shuttle-sambodromo-carnaval-2027-ida-volta-guia-lado-impar.jpg"]'::jsonb)
),
updated as (
  update public.store_products as p
  set image_url = a.image_url, gallery = a.gallery
  from artwork as a
  where p.slug = a.slug
    and p.kind in ('package', 'transfer')
    and p.status = 'published'
    and p.image_url like '%/legacy-catalog/%'
  returning p.slug
)
select count(*) as updated_products from updated;
