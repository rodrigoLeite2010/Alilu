# Relatório — Filas de vídeos (Games / GTA 6)

Data: 16/11/2026 · Base: `main` @ `11dc7a9` · Alterações **não commitadas**, **sem deploy** e **sem migração aplicada** em nenhum banco.
Documentação técnica completa: `docs/video-queue.md`.

## 1. O que foi encontrado na varredura

| Peça | Onde está | Como foi usada |
|---|---|---|
| Importador (Instagram) | `lib/instagram-import/backend/import-service.ts` (Apify, plano pago, cota diária, declaração), `safe-download.ts` (SSRF), `media-probe.ts` (ffprobe), limites em `instagram_import_settings` | Links do Instagram passam pelo importador; links diretos usam o mesmo download seguro e a mesma validação |
| Importador (YouTube) | `lib/youtube-import` — só metadados; o arquivo é enviado pelo usuário (políticas do YouTube) | Mesma regra: YouTube/TikTok/outras plataformas ficam "Aguardando autorização ou arquivo" |
| Publicação | `instagram_posts` + `instagram-publish-service.ts` (camada única) + `instagram-scheduler.ts` (claim `SKIP LOCKED`, lock, backoff 5/15/60) | A fila cria publicações `reels` normais; **nenhuma** lógica de publicação nova |
| Facebook | `social_publication_destinations` + `facebook-publish-service.ts` (Reels em 3 fases, reconciliação, status por destino) | A fila grava destinos com `addFacebookDestinationsIfMissing` |
| Cron | `/api/cron/instagram-publish` (disparador externo, `Bearer`), `/api/cron/content-automation` | Sem mudança; novo `/api/cron/video-queue` com o mesmo segredo |
| Contas | `instagram_accounts` (multi-conta por usuário), `facebook_pages` | Escolha explícita por fila |
| Piloto Automático | cria posts em `instagram_posts` com `source = 'AUTOMATION'` | Mesmo padrão (`source = 'VIDEO_QUEUE'`) |
| Legenda com IA | `POST /api/instagram/ai-caption` | Reaproveitada no painel (por vídeo, sempre revisada) |
| Vercel | Functions com `maxDuration` 60–300 s; Blob; sem Vercel Cron frequente (Hobby) | Processamento em lotes curtos, estado no banco, sem worker pago |

## 2. Solução escolhida (a mais simples e confiável)

Fila **persistente no Postgres** (sem serviço novo): `video_queues` + `video_queue_items` + `video_queue_events`, processada por um cron HTTP idempotente.

- **Importação**: um vídeo por vez, claim atômico com lock e expiração, teto global de downloads simultâneos (padrão 2), máximo de 3 por execução, retomada automática após queda do worker.
- **Publicação**: só quando o vídeo está pronto e o horário cabe no horizonte (padrão 48 h) a fila cria a publicação no agendador existente. A partir daí tudo é o fluxo que já funciona (Instagram e Facebook independentes).
- **Sem duplicidade**: índice único parcial `instagram_posts.video_queue_item_id` (uma publicação ativa por vídeo) + lock de planejamento por fila + as proteções que o agendador já tinha.

## 3. Arquivos

**Criados**

- `db/migrations/0055_video_queues.sql`
- `lib/video-queue/types.ts`, `catalog.ts`, `links.ts`, `schedule.ts`, `captions.ts` (módulos puros)
- `lib/video-queue/backend/queue-repository.ts`, `queue-service.ts`, `queue-processor.ts`, `queue-planner.ts`, `queue-cron.ts`, `queue-dto.ts`, `thumbnail.ts`, `route-helpers.ts`
- Rotas: `app/api/video-queues/route.ts`, `[id]/route.ts`, `[id]/items/route.ts`, `[id]/retry/route.ts`, `[id]/process/route.ts`, `items/[itemId]/route.ts`, `items/[itemId]/upload/route.ts`, `upload/route.ts`, `app/api/cron/video-queue/route.ts`
- Telas: `app/instagram/filas/page.tsx` (Games › temas › filas), `app/instagram/filas/nova/page.tsx`, `app/instagram/filas/[id]/page.tsx` (painel), `app/games/page.tsx` (atalho)
- Componentes: `components/video-queue/VideoQueueCreateForm.tsx`, `VideoQueuePanel.tsx`, `VideoQueueItemRow.tsx`, `QueueSettingsFields.tsx`
- Testes: `__tests__/lib/video-queue-pure.test.ts`, `video-queue-flow.test.ts`, `video-queue-thumbnail.test.ts`, `video-queue-cron-route.test.ts`, `__tests__/components/video-queue-create-form.test.tsx`
- Docs: `docs/video-queue.md`, este relatório

