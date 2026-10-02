-- Human support queues. Agent definitions are plans for future automation; no AI is active.
create table public.support_agents (
  agent_key text primary key check (agent_key ~ '^[a-z_]+$'),
  name text not null,
  queue_role text not null check (queue_role in ('administrator','commercial','operations','finance')),
  scope text not null,
  guardrails text not null,
  automation_status text not null default 'planned' check (automation_status = 'planned')
);
alter table public.support_agents enable row level security;
revoke all on public.support_agents from public,anon,authenticated;
grant select on public.support_agents to service_role;

insert into public.support_agents(agent_key,name,queue_role,scope,guardrails) values
('tickets','Especialista em ingressos e desfiles','commercial','Ingressos, setores, escolas, datas, preços e ensaios técnicos.','Usar apenas informações publicadas e disponibilidade confirmada; não prometer ingresso, setor ou preço sem confirmação.'),
('lounges','Especialista em camarotes','commercial','Camarotes, pacotes, inclusões e acesso.','Não inventar serviços inclusos ou disponibilidade; encaminhar logística de acesso à operação.'),
('mobility','Especialista em mobilidade','operations','Transfers, embarque, retorno e metrô.','Confirmar rota, data e ponto de encontro antes de orientar; não alterar reserva sem registro.'),
('citytour','Especialista Rio City Tour','commercial','Escolha de passeios, roteiros e inclusões.','Usar descrição publicada; não prometer operador, horário ou disponibilidade sem confirmação.'),
('tour_operations','Especialista em operação dos passeios','operations','Agenda, encontro e execução dos passeios.','Conferir produto e data; escalar divergência com fornecedor a uma pessoa.'),
('shop','Especialista em produtos da loja','commercial','Camisetas, tamanhos e demais produtos físicos.','Não confirmar estoque, envio ou prazo sem consulta aos dados operacionais.'),
('payments','Especialista em compras e pagamentos','finance','Checkout, cartão, parcelas, Pix e boleto.','Nunca solicitar número completo do cartão, CVV, senha ou código de autenticação; não afirmar pagamento aprovado sem confirmação do prestador.'),
('orders','Especialista em pedidos e entrega','operations','Status do pedido, dados do passageiro e acesso ao ingresso oficial.','Verificar status real antes de responder; não emitir ou prometer ingresso fora do fluxo oficial.'),
('refunds','Especialista em trocas e reembolsos','finance','Cancelamentos, remarcações e devoluções.','Aplicar termos vigentes e regras do produto; não prometer valor ou prazo de reembolso antes da análise humana.'),
('accounts','Especialista em conta e site','operations','Acesso à conta, carrinho e problemas técnicos.','Nunca pedir senha, token ou código de acesso; orientar recuperação pelo fluxo oficial.'),
('privacy','Especialista em privacidade','administrator','Dados pessoais, LGPD e solicitações do titular.','Não divulgar dados por chat sem verificação de identidade; encaminhar solicitações formais ao canal de privacidade.'),
('triage','Especialista em triagem','commercial','Assuntos gerais ou dúvidas não classificadas.','Identificar a demanda e encaminhar à fila correta; não inventar resposta nem concluir solicitação sem confirmação.');

create table public.support_topics (
  id text primary key check (id ~ '^[a-z_]+$'),
  category_key text not null,
  category_pt text not null,
  category_en text not null,
  title_pt text not null,
  title_en text not null,
  example_pt text not null,
  example_en text not null,
  agent_key text not null references public.support_agents(agent_key),
  sort_order integer not null,
  active boolean not null default true
);
create index support_topics_category_idx on public.support_topics(category_key,sort_order);
alter table public.support_topics enable row level security;
revoke all on public.support_topics from public,anon,authenticated;
grant select on public.support_topics to anon,authenticated;
grant select on public.support_topics to service_role;
create policy active_support_topics on public.support_topics for select to anon,authenticated using (active);

