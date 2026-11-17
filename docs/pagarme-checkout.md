# Pagar.me — backend MongoDB

As rotas de compra atuais continuam direcionando ao atendimento por WhatsApp. Não há venda online ativa.

A API Node.js implementa cotação, reserva transacional/idempotente e link hospedado do Pagar.me, com cartão em até 12 parcelas conforme o valor e a aceitação do provedor, e Pix. `PAGARME_SECRET_KEY` e `PAGARME_ACCOUNT_ID` são variáveis exclusivas do servidor Vercel TicketRio. Sem credenciais, produtos online, termos aprovados e `commerce_enabled=true`, o checkout fica bloqueado.

O webhook `/api/pagarme-webhook` reconsulta o pedido no provedor, compara conta, vínculo, moeda e total e registra o evento uma vez. Eventos pendentes não rebaixam pagamentos aprovados. Pagamentos recebidos após liberação de estoque ficam em revisão manual, sem entrega automática. Cancelamento ou falha libera reservas; reembolso não repõe estoque automaticamente.

A expiração pode ser acionada por chamada autenticada de cron, descrita em `mongodb-operations.md`. Nenhum cron foi ativado. Não habilite a navegação de compra online antes de homologar estoque concorrente, repetição de checkout, aprovação, falha, expiração e reembolso usando credenciais de teste do provedor.

## Retomada com estoque finito

O projeto Supabase anterior foi removido. Reutilizar a configuração exige cadastrar `PAGARME_SECRET_KEY` e `PAGARME_ACCOUNT_ID` no servidor Vercel TicketRio e apontar o webhook para `https://ticketrioingressos.com.br/api/pagarme-webhook` (eventos order.paid, order.payment_failed, order.canceled e charge.refunded). Não usar a URL antiga do Supabase nem credenciais de teste em produção.

O checkout como visitante exige nome e WhatsApp, cria uma identidade temporária sem senha e sem função interna e nunca associa a compra a uma conta existente por e-mail ou telefone. Uma sessão HttpOnly permite acompanhar o pedido no mesmo navegador. O contato fica no snapshot do pedido, visível aos operadores autorizados. A entrega oficial permanece manual; o pagamento não emite ingresso.

A reserva dura 30 minutos. O link usa a mesma expiração absoluta e no máximo uma sessão/um pagamento. As reservas vencidas são liberadas transacionalmente ao consultar o catálogo e ao iniciar checkout; sem tráfego, não é necessário executar trabalho em segundo plano. Pagamento após liberação permanece em revisão manual.

Dados de estoque, preços recuperados e avisos são preparados com as vendas ainda desativadas. Produtos novos sem preço histórico ficam em rascunho. Os scripts de preparação recusam sobrescrever avisos já aprovados e impedem reimportar o mesmo lote de estoque. Backups privados são obrigatórios.
