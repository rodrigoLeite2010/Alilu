# Implementação do Alilu Desapego

## Resumo

Foi criada uma área de classificados gratuitos para produtos usados. Usuários autenticados podem preparar anúncios, enviar fotos, submeter para moderação e acompanhar visualizações e contatos. A negociação e a entrega continuam diretamente entre comprador e vendedor; o site não processa pagamento.

## Funcionalidades

- Listagem pública responsiva com pesquisa textual, filtros por categoria, subcategoria, estado, cidade, conservação, marca, preço e troca, ordenação e paginação.
- Formulário para rascunho ou submissão, com preço atual e anterior, localização aproximada, WhatsApp privado, declaração de titularidade e consentimento.
- Até 15 imagens por anúncio por padrão, foto principal/reordenação, prévia, compressão e conversão para WebP, remoção de metadados e limpeza de arquivos órfãos.
- Link opcional de vídeo/Short/live do YouTube, validado e normalizado com o mesmo utilitário de Imóveis, prévia no formulário e player sem cookies na página do produto.
- Categoria configurável `Veículos`, com Carros, Motos, utilitários, vans, caminhões e peças; formulário oferece ano, quilometragem, combustível e câmbio, e exige marca/modelo/ano para anunciar veículo.
- Página pública individual, galeria ampliada, produtos semelhantes, favoritos, compartilhamento, denúncia e contato pelo WhatsApp com mensagem preparada pelo comprador.
- Painel de anúncios próprios: editar, pausar, reativar com análise, marcar vendido, remover e ver métricas.
- Moderação administrativa com aprovação/rejeição, remoção, denúncia, suspensão de vendedor, limites/categorias configuráveis, indicação de possíveis duplicados e histórico.
- Expiração de anúncios após 90 dias, passando a pausados para o vendedor confirmar disponibilidade e pedir nova análise.
- Integração ao menu, páginas de categorias/ferramentas, painel administrativo, termos e política de privacidade.

## Rotas

| Caminho | Acesso | Indexação |
| --- | --- | --- |
| `/desapego` | Público | Indexável sem filtros; parâmetros de busca recebem `noindex,follow` e canonical para a listagem principal |
| `/desapego/[slug]` | Público para anúncio publicado/vendido | Publicado indexável; vendido `noindex,follow`; somente anúncios publicados ativos entram no sitemap |
| `/desapego/anunciar` | Usuário autenticado | `noindex` |
| `/desapego/meus-anuncios` | Usuário autenticado | `noindex` |
| `/desapego/editar/[id]` | Proprietário autenticado | `noindex` |
| `/desapego/favoritos` | Usuário autenticado | `noindex` |
| `/admin/desapego` | Administrador | `noindex` e verificação de sessão administrativa |
| `/api/desapego/*` | Controlado por sessão/ação | JSON sem cache; não entra em sitemap |
| `/desapego/sitemap.xml` | Público | Somente URLs canônicas de anúncios publicados e ativos |

## Arquitetura e persistência

- O módulo segue os padrões de autenticação, Postgres/Neon, Vercel Blob, administração e UI do portal de imóveis.
- A migration aditiva `db/migrations/0048_desapego.sql` cria `desapego_settings`, `desapego_advertisers`, `desapego_ads`, `desapego_images`, `desapego_favorites`, `desapego_reports`, `desapego_history` e `desapego_rate_limits`, além de índices e funções transacionais para salvar, reservar fotos e mudar estado. `db/migrations/0049_desapego_veiculos.sql` adiciona a categoria Veículos preservando outras categorias que a administração tenha configurado.
- Informações públicas ficam em JSONB validado no servidor. Telefone e CEP são criptografados e não aparecem na projeção pública; o telefone é revelado apenas à ação de contato via WhatsApp. O endereço completo não é mostrado.
- Imagens são mantidas no Blob e não no banco. É reutilizado `processImage` do módulo Imóveis para redimensionamento, WebP e remoção de metadados. A migration armazena posição, URL, miniatura, bytes e marcação para limpeza.
- Limites iniciais: 10 anúncios por usuário, até 15 fotos por anúncio e 500 MB totais, configuráveis no painel administrativo. Não foi adicionado provedor nem API paga.

## Segurança e moderação

