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
| `content_automation_days` | Sempre 7 linhas por automação (segunda a domingo, criadas juntas — a UI só faz `UPDATE`, nunca `insert`/`delete` de um dia). Cada linha: habilitado?, POST ou REEL, **modo (`content_mode`: `AI` ou `MANUAL`)**, prompt do dia (modo `AI`) ou legenda final (`manual_caption`, modo `MANUAL`), horário (`HH:mm`), mídia específica do dia (opcional, sobrescreve a da automação). |
| `automation_runs` | Uma linha por `(automation_id, data civil no fuso da automação)` — `UNIQUE (automation_id, run_date)` é a **chave da idempotência**: o cron pode rodar 100 vezes no mesmo dia que só gera uma vez. Guarda status, a publicação gerada (`publication_id` → `instagram_posts.id`), tentativas e erro. |
| `generation_usage` | Registro de custo/uso de tokens por execução — nunca bloqueia nada, é só auditoria. |
| `instagram_posts.automation_run_id` | Nova coluna (nullable) ligando a publicação à execução que a criou. `source` ganhou o valor `'AUTOMATION'` (antes só `MANUAL`/`VIRAL_POST`). |

Multi-conta desde o dia 1: toda automação pertence a um `instagram_account_id` (não a "a conta do usuário"), e `instagram_accounts` já suportava mais de uma conta por usuário no banco antes deste módulo — só faltavam funções de listagem (`listInstagramAccountsForUser`, `getInstagramAccountByIdForUser`), que foram adicionadas. Hoje só existe `@alilu.tec` em produção, mas nada na arquitetura assume isso.

### 2.1 Modo manual por dia (`content_mode`)

Cada dia pode ser `AI` (padrão — legenda gerada a partir do `prompt` do dia, ver seção 6) ou `MANUAL` (a legenda sai exatamente como escrita em `manual_caption`, **sem nenhuma chamada ao provedor de IA**). É por dia, não por automação inteira: dá para misturar, ex. segunda com legenda fixa que nunca muda e sexta gerada por IA.

Consequência prática: **uma automação com todos os dias em modo `MANUAL` não exige `CONTENT_AI_API_KEY`/`CONTENT_AI_MODEL` configuradas** — `getContentAIProvider()` só é chamado quando o cron encontra um dia em modo `AI` (`content-automation-cron.ts`, `resolveCaptionForRun`). Validado em dois lugares, mesmo padrão de defesa em profundidade já usado para `imageMode`/`videoSelection`: na ativação (`automation-service.ts`, exige `manual_caption` não vazio para dia `MANUAL` habilitado) e de novo dentro do próprio cron.

### 2.2 Geração de arte com template (`imageMode = "AUTO_TEMPLATE"`, migração `0006_content_automation_auto_template.sql`)

A IA (ou o usuário, em modo `MANUAL`) gera só um **texto visual curto** — separado da legenda completa do Instagram — e o servidor desenha esse texto sobre a foto de fundo escolhida, usando o mesmo motor de template do compositor manual (Agendador). O resultado é uma imagem final (JPEG) salva como uma `instagram_media` normal, publicada exatamente como qualquer outra.

