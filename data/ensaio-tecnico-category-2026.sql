-- Publish the empty category after the category artwork and route are live.
-- Products remain drafts until their dates, details and availability are confirmed.
insert into public.store_categories (
  slug, name_pt, name_en, description_pt, description_en, image_url, sort_order, status
) values (
  'ensaio-tecnico', 'Ensaio Técnico', 'Technical Rehearsals',
  'Ensaios técnicos das escolas de samba na Sapucaí. Datas e ingressos serão publicados após confirmação.',
  'Samba school technical rehearsals at the Sambadrome. Dates and tickets will be published once confirmed.',
  '/images/ensaio-tecnico.jpg', 7, 'published'
)
on conflict (slug) do nothing;

select slug, name_pt, status from public.store_categories where slug = 'ensaio-tecnico';
