# Piloto Automático de Conteúdo

Documentação técnica do módulo que gera conteúdo com IA e publica no Instagram sozinho, no dia e horário escolhidos por semana — reaproveitando 100% do agendador de publicação já existente (`docs/instagram-scheduler.md`).

## 1. Arquitetura

```
Navegador (assistente de nova automação / painel de automações)
   │  POST/PATCH /api/content-automation/…  (sessão Auth.js; nunca token da Meta)
   ▼
Next.js Route Handlers (Vercel Functions)
   │  automation-service.ts        → validação, posse (userId), regras de ativação
   │  automation-repository.ts     → SQL: content_automations + content_automation_days
   │  automation-run-repository.ts → SQL: automation_runs (claim atômico + idempotência)
   ▼
Disparador externo ──► GET|POST /api/cron/content-automation (Bearer segredo)
                       content-automation-cron.ts
                         │ 1. decide se hoje é dia de gerar (fuso da automação)
                         │ 2. claimRunForGeneration() — mesmo padrão de lock do agendador
                         │ 3. content-generation-service.ts → provider-factory.ts → IA
                         │ 4. createDraftImagePost / createDraftReelPost
                         ▼        (as MESMAS funções de sempre — nunca uma 2ª implementação)
                       instagram_posts (DRAFT ou já SCHEDULED)
                         ▼
Disparador externo ──► GET|POST /api/cron/instagram-publish (Bearer segredo, JÁ EXISTIA)
                       instagram-scheduler.ts → claimNextDuePost() → publishInstagramPublication()
                         ▼
                       Meta Graph API — ÚNICO lugar do projeto inteiro que fala com a Meta
```

**Decisão central desta arquitetura**: este módulo **nunca** fala com a Meta e **nunca** publica sozinho. Ele só gera conteúdo e cria/atualiza uma linha em `instagram_posts` — a mesma entidade "publicação" usada pelo editor manual, por Posts Virais e pelo agendador. Quem publica de verdade continua sendo `publishInstagramPublication()`, via o cron `/api/cron/instagram-publish` que já existia. Isso significa:

- Dois crons, **uma única camada de publicação**. Nunca existe uma segunda implementação de "falar com a Meta" ou de "criar uma publicação".
- Separar geração de publicação também é o que permite o **modo aprovação**: o conteúdo é gerado com antecedência (`generation_lead_minutes`, padrão 120 min antes do horário) e fica em `WAITING_APPROVAL` esperando revisão humana, em vez de já sair publicado.
- Se o cron de geração cair, o pior caso é "não gerou hoje" — o agendador de publicação continua funcionando normalmente para tudo o mais (Posts Virais, editor manual, publicações já agendadas).

## 2. Modelo de dados (migração `0004_content_automation.sql`, aditiva)

| Tabela | Papel |
|---|---|
| `content_automations` | Uma automação = uma conta do Instagram (`instagram_account_id`) + configuração geral (fuso, contexto de marca, modo aprovação/automático, origem de imagem/vídeo). |
| `content_automation_days` | Sempre 7 linhas por automação (segunda a domingo, criadas juntas — a UI só faz `UPDATE`, nunca `insert`/`delete` de um dia). Cada linha: habilitado?, POST ou REEL, prompt do dia, horário (`HH:mm`), mídia específica do dia (opcional, sobrescreve a da automação). |
| `automation_runs` | Uma linha por `(automation_id, data civil no fuso da automação)` — `UNIQUE (automation_id, run_date)` é a **chave da idempotência**: o cron pode rodar 100 vezes no mesmo dia que só gera uma vez. Guarda status, a publicação gerada (`publication_id` → `instagram_posts.id`), tentativas e erro. |
| `generation_usage` | Registro de custo/uso de tokens por execução — nunca bloqueia nada, é só auditoria. |
| `instagram_posts.automation_run_id` | Nova coluna (nullable) ligando a publicação à execução que a criou. `source` ganhou o valor `'AUTOMATION'` (antes só `MANUAL`/`VIRAL_POST`). |

Multi-conta desde o dia 1: toda automação pertence a um `instagram_account_id` (não a "a conta do usuário"), e `instagram_accounts` já suportava mais de uma conta por usuário no banco antes deste módulo — só faltavam funções de listagem (`listInstagramAccountsForUser`, `getInstagramAccountByIdForUser`), que foram adicionadas. Hoje só existe `@alilu.tec` em produção, mas nada na arquitetura assume isso.

## 3. Status de uma execução (`automation_runs.status`)