- **Reaproveitamento total do motor existente**: `lib/instagram/templates.ts` (biblioteca de templates) e `lib/instagram/layout-math.ts` (matemática de recorte/posicionamento) já eram funções puras, sem nenhuma dependência de navegador. `lib/instagram/render.ts` (a função `drawPost`) foi generalizado para depender de uma interface própria (`RenderingContext2DLike`/`RenderableImage`, cobrindo só os métodos realmente usados) em vez do `CanvasRenderingContext2D` do navegador diretamente — o navegador continua passando seu contexto real (com um cast de tipo, sem mudar nenhum comportamento) e o servidor passa o contexto do `@napi-rs/canvas`, que implementa a mesma API. **Nenhuma lógica de desenho/layout foi duplicada.**
- **Renderização server-side**: `lib/instagram/backend/template-render-service.ts` (`renderAndStoreAutomationArt`) — carrega a foto de origem com `@napi-rs/canvas` (`loadImage`), desenha o template com `drawPost()`, sobe o JPEG resultante ao Vercel Blob (`put()`, mesma autenticação OIDC já usada pelo upload manual — não precisa de `BLOB_READ_WRITE_TOKEN` novo) e cria a linha em `instagram_media` via `insertInstagramMedia()` (a mesma função do upload manual).
- **Slot de texto**: fixo em `"heading"` nesta etapa (`AUTO_TEMPLATE_TEXT_SLOT`, em `template-render-service.ts`) — todos os 5 templates existentes o usam como destaque principal. Escolher outro slot fica para uma etapa futura, junto de um editor de estilo completo por dia. Os outros três slots (`badge`/`body`/`footer`) são **sempre limpos** ao montar a arte (`buildAutomationArtState`) — nenhum texto de exemplo do template ("50% OFF", "Sua Loja Aqui" etc.) vaza para dentro da arte gerada.
- **Template padrão**: quando o dia não escolheu nenhum, usa `"frase-motivacional"` (`AUTO_TEMPLATE_DEFAULT_TEMPLATE_ID`) — foto em tela cheia + frase central + tipografia forte ("Motivação Clean", pedido na seção 9 do briefing de correção) — em vez do padrão histórico do editor manual (`"promocao"`), que reserva a foto numa área pequena recortada e não serve para este fluxo.
- **Origem da foto de fundo**: reaproveita exatamente a mesma resolução de mídia que `FIXED_IMAGE`/`MEDIA_LIBRARY` já usavam (`resolveImageMediaId`, dia > padrão da automação) — o modo `AUTO_TEMPLATE` não é uma origem de foto diferente, é uma **transformação** aplicada sobre a foto resolvida.
- **Véu (overlay) configurável**: `content_automation_days.overlay_opacity` (migração `0007`, fração 0 a 1, nullable) — 0%/10%/20%/30%/40% na UI, padrão 20% (`AUTO_TEMPLATE_DEFAULT_OVERLAY_OPACITY`) quando o dia não escolheu nenhum. Substitui o degradê fixo (até 74% de preto) que antes era aplicado sempre que o template tinha `scrimOverBackgroundImage`, sem nenhum controle — ver `drawBackgroundOverlay()` em `render.ts`. Um rascunho salvo antes desta migração (`overlay_opacity` nulo) continua se comportando exatamente como antes.
- **Ajuste dinâmico de fonte**: `drawTextSlots()` (`render.ts`) encolhe a fonte automaticamente (até um piso legível) quando o texto não cabe no bloco reservado, e corta com reticências como último recurso — nunca deixa o texto vazar para fora da arte nem o corta silenciosamente.
- **Prévia fiel**: `POST /api/content-automation/media/preview-art` (`{ imageMediaId, templateId, visualText, overlayOpacity }`) chama exatamente `renderAutomationArtBuffer()`, a mesma função usada na geração real — nunca uma implementação de prévia separada — e devolve a arte como `data:` URL, sem gravar nada (nem Blob, nem `instagram_media`, nem execução). Disponível no assistente e na edição para dias em modo `MANUAL` (onde o texto final já é conhecido).
- **Texto visual, por `content_mode`**:
  - `MANUAL`: o usuário escreve o texto em `content_automation_days.visual_text` (coluna nova, nullable — obrigatória só quando o dia está habilitado, é `POST` e a automação está em `AUTO_TEMPLATE`, validado em `automation-service.ts`).
  - `AI`: o provedor de IA gera o texto visual **na mesma chamada** que gera a legenda (`GeneratePostContentInput.includeVisualText`, `GeneratedPostContent.visualText`) — evita duplicar custo de IA por dia. Nunca é salvo em `visual_text` (o dia continua sendo um molde reaproveitado toda semana, não uma instância).
- **Template e estilo por dia**: `content_automation_days.template_id`/`style_config` (já existiam desde a migração `0004`, reservados para esta etapa) — `style_config` guarda o mesmo formato serializado do editor (`serializeEditorState`/`deserializeEditorState`, `lib/instagram/editor-state.ts`). Nesta entrega, a UI só deixa escolher o **template** por dia (dropdown com os 5 templates de `lib/instagram/templates.ts`); cores/fontes usam os padrões do template — um editor de estilo completo por dia fica para uma etapa futura.
- **Rastreabilidade**: `instagram_media` ganhou `generated_from_media_id` (a foto de origem) e `automation_run_id` (a execução que gerou a arte) — nullable, nunca afeta uploads manuais existentes.
- **Limitação conhecida — fontes**: as fontes do editor (`lib/instagram/fonts.ts`) são fontes de sistema do navegador do usuário (Segoe UI, Impact, etc.), que não existem no container Linux da Vercel. Sem registrar arquivos de fonte reais via `GlobalFonts` do `@napi-rs/canvas`, o texto renderiza com a fonte padrão do Skia — legível, mas não necessariamente idêntica à prévia do compositor. Registrar fontes reais é uma melhoria futura, não bloqueia a funcionalidade.

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