**Alterados (mínimo)**

- `lib/instagram/backend/instagram-post-repository.ts`: tipo `source` aceita `VIDEO_QUEUE`; o insert grava `video_queue_item_id` (null nos outros fluxos)
- `next.config.ts`: ffmpeg/ffprobe nas rotas novas
- `app/instagram/page.tsx`: bloco "Filas de vídeos (Games)"
- `.env.example`: 2 variáveis opcionais

## 4. Migração

`0055_video_queues.sql` — aditiva. Cria 3 tabelas, 1 coluna anulável em `instagram_posts` com índice único parcial, e recria o CHECK de `source` com todos os valores atuais + `VIDEO_QUEUE`. Não altera nenhum registro existente. Aplicar com `npm run db:migrate` **antes** do deploy.

## 5. Testes executados

**Resultado da suíte completa (`npx vitest run`, com as alterações):** 411 arquivos, 4.383 testes — **4.370 passaram**, 1 ignorado, 12 falharam.
As **mesmas 12 falhas** acontecem no código original (`11dc7a9`, sem nenhuma alteração), rodadas no mesmo ambiente: `InstagramPainelPage` (multi-conta), `VideoSplitScreenEditor` (2), `carousel-editorial` (cron semanal), `instagram-oauth-service` (1), `PlanilhasDownloads` e `imoveis-integracoes*` (arquivos de `public/`, que não foram copiados para o ambiente de teste). **Nenhuma regressão.**

Testes novos: 40 (todos passando) — `video-queue-pure` (13), `video-queue-flow` (22, Postgres real via PGlite), `video-queue-thumbnail` (2, ffmpeg real), `video-queue-cron-route` (2), `video-queue-create-form` (1). Também passaram `tsc --noEmit` (só os 3 erros já existentes de tipos gerados pelo Next) e `eslint` nos arquivos novos/alterados. `next build` não foi executado (exige as variáveis de produção).

| Requisito | Onde |
|---|---|
| 1, 10 e 100 links | `video-queue-flow` (importação em lote) + `video-queue-pure` (limite por envio) |
| Duplicados / inválidos | `video-queue-flow` + `video-queue-pure` |
| Indisponível / aguardando arquivo / upload | `video-queue-flow` |
| Contas diferentes, sem mistura, sem acesso cruzado | `video-queue-flow` |
| Distribuição de horários / agendamentos existentes | `video-queue-pure` + `video-queue-flow` |
| Publicação automática Instagram e Facebook (agendador existente) | `video-queue-flow` (20 vídeos, 2/dia) |
| Falha isolada por plataforma | `video-queue-flow` (só Facebook / só Instagram) |
| Pausar e retomar | `video-queue-flow` |
| Reprocessar erros | `video-queue-flow` |
| Cron simultâneo / queda no meio / workers simultâneos | `video-queue-flow` |
| Reinício do worker | `video-queue-flow` |
| Fila vazia / recebendo novos links | `video-queue-flow` |
| Preservação das automações atuais | suíte completa do projeto |

## 6. Para ativar em produção

1. `npm run db:migrate` com o `DATABASE_URL` de produção.
2. Deploy.
3. Novo disparador (mesmo serviço do cron atual), a cada 5 min: `POST https://alilu.com.br/api/cron/video-queue` com `Authorization: Bearer <CRON_SECRET ou INSTAGRAM_SCHEDULER_SECRET>`.
4. Opcional: `VIDEO_QUEUE_MAX_IMPORTS_PER_RUN`, `VIDEO_QUEUE_MAX_CONCURRENT_IMPORTS`.
5. Links do Instagram exigem `APIFY_TOKEN` (já usado pelo importador) e plano pago; sem isso, o vídeo fica aguardando o arquivo.

Nenhum serviço pago novo foi adicionado.