| Status | Significado |
|---|---|
| `PENDING` | Ainda não é hora, ou aguardando a próxima tentativa de geração (retry). |
| `GENERATING` | Claim ativo — a IA está sendo chamada agora. |
| `WAITING_APPROVAL` | Conteúdo gerado, publicação criada como `DRAFT`; modo aprovação (padrão) — aguarda um clique do usuário. |
| `SCHEDULED` | Publicação já agendada (`instagram_posts` em `SCHEDULED`) — modo automático, ou aprovada manualmente. A partir daqui é o agendador de sempre que assume. |
| `PUBLISHING` / `PUBLISHED` | Reservados para refletir o status espelhado de `instagram_posts` (o agendador é quem escreve `PUBLISHED` de verdade). |
| `FAILED` | Geração falhou e esgotou as tentativas (3, backoff 5/15/30 min). |
| `CANCELLED` | Rejeitado pelo usuário, ou automação pausada com "cancelar execuções futuras". |

## 4. Cron de geração, claim e idempotência

`GET|POST /api/cron/content-automation` (separado de `/api/cron/instagram-publish`):

1. Valida `Authorization: Bearer <segredo>` (tempo constante) — aceita `CONTENT_AUTOMATION_CRON_SECRET` dedicado, ou os mesmos `CRON_SECRET`/`INSTAGRAM_SCHEDULER_SECRET` do agendador de publicação.
2. Para cada automação `ACTIVE` (até `limit`, padrão 10, e ~45 s de orçamento):
   - Descobre o dia da semana "de hoje" **no fuso da automação** (`zonedToday`, `automation-time.ts`).
   - Se o dia está habilitado, tem prompt, e já é hora de gerar (`isDueForGeneration`: horário de publicação − `generation_lead_minutes`), garante a linha de `automation_runs` (`ensureRunForDate`, `INSERT … ON CONFLICT (automation_id, run_date) DO NOTHING` — a trava).
   - `claimRunForGeneration()` — **um único UPDATE** com subconsulta `FOR UPDATE SKIP LOCKED`, mesma técnica exata de `claimNextDuePost()` no agendador de publicação. Só uma chamada concorrente consegue o lock.
   - Gera o conteúdo (`content-generation-service.ts` → provedor de IA configurado) e cria a publicação via `createDraftImagePost`/`createDraftReelPost` (as funções de sempre).
   - Modo automático (`autoPublish=true` e `requireApproval=false`): publicação já nasce `SCHEDULED` no horário certo. Modo aprovação (padrão): nasce `DRAFT`, run fica `WAITING_APPROVAL`.
3. Falha na geração: backoff **5/15/30 min** (mesmos números do agendador de publicação), depois disso `FAILED` definitivo — nunca derruba as outras automações do mesmo lote.

Prova de idempotência: `__tests__/lib/content-automation.test.ts`, cenário "cron rodando duas vezes ao mesmo tempo" — duas chamadas simultâneas de `runContentAutomationCron()` geram conteúdo **uma única vez**, mesmo padrão de teste de `instagram-scheduler.test.ts`.

## 5. Aprovação

- `PATCH /api/content-automation/runs/[id]` com `{ "action": "approve" }` ou `{ "action": "reject" }`.
- **Aprovar** reaproveita `reschedulePost()` (o mesmo caminho que "Alterar horário" usa no calendário editorial manual) para agendar a publicação já criada — nunca uma nova rota de publicação. Se o horário original já passou (aprovação tardia), agenda para daqui a 2 minutos em vez de rejeitar por estar no passado.
- **Rejeitar** cancela a publicação gerada (`cancelPost()`) — o rascunho continua no histórico para auditoria, só marcado `CANCELLED`.

## 6. Geração de conteúdo com IA

- Interface única `AIContentProvider` (`ai-provider.ts`) — a regra de negócio nunca fala diretamente com um provedor específico. `provider-factory.ts` escolhe a implementação por `CONTENT_AI_PROVIDER` (hoje só `"anthropic"`, via `anthropic-content-provider.ts`). Trocar de provedor no futuro é implementar a interface de novo e adicionar um `case`, sem tocar em cron/UI/banco.
- Todo prompt combina: contexto geral da marca (`brand_context`, editável na automação) + prompt específico do dia + as últimas 7 legendas geradas (`listRecentGenerationsForAutomation`) como "evite repetir estes temas".
- Uso (tokens de entrada/saída, provedor, modelo) é registrado em `generation_usage` por execução — nunca bloqueia a geração se o registro falhar.
- Credenciais de IA **nunca** saem do servidor: todo o módulo é `server-only`, nenhum componente cliente importa nada daqui.

## 7. Pendências conhecidas (escopo desta etapa)

Duas restrições reais, deliberadas, e **impostas em dois lugares** (validação na criação/edição + defesa em profundidade dentro do próprio cron, que lança `ContentAutomationConfigError` se algo escapar da validação):

