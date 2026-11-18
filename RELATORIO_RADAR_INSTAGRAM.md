# Relatório — Radar Instagram e reestruturação do módulo Instagram

Data: 18/11/2026 · Base: `main` @ `669b908` · Alterações **não commitadas**, **sem deploy** e **sem migração aplicada** em nenhum banco.
Documentação técnica: `docs/instagram-radar.md`.

## 1. Auditoria (o que já existia e foi reaproveitado)

| Peça | Onde | Uso no Radar |
|---|---|---|
| Fila persistente (Games) | `video_queues`, `video_queue_items`, `video_queue_events` (0055/0056) + `lib/video-queue/backend/*` | Radar = linha de `video_queues` com `kind = 'INSTAGRAM_RADAR'` |
| Importador | `queue-processor.ts` → `safe-download.ts` (SSRF/tamanho/tipo/tempo), `import-service.ts` do Instagram (provedor autorizado, plano pago, cota), `media-probe.ts` (ffprobe), upload autorizado | Sem alteração; nenhum importador novo |
| Planejador | `queue-planner.ts` (lock por fila, sincronização de resultados, pausa por conta desconectada, índice único por item) | Ganhou o ramo do radar (janela + intervalo fixo + N/dia + teto por conta) e lock por conta |
| Agendador / publicador | `instagram_posts` + `instagram-scheduler.ts` + `instagram-publish-service.ts` (claim atômico, container retomado, confirmação da Meta, backoff) | Sem mudança de fluxo; só a guarda de conta antes da Meta |
| Cron | `/api/cron/video-queue` (importa + planeja) e `/api/cron/instagram-publish` (publica) | Os mesmos; **nenhum cron novo** |
| Contas | `instagram_accounts` (multi-conta), `getInstagramAccountByIdForUser`, `fetchInstagramProfileDetails` (App Review) | Seletor de conta; foto/nome/tipo vindos da Meta |
| Facebook | `social_publication_destinations`, `destination-authorization.ts` | Radar nunca usa; bloqueio extra na hora da publicação |
| Legenda com IA | `POST /api/instagram/ai-caption` + `buildAiCaptionPrompt` | Mesma rota, sempre revisada |
| Duplicidade | índice único `instagram_posts.video_queue_item_id`, URL normalizada por fila, hash (`block_duplicate_files`) | + URL por **conta** entre radares/filas; hash ligado em todo radar |

Interface manual encontrada: menu "Manual" (Criar post, Carrossel, Reels, Legendas), CTAs da página `/instagram`, botões de criação em "Minhas publicações", atalhos móveis e os compositores autenticados `/instagram/painel/calendario/novo` e `/novo-carrossel`.

## 2. Interfaces removidas / restritas

| Item | O que aconteceu |
|---|---|
| Grupo "Manual" do menu Instagram | Removido. Menu agora: **Radar Instagram** (Meus radares, Criar radar) e **Automatizado** (Minhas publicações, Carrossel Inteligente, Piloto Automático, Contas conectadas) |
| Página `/instagram` | Saíram "Criar post grátis", "Agendar publicação", a grade "Criar publicação", "Outras ferramentas" (legendas) e o "Como usar" manual. Entraram CTAs e seção do Radar |
| Minhas publicações | Saíram "Agendar nova publicação", "Post viral", "Novo carrossel", "Novo Reel". Ficam histórico, cancelar/editar agendamentos existentes |
| `/instagram/painel/calendario/novo` e `/novo-carrossel` | **Restritos ao admin** (ADMIN_EMAILS) — ferramenta de teste fora do menu; demais usuários são redirecionados ao Radar |
| Celular (botão Criar e home) | Atalhos de Post/Reel/Carrossel trocados por Radar Instagram / Meus radares / Publicações |
| Painel do Instagram e tela de login | "Criar Post Viral" e "Criar um post primeiro" trocados por links do Radar |

**Não foram apagadas** as páginas públicas `/instagram/criar-post`, `/carrossel`, `/reels`, `/legendas`, `/posts-virais`: estão no sitemap (SEO/AdSense), servem downloads gratuitos e são destino de botões do importador do Instagram/YouTube, do vídeo com IA e do Split Screen (`ReelsComposer` é usado pelo editor Split Screen). Continuam acessíveis só por link direto. Se quiser removê-las de vez, é uma etapa separada (exige redirecionamentos 301 e ajuste desses fluxos).

## 3. Serviços preservados

OAuth Instagram/Facebook Login, callbacks, tokens (nenhum lido fora do backend, nenhum alterado), escopos (sem mudança), `/admin/meta-app-review` e suas rotas, publicador, agendador, Piloto Automático, Carrossel Inteligente, filas de Games (sem mudança de comportamento), Radar Viral, publicação no Facebook, histórico e agendamentos existentes.

## 4. Novos componentes

