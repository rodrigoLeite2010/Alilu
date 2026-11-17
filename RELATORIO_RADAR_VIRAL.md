# Relatório — Radar Viral Inteligente (Games / GTA 6)

Data: 17/11/2026 · Base: `main` @ `b1261db` · Alterações **não commitadas**, **sem deploy** e **sem migração aplicada** em nenhum banco. Nenhuma publicação real, nenhuma chamada real a APIs pagas.
Documentação técnica: `docs/viral-radar.md`.

## 1. Varredura — o que já existia e foi reaproveitado

| Necessidade | Já existia em | Uso no radar |
|---|---|---|
| Fila persistente, importação segura, horários, contas | `lib/video-queue/*` (migração 0055) | Cada radar é ligado a UMA fila; o radar só acrescenta itens autorizados |
| Download seguro (SSRF, DNS rebinding, redirecionamentos, tipo, tamanho) | `lib/instagram-import/backend/safe-download.ts` | Leitura de feeds RSS e (via fila) dos arquivos de vídeo |
| Validação real do vídeo / miniatura | `media-probe.ts` (ffprobe), `video-queue/backend/thumbnail.ts` | Sem mudança |
| YouTube Data API (metadados, erros de cota/chave) | `lib/youtube-import/backend/youtube-api.ts` | `mapGoogleError` exportado e reaproveitado; `search.list` + `videos.list` novos |
| Agendador Instagram + Facebook (claims, locks, retentativas, status por destino) | `instagram-scheduler.ts`, `facebook-publish-service.ts` | **Sem alteração** |
| Cron | `/api/cron/video-queue` (Bearer `CRON_SECRET`/`INSTAGRAM_SCHEDULER_SECRET`) | O radar roda **dentro** dele (sem trigger novo) |
| IA | `getContentAIProvider().rewriteText`, `canUseAiAutomation`, `recordUserAiUsage` | Classificação, legendas e roteiros originais (opcional) |
| ffmpeg na Vercel | `ffmpeg-static` (split-screen, ai-video) | Adaptação 9:16 opcional no worker da fila |
| Contas | `instagram_accounts` (escopos `instagram_business_basic`, `instagram_business_content_publish`), `facebook_pages` (`pages_read_engagement`) | Escolha explícita na fila; monitoramento de curtidas/comentários |

## 2. Arquivos

**Criados**

- `db/migrations/0056_viral_radar.sql`
- `lib/viral-radar/` — `types.ts`, `config.ts`, `score.ts`, `relevance.ts`, `selection.ts`, `rss.ts`, `ai-prompts.ts`, `insights.ts`, `stage.ts` (puros)
- `lib/viral-radar/backend/` — `radar-repository.ts`, `youtube-search.ts`, `connectors.ts`, `ai-service.ts`, `radar-runner.ts`, `radar-cron.ts`, `performance.ts`, `radar-service.ts`, `radar-dto.ts`, `route-helpers.ts`
- `lib/video-queue/reframe.ts`, `lib/video-queue/backend/reframe-runner.ts`
- Rotas: `app/api/viral-radars/route.ts`, `[id]/route.ts`, `[id]/candidates/route.ts`, `[id]/sources/route.ts`, `sources/[sourceId]/route.ts`, `candidates/[candidateId]/route.ts`, `app/api/cron/viral-radar/route.ts`
- Telas: `app/radar-viral/page.tsx`, `app/radar-viral/novo/page.tsx`, `app/radar-viral/[id]/page.tsx`
- Componentes: `components/viral-radar/RadarSettingsFields.tsx`, `SourceEditor.tsx`, `RadarCreateForm.tsx`, `RadarPanel.tsx`
- Testes: `__tests__/lib/viral-radar-pure.test.ts`, `viral-radar-flow.test.ts`, `viral-radar-cron-route.test.ts`, `video-queue-reframe.test.ts`, `__tests__/components/viral-radar-create-form.test.tsx`
- Docs: `docs/viral-radar.md`, este relatório

**Alterados (mínimo, compatível)**

- `lib/video-queue/backend/queue-processor.ts` — hash SHA-256 do arquivo; bloqueio de arquivo duplicado e adaptação 9:16 **só quando a fila pede** (colunas novas com padrão neutro)
- `lib/video-queue/backend/queue-repository.ts` — campos opcionais em `markItemReady`; 3 funções novas
- `lib/video-queue/backend/queue-cron.ts` — chama o radar (isolado em try/catch, orçamento ≤ 60 s); formato do resultado mantido quando o radar não fez nada
- `app/api/cron/video-queue/route.ts` — resumo do radar na resposta (só quando houve atividade)
- `lib/youtube-import/backend/youtube-api.ts` — `export` em `mapGoogleError`
- `components/navigation/SiteNav.tsx` — item "Radar Viral" no menu
- `.env.example` — variáveis opcionais do radar

