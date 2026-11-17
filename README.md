# Ticket Rio

Loja e painel Vite + React + TypeScript, com API Node.js na Vercel e MongoDB Atlas. Nenhum serviço do Supabase é necessário.

## Desenvolvimento

Node.js 24 ou superior:

```sh
npm ci
cp .env.example .env.local
# Preencha MONGODB_URI, MONGODB_DB e SITE_URL no arquivo local.
npm run db:init
npm run dev:api
# Em outro terminal:
npm run dev
```

O Vite encaminha `/api` à API local na porta 3001. Use `SITE_URL=http://localhost:5173` localmente. Credenciais nunca recebem prefixo `VITE_`. `.env.local` não é versionado.

## Primeiro administrador

```sh
npm run db:admin -- EMAIL_DO_ADMIN /CAMINHO/PRIVADO/primeiro-acesso.txt
```

O comando cria a conta e a função administrativa no servidor e grava um link de uso único, válido por uma hora, com permissão de arquivo 0600. Defina `ADMIN_SETUP_URL` como o endereço do Preview ou desenvolvimento que usará esse banco. Abra o link para definir uma senha de pelo menos 12 caracteres. Não há senha padrão, cadastro público de administrador nem chave administrativa no navegador. Reexecute o comando se o link expirar; não publique esse arquivo em Git, PR ou logs.

## Login administrativo `admin`

O painel `/admin` aceita `admin` ou e-mail, sempre com senha. O alias `admin` só autentica uma conta confirmada, ativa e com função `administrator`; remover essa função bloqueia o alias. Cadastro público não atribui nomes de usuário.

Para criar uma conta separada (sem alterar a conta principal), use um e-mail de recuperação controlado pela equipe e um arquivo privado fora do repositório:

```sh
node --env-file=/caminho/privado.env scripts/create-admin-login.mjs EMAIL_DA_EQUIPE /caminho/privado/acesso-admin.txt
```

O comando permite apenas `ticketrio` e `ticketrio_preview`, cria usuário e função em transação e grava uma senha aleatória em arquivo 0600. Se o e-mail ou o usuário `admin` já existir, aborta sem redefinir senhas. Não versione nem publique o arquivo de acesso. A recuperação continua usando o e-mail vinculado. Para rollback, remova o acesso em Equipe e acessos e reverta o PR.

## Funcionalidades

- Catálogo, categorias, variantes, estoque, páginas, políticas, banners, FAQ, blocos da home e desfiles editáveis no painel.
- Sessões em cookies HttpOnly/SameSite, Secure em produção; senhas com scrypt e salt individual; tokens persistidos apenas como hash, expiração e uso único.
- Cadastro com confirmação de e-mail, recuperação de senha, convite de equipe e revogação de sessões.
- Papéis administrador, comercial, operação, financeiro e marketing conferidos no servidor a cada requisição. Clientes só acessam seus próprios perfis, carrinhos, pedidos e entregas.
- CRM, histórico, investimento em mídia, relatório UTM e filas de atendimento humano por especialidade. Nenhuma IA responde automaticamente.
- Imagens JPEG, PNG e WebP até 2 MB armazenadas no MongoDB, com validação de assinatura binária. Documentos privados não têm acesso público. O painel atual envia imagens; não há upload público de documentos.
- Cotação com preços do servidor, reserva transacional de estoque, checkout Pagar.me e reconciliação de webhook consultando a API do provedor. Pagamento tardio após expiração exige revisão manual; o sistema não entrega ingresso automaticamente.

Carrinho e checkout estão disponíveis; os botões de compra respeitam `commerce_enabled`, preço positivo e estoque. Compradores podem concluir como visitantes, com nome e WhatsApp obrigatórios, em sessão HttpOnly separada de contas existentes. Atendimento e entrega são manuais via WhatsApp; e-mail não é necessário para comprar.

O manifesto `data/inventory-carnaval-2027.json` reproduz o PDF aprovado (120 combinações, 417 vagas, datas corrigidas para 2027 e lotes repetidos somados). `scripts/import-carnaval-stock.mjs PASTA_PRIVADA` faz backup e importa uma única vez com vendas suspensas e sem reservas ativas. Recupera somente preços históricos existentes; itens sem preço ficam em rascunho. Nunca reimporte o lote após vendas. `scripts/link-carnaval-dates.mjs PASTA_PRIVADA` vincula as seis datas do PDF; `scripts/prepare-commerce-notices.mjs PASTA_PRIVADA` recupera os avisos anteriores adaptados à operação atual, sem sobrescrever avisos já aprovados.

A ativação exige credenciais de produção, termos publicados, estoque importado e confirmação do novo webhook: `node --env-file=/caminho/privado.env scripts/activate-commerce.mjs --webhook-confirmed`. O script valida acesso à API da Pagar.me antes de liberar vendas. Sem essas condições, mantenha `commerce_enabled=false`.

## Banco e conteúdo inicial

`npm run db:init` cria coleções e índices e importa os textos/assuntos e o catálogo de referência versionados. Os inserts são idempotentes e não sobrescrevem edições existentes. Imagens usam arquivos locais do projeto; não dependem do antigo Storage. Conteúdo importado continua sujeito à revisão operacional. Nenhum pedido, pagamento ou cliente fictício é criado.

O inventário usa UUIDs de aplicação; `_id` fica interno. O contrato da API de consulta é fechado por coleção, campo, operação e papel. Não existe endpoint para executar MongoDB arbitrário. Campos de autenticação, funções da equipe e pagamentos não podem ser gravados pelo cliente genérico.

## E-mail

Configure `RESEND_API_KEY` e `EMAIL_FROM` de um domínio verificado da TicketRio. Sem essas duas configurações, cadastro, recuperação e convites por e-mail informam indisponibilidade; não simulam envio. O primeiro acesso pelo comando local funciona sem provedor de e-mail. Nenhuma senha ou token é exposto pela resposta de cadastro/recuperação.

## Vercel e operação

Veja [docs/mongodb-operations.md](docs/mongodb-operations.md) para ambientes, backup, restauração e checklist de publicação. Build: `npm run build`; saída: `dist`. A API é `api/backend.js` e deve ser entregue pela Vercel, nunca pelo servidor estático de Preview do Vite.

```sh
npm run lint
npx tsc -b --pretty false
npm run test:run
TICKETRIO_INTEGRATION=1 npm run test:run
npm run build
```

Os testes de integração usam uma base temporária `ticketrio_test_UUID`, isolada dos dados reais e removida ao terminar. Não alteram o banco `ticketrio`. Configure a URI local com permissão de criar essa base de teste, ou use credencial de homologação.