- `db/migrations/0059_instagram_radar.sql`
- `lib/instagram-radar/schedule.ts`, `captions.ts`, `radar-config.ts` (puros)
- `lib/instagram-radar/backend/radar-service.ts`, `radar-repository.ts`, `radar-accounts.ts`, `radar-dto.ts`, `publish-target-guard.ts`
- Rotas: `app/api/instagram-radars/route.ts`, `accounts/route.ts`, `preview/route.ts`, `[id]/route.ts`, `[id]/links/route.ts` (itens, upload e reprocessar usam as rotas existentes de `/api/video-queues/*`, com checagem de posse)
- Telas: `app/instagram/radar/page.tsx` (gerenciamento), `novo/page.tsx`, `[id]/page.tsx`
- Componentes: `components/instagram-radar/RadarAccountSelector.tsx`, `RadarScheduleFields.tsx`, `RadarLinksInput.tsx`, `RadarCaptionFields.tsx`, `RadarPreviewCard.tsx`, `RadarCreateForm.tsx`, `RadarPanel.tsx`, `RadarItemRow.tsx`
- Testes: `__tests__/lib/instagram-radar-schedule.test.ts`, `__tests__/lib/instagram-radar-flow.test.ts`, `__tests__/components/instagram-radar-create-form.test.tsx`, `__tests__/components/instagram-radar-panel.test.tsx`
- Docs: `docs/instagram-radar.md`, este relatório

## 5. Arquivos alterados (código compartilhado — mínimo)

- `lib/video-queue/backend/queue-repository.ts`: `kind`/configurações do radar no registro; `listQueuesForUser(userId, kind)` (Games continua listando só Games); `insertItems(..., { referenceOnly })`.
- `lib/video-queue/backend/queue-planner.ts`: ramo do radar, lock por conta (`withAccountScheduleLock`, também nas filas de Games, com fallback sem a migração), radar nunca com Facebook.
- `lib/video-queue/backend/queue-service.ts`: telas/API de Games não editam radar, não adicionam links a radar e não fazem "publicar agora" de radar.
- `lib/instagram/backend/instagram-post-repository.ts` + `instagram-publish-service.ts`: `getPostForPublish` traz a conta/dono/item da fila; guarda de conta antes da Meta.
- `lib/facebook/destination-policy.ts`, `destination-authorization.ts`, `social-destinations-service.ts`: motivo `instagram_radar_only` (bloqueio de Facebook em publicações do radar).
- Interface: `data/instagram.ts`, `app/instagram/page.tsx`, `app/instagram/painel/page.tsx`, `app/instagram/painel/calendario/page.tsx`, `.../novo/page.tsx`, `.../novo-carrossel/page.tsx`, `components/instagram/SchedulingIntro.tsx`, `components/mobile/mobile-links.ts`, `components/mobile/MobileHome.tsx`.
- Testes existentes ajustados à nova interface: `SiteNav`, `InstagramPublishingDiscovery`, `InstagramCalendarioPage`, `MobileBottomNavigation`, `MobileHome`.

## 6. Tabelas e migration

`0059_instagram_radar.sql` — **aditiva**: colunas com padrão neutro em `video_queues` (`kind` = `'VIDEO_QUEUE'` em todas as filas existentes, `window_start`, `window_end`, `hashtags`, `missing_caption_policy`), `CHECK` das regras do radar (só Instagram, 1–10/dia, intervalo da lista, janela válida), índice e a tabela `instagram_account_schedule_locks`. Nada é apagado nem alterado.

## 7. Seletor de contas

Lista só as contas do usuário logado com status `connected` (as demais aparecem como "N conta(s) precisam ser reconectadas"); mostra foto, nome, @usuário, status e tipo (foto/nome/tipo via `GET /me` com cache de 10 min; se a Meta falhar, mostra o @ sem inventar dados). Nada pré-selecionado. O ID escolhido é gravado no radar e não pode ser trocado; conta desconectada pausa o radar (nunca troca).

## 8. Regras de agendamento

Ver `docs/instagram-radar.md` §2. Resumo: horários = início + k × intervalo (N horários); janela com início/fim/dias/fuso (atravessa meia-noite); configuração que não cabe é recusada com sugestões; teto diário combinado por conta (menor limite entre radares ativos, contando todas as publicações da conta); horário em conflito de intervalo é pulado, nunca deslocado; lock por conta.

## 9. Cron utilizado

Os existentes: `POST /api/cron/video-queue` (importação + planejamento; radar entra pelo mesmo `listQueueIdsForCron`) e `POST /api/cron/instagram-publish` (publicação). Nenhum disparador novo.

## 10. Testes

**Suíte completa (`npx vitest run`, com as alterações):** 425 arquivos, 4.573 testes — **4.565 passaram**, 1 ignorado, **7 falharam**. As **mesmas 7 falhas** acontecem no código original (`669b908`, sem nenhuma alteração), rodadas no mesmo ambiente: `InstagramPainelPage` (multi-conta), `MobileBottomNavigation` (item "Games" a mais), `VideoSplitScreenEditor` (2), `admin-links`, `carousel-editorial` (cron semanal) e `instagram-oauth-service` (1). **Nenhuma regressão.**

