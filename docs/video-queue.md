# Filas de vídeos (Games / GTA 6)

Importação em lote de vídeos por links, com processamento em fila e publicação automática nas contas escolhidas — **reaproveitando** o importador, o agendador e as integrações com a Meta que já existiam. A fila não publica nada sozinha: quando chega a vez de um vídeo, ela cria uma publicação normal no agendador existente, e o cron de sempre (`/api/cron/instagram-publish`) publica.

## 1. Arquitetura

```
Tela /instagram/filas (Games › GTA 6)            Tela /instagram/filas/[id] (painel)
   │ POST /api/video-queues  (links + contas + horários + legenda + declaração de direitos)
   ▼
video_queues / video_queue_items  (fila persistente, Postgres)
   │
Disparador externo ──► /api/cron/video-queue  (Bearer CRON_SECRET | INSTAGRAM_SCHEDULER_SECRET)
   │  1. planQueue()  — sincroniza resultados, confere contas, cria publicações nos próximos horários livres
   │  2. runQueueImports() — importa vídeos EM SEQUÊNCIA (teto global de downloads simultâneos)
   │       DIRECT    → safe-download.ts (SSRF/DNS rebinding/tipo/tamanho/tempo) → ffprobe → Blob video-queue/
   │       INSTAGRAM → import-service.ts existente (Apify, plano pago, cota diária) → cópia no Blob video-queue/
   │       UPLOAD    → arquivo enviado pelo usuário (token assinado) → ffprobe
   │       YOUTUBE / TIKTOK / outras → "Aguardando autorização ou arquivo" (nada é baixado)
   │  3. planQueue() de novo nas filas que ganharam vídeos prontos
   ▼
instagram_posts (post_type 'reels', source 'VIDEO_QUEUE', video_queue_item_id) + social_publication_destinations (Facebook)
   ▼
/api/cron/instagram-publish (EXISTENTE, sem mudança) → publishInstagramPublication / publishFacebookDestination
```

### O que foi reaproveitado

| Necessidade | Reaproveitado de |
|---|---|
| Download seguro (SSRF, redirecionamentos, tamanho, tempo) | `lib/instagram-import/backend/safe-download.ts` |
| Validação real do vídeo | `lib/instagram-import/backend/media-probe.ts` (ffprobe) |
| Limites de tamanho/duração | `instagram_import_settings` (`/admin/instagram-import`) |
| Links do Instagram | `resolveInstagramLink` + `importResolvedMedia` (provedor autorizado, plano pago, cota diária) |
| Upload direto navegador → Blob | mesmo padrão `handleUploadPresigned` do importador |
| Publicação Instagram (claim, lock, retentativas, container) | `instagram_posts` + `runInstagramScheduler` — **sem alteração** |
| Publicação Facebook (Reels, idempotência por destino) | `social_publication_destinations` + `runFacebookScheduler` — **sem alteração** |
| Contas | `instagram_accounts` (multi-conta) e `facebook_pages` |
| Legenda com IA | rota existente `POST /api/instagram/ai-caption` (mesmo provedor, plano e teto diário) |
| Autorização do cron | `isSchedulerRequestAuthorized` |

Única mudança em código compartilhado: `insertPostWithItems` (`instagram-post-repository.ts`) grava a coluna nova `video_queue_item_id` (null em todos os outros fluxos) e o tipo `InstagramPostSource` ganhou `"VIDEO_QUEUE"`.

## 2. Status

Item da fila: `PENDING` (Pendente) → `VALIDATING` (Validando) → `IMPORTING` (Importando) → `PROCESSING` (Processando) → `READY` (Pronto para publicação) → `SCHEDULED` (Agendado) → `PUBLISHED` (Publicado). Saídas: `WAITING_FILE` (Aguardando autorização ou arquivo), `ERROR` (Erro), `CANCELLED` (Cancelado).

Fila: `DRAFT` (criada; só prévia) → `ACTIVE` ⇄ `PAUSED` → `ARCHIVED`. A importação começa logo após criar a fila (inclusive em rascunho e pausada), para os vídeos estarem prontos quando a fila for ativada/retomada; **publicações só são criadas com a fila ativa**.

Cada rede tem status próprio: o Instagram fica em `instagram_posts.status` e cada Página em `social_publication_destinations.status`. O item só vira `PUBLISHED` quando **todos** os destinos ativos publicaram. Falha em um destino aparece no painel com "tentar de novo só no Instagram/Facebook" (rotas existentes).

## 3. Concorrência, idempotência e falhas