Não foram tocados: Prestador Seguro, Abimaq, agendador do Instagram/Facebook, OAuth, contas conectadas, Piloto Automático.

## 3. Endpoints

| Método | Rota | Função |
|---|---|---|
| GET/POST | `/api/viral-radars` | lista + indicadores + conectores / cria radar (e a fila dele) |
| GET/PATCH | `/api/viral-radars/[id]` | painel / `update`, `pause`, `resume`, `archive`, `run`, `activate_publishing` |
| GET | `/api/viral-radars/[id]/candidates` | tabela de candidatos (filtros por status/destino, paginação) |
| POST | `/api/viral-radars/[id]/sources` | nova fonte |
| PATCH/DELETE | `/api/viral-radars/sources/[sourceId]` | editar/remover fonte |
| POST | `/api/viral-radars/candidates/[candidateId]` | `approve` (com licença), `ignore`, `restore`, `brief` (conteúdo original), `reprocess` |
| GET/POST | `/api/cron/viral-radar` | cron opcional (mesmo segredo) |

## 4. Banco — `0056_viral_radar.sql` (aditiva)

`viral_radars`, `viral_radar_sources`, `viral_candidates`, `viral_metric_snapshots`, `viral_radar_executions`, `viral_radar_events`, `viral_provider_usage`, `viral_query_cache`, `viral_post_metrics`; em `video_queues`: `block_duplicate_files` (false), `reframe_mode` ('NONE'), `max_duration_seconds` (null); em `video_queue_items`: `content_sha256`, `original_blob_url` (anuláveis). Índices de unicidade: candidato por `(radar, plataforma, ID externo)`; uma fila por radar.

## 5. Jobs

Um único disparador (o que já chama `/api/cron/video-queue`, recomendado a cada 5 min) executa, em ordem: **Radar** (limpeza de execuções abandonadas → claim atômico dos radares vencidos/abaixo do mínimo → descoberta + métricas + score → fila → monitoramento) → **importação** (worker existente, com 9:16 opcional) → **planejamento** (agendador existente). A publicação continua em `/api/cron/instagram-publish`. Locks com expiração, idempotência, backoff, limites por fonte/cota/IA e recuperação após reinício.

## 6. Testes

- **Novos: 50, todos passando** — `viral-radar-pure` (22), `viral-radar-flow` (24, Postgres real via PGlite + fila/agendador/Meta reais do projeto com a rede simulada), `video-queue-reframe` (2, ffmpeg/ffprobe reais), `viral-radar-cron-route` (1), `viral-radar-create-form` (1).
- **Suíte completa** (`npx vitest run`): 415 arquivos, 4.452 testes — 4.444 passaram, 1 ignorado, 7 falharam. Das 7: **6 falham igualmente no código original** (`b1261db`, conferido rodando sem as alterações): `InstagramPainelPage` (multi-conta), `MobileBottomNavigation` (ordem dos itens, alterada no commit "games"), `VideoSplitScreenEditor` (2), `carousel-editorial` (cron semanal), `instagram-oauth-service` (1). A 7ª (`video-queue-flow` › "fila vazia…", que compara o formato exato do resultado do cron) foi corrigida mantendo o formato antigo — os 5 arquivos da Fila de vídeos + os do radar + YouTube passam juntos (203 testes).
- `tsc --noEmit` (com `next typegen`): **0 erros**. `eslint` nos arquivos novos/alterados: 0 erros, 0 avisos.
- `next build`: **concluído com sucesso** (com variáveis de ambiente fictícias; nenhuma conexão real) — rotas `/radar-viral`, `/radar-viral/novo`, `/radar-viral/[id]`, `/api/viral-radars/**` e `/api/cron/viral-radar` geradas.

