# Ticket Rio

Loja Vite + React + TypeScript para a Ticket Rio, conectada ao Supabase. A interface pública, conta e painel usam o mesmo projeto, com autorização no PostgreSQL via RLS. A venda online fica bloqueada até a operação aprovar produtos, termos, estoque e um gateway.

## Estado operacional

- Site público: home, famílias de produtos, filtros, detalhe, conteúdo institucional, contato, login e conta.
- Catálogo novo: somente registros **publicados** de `store_products`; produtos e variantes são entidades separadas.
- Registros de referência (camarotes, tours, transfers, metrô, camiseta e datas de 2027) foram criados como **rascunhos**, sem preços nem estoque fictícios.
- Carrinho: persistência local, reconciliação com a conta e cotação em centavos pelo banco. O cliente não informa o preço à função de cotação.
- Checkout: exibe a cotação e informa indisponibilidade de pagamento. **Não cria pedido, reserva, cobrança nem ingresso.**
- Pedido, reserva de estoque, pagamentos, entregas, transfer, auditoria e notificação: esquema e políticas criados. `private.reserve_order` contém bloqueio transacional, idempotência por chave e validação de termos; não é exposta à API pública e permanece desativada por `commerce_enabled=false`. Um webhook real, expiração agendada e gateway não estão conectados.
- Simulador de pagamento: contrato isolado em `server/paymentProvider.ts`, permitido somente em desenvolvimento local e sem transação financeira.
- Chat do site: explicitamente simulado; atendimento real pelo e-mail/WhatsApp de referência, sujeito à confirmação da Ticket Rio.

## Ambiente

Instale Node.js compatível com Vite 8 e execute:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Preencha apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com valores públicos para o site. Variáveis `VITE_*` entram no JavaScript enviado ao navegador. A chave secreta ou `service_role` jamais deve ter esse prefixo.

`npm run lint`, `npm run test:run` e `npm run build` verificam o projeto. O build gera `dist` e um sitemap com produtos publicados no momento do build. Após publicar novos produtos, faça novo deploy para atualizá-lo.

## Supabase

Execute as migrations de `supabase/migrations` na ordem. A primeira migration antiga contém produtos de demonstração; `commerce_foundation` os retira da leitura pública e `remove_legacy_mock_catalog` elimina a tabela antiga após a publicação da nova interface. Em instalações novas, todas devem ser aplicadas juntas antes de expor o site.

Configure no Supabase Auth:

- URL principal: domínio da loja.
- URLs de redirecionamento: `/conta` e `/redefinir-senha` dos domínios de produção e Preview usados.
- Confirmação de e-mail e templates de autenticação conforme a operação.

As políticas permitem leitura anônima somente de conteúdo publicado. Perfis e pedidos são isolados por `auth.uid()`. Papéis internos residem em `staff_roles` e não podem ser atribuídos pelo próprio usuário comum. Os buckets `ticket-rio-media` (imagens públicas) e `ticket-rio-documents` (documentos privados) têm restrição de MIME e tamanho; uploads de imagens no painel usam o primeiro.

### Primeiro administrador

1. Crie uma conta pelo cadastro normal e confirme o e-mail.
2. No SQL Editor do **projeto Ticket Rio** do Supabase, confira o UUID pelo e-mail:

```sql
select id, email, email_confirmed_at from auth.users where email = 'ADMIN_EMAIL';
```

3. Após confirmar a identidade, execute:

```sql
insert into public.staff_roles(user_id, role)
select id, 'administrator' from auth.users
where email = 'ADMIN_EMAIL' and email_confirmed_at is not null;
```

Use o e-mail real do administrador no SQL Editor. Não coloque o UUID, a chave `service_role` ou uma rotina de criação de admin no frontend. O painel fica em `/admin`.

## Conteúdo e importação

Os módulos do painel permitem editar rascunhos de categorias, produtos, variantes, eventos, datas, escolas, desfiles, páginas, FAQ, banners, blocos da home e rotas de transfer. Alguns módulos financeiros/operacionais são somente leitura até existir um fluxo de pagamento e entrega conectado.

Importação CSV de produtos: `sku,slug,name_pt,kind,summary_pt`. Importação CSV de variantes: `sku,product_id,name_pt,price_cents,currency`. O painel mostra prévia, valida colunas, SKU duplicado e exige confirmação. Não sobrescreve registros existentes. Produtos entram como rascunhos sob consulta; variantes entram com estoque zero e indisponíveis. Imagens podem ser enviadas ao Storage pelo editor de produtos.

Páginas de privacidade, termos e cancelamento são rascunhos com aprovação pendente. A publicação definitiva exige revisão jurídica/comercial; o site público mostra aviso enquanto isso.

## Publicação na Vercel

O projeto usa `npm run build` e saída `dist`. Configure na Vercel da Ticket Rio as três variáveis públicas de `.env.example` necessárias à interface; `VITE_SITE_URL` serve ao sitemap. Nunca configure segredos como `VITE_*`.

Fluxo: branch → PR → Preview → revisão → merge na `main` → Production automático. Confirme domínio, HTTP, rotas diretas, login, acesso negado ao painel para usuário comum e catálogo publicado. Redirecionamentos permanentes para URLs antigas ficam em `vercel.json`.

## Pendências externas para venda real

1. Escolher e contratar gateway (ASAAS, Mercado Pago, Pagar.me ou outro), homologar API e webhook autenticado, processar eventos duplicados/fora de ordem e reembolsos. `PAYMENT_*` são placeholders de servidor; a função de reserva **não** deve ser ativada antes disso.
2. Definir regra operacional de expiração das reservas e agendar `private.release_expired_reservations()` com credenciais de servidor. Nenhum agendamento está ativo.
3. Aprovar catálogo, preços, estoque, datas oficiais, entrega, fornecedores, produtos de camarote, conteúdo institucional e políticas. Os dados do site antigo são referências, não confirmação.
4. Configurar e autenticar domínio no Resend; implementar gatilhos transacionais e deduplicação antes de enviar e-mails. `RESEND_*` não estão conectadas.
5. Confirmar telefone e, para automação, credenciais/consentimento/templates da WhatsApp Business Platform. O site oferece apenas link de atendimento.
6. Documentar a operação de entrega de ingressos oficiais (incluindo eventual Quentro). O site não gera QR Code, não trata comprovante como ingresso e não promete integração com fornecedor.
7. Para SEO completo de produtos publicados após o deploy, atualizar o sitemap por novo build; páginas do SPA não possuem HTML pré-renderizado individualmente. GTM/Meta ficam aguardando IDs e consentimento aprovado.

Não ative `store_settings.commerce_enabled` enquanto estes itens de pagamento e operação estiverem pendentes.
