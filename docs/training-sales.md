# Vendas para treinamento

O seed `scripts/seed-training.mjs` cria 12 vendas com oito clientes inteiramente fictícios, ingressos, camarotes, transfers e passeios. Inclui documentos demonstrativos, contatos inválidos, endereço fictício, participantes, datas, acessibilidade, pagamentos simulados, logística e histórico. Os valores são didáticos e não representam preços do catálogo.

Todas as linhas possuem `is_training: true` e `training_batch: training-2026-10`. Não há cobrança, comunicação externa, emissão de ingresso nem alteração de estoque. O seed é idempotente por ID e não sobrescreve vendas existentes. A receita aprovada e o relatório de mídia excluem treinamento.

O acesso da equipe é separado da conta principal, usando o alias Gmail `raulbeguelini29+treinamento@gmail.com`. É administrador completo, com senha aleatória forte armazenada exclusivamente em arquivo local privado. Uma segunda execução preserva a senha existente. Revogue esse acesso em Equipe e acessos quando o treinamento terminar; prefira convites individuais para uso contínuo.

Execução autorizada, após backup:

```
MONGODB_DB=ticketrio node --env-file=/caminho/privado.env scripts/seed-training.mjs /caminho/privado/acesso.txt
```

Use `ticketrio_preview` para homologação. Não versione o arquivo de acesso. Para remover as simulações no futuro, faça backup e remova apenas registros com o lote indicado nas coleções orders, order_items, customer_profiles, payments, deliveries e order_events. Nunca faça limpeza genérica de coleções.

A nova seção Vendas é somente leitura: busca por cliente/pedido/experiência, filtros de pagamento e tipo, ficha completa em painel com diálogo nativo e navegação de teclado. O catálogo continua sob consulta e pagamentos online/e-mails dependem das configurações previamente documentadas; treinamento não ativa esses provedores.
