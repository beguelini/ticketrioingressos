# Operação MongoDB — TicketRio

## Ambientes

Projeto Vercel: **ticketrioingressos**, repositório **beguelini/ticketrioingressos**. Não usar projetos Sail in Rio/SailCore.

| Variável | Production | Preview/Development |
| --- | --- | --- |
| MONGODB_URI | Credencial Atlas privada com readWrite apenas em ticketrio | Credencial separada com readWrite apenas em ticketrio_preview |
| MONGODB_DB | ticketrio | ticketrio_preview |
| SITE_URL | https://ticketrioingressos.com.br | URL canônica usada nos links do ambiente |
| RESEND_API_KEY | Chave do domínio TicketRio | Chave de homologação |
| EMAIL_FROM | Remetente de domínio verificado | Remetente autorizado para testes |
| PAGARME_SECRET_KEY / PAGARME_ACCOUNT_ID | Somente após homologação | Credenciais de teste |
| CRON_SECRET | Secret próprio do ambiente | Secret de homologação |

`VERCEL_URL` e `VERCEL_BRANCH_URL` permitem as origens exatas do próprio deploy e do alias da branch. Outras origens só são aceitas quando cadastradas em `ALLOWED_ORIGINS`, separadas por vírgula; não usar `*`. As variáveis `VITE_*` são públicas e nunca recebem URI MongoDB, senha ou token.

No Atlas, autorize a rede de saída da hospedagem conforme seu plano. Não abra o cluster indiscriminadamente. Use usuários com acesso apenas ao banco do respectivo ambiente, TLS e uma política de backups do Atlas adequada à operação. As credenciais locais fornecidas pelo usuário serviram ao bootstrap; substitua por credenciais específicas de aplicação antes da produção.

## Backup e restauração

O código anterior está preservado no histórico Git. Este é um banco novo: não há dados Supabase a migrar.

Antes de alterações operacionais, interrompa escritas da aplicação para ter consistência entre coleções e execute:

```sh
npm run db:backup -- /CAMINHO/PRIVADO/backup-AAAAMMDD-HHMM
```

O backup inclui todas as coleções, binários dos uploads, contas, hashes, sessões e índices, em EJSON, com manifesto de contagens e SHA-256. Contém dados sensíveis; mantenha-o fora do repositório, com armazenamento criptografado. A pasta deve ser nova. Este export não substitui snapshots/recuperação pontual do Atlas e carrega uma coleção por vez em memória.

Para restaurar em **um banco novo e vazio**, configure uma URI de destino autorizada e um nome diferente do banco original:

```sh
node --env-file=.env.restore.local scripts/restore-mongodb.mjs /CAMINHO/PRIVADO/backup-AAAAMMDD-HHMM
```

O script verifica hashes e contagens e recusa destino não vazio ou de mesmo nome que a origem. Valide login, catálogo, pedidos e imagens na base restaurada antes de apontar um ambiente para ela. Não apague o banco original durante rollback.

## E-mail e primeiro acesso

1. Crie uma API key no Resend usado pela TicketRio.
2. Verifique o domínio remetente no Resend pelos registros DNS indicados pelo serviço.
3. Cadastre `RESEND_API_KEY` e `EMAIL_FROM` nos ambientes do projeto Vercel TicketRio.
4. Gere um link pelo comando `db:admin` com `ADMIN_SETUP_URL` apontando ao ambiente correto e abra o arquivo privado gerado.
5. Homologue confirmação, recuperação e convite com um endereço controlado antes de liberar cadastro público.

## Pagamento e expiração

As rotas de compra atuais continuam levando ao atendimento por WhatsApp. Para ativar compra online, é necessário aprovar uma mudança específica de navegação, termos, estoque e preços, além de testar a API de checkout.

O webhook Pagar.me usa `/api/pagarme-webhook`; o backend reconsulta o pedido no provedor, confere conta, moeda, montante, vínculo com pedido local e idempotência. Nenhuma aprovação depende do status enviado pelo navegador ou pelo webhook sem reconsulta. Credenciais faltantes mantêm a cobrança bloqueada.

