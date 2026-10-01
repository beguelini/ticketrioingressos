-- Revise notices before payment is enabled; checkout requires purchase terms v3.
update public.store_pages set
  body_pt = replace(replace(replace(replace(body_pt,
    'A loja informa atualmente que as vendas online estão em preparação: montar um carrinho ou consultar um produto não cria reserva nem cobrança.',
    'Produtos marcados para compra online podem gerar uma reserva temporária após você aceitar os termos e iniciar o checkout. Montar um carrinho ou enviar uma consulta não gera cobrança.'),
    'e, caso a venda seja ativada, dados necessários à confirmação, pagamento, entrega e suporte do pedido.',
    'e dados necessários à confirmação, ao pagamento, à entrega e ao suporte do pedido, incluindo identificadores da transação e seu status. Os dados de cartão são inseridos diretamente no checkout hospedado pela Pagar.me; não os recebemos em nossos formulários.'),
    'Não tomamos decisões exclusivamente automatizadas que produzam efeitos jurídicos ou semelhantes sobre você nesta loja. Caso uma futura etapa de pagamento ou reserva amplie o tratamento, este aviso deverá ser atualizado antes da ativação.',
    'A Pagar.me e participantes da cadeia de pagamento podem realizar verificações automatizadas de segurança e antifraude. Caso uma transação seja recusada, você pode solicitar informações e revisão pelos canais do prestador e da Ticket Rio, conforme a legislação aplicável.'),
    'provedores de hospedagem, autenticação e banco de dados (Vercel e Supabase);',
    'provedores de hospedagem, autenticação e banco de dados (Vercel e Supabase); a Pagar.me e participantes necessários ao processamento, antifraude e liquidação do pagamento;'),
  body_en = replace(replace(replace(replace(body_en,
    'Online sales are currently being prepared: adding an item to the cart or enquiring about a product does not create a booking or charge.',
    'Products marked for online purchase may create a temporary reservation once you accept the terms and start checkout. Building a cart or sending an enquiry does not create a charge.'),
    'and, if sales are enabled, information needed to confirm, pay for, deliver and support an order.',
    'and information needed to confirm, pay for, deliver and support an order, including transaction identifiers and status. Card details are entered directly in Pagar.me hosted checkout, not in our forms.'),
    'This store does not make solely automated decisions with legal or similarly significant effects. This notice must be updated before a future payment or booking step expands processing.',
    'Pagar.me and payment-chain participants may perform automated security and anti-fraud checks. If a transaction is declined, you may request information and review through the provider and Ticket Rio channels, subject to applicable law.'),
    'hosting, authentication and database providers (Vercel and Supabase);',
    'hosting, authentication and database providers (Vercel and Supabase); Pagar.me and participants needed for payment processing, anti-fraud and settlement;'),
  version = version + 1, updated_at = now()
where slug='politica-de-privacidade' and version=2 and approval_status='approved';

update public.store_pages set
  body_pt = replace(body_pt, 'a função de pagamento ainda não está ativa.', 'o pagamento é processado no checkout hospedado pela Pagar.me.'),
  body_en = replace(body_en, 'online payment is not yet active.', 'payment is processed in Pagar.me hosted checkout.'),
  version = version + 1, updated_at = now()
where slug='politica-de-cookies' and version=1 and approval_status='approved';

update public.store_pages set
  body_pt = replace(body_pt,
    'As vendas online estão em preparação; navegar, criar conta, montar carrinho ou enviar consulta não gera cobrança ou ingresso.',
    'Navegar, criar conta, montar carrinho ou enviar consulta não gera cobrança ou ingresso. Para produtos habilitados para venda online, o pedido é reservado ao iniciar o pagamento; somente a confirmação do prestador constitui pagamento aprovado.'),
  body_en = replace(body_en,
    'Online sales are being prepared: browsing, registering, creating a cart or sending an enquiry does not create a charge or ticket.',
    'Browsing, registering, creating a cart or sending an enquiry does not create a charge or ticket. For products enabled for online purchase, an order is reserved when payment starts; payment is approved only after provider confirmation.'),
  version = version + 1, updated_at = now()
where slug='termos-de-uso' and version=1 and approval_status='approved';

