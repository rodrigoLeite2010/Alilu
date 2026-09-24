# Agendador de publicações do Instagram

Documentação técnica do módulo que publica automaticamente no Instagram no horário escolhido pelo usuário, e da integração com **Posts Virais**.

## 1. Arquitetura

```
Navegador (editor / Posts Virais / Minhas publicações)
   │  arte final (JPEG 1080×1350 etc.) + foto original → Vercel Blob (URL pública, persistente)
   │  POST/PATCH /api/instagram/posts…  (sessão Auth.js; nunca token da Meta)
   ▼
Next.js Route Handlers (Vercel Functions)
   │  instagram-post-service.ts   → validação, posse (userId), fuso, template
   │  instagram-post-repository.ts→ SQL (Neon/Postgres): claim atômico, lock, retry
   │  instagram-publish-service.ts→ publishInstagramPublication()  ← CAMADA ÚNICA
   │  meta-graph-client.ts        → Instagram API with Instagram Login
   ▼
Disparador externo ──► GET|POST /api/cron/instagram-publish (Bearer segredo)
                       instagram-scheduler.ts → claimNextDuePost() → publishInstagramPublication()
```

- **Entidade publicação** = tabela `instagram_posts` (já existente) + `instagram_post_items` (mídias, em ordem) + `instagram_publish_attempts` (auditoria). A migração `0003_instagram_scheduler.sql` só **acrescenta** colunas: `source` (`MANUAL`/`VIRAL_POST`), `template_id`, `template_data` (jsonb), `next_attempt_at`, `last_attempt_at`, `processing_started_at`.
- Mapeamento para o modelo pedido: `type` = `post_type` (`image`/`carousel`/`reels`), `retryCount` = `attempts_count`, `scheduledAt` = `scheduled_at_utc`, `timezone` = `timezone_original`, `instagramMediaId` = `meta_media_id`, `errorMessage` = `last_error_sanitized`, `media[]` = `instagram_post_items`, `thumbnailUrl` = mídia na posição 0.
- **"Publicar agora" e o scheduler usam a mesma função**: `publishInstagramPublication()` em `lib/instagram/backend/instagram-publish-service.ts`. Não existe outra implementação de publicação.

## 2. Status

| Status | Significado | Ações na tela |
|---|---|---|
| `DRAFT` (Rascunho) | salvo, sem data | Editar, Agendar, Publicar agora, Excluir |
| `SCHEDULED` (Agendado) | aguardando o horário (ou a próxima tentativa, após falha temporária) | Editar, Alterar horário, Publicar agora, Cancelar agendamento, Excluir |
| `PROCESSING` (Publicando) | alguém tem o *claim* e está falando com a Meta, ou o container ainda processa na Meta | nenhuma (edição/cancelamento bloqueados) |
| `PUBLISHED` (Publicado) | a Meta confirmou | Visualizar, Excluir do Alilu (continua no Instagram) |
| `FAILED` (Falhou) | erro permanente ou retentativas esgotadas | Ver erro, Editar, Tentar novamente, Excluir |
| `CANCELLED` (Cancelado) | nunca será publicado | Excluir |

Transições:

```
DRAFT ──agendar──► SCHEDULED ──horário chegou + claim──► PROCESSING ──► PUBLISHED
  │                   │  ▲                                     │
  │                   │  └──── falha temporária (backoff) ◄────┤
  │                   └─cancelar─► CANCELLED                   └──► FAILED (permanente / 3 retentativas)
  └─publicar agora + claim─► PROCESSING
FAILED ──tentar novamente (claim, container descartado)──► PROCESSING
```

## 3. Scheduler, claim e idempotência

`POST|GET /api/cron/instagram-publish` (a rota antiga `/api/instagram/scheduler/run` chama a mesma lógica):

1. Valida `Authorization: Bearer <segredo>` (comparação em tempo constante). O segredo **nunca** vai na URL.
2. Em loop (até `limit`, padrão 5, máx. 20, e até ~30 s de orçamento):
   - `claimNextDuePost()` — **um único UPDATE** com subconsulta `FOR UPDATE SKIP LOCKED`, que pega a próxima publicação `SCHEDULED` com `scheduled_at_utc <= now()` (respeitando `next_attempt_at`) **ou** um `PROCESSING` sem dono/lock expirado (retomada), e já grava `status='PROCESSING'`, `processing_lock_token` (uuid) e `processing_lock_expires_at` (+5 min).
   - `publishInstagramPublication(..., { claimed })` publica.
3. Toda escrita de resultado (`markPostProcessing/Published/Failed`, `schedulePostRetry`, `releasePostForResume`) tem `WHERE processing_lock_token = <meu token>` — um worker cujo lock expirou nunca sobrescreve outro.

