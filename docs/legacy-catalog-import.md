# Catálogo de referência TicketRio

O manifesto `data/legacy-catalog-2026-10-01.json` preserva 39 produtos coletados do site antigo. Produtos indisponíveis na coleta não foram inventados. Os preços de origem, quando presentes nos atributos, são apenas referência: a variante ativa começa sem preço, indisponível e com estoque zero. A venda é sob consulta pelo atendimento atual.

Execute `npm run db:init` com o MongoDB de destino configurado. O comando usa SKU/slug e índices únicos para não duplicar produtos, nem sobrescrever edições. Imagens editoriais de ingressos e imagens locais de camarotes, tours e transfers estão em `public/images`; não há dependência de Storage externo. Confira os dados e a disponibilidade com a equipe antes de publicar alterações comerciais.