Também passaram: `tsc --noEmit` (sem erros), `eslint` em todos os arquivos novos/alterados e **`next build`** (todas as rotas e telas novas compiladas: `/api/instagram-radars/*`, `/instagram/radar`, `/instagram/radar/novo`, `/instagram/radar/[id]`). Testes existentes ajustados à nova interface (menu, página da categoria, Minhas publicações, celular, compositores restritos ao admin, formato de `getPostForPublish`).

**Testes novos: 61, todos passando** — APIs sociais sempre simuladas (nenhuma publicação real):

- `instagram-radar-schedule.test.ts` (24, puro) e `instagram-radar-flow.test.ts` (32, Postgres real via PGlite com as mesmas migrações + agendador/publicador existentes);
- `instagram-radar-create-form.test.tsx` (4) e `instagram-radar-panel.test.tsx` (1).

Teste de mutação: desligar o teto por conta ou a guarda de conta faz os testes 22 e 21 falharem (os testes de fato protegem essas regras).

| # | Requisito | Onde |
|---|---|---|
| 1 | Criação do radar | flow 1 |
| 2 | Seleção de conta (só do usuário, conectada, sem padrão; foto/nome/tipo; sem token) | flow 2, 2b; form |
| 3–5 | 1, 10 e 100 links | flow 3–5 |
| 6 | Arquivo TXT | flow 6; form (upload .txt) |
| 7–8 | Duplicados e inválidos | flow 7–8; form |
| 9 | Bloqueio de importação não autorizada | flow 9 |
| 10 | Fila persistente | flow 10/34 |
| 11–13 | 1/dia, 10/dia, bloqueio acima de 10 (serviço + CHECK do banco) | flow 11–13; schedule |
| 14–17 | Intervalos de 30 min, 1 h, 2 h, 12 h | flow 14–17; schedule |
| 18 | Horários incompatíveis (mensagem + sugestões) | flow 18; schedule; form |
| 19 | Fuso horário (+ horário de verão, janela pela meia-noite) | flow 19; schedule |
| 20 | Publicação na conta selecionada (ID até a chamada da Meta) | flow 20 |
| 21 | Proteção contra conta errada (bloqueio antes da Meta) | flow 21 |
| 22 | Dois radares na mesma conta (teto combinado + intervalo, crons concorrentes) | flow 22 |
| 23 | Radares em contas distintas | flow 23 |
| 24 | Pausar e retomar | flow 24/33 |
| 25 | Token expirado (190 da Meta; conta expirada pausa o radar) | flow 25 |
| 26 | Falha de publicação / vídeo inválido sem parar a fila | flow 26 |
| 27 | Retentativa segura (container retomado, um único Reel) | flow 27 |
| 28 | Cron simultâneo | flow 28 |
| 29 | Duplicidade (URL na mesma conta, hash do arquivo) | flow 29 |
| 30 | Filas Games preservadas | flow 30 + suíte `video-queue-*` |
| 31 | Facebook preservado e nunca usado pelo radar | flow 31 + suítes `facebook-*` e `social-destination-*` |
| 32 | Integrações Meta preservadas (OAuth, App Review, publicador) | suítes existentes (`instagram-oauth-*`, `meta-app-review-*`, `instagram-publish-*`) |
| 33 | Histórico preservado | flow 24/33 |
| 34 | Funciona com o navegador fechado (só cron + agendador) | flow 10/34 |
| 35 | Sem regressões | suíte completa (acima) |

## 11. Dependências de APIs/credenciais

- Links do Instagram com autorização: `APIFY_TOKEN` (já existente, importador do Instagram) e plano pago — sem isso, o item fica aguardando arquivo.
- Foto/nome/tipo no seletor: token da conta já conectada (`instagram_business_basic`), sem escopo novo.
- `BLOB_READ_WRITE_TOKEN`, `DATABASE_URL`, `CRON_SECRET`/`INSTAGRAM_SCHEDULER_SECRET`, `INSTAGRAM_TOKEN_ENCRYPTION_KEY`: já existentes.
- Nenhum serviço pago novo. Vercel: nenhuma rota nova faz download/renderização; isso continua no worker existente (lotes curtos, `maxDuration` já configurado).

## 12. Ativação em produção

1. Revisar e aplicar o patch numa branch; `npm test` e `npm run build`.
2. `npm run db:migrate` (aplica a `0059_instagram_radar.sql`) com o `DATABASE_URL` de produção, **antes** do deploy.
3. Deploy (manual — nada foi publicado automaticamente).
4. Conferir que os disparadores existentes continuam ativos: `/api/cron/video-queue` (5 min) e `/api/cron/instagram-publish` (1 min).
5. Teste controlado: Instagram › Radar Instagram › Criar radar com 1 vídeo próprio na conta de teste, conferir a prévia, ativar, acompanhar até "Publicado".
