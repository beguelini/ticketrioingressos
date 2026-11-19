# TicketRio: Supabase e Pagar.me

Projeto: `beguelini/ticketrioingressos`, Vercel `ticketrioingressos`, domínio `https://ticketrioingressos.com.br`. Supabase `mgnyisszebmxlvxsaghz` (us-west-2). Não executar estes procedimentos no Sail in Rio.

## Banco e acessos

O backend mantém a API e a autenticação existentes (scrypt, sessões HttpOnly e permissões administrativas). Os dados são persistidos no PostgreSQL do Supabase, em 43 tabelas privadas com documentos JSONB, índices e transações SQL. Supabase Auth e sua API pública não são usados: esta migração preserva contas, senhas, identificadores e sessões, sem conversão de hashes para outro provedor de autenticação.

Produção usa schema `ticketrio` e role `ticketrio_app`; Preview usa `ticketrio_preview` e `ticketrio_preview_app`. As roles não têm DDL, bypass de RLS nem acesso ao outro schema. `anon`, `authenticated` e `public` não têm acesso às tabelas. As migrations devem ser aplicadas por administração, nunca pela role do runtime. Arquivos continuam no backend autenticado, com validação de assinatura e conteúdo; não foi criado bucket público.

Na Vercel, configurar `DATA_BACKEND=supabase`, `SUPABASE_DB_URL` (secreto) e `SUPABASE_DB_SCHEMA` no ambiente correspondente. Usar session pooler porta 5432. O cliente verifica TLS com os certificados oficiais Supabase 2021/2025 em `server/postgres/supabase-ca.crt`; não desabilitar validação TLS. As funções executam em pdx1, próximo ao banco. Nenhuma credencial administrativa de Supabase é necessária no runtime ou no navegador.

Antes de importar, fazer backup com `scripts/backup-mongodb.mjs`. `scripts/migrate-to-supabase.mjs SOURCE_ENV TARGET_ENV OUTPUT_DIRECTORY` exige alvo vazio, importa em uma transação e compara SHA-256 de cada tabela. Preview não recebe sessões, links de recuperação, limites de tentativas ou contatos comerciais. `scripts/backup-supabase.mjs OUTPUT_DIRECTORY` produz snapshot consistente e checksums; executar com arquivo de ambiente privado via `node --env-file=...`. Backups contêm dados pessoais e hashes: manter acesso restrito. Tokens e sessões expirados são recusados nas leituras; a remoção física das linhas expiradas pode ser realizada na manutenção, sem afetar a expiração de acesso.

MongoDB e seus backups são preservados para rollback. Retornar `DATA_BACKEND=mongodb` exige reconciliar antes quaisquer vendas, estoque, clientes e alterações já gravadas no Supabase; não fazer rollback cego após novas vendas.

## Pagamentos

Somente no servidor de **Production** da Vercel: `PAGARME_SECRET_KEY`, `PAGARME_ACCOUNT_ID`, `SITE_URL=https://ticketrioingressos.com.br`. A chave pública não é necessária no checkout hospedado. Preview não deve herdar chaves financeiras reais.

Na Pagar.me, em Configurações → Webhooks, cadastrar:

`https://ticketrioingressos.com.br/api/pagarme-webhook`

Eventos: `order.paid`, `order.payment_failed`, `order.canceled`, `charge.refunded`. Preservar outros destinos existentes da conta. Confirmar que o destino foi salvo e, depois do primeiro pagamento real autorizado, verificar entrega HTTP 200 no painel.

O servidor calcula preços e reserva estoque em transação antes de criar um link de pagamento único, com expiração de 30 minutos, cartão e Pix. Webhooks conferem conta e consultam novamente o pedido na API autenticada da Pagar.me: valor, moeda e referência precisam corresponder ao pedido local. Eventos duplicados não consomem estoque novamente. Pagamentos tardios, após liberação da reserva, ficam em revisão manual; nenhum ingresso oficial é inventado. Entrega depende de confirmação do fornecedor. Somente dados do pagador e referências do pagamento são guardados; dados de cartão permanecem na Pagar.me.

Após publicar e confirmar o webhook, executar `scripts/activate-commerce.mjs --webhook-confirmed` com o ambiente privado de produção e as credenciais Pagar.me. O script confere o runtime Supabase, termos aprovados e opções com preço e estoque antes de ativar. Não usar a flag sem confirmação do cadastro do webhook.

## E-mails pendentes

Para confirmações, recuperação e convites por e-mail: criar conta Resend, adicionar um domínio de envio, publicar os registros DNS indicados e esperar a verificação. Criar uma API key de envio e configurar `RESEND_API_KEY` e `EMAIL_FROM` no projeto Vercel TicketRio, somente no servidor; fazer novo deploy. Validar um envio autorizado e a entrega na caixa de entrada. Sem isso, não prometer envio automático de recuperação; o checkout de visitante e a sessão do pedido continuam disponíveis. A equipe pode usar os logins administrativos já existentes, preservados na migração.

## Validação

`npm run lint`, `npx tsc -b --pretty false`, `npm run test:run`, `npm run build`. Integrações reais de banco: `TICKETRIO_INTEGRATION=1 node --env-file=PRIVATE_TEST_ENV node_modules/vitest/vitest.mjs run`; exigem role de testes e criam somente schemas aleatórios `ticketrio_test_*`. O gateway é simulado nesses testes, sem cobrança. Um link real em modo rascunho, cancelado após criação, verifica a API sem movimentar dinheiro; não comprova aprovação financeira nem entrega de webhook real.
