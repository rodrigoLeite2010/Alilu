# Integração de imóveis de parceiros — Alilu

Data: 04/11/2026. Implementação local; **não houve deploy, migração no Neon nem importação real em produção**.

## Objetivo e princípio

Adicionar à categoria Imóveis uma segunda origem de anúncios — **imobiliárias e corretores parceiros autorizados** — sem alterar o cadastro direto. Os dois tipos convivem na mesma busca, nos mesmos cards e na mesma página de detalhe.

Regra central: **uma integração nunca apaga nem sobrescreve anúncio de outro proprietário**. Toda escrita da integração é feita por uma função SQL que só localiza anúncios pela chave *parceiro + código externo* e só grava com o dono técnico daquele parceiro.

## Auditoria do sistema existente (o que foi reaproveitado)

| Área | Existente | Uso pela integração |
| --- | --- | --- |
| Framework | Next.js 16.3.5 App Router, React 19, TypeScript, Tailwind 4 | Mesmo padrão de rotas, Route Handlers catch-all e páginas server |
| Banco | Neon/Postgres via `lib/db/client.ts` (driver HTTP, sem transação multi-statement) | Atomicidade por funções PL/pgSQL, como em `save_property` |
| Migrações | `db/migrations/*.sql` + `npm run db:migrate` (manual) | Nova migração aditiva `0050_imoveis_integracoes.sql` |
| Auth/permissões | Auth.js v5; admin por `ADMIN_EMAILS` (`getAdminSession`) | Toda a área é exclusiva do admin; mutações passam por `identity(request, true)` (origem + conta + quota) |
| Módulo Imóveis | `properties` (JSONB público + bloco privado cifrado), `property_images`, moderação, histórico, vencimento 90 dias, métricas | Imóveis importados **são linhas de `properties`** com um dono técnico por parceiro |
| Fotos | Vercel Blob prefixo `imoveis/`, `sharp`, limpeza por cron | Padrão: URLs do parceiro (bytes = 0). Opcional: cópia para o Blob com `processImage` |
| Contato | `activeContact` lê o WhatsApp do bloco cifrado | O bloco do importado guarda o WhatsApp **comercial autorizado** do parceiro |
| Suspensão | `property_advertisers.suspended` já oculta busca, página, contato e sitemap | Suspender/inativar parceiro reaproveita esse mecanismo |
| SEO | Slug + UUID, canonical, JSON-LD, sitemap próprio, robots | Sem mudança para diretos; importados com política de indexação por parceiro |
| Cron | `GET /api/cron/imoveis` com Bearer (`isStorageCleanupCronAuthorized`) | Novo `GET /api/cron/imoveis-integracoes`, mesmo segredo |
| Vercel | Functions com `maxDuration` 30–60 s; corpo ≤ 4,5 MB | Arquivos lidos no navegador e enviados em partes ≤ 3 MB; processamento em passos com orçamento de tempo |

## Arquitetura

```text
Navegador (admin)                         Servidor (Route Handlers)                 Postgres
------------------                        -------------------------                 --------
arquivo → parsers.ts (isomórfico)  ──►    /api/imoveis/integracoes/lotes/*   ──►    property_import_batches / _items
  CSV · XLSX · JSON · XML/VRSync           stage → fechar → validar (passos)          (staging, prévia, checkpoints)
mapeamento (MappingEditor)         ──►    fontes/:id/mapeamento              ──►    property_field_mappings (versões)
confirmar importação               ──►    importar → processar (passos)      ──►    upsert_partner_property()
                                                                                      → properties / property_images
Cron (15–60 min)                   ──►    /api/cron/imoveis-integracoes      ──►    property_external_listings
  safeFetch (SSRF) → parse → stage → validar → importar → ausências             property_duplicate_candidates
Visitante                          ──►    /imoveis/[slug] (mesma página)            property_integration_errors
                                          /imoveis/saida/[id] → anúncio original
```

Arquivos novos:

- `db/migrations/0050_imoveis_integracoes.sql`
- `lib/imoveis/integracoes/{fields,parsers,transform,safe-fetch,repository,sync}.ts`
- `app/api/imoveis/integracoes/[[...path]]/route.ts`, `app/api/cron/imoveis-integracoes/route.ts`, `app/imoveis/saida/[id]/route.ts`
- `app/admin/imoveis/integracoes/page.tsx`, `components/imoveis/integracoes/{IntegrationsPanel,ImportFlow,PartnerSource,api}.tsx|ts`
- `public/imoveis/modelos/*` (modelos para parceiros) e `scripts/generate-imoveis-modelos.ts`
- Testes: `__tests__/lib/imoveis-integracoes*.test.ts`, `__tests__/components/ImoveisIntegracoes.test.tsx`, fixture `__tests__/fixtures/imoveis-integracoes/openpyxl.xlsx`

Alterações pontuais em código existente (todas aditivas):