- **`imageMode = "AUTO_TEMPLATE"` não está disponível.** O motor de templates visuais do projeto (`lib/instagram/templates.ts` + `lib/instagram/render.ts`) usa a Canvas API do navegador — documentado no próprio cabeçalho de `render.ts` como impossível de rodar em Node/servidor (é exatamente o que um cron precisaria). Implementar isso exigiria um renderizador server-side novo (ex.: `@napi-rs/canvas` ou similar), fora do escopo desta entrega. Hoje só `"FIXED_IMAGE"` (uma imagem fixa por automação/dia) e `"MEDIA_LIBRARY"` (reaproveita a biblioteca de mídia já enviada) estão disponíveis — ambas reaproveitam `instagram_media`, sem nenhum código novo de upload.
- **`videoSelection` só aceita `"FIXED"`.** `"ROTATE"` (alterna vídeos numa lista) e `"RANDOM"` ficam para uma etapa futura — o schema já reserva os valores (`CHECK` inclui as três opções) para não exigir nova migração quando forem implementados.

Ambas ficam bloqueadas na validação (`automation-service.ts`, mensagens claras) e, redundantemente, no próprio cron — nunca é possível uma automação "escapar" e tentar gerar algo que o sistema não sabe montar.

Outras limitações desta etapa, não bloqueantes:

- O assistente de criação de automação é um formulário único (client-side, em etapas) em vez de rotas separadas por etapa — decisão de simplicidade que não muda nenhuma regra de negócio nem a API.
- Sem testes automatizados de UI (componentes React) para o módulo — os testes cobrem toda a camada de banco/regra de negócio/cron (`__tests__/lib/content-automation.test.ts` e `content-automation-time.test.ts`), no mesmo padrão do agendador de publicação.

## 8. Segurança

- Chave de IA (`CONTENT_AI_API_KEY`) e credenciais da Meta: só no servidor, nunca em respostas HTTP, `localStorage`, props de componente ou logs — o módulo inteiro é `server-only`.
- Posse validada em toda operação (`user_id = sessão`) — criar, editar, ativar, pausar, arquivar, excluir, duplicar automação; aprovar/rejeitar execução; usar mídia da biblioteca. Ver `__tests__/lib/content-automation.test.ts`, bloco "posse (ownership) entre usuários".
- O cron de geração é o único ponto sem sessão de usuário — protegido pelo mesmo mecanismo Bearer + comparação em tempo constante do agendador de publicação.

## 9. Variáveis de ambiente

Ver `.env.example` (seção "Piloto Automático de Conteúdo"): `CONTENT_AI_PROVIDER`, `CONTENT_AI_API_KEY`, `CONTENT_AI_MODEL`, `CONTENT_AUTOMATION_CRON_SECRET` (opcional — sem ela, aceita os mesmos segredos do agendador de publicação).

## 10. Como ativar em produção

1. Rodar a migração: `npm run db:migrate` (aplica `0004_content_automation.sql`; aditiva, não apaga dados).
2. Cadastrar na Vercel: `CONTENT_AI_API_KEY` e `CONTENT_AI_MODEL` (obrigatórios — sem eles nenhuma automação consegue ativar) e, opcionalmente, `CONTENT_AUTOMATION_CRON_SECRET`.
3. Configurar **um** disparador para `/api/cron/content-automation`, do mesmo jeito que já existe para `/api/cron/instagram-publish` (ver `docs/instagram-scheduler.md`, seção 10) — cron-job.org, GitHub Actions ou Vercel Cron. Frequência recomendada: a cada 5–15 min (a geração tem uma janela de antecedência de até 24 h — `generation_lead_minutes` —, então não precisa da mesma frequência de 1 min do cron de publicação).
4. Conferir: `curl -i -X POST -H "Authorization: Bearer <segredo>" https://alilu.com.br/api/cron/content-automation` → `{"processed":0,"results":[]}`.
5. Criar a primeira automação pela tela (`/instagram/piloto-automatico/nova`), configurar pelo menos um dia com prompt + mídia, e ativar.

**Única ação manual pendente**: obter uma chave de API de um provedor de IA (Anthropic) e configurar `CONTENT_AI_API_KEY`/`CONTENT_AI_MODEL` na Vercel — não há como automatizar a criação de uma credencial de terceiro.

## 11. Testar localmente

- Testes: `npm test -- content-automation` (inclui `content-automation.test.ts`, que roda o SQL real em Postgres em memória via PGlite — idempotência do cron, modo aprovação/automático, POST/REEL, multi-conta, ownership, retry — e `content-automation-time.test.ts`, matemática pura de fuso horário).
- Manual: `npm run dev`, criar uma automação com um dia habilitado para "agora + poucos minutos" (ajustando `generation_lead_minutes` para um valor pequeno) e disparar:
  `curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/content-automation`.
  Atenção: isso chama a API de IA de verdade (custo real) e, em modo automático com uma conta real conectada, o cron de publicação subsequente **publica de verdade**.