- O servidor valida autenticação, origem das mutações, proprietário, UUID, estados válidos, concorrência por revisão, consentimento, preço, categorias, arquivos e tamanho máximo do corpo.
- SQL usa parâmetros; há limites de frequência por usuário/IP e limites globais de upload/armazenamento.
- Novos anúncios e edições são enviados para análise. Somente anúncios publicados são listados publicamente; vendedores suspensos e usuários desativados são ocultados.
- Denúncias repetidas são limitadas e ficam disponíveis para análise administrativa. Duplicidade é indicada por fingerprint; a publicação continua sujeita à revisão humana.
- O formulário proíbe e registra a declaração contra itens ilegais, falsificados ou roubados. A verificação de autenticidade/legalidade é operacional e feita na moderação; não há detector automático confiável.
- Não há selo de vendedor verificado. Não há mensagens enviadas automaticamente: o usuário inicia a conversa pelo WhatsApp.

## SEO

- Metadata individual, canonical absoluta em `https://alilu.com.br`, Open Graph/Twitter com primeira foto, dados estruturados `Product` e `Offer`, links internos e slug estável.
- `/sitemap.xml` lista a categoria Desapego; `/desapego/sitemap.xml` lista anúncios publicados e ativos, sem duplicar a página da categoria.
- Filtros da listagem são `noindex,follow` e canonicalizam para `/desapego`. Anúncios vendidos permanecem visíveis para o comprador, mas são `noindex,follow` e removidos do sitemap. Rascunhos, pendentes, pausados, rejeitados, removidos e privados não têm página pública indexável.
- `robots.txt` desautoriza áreas privadas/admin/API. `robots.txt` é orientação para crawlers; a proteção real depende das sessões e verificações do servidor.

## Migration e publicação

Nenhuma migration foi executada, nenhum dado foi criado no banco remoto e nada foi publicado em produção.

Antes de habilitar a funcionalidade:

1. Revise e aplique, em ordem, `db/migrations/0048_desapego.sql` e `db/migrations/0049_desapego_veiculos.sql` no banco correto, usando o procedimento operacional já adotado pelo projeto.
2. Confirme no ambiente de preview que Vercel Blob e `INSTAGRAM_TOKEN_ENCRYPTION_KEY` já estão configurados (o módulo reutiliza ambos); não crie segredos novos no repositório.
3. Publique o código em preview e valide cadastro, upload, análise, publicação, contato, remoção e execução do cron.
4. Só depois da validação, decida separadamente se autoriza publicação em produção.

A rota cron já existente de limpeza chama agora também a limpeza do Desapego e expira anúncios vencidos. Verifique que o cron da Vercel continue apontando para `/api/cron/imoveis` e com a autorização já usada para limpeza de arquivos.

## Testes, custos e pendências

- Testes automatizados adicionados ao modelo e integração Postgres: validação de submissão/consentimento/fotos, categorias, casas decimais, filtros, slugs, persistência, moderação, privacidade, autorização, duplicidade, concorrência e estados de anúncio.
- Verificações desta implementação e da extensão de vídeo/veículos: `npx tsc --noEmit`, `npm run build`, ESLint focado e testes focados (`426 passed` nos testes de Desapego, SEO/robots e índice administrativo). O build incluiu as rotas do módulo e `/desapego/sitemap.xml`.
- A suíte completa foi executada na implementação inicial: `366 passed`, `46 failed`, `1 skipped` em 389 arquivos de teste, com duração aproximada de 16 minutos. Houve timeouts sob concorrência elevada e falhas em testes de áreas preexistentes (incluindo fluxos Instagram e testes de interface). As verificações relevantes ao Desapego/SEO/admin foram ajustadas e passaram isoladamente; a suíte completa deve ser reexecutada em ambiente com capacidade e concorrência controladas antes da integração.
- O lint global foi iniciado na implementação inicial, mas interrompido após longa execução sem saída; o ESLint focado nesta extensão terminou sem erros.
- Custo adicional de infraestrutura previsto: nenhum serviço pago novo. O uso de Blob e banco compartilha os limites/plano atuais da Vercel/Neon; o teto de 500 MB configurado não garante que o contrato do provedor não cobre armazenamento/transferência excedentes. Monitorar consumo real.
- A assistência opcional de IA para descrição não foi adicionada: exigiria integração/custo e revisão contra invenção de atributos. O fluxo principal não depende dela.
- O bloqueio de categorias proibidas depende de termos, declaração e moderação humana; recomenda-se adicionar instruções internas de moderação e um processo de resposta às denúncias antes de abrir ao público.
- Testes de responsividade visual e fluxos reais com Blob/WhatsApp precisam ser feitos em preview com contas de teste e migration aplicada.