| Arquivo | Mudança |
| --- | --- |
| `app/imoveis/[slug]/page.tsx` | Bloco "Anúncio de parceiro" + "Ver anúncio original"; `noindex` para importados conforme política |
| `lib/imoveis/repository.ts` | `sitemapEntries` exclui importados com política `noindex` (diretos inalterados) |
| `app/robots.ts` e teste SEO | `Disallow: /imoveis/saida/` |
| `lib/admin/admin-links.ts` | Link "Integração de parceiros" |
| `.env.example` | Nota do cron (sem variável nova) |

## Modelo de dados (migração 0050, aditiva)

| Tabela | Finalidade |
| --- | --- |
| `property_partners` | Parceiro, dono técnico (`user_id`), dados comerciais, CPF/CNPJ cifrado, autorização (quem, quando, escopo, imagens, descrições, links, validade, condições, remoção, pedidos de remoção), política de fotos/SEO, domínios de imagens, limite de anúncios |
| `property_partner_sources` | Fontes: upload, URL ou API; formato; feed completo/incremental; headers/token **cifrados**; paginação; frequência; tolerância de ausência; publicação automática; estado da última execução |
| `property_field_mappings` | Mapeamento versionado por fonte (campos, padrões, conversões) |
| `property_import_batches` | Lotes de upload e sincronização: situação, contagens, resumo da prévia, lock/attempts (concorrência) |
| `property_import_items` | Registros do lote: bruto, normalizado, erros, avisos, ação e resultado (checkpoints) |
| `property_external_listings` | Vínculo anúncio ↔ parceiro + código externo, URL original, hashes de conteúdo/fotos/endereço, situação no feed, contador de ausência, cliques |
| `property_integration_errors` | Logs (info/aviso/erro) sem tokens |
| `property_duplicate_candidates` | Possíveis duplicidades entre anunciantes, com sinais e conferência |

Também: colunas `external` e `source_url` em `property_images` (padrão `false`/vazio — fotos diretas inalteradas).

Funções: `upsert_partner_property` (upsert atômico com lock do parceiro e do anúncio) e `archive_missing_partner_properties` (ausência em feed completo).

### Por que um "dono técnico" por parceiro

`properties.user_id` é obrigatório e todo o módulo (busca, visibilidade, suspensão, contato, quotas, limpeza) depende dele. Criar uma conta técnica por parceiro (e-mail `parceiro-<uuid>@parceiros.alilu.invalid`, domínio reservado que não recebe código de login nem existe no Google) faz o anúncio importado funcionar com **zero mudança** nas consultas públicas. A chave única existente `(user_id, fingerprint)` também passa a garantir, por construção, *parceiro + código externo* sem duplicação.

## Fluxos

### Upload (Entrega 1)

1. Admin escolhe parceiro, fonte e arquivo (até 30 MB / 20.000 registros).
2. O arquivo é lido **no navegador** (mesmos parsers do servidor) e enviado em partes ≤ 3 MB / 500 registros.
3. Mapeamento: automático por nomes conhecidos + correção manual, valores padrão, conversões de tipo/finalidade/características, separador de fotos, unidade de área, valores em centavos. Salvo como nova versão da fonte. Campos não usados aparecem como "ignorados".
4. Validação em passos de 400 registros = **simulação sem gravar**: válidos, inválidos, novos, a atualizar, inalterados, indisponíveis, repetidos no arquivo, sem fotos, sem preço, sem link, erros de conversão, pendentes. Relatório CSV de erros (fórmulas neutralizadas).
5. Confirmação com aprovação administrativa (opção de publicar já ou deixar pendente). Importação em passos de até 20 s; o cron retoma se o navegador fechar.

### Sincronização (Entrega 2)

1. Cron reivindica atomicamente fontes vencidas (`for update skip locked`, próximo horário gravado antes da execução).
2. `safeFetch`: https/443, DNS validado e fixado na conexão, redirecionamentos revalidados (máx. 3, headers só no mesmo host), 25 s, 25 MB, descompressão limitada, tipo de conteúdo verificado. Paginação por página ou cursor.
3. Parse → staging → validação → importação com o último mapeamento. Sem mapeamento salvo, o lote fica aguardando revisão (nada é importado).
4. **Publicação automática só depois que o parceiro teve um lote aprovado pelo admin e a fonte tem a opção ligada**; caso contrário os novos ficam pendentes na moderação existente.

### Status do anúncio importado

| Situação | Status |
| --- | --- |
| Lote aprovado com publicação, item completo | `published` (validade 90 dias renovada a cada sincronização em que aparece) |
| Sem fotos autorizadas, sem link e sem WhatsApp, parceiro sem CRECI, ou publicação não autorizada | `pending` (moderação existente; ações em lote no painel) |
| Feed informa vendido / alugado / inativo | `sold` / `rented` / `paused` |
| Ausente de feed completo além da tolerância | `paused` (motivo registrado); volta a `published` se reaparecer |
| Removido ou rejeitado pelo admin | permanece; o feed **não ressuscita** |

### Regra para imóvel que desaparece do feed