A expiração de reservas ocorre antes de um novo checkout; para operação online contínua, agende POST `/api/backend` com JSON `{"kind":"cron"}` e `Authorization: Bearer CRON_SECRET` a cada poucos minutos. Nenhum cron externo foi contratado ou ativado por esta alteração. Não envie o secret no corpo ou URL.

## Publicação

Branch → commit → push → PR → Vercel Preview → teste do usuário → aprovação → merge → Production automático. Não usar `vercel --prod` ou promover Preview sem aprovação.

Antes de merge, confirmar:

- Login, recuperação e convite com e-mail real homologado.
- Usuário comum sem acesso à equipe, financeiro ou dados de outros clientes.
- Catálogo público, upload JPEG/PNG/WebP, edição do painel e mensagens de atendimento.
- URI e usuário Atlas exclusivos para cada ambiente; rede e backup configurados.
- Compra por WhatsApp preservada e pagamento online desativado até homologação.

Para rollback de código, reverta o commit/PR ou restaure a versão anterior pela operação aprovada. Como a versão anterior dependia de um Supabase inexistente, ela restaura apenas a interface antiga, não um backend funcional. Preserve o MongoDB e seus backups.

## Bloqueio de rede observado na preparação

Na verificação de 20/10/2026, o Atlas permitia apenas o IP local do operador. A conexão local funcionou; o build Vercel falhou ao gerar o sitemap com `ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR`. O Preview não está funcional até autorizar a rede da hospedagem.

O usuário de bootstrap fornecido tem `atlasAdmin` em todos os recursos. Antes de autorizar acesso externo, crie credenciais de aplicação separadas, com `readWrite` apenas no banco de cada ambiente, e substitua a URI do Preview e da futura produção.

Uma opção para preservar a restrição por rede é usar Static IPs da Vercel e cadastrar somente os IPs apresentados por ela no Atlas. Como o build consulta o banco para o sitemap, habilite também **Use Static IPs for builds**. A documentação da Vercel informa US$ 100/mês por projeto, mais transferência e plano elegível; nenhuma contratação foi feita. Confira a condição atual em https://vercel.com/docs/networking/static-ips antes de contratar. A abertura global `0.0.0.0/0` não foi feita.

## Integração nativa instalada

Após o aceite do usuário, foi provisionado o recurso MongoDB Atlas nativo `ticketrio`, no plano Free, região São Paulo (`gru1`), vinculado ao projeto Vercel `ticketrioingressos`. A função Vercel também usa `gru1`, evitando viagens de rede entre regiões. A integração fornece `MONGODB_URI` aos três ambientes. Production usa `MONGODB_DB=ticketrio`; Preview/Development usam `ticketrio_preview`. O banco anterior foi preservado e recebeu backup antes da cópia.

O fluxo nativo configura o acesso de rede e seu usuário de aplicação conforme o provedor: entrada `0.0.0.0/0`, autenticação SCRAM/TLS e função `readWriteAnyDatabase` para os bancos não sistêmicos do cluster nativo. Essa configuração foi informada ao usuário no aceite. Não foi contratado Static IPs. A URI administrativa do cluster anterior foi removida da branch Preview; o deploy usa a credencial provisionada pela integração. Não adicionar outros projetos ou dados de terceiros a esse cluster compartilhado entre os ambientes TicketRio.

Para copiar uma instalação existente a outro cluster nativo vazio, com backup prévio e sem escritas concorrentes:

```sh
node scripts/migrate-native.mjs /CAMINHO/PRIVADO/origem.env /CAMINHO/PRIVADO/destino.env
```

O script exige hosts diferentes e destino vazio, preserva documentos e índices e não apaga a origem. Arquivos de configuração contêm segredos e ficam fora do Git. Em Preview, os links de autenticação usam o endereço do próprio deploy; Production usa `SITE_URL`.