- **Importação**: claim atômico `FOR UPDATE SKIP LOCKED` + lock de 5 min com token. Dois crons nunca pegam o mesmo item. Worker que morre (timeout, reinício) → lock expira → item retomado; o arquivo vai sempre para o mesmo caminho (`video-queue/{user}/{fila}/{item}.mp4`, `allowOverwrite`), sem duplicar.
- **Teto de downloads**: `VIDEO_QUEUE_MAX_CONCURRENT_IMPORTS` (padrão 2) itens em andamento no sistema inteiro; cada execução do cron importa no máximo `VIDEO_QUEUE_MAX_IMPORTS_PER_RUN` (padrão 3), em sequência, e só começa uma importação se sobrar ≥ 90 s de orçamento.
- **Retentativas**: falha temporária (timeout, interrupção, HTTP 5xx/429, Blob) → nova tentativa em 5 e 15 min; na 3ª falha → `ERROR`. Falha permanente (vídeo inválido, longo/grande demais, HTTP 4xx, endereço bloqueado) → `ERROR` direto. Cota diária do Instagram → tenta de novo no dia seguinte, sem gastar tentativas. "Reprocessar erros" só reabre itens com `ERROR`.
- **Planejamento**: lock por fila (`planning_lock_token`), usado pelo cron e pelas ações do usuário.
- **Uma publicação por vídeo**: índice único parcial `instagram_posts (video_queue_item_id) WHERE status <> 'CANCELLED'`. Se o planejamento cair entre criar a publicação e marcar o item, a próxima execução encontra a publicação e só completa o vínculo. Destinos Facebook: `on conflict do nothing`.
- **Publicação**: as garantias existentes do agendador (claim atômico, container retomado, reconciliação do Facebook antes de repetir POST, retentativa por destino). Falha só no Facebook nunca republica o Instagram, e vice-versa.
- **Pausar / mudar horários / reordenar**: só desfazem publicações `SCHEDULED` da fila com mais de 1 min de folga e **nenhum destino iniciado**. O que já foi publicado ou está publicando nunca é tocado.

## 4. Distribuição dos horários

`allocateSlots` (`lib/video-queue/schedule.ts`, puro e testado):

- dias da semana + horários escolhidos, no fuso da fila (padrão `America/Sao_Paulo`), a partir da data de início, nunca no passado (antecedência de 5 min);
- no máximo N publicações **da fila** por dia;
- não usa horário a menos de "intervalo mínimo" de **qualquer** publicação já agendada/publicada nas mesmas contas (Instagram da fila e Páginas escolhidas, de qualquer origem: manual, Piloto Automático, outras filas). "Permitir mesmo horário" libera só o conflito com publicações de fora da fila;
- nunca altera agendamentos existentes;
- as publicações são criadas com antecedência configurável (padrão 48 h); a aba **Programação** mostra os horários já criados e a previsão dos demais — também antes de ativar;
- vídeo não pronto: **Usar o próximo vídeo pronto** (padrão) ou **Aguardar o processamento** (mantém a ordem; o horário perdido passa para o próximo livre — nenhuma publicação quebrada é criada).

## 5. Contas de destino

- A fila guarda `instagram_account_id`, `publish_to_instagram` e `facebook_page_ids` explicitamente; nada é pré-selecionado quando há várias contas/Páginas.
- A conta Instagram de uma fila não pode ser trocada (para outra conta, outra fila).
- Antes de cada planejamento a fila confere as contas. Conta ou Página desconectada → fila **pausada automaticamente** com o motivo, publicações futuras desfeitas; nunca há troca para outra conta. Ao reconectar a mesma conta, "Retomar fila".
- Vídeo incompatível com Reels do Facebook (fora de 3–90 s, não 9:16…): vai só ao Instagram, com aviso no item.

## 6. Legendas

Template por fila com `{titulo}`, `{tema}`, `{categoria}`, `{numero}`, `{total}` (sem variáveis = mesma legenda para todos), legenda individual por vídeo e legenda específica do Facebook. "Gerar legenda com IA" usa a rota existente `/api/instagram/ai-caption` (mesmos planos, custo registrado em `generation_usage` e teto `AI_CAPTION_DAILY_CAP`), com prompt que proíbe chamar conteúdo de fã de trailer oficial/notícia; o texto sempre volta para revisão antes de salvar. Máximo de 2.200 caracteres e 30 hashtags.

## 7. Segurança e direitos