- Só se aplica a fontes `full` e lotes marcados como carteira completa.
- Não se aplica se houve falha de gravação, feed vazio, ou queda acima de 50 % com 10+ ativos (configurável por fonte).
- Registros presentes porém inválidos contam como **vistos**.
- Cada ausência incrementa um contador; só pausa ao atingir a tolerância (padrão 2). Nunca exclui.
- Erro HTTP, timeout, parsing inválido e arquivo vazio encerram o lote como falha **antes** de qualquer comparação.
- Feeds incrementais: somente eventos explícitos de status.
- Anúncios diretos estão fora do escopo da função (filtra por fonte do parceiro).

## Fotos

- **Padrão (A):** exibe URLs https dos **domínios autorizados** do parceiro; outras são descartadas com aviso. Sem consumo de Blob. O navegador do visitante carrega a imagem (o servidor não faz requisição a essas URLs → sem SSRF).
- **Opcional (B):** com autorização expressa ("pode copiar fotos"), o cron copia até 5 por execução via `safeFetch`, reprocessa com `processImage` (WebP 1600 px + miniatura, sem EXIF) e grava no Blob dentro do orçamento de storage do módulo. Falhas mantêm a URL externa e são registradas.
- Até 20 fotos por imóvel, ordem preservada, deduplicação por URL, `loading="lazy"` nos componentes existentes.
- A imagem OG só usa fotos do Blob (regra existente); importados com fotos externas geram OG sem foto.

## Contato e página pública

- Mesmo layout. Bloco discreto "Anúncio de parceiro" com nome/logo, **Ver anúncio original** (via `/imoveis/saida/[id]`, que valida a URL, conta 1 clique por visitante/dia sem guardar IP e é bloqueado no robots) e aviso de que a negociação é com o parceiro.
- **Falar com anunciante** = botão de WhatsApp existente, com o WhatsApp comercial do cadastro do parceiro (ou do anúncio, só se o parceiro autorizou).
- Endereço, CEP e coordenadas ficam somente no bloco cifrado; usados apenas como hash para duplicidade.

## Duplicidades

- Mesmo parceiro: chave única parceiro + código; reimportar atualiza o mesmo anúncio. Código repetido no arquivo → primeira ocorrência vale, demais marcadas.
- Entre anunciantes (inclui diretos): candidatos na mesma cidade/tipo/finalidade e área ±15 %; pontuação por bairro, área, preço, cômodos, **foto idêntica, hash de endereço, título e descrição parecidos**. Exige ao menos um sinal forte — preço/área/bairro parecidos nunca bastam. Vai para conferência; nada é excluído.

## SEO

- Diretos: sem alteração (canonical, sitemap, metadados).
- Importados: política por parceiro, padrão `noindex,follow` e fora do sitemap, porque o mesmo conteúdo existe no site original. `index` apenas quando o parceiro autorizar conteúdo exclusivo. Não se afirma que canonical para o Alilu seja sempre a melhor escolha — a decisão é editorial por parceiro.
- Pendentes, pausados e removidos já não são públicos (regra existente); vendidos/alugados mantêm página informativa `noindex`.

## Segurança

- Admin-only; mutações com validação de origem, conta ativa e quota.
- XML sem DTD (DOCTYPE recusado → sem XXE / billion laughs), profundidade e quantidade de nós limitadas; JSON com profundidade ≤ 32; XLSX com limite de entradas e de tamanho descompactado, fórmulas nunca avaliadas; CSV exportado com neutralização de fórmulas; limites de bytes, registros, campos e tamanho de valor.
- SSRF: ver "Sincronização". Headers aceitos apenas de autenticação, sem CR/LF; cifrados em repouso; nunca enviados ao navegador nem gravados em log.
- Dados brutos dos lotes descartados ao fim da importação; itens antigos limpos em 30 dias; logs em 180 dias.

## Performance e custos

- Nenhuma requisição processa o arquivo inteiro: staging em partes, validação 400/passo, importação com orçamento de 20 s, cron com orçamento de 50 s, lock por lote e índice único "um lote em importação por fonte".
- Falha de um registro não interrompe o lote; reprocessamento de falhas.
- Teste sintético: 600 imóveis importados em passos; parse de CSV com 20.000 linhas em < 5 s.
- Custos: fotos externas não usam Blob; o cron consome invocações de Function (agendar 15–60 min). Cópia de fotos consome storage/transferência do Blob como os anúncios diretos.

## Ranking

A ordenação existente (recência, preço, área) foi mantida, sem destaque pago ou automático por origem. Ponto de atenção: uma importação grande entra como "recente" e pode empurrar anúncios diretos para páginas seguintes na ordenação padrão. Recomenda-se decidir a regra comercial antes de importar carteiras grandes (ex.: intercalar origens ou usar a data original do anúncio).

## Limites conhecidos / próximos passos

- Acesso individual do parceiro ao painel não foi aberto (decisão do escopo: somente admin). O isolamento por `partner_id` já existe em todas as consultas.
- VRSync: fixture baseada na estrutura pública conhecida (`ListingDataFeed/Listings/Listing`); confirmar com um arquivo real de cada parceiro, pois versões variam.
- Verificação de URLs de foto quebradas não é feita no servidor (evita requisições a terceiros); fotos quebradas aparecem como imagem ausente.
- O cron precisa ser agendado externamente (ou Vercel Cron, conforme plano).