update public.store_pages set
  body_pt = replace(replace(replace(replace(body_pt,
    E'## 1. Situação atual da loja\n\nA venda e o pagamento online ainda estão em preparação. Os produtos publicados podem estar sob consulta, sem estoque ou indisponíveis para compra imediata. Adicionar ao carrinho, visualizar um valor de referência ou enviar uma consulta não confirma preço, disponibilidade, reserva, pedido ou pagamento. Nenhuma cobrança é realizada pelo site nesta etapa.',
    E'## 1. Produtos e pedido\n\nProdutos marcados como disponíveis para compra online podem ser adquiridos pelo checkout. Produtos sob consulta exigem confirmação da equipe. Adicionar itens ao carrinho ou enviar uma consulta não gera cobrança. Ao aceitar estes termos e iniciar o pagamento, o sistema registra um pedido e reserva temporariamente a disponibilidade. O pedido só é confirmado após a Pagar.me informar pagamento aprovado. Confira o resumo, o preço final em reais e as condições do produto antes de seguir.'),
    'Quando a venda for habilitada, a página do produto e o resumo anterior à confirmação deverão apresentar, conforme o caso, fornecedor, data, horário, local, setor, quantidade, inclusões, restrições de acesso, preço total, taxas, meio de pagamento, forma e prazo de entrega e regras de cancelamento.',
    'A página do produto e o resumo anterior à confirmação apresentam as informações disponíveis sobre data, horário, local, setor, quantidade, inclusões, restrições de acesso e preço total. O checkout hospedado pela Pagar.me exibe os meios, parcelas e valor final antes da autorização de pagamento. Consulte as condições específicas e a entrega informadas para o produto.'),
    'Quando houver integração de pagamento, os meios disponíveis e qualquer parcelamento serão exibidos antes da confirmação. A aprovação poderá depender do prestador de pagamento e de verificações antifraude proporcionais.',
    'O pagamento é realizado no checkout hospedado pela Pagar.me. Cartão de crédito, Pix e boleto aparecem conforme a habilitação da conta e as regras da transação; as parcelas e o valor final são exibidos antes de pagar. A aprovação pode depender do prestador e de verificações antifraude proporcionais.'),
    'Um pedido só existirá após confirmação expressa nos canais de venda habilitados.', 'O pedido é criado ao iniciar o checkout; sua compra é confirmada somente após a aprovação do pagamento.'),
  body_en = replace(replace(replace(replace(body_en,
    E'## 1. Current store status\n\nOnline sales and payment are still being prepared. Published products may be enquiry-only, out of stock or unavailable for immediate purchase. Adding an item to the cart, viewing an indicative amount or sending an enquiry does not confirm a price, availability, booking, order or payment. The site does not currently charge you.',
    E'## 1. Products and orders\n\nProducts marked as available for online purchase may be bought through checkout. Enquiry-only products require confirmation by our team. Adding items to the cart or sending an enquiry does not create a charge. Once you accept these terms and start payment, the system records an order and temporarily reserves availability. An order is confirmed only after Pagar.me reports approved payment. Review the summary, final BRL price and product conditions before proceeding.'),
    'When online sales are enabled, the product page and pre-confirmation summary should show, as relevant, supplier, date, time, venue, sector, quantity, inclusions, access restrictions, total price, fees, payment method, delivery method and time, and cancellation rules.',
    'The product page and pre-confirmation summary show available information about date, time, venue, sector, quantity, inclusions, access restrictions and total price. Pagar.me hosted checkout shows payment methods, instalments and final amount before payment authorisation. Review the product-specific conditions and delivery information.'),
    'Once a payment integration exists, available payment methods and instalments will be shown before confirmation. Approval may depend on the payment provider and proportionate fraud checks.',
    'Payment takes place in Pagar.me hosted checkout. Credit card, Pix and boleto appear according to account availability and transaction rules; instalments and the final amount are shown before payment. Approval may depend on the provider and proportionate anti-fraud checks.'),
    'An order exists only after express confirmation through an enabled sales channel.', 'An order is created when checkout starts; the purchase is confirmed only after payment approval.'),
  version = version + 1, updated_at = now()
where slug='termos-de-compra' and version=2 and approval_status='approved';

update public.store_pages set
  body_pt = replace(body_pt,
    'O site ainda não realiza cobranças nem confirma reservas online. Portanto, selecionar um produto ou montar um carrinho não exige cancelamento nem gera reembolso. Se você contratou por outro canal da Ticket Rio, informe o número do pedido e o canal de compra ao solicitar atendimento.',
    'Selecionar um produto ou montar um carrinho não gera cobrança. Se você iniciou um pedido online, acompanhe seu status na área da conta. Para pedir cancelamento ou reembolso de uma compra efetivamente paga, informe o número do pedido. Se contratou por outro canal da Ticket Rio, informe também o canal de compra.'),
  body_en = replace(body_en,
    'The site does not currently charge customers or confirm online bookings. Selecting a product or building a cart therefore requires no cancellation or refund. If you contracted through another Ticket Rio channel, include your order number and sales channel when contacting us.',
    'Selecting a product or building a cart does not create a charge. If you started an online order, check its status in your account. To request cancellation or a refund for a paid purchase, provide the order number. If you purchased through another Ticket Rio channel, also identify that sales channel.'),
  version = version + 1, updated_at = now()
where slug='cancelamento-e-reembolso' and version=2 and approval_status='approved';