- Todas as rotas exigem sessão; fila, itens, conta e Páginas são sempre filtrados por `user_id`.
- Tokens da Meta continuam só no backend (nenhuma rota nova devolve token).
- Links: só http/https, portas 80/443, sem usuário/senha; IP privado/loopback/link-local, IPv6 literal e nomes locais recusados já na entrada; a checagem definitiva acontece na conexão (`safe-download.ts`), com redirecionamentos revalidados, tipo de conteúdo e tamanho máximo.
- Declaração de direitos obrigatória ao criar a fila, ao adicionar links e ao enviar arquivo.
- Nada de YouTube/TikTok/outras plataformas é baixado. Sem remoção de marca-d'água, sem contorno de DRM, login ou restrições.

## 8. Banco — migração `0055_video_queues.sql`

Aditiva: tabelas `video_queues`, `video_queue_items`, `video_queue_events`; coluna anulável `instagram_posts.video_queue_item_id` + índice único parcial; CHECK de `instagram_posts.source` recriado com os valores existentes + `VIDEO_QUEUE`. Nenhum registro existente é alterado.

## 9. Variáveis de ambiente

| Variável | Obrigatória | Valor |
|---|---|---|
| `CRON_SECRET` / `INSTAGRAM_SCHEDULER_SECRET` | já existem | O mesmo segredo autoriza `/api/cron/video-queue` |
| `VIDEO_QUEUE_MAX_IMPORTS_PER_RUN` | não | Vídeos importados por execução do cron (padrão 3, máx. 20) |
| `VIDEO_QUEUE_MAX_CONCURRENT_IMPORTS` | não | Importações simultâneas no sistema todo (padrão 2, máx. 10) |
| `APIFY_TOKEN` | só para links do Instagram | já existente (importador do Instagram) |
| `BLOB_READ_WRITE_TOKEN`, `DATABASE_URL` | já existem | — |

## 10. Ativar em produção

1. `npm run db:migrate` (aplica `0055_video_queues.sql`) **antes** do deploy.
2. Deploy (o `next.config.ts` já inclui ffmpeg/ffprobe nas rotas novas).
3. Criar **um disparador a mais** (mesmo serviço do cron atual, ex.: cron-job.org), a cada 5 min:
   `POST https://alilu.com.br/api/cron/video-queue` com `Authorization: Bearer <segredo>`.
   O disparador do `/api/cron/instagram-publish` continua igual (recomendado: 1 min).
4. Conferir: `curl -X POST -H "Authorization: Bearer <segredo>" https://alilu.com.br/api/cron/video-queue` → `{"planned":0,…}`.
5. Teste real somente quando autorizado: criar uma fila com 1 vídeo próprio, conferir a programação, ativar e acompanhar no painel.

`maxDuration` do cron novo = 300 s, o mesmo já usado por `/api/cron/content-automation`. Se o plano limitar a 60 s, reduza `VIDEO_QUEUE_MAX_IMPORTS_PER_RUN` para 1 e aumente a frequência do disparador.

## 11. Limitações conhecidas

- Armazenamento: os vídeos ficam em `video-queue/` no Vercel Blob (fora da limpeza automática de importações, para não sumirem antes do horário). Remover um link apaga o arquivo; vídeos publicados permanecem.
- Vídeo maior que o limite do importador (padrão 100 MB / 10 min) não é importado.
- Links de Stories, perfis e encurtadores do Instagram ficam aguardando arquivo.
- Pausa automática por conta desconectada exige "Retomar" manual depois de reconectar.

## 12. Testes

| Arquivo | Cobre |
|---|---|
| `__tests__/lib/video-queue-pure.test.ts` | Links (classificação, SSRF na entrada, duplicados, 100+ links), validação da programação, distribuição de horários (fuso, dias, data de início, agendamentos existentes, intervalo, limite diário, horizonte), regra de vídeo não pronto, legendas e catálogo |
| `__tests__/lib/video-queue-flow.test.ts` | Postgres real (PGlite): 1/10/100 links, duplicados, inválidos, indisponíveis, aguardando arquivo + upload, Instagram pelo importador, retentativa/erro/reprocessar, reinício do worker, workers simultâneos, fluxo completo 20 vídeos IG+FB pelo agendador existente, respeito a agendamentos existentes, isolamento de contas e usuários, falha só no Facebook / só no Instagram, cron simultâneo + queda no meio, pausar/retomar, conta desconectada, Reel incompatível com Facebook, aguardar x próximo pronto, fila vazia e recebendo links, alterar horários/reordenar/cancelar/remover |
| `__tests__/lib/video-queue-thumbnail.test.ts` | Miniatura com o ffmpeg estático real |