Garantias contra publicação duplicada:

- Duas instâncias simultâneas: `SKIP LOCKED` + condição repetida no UPDATE → só uma recebe a linha (teste "cenário crítico" em `__tests__/lib/instagram-scheduler.test.ts`, contra Postgres real via PGlite).
- "Publicar agora" durante o scheduler: o clique também faz claim (`claimPostForManualPublish`); quem perder recebe `PROCESSING`/`PUBLISHED` sem publicar.
- Container salvo é **retomado**, nunca recriado. Se a resposta do `media_publish` se perder, a próxima execução consulta o container: status `PUBLISHED` na Meta → marcamos `PUBLISHED` sem publicar de novo.
- Cancelar/editar só funcionam fora de `PROCESSING` (condição atômica no UPDATE). Publicação cancelada nunca é elegível para claim.

## 4. Retentativas

- Classificação em `lib/instagram/backend/publish-errors.ts`:
  - **Temporário**: códigos Meta 1, 2, 4, 17, 32, 341, 368, 613, `is_transient: true`, resposta sem JSON (502/503), falha de rede/timeout.
  - **Permanente**: 190/102 (token → "Sua conexão com o Instagram precisa ser renovada."), 10/200–299 (permissão), 9004/36003/subcódigos 2207xxx (mídia), container `ERROR`/`EXPIRED`, validação local (tipo/quantidade de mídia).
- Backoff após cada falha temporária: **+5 min, +15 min, +60 min**; depois da 3ª retentativa → `FAILED`.
- Container ainda processando (comum em Reels): fica `PROCESSING`, lock liberado, `next_attempt_at = +1 min`; o scheduler retoma. Processando por mais de 2 h → `FAILED`.
- "Tentar novamente" (manual) em `FAILED` zera tentativas e descarta o container antigo.

## 5. Fuso horário

- Banco: `scheduled_at_utc timestamptz` (UTC) + `timezone_original` (IANA, ex.: `America/Sao_Paulo`).
- A API só aceita ISO 8601 **com** `Z` ou offset (`parseAbsoluteIso`) — `"2026-09-24T15:00"` é recusado.
- A tela converte data + hora escolhidas no fuso do navegador com `zonedDateTimeToUtc` e exibe com `formatInTimeZone` no fuso salvo (`lib/instagram/schedule-time.ts`, testes em `instagram-schedule-time.test.ts`: 15:00 em São Paulo → 18:00Z).

## 6. Storage de mídia

- Vercel Blob (store público — a Meta baixa pela URL, sem autenticação), via *client upload* assinado (`/api/instagram/media/upload`), caminho restrito a `instagram-media/<userId>/`.
- Nada fica em `blob:`/base64 esperando o horário: a arte final (JPEG, resolução real do formato, ex.: 1080×1350) é enviada ao salvar/agendar; a foto original do usuário também, para reabrir a arte (`template_data.state.backgroundImage.storageUrl`).
- `template_data` é validado (≤ 64 KB, sem `data:`/`blob:`) — só configuração, nunca imagem.

## 7. Posts Virais e imagem própria

- Rota `/instagram/posts-virais` (noindex). Catálogo extensível em `lib/instagram/viral/viral-templates.ts` (template base do editor, formato 4:5, textos sugeridos). Sem IA/geração automática.
- Camadas: background → image (foto do usuário, *cover* com enquadramento e zoom 1–4×, nunca distorcida) → overlay → badge → title → subtitle → CTA. Trocar/remover a foto só muda a camada da imagem.
- Editor: "Adicionar minha imagem" (JPG/PNG/WEBP, até 15 MB), "Trocar imagem", remover, zoom (slider/botões), arrastar a foto na prévia (mouse ou toque) e pinça com dois dedos.
- Prévia (imagem, @conta, legenda, Agora/Agendar, data, hora) → Confirmar.
- Sem login: rascunho local (IndexedDB, 24 h, sem tokens) → `/entrar?callbackUrl=…`. Sem Instagram: "Conecte seu Instagram para publicar." → `/api/instagram/oauth/start?returnTo=…` → volta para a publicação com tudo restaurado (cookie `ig_oauth_return`, só caminhos internos `/instagram…`).
- Editar arte de uma publicação agendada: `/instagram/posts-virais?editar=<id>` (a gravação substitui mídia e template; o scheduler usa a versão nova).

## 7.1 Imagem sem corte e legenda com IA (compositor manual)