insert into public.support_topics(id,category_key,category_pt,category_en,title_pt,title_en,example_pt,example_en,agent_key,sort_order) values
('ticket_sector','tickets','Ingressos e desfiles','Tickets and parades','Setores e visibilidade','Sections and views','Qual setor combina com a minha experiência?','Which section suits my visit?','tickets',10),
('parade_schedule','tickets','Ingressos e desfiles','Tickets and parades','Datas, escolas e ordem dos desfiles','Dates, schools and parade order','Em que dia desfila a escola que quero ver?','When will the school I want to see parade?','tickets',20),
('ticket_prices','tickets','Ingressos e desfiles','Tickets and parades','Valores e tipos de ingresso','Prices and ticket types','Quais são os valores e opções de ingresso?','What ticket types and prices are available?','tickets',30),
('ticket_availability','tickets','Ingressos e desfiles','Tickets and parades','Disponibilidade e reserva','Availability and booking','Há ingressos disponíveis para a data que escolhi?','Are tickets available for my chosen date?','tickets',40),
('technical_rehearsal','tickets','Ingressos e desfiles','Tickets and parades','Ensaio Técnico','Technical Rehearsal','Como funcionam os ingressos para o Ensaio Técnico?','How do Technical Rehearsal tickets work?','tickets',50),
('ticket_accessibility','tickets','Ingressos e desfiles','Tickets and parades','Acessibilidade no Sambódromo','Accessibility at the Sambadrome','Quais opções de acessibilidade estão disponíveis?','What accessibility options are available?','mobility',60),
('lounge_options','lounges','Camarotes','VIP lounges','Opções de camarote','Lounge options','Qual camarote combina com o que procuro?','Which lounge suits what I need?','lounges',70),
('lounge_inclusions','lounges','Camarotes','VIP lounges','O que está incluído','What is included','O que o meu camarote inclui?','What does my lounge package include?','lounges',80),
('lounge_access','lounges','Camarotes','VIP lounges','Localização e acesso','Location and access','Como chego ao camarote no dia do evento?','How do I reach the lounge on event day?','mobility',90),
('transfer_routes','mobility','Transfers e metrô','Transfers and metro','Rotas de transfer','Transfer routes','Qual rota atende meu hotel ou região?','Which route serves my hotel or area?','mobility',100),
('transfer_boarding','mobility','Transfers e metrô','Transfers and metro','Embarque e horário','Boarding and timing','Onde e quando devo embarcar?','Where and when should I board?','mobility',110),
('transfer_return','mobility','Transfers e metrô','Transfers and metro','Retorno e alterações','Return and changes','Como funciona a volta depois do desfile?','How does the return trip work?','mobility',120),
('metro_access','mobility','Transfers e metrô','Transfers and metro','Metrô e acesso ao Sambódromo','Metro and Sambadrome access','Qual estação ou bilhete de metrô devo usar?','Which metro station or pass should I use?','mobility',130),
('tour_choice','tours','Rio City Tour','Rio City Tour','Escolher um passeio','Choose a tour','Qual passeio é melhor para mim?','Which tour is right for me?','citytour',140),
('tour_inclusions','tours','Rio City Tour','Rio City Tour','Roteiro e inclusões','Itinerary and inclusions','O que está incluído no passeio?','What is included in the tour?','citytour',150),
('tour_schedule','tours','Rio City Tour','Rio City Tour','Datas e disponibilidade','Dates and availability','Há vagas para a data desejada?','Is my preferred date available?','tour_operations',160),
('tour_meeting','tours','Rio City Tour','Rio City Tour','Ponto de encontro e horários','Meeting point and times','Onde começa o passeio?','Where does the tour start?','tour_operations',170),
('apparel_product','shop','Produtos da loja','Store products','Camisetas e outros produtos','T-shirts and other products','Quais produtos estão disponíveis?','Which products are available?','shop',180),
('apparel_size','shop','Produtos da loja','Store products','Tamanhos e entrega','Sizes and delivery','Como escolho o tamanho e recebo o produto?','How do I choose a size and receive the item?','shop',190),
('checkout_how','payments','Compra e pagamento','Purchase and payment','Como comprar pelo site','How to buy online','Como finalizo minha compra?','How do I complete my purchase?','payments',200),
('credit_installments','payments','Compra e pagamento','Purchase and payment','Cartão e parcelamento','Card and installments','Posso parcelar no cartão?','Can I pay in installments?','payments',210),
('pix_boleto','payments','Compra e pagamento','Purchase and payment','Pix e boleto','Pix and bank slip','Como pago com Pix ou boleto?','How can I pay with Pix or bank slip?','payments',220),
('payment_problem','payments','Compra e pagamento','Purchase and payment','Falha ou dúvida na cobrança','Payment problem or charge','O pagamento não abriu ou apareceu uma cobrança inesperada.','Payment did not open or I see an unexpected charge.','payments',230),
('order_status','orders','Pedido e ingresso','Order and ticket','Status do pedido','Order status','Qual é a situação do meu pedido?','What is my order status?','orders',240),
('ticket_delivery','orders','Pedido e ingresso','Order and ticket','Entrega do ingresso oficial','Official ticket delivery','Quando e como recebo meu ingresso?','When and how will I receive my ticket?','orders',250),
('passenger_details','orders','Pedido e ingresso','Order and ticket','Dados dos participantes','Guest details','Preciso corrigir dados de um participante.','I need to correct a guest detail.','orders',260),
('change_reschedule','policies','Trocas e reembolsos','Changes and refunds','Troca ou remarcação','Change or reschedule','Posso alterar a data ou o produto?','Can I change the date or product?','refunds',270),
('cancel_refund','policies','Trocas e reembolsos','Changes and refunds','Cancelamento e reembolso','Cancellation and refund','Como solicito o cancelamento?','How do I request cancellation?','refunds',280),
('refund_status','policies','Trocas e reembolsos','Changes and refunds','Acompanhar reembolso','Refund status','Em que etapa está meu reembolso?','What is the status of my refund?','refunds',290),
('account_login','site','Conta e funcionamento do site','Account and website','Acesso à conta','Account access','Não consigo entrar na minha conta.','I cannot sign in to my account.','accounts',300),
('cart_problem','site','Conta e funcionamento do site','Account and website','Carrinho ou erro no site','Cart or website error','Meu carrinho ou uma página não funciona.','My cart or a page is not working.','accounts',310),
('privacy_data','site','Conta e funcionamento do site','Account and website','Privacidade e meus dados','Privacy and my data','Quero saber como meus dados são tratados.','I want to know how my data is handled.','privacy',320),
('other_question','other','Outro assunto','Something else','Outra dúvida','Another question','Minha dúvida não aparece nas opções.','My question is not listed.','triage',330);

