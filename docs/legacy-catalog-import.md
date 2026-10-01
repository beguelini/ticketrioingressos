# Importação do catálogo público Ticket Rio

Coleta de 1º de outubro de 2026 em `https://www.lojaticketrio.com.br/`. O manifesto em `data/legacy-catalog-2026-10-01.json` registra 109 URLs descobertas: 39 páginas acessíveis e 70 URLs antigas do sitemap que retornaram HTTP 500. Nenhuma URL inacessível foi cadastrada como produto.

## Repetir sem duplicar

Com o Supabase CLI autenticado e vinculado ao projeto `xylnlwtinrahtvgacxoc`:

```sh
python3 scripts/build-legacy-import.py data/legacy-catalog-2026-10-01.json /tmp/ticket-rio-import.sql
supabase db query --linked --file /tmp/ticket-rio-import.sql --output json
```

O SQL gerado cria registros somente quando a URL de origem ainda não existe. Restrições únicas de SKU e slug fornecem uma segunda proteção. Produtos, variantes, preços, estoque e conteúdo existentes não são atualizados nem excluídos. Se uma URL existente, SKU ou slug conflitar, inspecione o registro no painel e resolva manualmente. A execução inicial e uma segunda execução foram verificadas com 39 produtos e 39 variantes, sem duplicação.

As 49 imagens distintas já estão no bucket público `ticket-rio-media`, sob caminhos estáveis pelo SHA-256 do arquivo. O manifesto contém URLs finais de imagem e a ordem de cada galeria. A repetição do SQL não reenvia imagens.

Todos os produtos importados estão publicados **sob consulta**. As 34 páginas que anunciavam compra online na origem continuam com estoque zero, variante indisponível e atendimento como única ação na nova loja. O preço anunciado foi preservado como referência, sujeito a confirmação. As outras cinco páginas já eram sob consulta. R$ 0,00 de tour foi convertido em preço nulo. Para habilitar compra online, a equipe comercial precisa validar preço, estoque, entrega, termos e pagamento.

Os seis registros de referência com equivalência temática (quatro tours e dois transfers) permaneceram como rascunhos independentes. Isso preserva qualquer edição manual já realizada. Os quatro outros registros de referência de camarotes também não foram alterados. Metrô e camisetas não tinham produtos públicos acessíveis na coleta.

O nome da página individual prevaleceu sobre slugs antigos: 33 URLs com anos antigos apontavam para anúncios de 2027. Três passeios continham instruções antigas sobre pandemia/cancelamento; o texto completo da origem está em `attributes.source_description_full`, enquanto a descrição pública omite essa seção até revisão comercial. `attributes` também armazena URL, data da coleta, preço original, imagens, opções de hotel e marcadores de validação.
