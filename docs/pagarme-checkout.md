# Pagar.me — backend MongoDB

As rotas de compra atuais continuam direcionando ao atendimento por WhatsApp. Não há venda online ativa.

A API Node.js implementa cotação, reserva transacional/idempotente e link hospedado do Pagar.me, com cartão à vista e Pix. `PAGARME_SECRET_KEY` e `PAGARME_ACCOUNT_ID` são variáveis exclusivas do servidor Vercel TicketRio. Sem credenciais, produtos online, termos aprovados e `commerce_enabled=true`, o checkout fica bloqueado.

O webhook `/api/pagarme-webhook` reconsulta o pedido no provedor, compara conta, vínculo, moeda e total e registra o evento uma vez. Eventos pendentes não rebaixam pagamentos aprovados. Pagamentos recebidos após liberação de estoque ficam em revisão manual, sem entrega automática. Cancelamento ou falha libera reservas; reembolso não repõe estoque automaticamente.

A expiração pode ser acionada por chamada autenticada de cron, descrita em `mongodb-operations.md`. Nenhum cron foi ativado. Não habilite a navegação de compra online antes de homologar estoque concorrente, repetição de checkout, aprovação, falha, expiração e reembolso usando credenciais de teste do provedor.