create table public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  topic_id text not null references public.support_topics(id),
  agent_key text not null references public.support_agents(agent_key),
  queue_role text not null check (queue_role in ('administrator','commercial','operations','finance')),
  product_id uuid references public.store_products(id) on delete set null,
  inquiry_id uuid references public.inquiries(id) on delete set null,
  customer_name text not null check (length(customer_name) between 2 and 100),
  customer_email text not null check (length(customer_email) between 3 and 254),
  visitor_token_hash text not null check (length(visitor_token_hash)=64),
  status text not null default 'waiting_staff' check (status in ('waiting_staff','waiting_customer','closed')),
  assigned_to uuid references public.staff_roles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_customer_message_at timestamptz not null default now(),
  last_staff_message_at timestamptz,
  last_staff_read_at timestamptz,
  closed_at timestamptz
);
create index support_queue_idx on public.support_conversations(queue_role,status,last_message_at desc);
create index support_email_idx on public.support_conversations(lower(customer_email));
alter table public.support_conversations enable row level security;
revoke all on public.support_conversations from public,anon,authenticated;
grant select,insert,update,delete on public.support_conversations to service_role;

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('visitor','staff')),
  sender_id uuid references auth.users(id),
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  check ((sender_type='visitor' and sender_id is null) or (sender_type='staff' and sender_id is not null))
);
create index support_messages_thread_idx on public.support_messages(conversation_id,created_at,id);
alter table public.support_messages enable row level security;
revoke all on public.support_messages from public,anon,authenticated;
grant select,insert,update,delete on public.support_messages to service_role;

create table public.support_rate_limits (
  key_hash text primary key check (length(key_hash)=64),
  reset_at timestamptz not null,
  hits integer not null check (hits >= 1)
);
alter table public.support_rate_limits enable row level security;
revoke all on public.support_rate_limits from public,anon,authenticated;
grant select,insert,update,delete on public.support_rate_limits to service_role;

create or replace function public.support_consume_rate_limit(rate_key text, max_hits integer, window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_hits integer;
begin
  if rate_key !~ '^[0-9a-f]{64}$' or max_hits not between 1 and 100 or window_seconds not between 30 and 86400 then
    raise exception 'invalid_rate_limit';
  end if;
  insert into public.support_rate_limits as r(key_hash,reset_at,hits)
    values(rate_key,now()+make_interval(secs=>window_seconds),1)
    on conflict (key_hash) do update set
      hits=case when r.reset_at<=now() then 1 else r.hits+1 end,
      reset_at=case when r.reset_at<=now() then now()+make_interval(secs=>window_seconds) else r.reset_at end
    returning hits into current_hits;
  return current_hits<=max_hits;
end $$;
revoke all on function public.support_consume_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.support_consume_rate_limit(text,integer,integer) to service_role;

-- Human chat transcripts and a private browser token are necessary for this requested service.
update public.store_pages set
  body_pt = body_pt || E'\n\n## Atendimento pelo chat\n\nQuando você inicia uma conversa, tratamos nome, e-mail, assunto, produto relacionado (se informado) e mensagens para encaminhar a pergunta à equipe adequada, responder e manter o histórico do atendimento. Um identificador privado fica armazenado neste navegador para permitir que você volte à conversa. Não informe senhas, dados completos de cartão ou códigos de autenticação no chat. O atendimento é realizado por pessoas; especialistas de IA estão apenas planejados. Se perder o acesso ao navegador, escreva para atendimento@ticketrio.com.br para solicitar assistência. Você pode exercer seus direitos de privacidade pelo canal indicado nesta política.',
  body_en = body_en || E'\n\n## Chat support\n\nWhen you start a conversation, we process your name, email, subject, related product (if provided) and messages to route your question to the appropriate team, respond and retain the support history. A private identifier is stored in this browser so you can return to the conversation. Do not share passwords, full card details or authentication codes in chat. Support is handled by people; AI specialists are only planned. If you lose browser access, email atendimento@ticketrio.com.br for assistance. You may exercise your privacy rights through the contact channel in this policy.',
  version = version + 1, updated_at = now()
where slug='politica-de-privacidade' and status='published' and approval_status='approved';