- Só se aplica a dias em modo `AI` (padrão). Um dia em modo `MANUAL` nunca passa por esta seção — `resolveCaptionForRun()` (`content-automation-cron.ts`) devolve `manual_caption` direto, sem chamar `getContentAIProvider()` nem `content-generation-service.ts`.
- Interface única `AIContentProvider` (`ai-provider.ts`) — a regra de negócio nunca fala diretamente com um provedor específico. `provider-factory.ts` escolhe a implementação por `CONTENT_AI_PROVIDER` (hoje só `"anthropic"`, via `anthropic-content-provider.ts`). Trocar de provedor no futuro é implementar a interface de novo e adicionar um `case`, sem tocar em cron/UI/banco.
- Todo prompt combina: **o dia da semana configurado para aquela execução** (`AutomationDayRecord.dayOfWeek` → `DAY_OF_WEEK_LABEL`, nunca o dia atual do servidor — única fonte confiável, ver correção abaixo) + contexto geral da marca (`brand_context`, editável na automação) + prompt específico do dia + as últimas 7 legendas geradas (`listRecentGenerationsForAutomation`) como "evite repetir estes temas".
- **Correção do bug "segunda-feira numa automação de quinta"**: o prompt enviado à IA nunca informava o dia da semana — o modelo simplesmente não tinha como saber que dia era, e podia inventar qualquer um. `content-generation-service.ts` agora sempre passa `dayOfWeekLabel: DAY_OF_WEEK_LABEL[day.dayOfWeek]` (o dia REALMENTE configurado no item/agendamento) para `AIContentProvider.generatePost/generateReel`, e `anthropic-content-provider.ts` abre o prompt com duas linhas explícitas ("Dia da semana desta publicação: Quinta-feira." + instrução para nunca citar outro dia). O campo é opcional na interface só para a chamada avulsa do Agendador (`/api/instagram/ai-caption`, sem automação/dia por trás, mantém o comportamento "hoje").
- Uso (tokens de entrada/saída, provedor, modelo) é registrado em `generation_usage` por execução — nunca bloqueia a geração se o registro falhar.
- Credenciais de IA **nunca** saem do servidor: todo o módulo é `server-only`, nenhum componente cliente importa nada daqui.

## 7. Pendências conhecidas (escopo desta etapa)

Uma restrição real, deliberada, e **imposta em dois lugares** (validação na criação/edição + defesa em profundidade dentro do próprio cron, que lança `ContentAutomationConfigError` se algo escapar da validação):

- **`videoSelection` só aceita `"FIXED"`.** `"ROTATE"` (alterna vídeos numa lista) e `"RANDOM"` ficam para uma etapa futura — o schema já reserva os valores (`CHECK` inclui as três opções) para não exigir nova migração quando forem implementados. A mesma limitação vale para fotos em modo `AUTO_TEMPLATE`/`MEDIA_LIBRARY`: hoje a variação de foto entre dias é sempre manual (escolher uma mídia diferente por dia no assistente) — não existe ainda uma rotação automática `FIXED`/`ROTATE`/`RANDOM` para imagens, análoga à de vídeo.

Outras limitações desta etapa, não bloqueantes:

- `imageMode = "AUTO_TEMPLATE"` (seção 2.2) usa sempre o slot de texto `"heading"` e os estilos padrão do template escolhido (cor/fonte/posição não são editáveis por dia ainda — só template e véu) — e sem registrar fontes reais para o renderizador server-side (usa a fonte padrão do Skia).
- O assistente de criação de automação é um formulário único (client-side, em etapas) em vez de rotas separadas por etapa — decisão de simplicidade que não muda nenhuma regra de negócio nem a API.
- Sem testes automatizados de UI (componentes React) para o módulo — os testes cobrem toda a camada de banco/regra de negócio/cron (`__tests__/lib/content-automation.test.ts` e `content-automation-time.test.ts`), no mesmo padrão do agendador de publicação.

## 8. Segurança

- Chave de IA (`CONTENT_AI_API_KEY`) e credenciais da Meta: só no servidor, nunca em respostas HTTP, `localStorage`, props de componente ou logs — o módulo inteiro é `server-only`.
- Posse validada em toda operação (`user_id = sessão`) — criar, editar, ativar, pausar, arquivar, excluir, duplicar automação; aprovar/rejeitar execução; usar mídia da biblioteca. Ver `__tests__/lib/content-automation.test.ts`, bloco "posse (ownership) entre usuários".
- O cron de geração é o único ponto sem sessão de usuário — protegido pelo mesmo mecanismo Bearer + comparação em tempo constante do agendador de publicação.

## 9. Variáveis de ambiente

Ver `.env.example` (seção "Piloto Automático de Conteúdo"): `CONTENT_AI_PROVIDER`, `CONTENT_AI_API_KEY`, `CONTENT_AI_MODEL`, `CONTENT_AUTOMATION_CRON_SECRET` (opcional — sem ela, aceita os mesmos segredos do agendador de publicação).

`CONTENT_AI_API_KEY`/`CONTENT_AI_MODEL` só são obrigatórias na prática se pelo menos uma automação tiver algum dia em modo `AI` (seção 2.1) **ou** se o botão "Gerar com IA" do compositor manual (Agendador — `docs/instagram-scheduler.md`) for usado; ambos reaproveitam o mesmo `getContentAIProvider()`. Uma instalação 100% manual (automações e Agendador sem nenhuma chamada de IA) não precisa dessas variáveis.

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