| Requisito (spec §24) | Coberto em |
|---|---|
| 1–3 criação, edição, GTA 6 | flow "criação e configuração", pure "configuração do radar", form |
| 4–6 API oficial, cotas, sem resultados | flow "descoberta…" (cabeçalho da chave, `order=viewCount`, `regionCode=BR`, teto diário, backoff, espera crescente) |
| 7–10 score, histórico, duplicidade, melhores | pure "Viral Score", flow (2 observações reais, dedupe entre palavras-chave e fontes, seleção por execução) |
| 11–13 bloqueio de terceiros, importação autorizada, falha de importação | flow "direitos, importação…" |
| 14 processamento | flow (9:16 com original preservado, fallback, arquivo duplicado) + reframe com ffmpeg real |
| 15 legendas | flow (IA com estilo, saneamento, fallback para o modelo, custo em `generation_usage`) |
| 16–18 fila, conta, horários | flow (mesma conta bloqueada, outra conta liberada, 9h/15h/20h São Paulo) |
| 19–21 Instagram, Facebook, falha isolada | flow (publicação pelo agendador existente; falha só no Facebook não republica o Instagram) |
| 22–23 reabastecimento, pausa/retomada | flow |
| 24–26 cron simultâneo, idempotência, reinício | flow "robustez" |
| 27 token expirado | flow (conector com conta expirada; outras fontes seguem; pendências no painel) |
| 28 URL insegura | pure + flow (rede interna recusada na entrada; `BLOCKED_URL` no download) |
| 29 isolamento entre usuários | flow |
| 30 automações existentes | suíte completa |

Integrações reais **não executadas** (dependem de credenciais/autorização): YouTube Data API real, Graph API real (publicação, métricas, hashtags), IA real, Vercel Blob real.

## 7. O que está operacional × o que depende de configuração

**Operacional (com as credenciais que o projeto já usa):** criação/edição de radares, fontes YouTube (pesquisa com `YOUTUBE_API_KEY`; canal pelo feed oficial), RSS/Atom, Viral Score, histórico de métricas, seleção, dedupe, controle de direitos (automático e supervisionado), envio à fila, importação de arquivos MP4 de fontes licenciadas, adaptação 9:16, legendas por modelo ou IA, agendamento e publicação Instagram/Facebook pelo fluxo existente, reabastecimento, roteiros originais com IA, monitoramento de curtidas/comentários, painel.

**Depende de ação externa:**
- `npm run db:migrate` (0056) e deploy.
- Para publicar **sozinho**, o radar precisa de pelo menos uma **fonte autorizada com arquivos baixáveis** (feed RSS próprio/licenciado com `<enclosure>`/`media:content` MP4). Sem isso, a operação **não é 100% automática**: o radar descobre e classifica, mas a fila só recebe o que você aprovar com licença, e vídeos do YouTube (mesmo próprios) exigem o envio manual do arquivo — a API oficial do YouTube não permite download.
- Instagram hashtag: App Review da Meta (Instagram Public Content Access) + conta pelo Login do Facebook + `INSTAGRAM_HASHTAG_SEARCH_ENABLED=true`.
- TikTok: sem API autorizada — conector preparado e desativado.
- Métricas de visualizações/alcance/salvamentos: permissão de insights (não solicitada hoje).
- IA: `CONTENT_AI_*` já existentes + plano com IA.

## 8. Limitações reais das APIs

- YouTube `search.list` custa 100 unidades; cota padrão 10.000/dia por projeto (dividida com o "Importar do YouTube"). Curtidas podem estar ocultas e comentários desativados (ficam "indisponíveis"). Sem download de mídia.
- Feed de canal do YouTube: só os ~15 vídeos mais recentes; sem comentários.
- Instagram hashtag (quando aprovado): só `top_media`/`recent_media`, 30 hashtags únicas por 7 dias, **sem visualizações**, sem download de terceiros.
- Crescimento (35% do score) só existe a partir da 2ª observação (próxima execução); na 1ª, o score usa os demais componentes com fator de cobertura.

## 9. Custos adicionais estimados

Nenhum serviço pago novo. YouTube: gratuito dentro da cota (teto padrão 3.000 un./dia ≈ 29 pesquisas). IA: opcional, teto de 20 chamadas/dia por radar (padrão), mesmo provedor/plano do Piloto. Vercel: dentro do cron existente (≤ 60 s por chamada para o radar; ffmpeg ≤ 75 s por vídeo adaptado). Blob: arquivo adaptado + original por vídeo adaptado.

## 10. Ativação em produção

1. `npm run db:migrate` com o `DATABASE_URL` de produção.
2. Deploy.
3. Manter o disparador de `/api/cron/video-queue` (a cada 5 min) — o radar já roda nele.
4. `/radar-viral/novo` → "Radar GTA 6 Brasil" (padrões já preenchidos: 6 h, 100 mil views, 3/dia 9h/15h/20h, São Paulo, fila 15/mín. 5), conta Instagram GTA 6 e Página GTA 6 quando conectada.
5. Adicionar a(s) fonte(s) autorizada(s) e marcar "Ativar publicação".
6. "Executar radar agora" e conferir candidatos, fila e programação no painel.