- **`fitMode` ("cover" | "contain")**: campo novo em `BackgroundImageState` (`lib/instagram/editor-state.ts`, dentro de `template_data`, sem migração de banco — é jsonb livre). Padrão `"cover"` (comportamento de sempre: preenche a área, cortando o excesso, com zoom/enquadramento). `"contain"` mostra a imagem inteira, sem cortar nada — o espaço sobrando fica com a cor de fundo da arte. Cálculo puro e testado em `computeContainRect()` (`lib/instagram/layout-math.ts`, mesmo padrão de `computeCoverRect()`); usado em `render.ts` nos dois lugares que desenham a imagem (fundo cheio e área recortada de template). Toggle "Preencher (corta) / Mostrar tudo (sem corte)" em `BackgroundControls.tsx`, disponível no Criador de Posts e reaproveitado pelo Criador de Carrosséis (mesmo `PostEditorState` por slide).
- **Botão "Gerar com IA" na legenda**: reaproveita o MESMO provedor de IA do Piloto Automático (`getContentAIProvider()`, `docs/content-automation.md`) através de uma rota dedicada (`POST /api/instagram/ai-caption`, sessão obrigatória) — não cria automação/execução nem grava uso em `generation_usage`, é só uma sugestão pontual a partir de um prompt curto que o usuário revisa/edita antes de publicar ou agendar, exatamente como se tivesse escrito a legenda à mão. UI em `PublicationComposerPanel.tsx`.

## 8. Segurança

- Token da Meta: só no servidor, cifrado (AES-256-GCM, `INSTAGRAM_TOKEN_ENCRYPTION_KEY`); nunca em respostas, `localStorage`, `sessionStorage`, props de componentes ou logs. `GET /api/instagram/account` devolve só `authenticated/connected/username/userId`.
- Posse validada em todas as operações (`user_id = sessão`) — GET, criar, editar, publicar, agendar, cancelar, excluir; mídias de edição também são checadas (teste "permissão entre usuários").
- Logs estruturados (`publication-log.ts`) com lista fechada de campos: `publicationId, type, status, trigger, attempt, scheduledAt, startedAt, completedAt, nextAttemptAt, errorKind, metaCode`.
- Notificações: ponto único `publication-notifier.ts` (hoje só log; pronto para e-mail via Resend).

## 9. Variáveis de ambiente

| Variável | Onde | O que colocar |
|---|---|---|
| `INSTAGRAM_SCHEDULER_SECRET` **ou** `CRON_SECRET` | Vercel (Production) e no disparador | Segredo aleatório ≥ 16 caracteres (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). O disparador envia `Authorization: Bearer <valor>`. |
| (já existentes) `DATABASE_URL`, `INSTAGRAM_TOKEN_ENCRYPTION_KEY`, Blob, `AUTH_*`, `INSTAGRAM_APP_*` | — | sem mudança |

## 10. Como ativar em produção

1. Rodar a migração: `npm run db:migrate` (aplica `0003_instagram_scheduler.sql`; aditiva, não apaga dados).
2. Cadastrar `INSTAGRAM_SCHEDULER_SECRET` na Vercel e fazer o deploy.
3. Configurar **um** disparador chamando a cada 1–5 min:
   - **cron-job.org** (gratuito, a cada 1 min): URL `https://alilu.com.br/api/cron/instagram-publish`, método POST, header `Authorization: Bearer <segredo>`.
   - **GitHub Actions** (mínimo 5 min, horário pode atrasar): workflow `schedule: - cron: "*/5 * * * *"` com `curl -fsS -X POST -H "Authorization: Bearer ${{ secrets.INSTAGRAM_SCHEDULER_SECRET }}" https://alilu.com.br/api/cron/instagram-publish`.
   - **Vercel Cron**: no plano Hobby só roda 1×/dia (e um cron mais frequente faz o deploy falhar) — por isso **não** há `vercel.json` com cron neste repositório. No plano Pro, adicionar `{"crons":[{"path":"/api/cron/instagram-publish","schedule":"* * * * *"}]}` e usar `CRON_SECRET`.
4. Conferir: `curl -i -X POST -H "Authorization: Bearer <segredo>" https://alilu.com.br/api/cron/instagram-publish` → `{"processed":0,"results":[]}`.

A regra de negócio não depende do provedor: trocar de disparador não exige mudar código.

## 11. Testar localmente

- Testes: `npm test` (inclui `instagram-scheduler.test.ts`, que roda o SQL real em Postgres em memória via PGlite — concorrência, retry, cancelamento, ownership, Reels, carrossel, Post Viral ponta a ponta).
- Manual: `npm run dev`, criar um agendamento para daqui a 2 min e disparar
  `curl -X POST -H "Authorization: Bearer $INSTAGRAM_SCHEDULER_SECRET" http://localhost:3000/api/cron/instagram-publish`.
  Atenção: com uma conta real conectada isso **publica de verdade**.
