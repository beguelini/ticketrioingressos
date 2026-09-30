-- Public, read-only catalogue for the Ticket Rio demonstration site.
create table public.catalog_products (
  id integer primary key,
  kind text not null check (kind in ('carnaval', 'city')),
  category text not null,
  title text not null,
  event_date date,
  date_label text not null,
  venue text not null,
  description text not null,
  image_path text not null,
  image_alt text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) > 0),
  badge text,
  badge_tone text check (badge_tone in ('yellow', 'red', 'blue')),
  original_price numeric(10, 2) check (original_price >= 0),
  sort_order integer not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint catalog_products_category_matches_kind check (
    (kind = 'city' and category = 'Rio City Tour') or
    (kind = 'carnaval' and category in ('Grupo Especial', 'Série Ouro', 'Experiências'))
  )
);

create index catalog_products_published_order_idx
  on public.catalog_products (sort_order)
  where is_published;

alter table public.catalog_products enable row level security;
revoke all on table public.catalog_products from public, anon, authenticated;
grant select on table public.catalog_products to anon, authenticated;

create policy "Published catalogue is readable"
  on public.catalog_products
  for select
  to anon, authenticated
  using (is_published);

insert into public.catalog_products
  (id, kind, category, title, event_date, date_label, venue, description, image_path, image_alt, options, badge, badge_tone, original_price, sort_order, is_published)
values
  (1, 'carnaval', 'Grupo Especial', 'Grupo Especial · Domingo', '2027-02-07', 'DOM, 7 FEV 2027', 'Sambódromo · Marquês de Sapucaí', 'A primeira noite do maior desfile do mundo.', '/images/avenida-noturna.webp', 'Vista aérea de um desfile iluminado na avenida', '[{"name":"Arquibancada","price":270,"note":"A energia da avenida"},{"name":"Frisa","price":790,"note":"Mais perto do desfile"},{"name":"Camarote","price":1490,"note":"Vista e conforto"}]', 'Mais procurado', 'yellow', null, 1, true),
  (2, 'carnaval', 'Série Ouro', 'Série Ouro · Sexta', '2027-02-05', 'SEX, 5 FEV 2027', 'Sambódromo · Marquês de Sapucaí', 'Ritmo, tradição e novas histórias na avenida.', '/images/samba-percussao.webp', 'Ritmista de escola de samba em figurino vermelho e dourado', '[{"name":"Arquibancada","price":120,"note":"A vibração do desfile"},{"name":"Frisa","price":490,"note":"Perto da bateria"}]', '20% OFF · exemplo', 'red', 150, 2, true),
  (3, 'carnaval', 'Experiências', 'Camarote da Avenida', '2027-02-06', 'SÁB, 6 FEV 2027', 'Sambódromo · Marquês de Sapucaí', 'Uma perspectiva especial para viver cada detalhe.', '/images/camarote-vista.webp', 'Lounge elegante iluminado com vista para a avenida', '[{"name":"Camarote","price":490,"note":"Vista privilegiada"},{"name":"Camarote premium","price":890,"note":"Espaço e conforto extra"}]', 'Oferta · exemplo', 'blue', 590, 3, true),
  (4, 'carnaval', 'Série Ouro', 'Série Ouro · Sábado', '2027-02-06', 'SÁB, 6 FEV 2027', 'Sambódromo · Marquês de Sapucaí', 'O espetáculo continua em uma noite vibrante.', '/images/bloco-de-rua.webp', 'Percussionistas em uma celebração colorida no Rio', '[{"name":"Arquibancada","price":140,"note":"A energia da avenida"},{"name":"Frisa","price":520,"note":"Mais perto do desfile"}]', 'Novidade', 'blue', null, 4, true),
  (5, 'carnaval', 'Grupo Especial', 'Grupo Especial · Segunda', '2027-02-08', 'SEG, 8 FEV 2027', 'Sambódromo · Marquês de Sapucaí', 'Grandes alegorias em uma noite inesquecível.', '/images/alegoria-dourada.webp', 'Alegoria dourada com esculturas de aves tropicais', '[{"name":"Arquibancada","price":270,"note":"A energia da avenida"},{"name":"Frisa","price":790,"note":"Mais perto do desfile"},{"name":"Camarote","price":1490,"note":"Vista e conforto"}]', 'Destaque', 'yellow', null, 5, true),
  (6, 'carnaval', 'Experiências', 'Frisa na Sapucaí', '2027-02-08', 'SEG, 8 FEV 2027', 'Sambódromo · Marquês de Sapucaí', 'Sinta a avenida de um lugar ainda mais próximo.', '/images/arquibancada-fogos.webp', 'Público acompanha fogos de artifício sobre a avenida', '[{"name":"Frisa","price":790,"note":"Mais perto do desfile"},{"name":"Frisa premium","price":1090,"note":"Vista central da avenida"}]', null, null, null, 6, true),
  (7, 'city', 'Rio City Tour', 'Santa Teresa de perto', null, 'DATAS A DEFINIR', 'Santa Teresa · Rio de Janeiro', 'Ruas históricas, arte e a alma carioca.', '/images/santa-teresa-bonde.webp', 'Bonde amarelo atravessa uma rua histórica de Santa Teresa', '[{"name":"Experiência compartilhada","price":180,"note":"Valor ilustrativo por pessoa"},{"name":"Experiência privativa","price":390,"note":"Valor ilustrativo por pessoa"}]', 'Oferta · exemplo', 'blue', 220, 7, true),
  (8, 'city', 'Rio City Tour', 'Pão de Açúcar ao entardecer', null, 'DATAS A DEFINIR', 'Urca · Rio de Janeiro', 'O pôr do sol visto de um dos ícones do Rio.', '/images/pao-de-acucar.webp', 'Bondinho diante do Pão de Açúcar no pôr do sol', '[{"name":"Experiência compartilhada","price":220,"note":"Valor ilustrativo por pessoa"},{"name":"Experiência privativa","price":460,"note":"Valor ilustrativo por pessoa"}]', 'Mais desejado', 'yellow', null, 8, true),
  (9, 'city', 'Rio City Tour', 'Rio visto do mar', null, 'DATAS A DEFINIR', 'Baía de Guanabara · Rio de Janeiro', 'Paisagens da cidade por um ângulo especial.', '/images/rio-pelo-mar.webp', 'Barco navega pela baía com montanhas do Rio ao fundo', '[{"name":"Passeio compartilhado","price":320,"note":"Valor ilustrativo por pessoa"},{"name":"Passeio privativo","price":690,"note":"Valor ilustrativo por pessoa"}]', 'Novidade', 'blue', null, 9, true);
