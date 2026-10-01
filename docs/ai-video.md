# Imagem para vídeo com IA + Créditos de IA

Documentação técnica da ferramenta `/videos/imagem-para-video`, que transforma uma imagem em um vídeo curto com IA. A geração usa a **Runway API** como fornecedora e é paga com **Créditos de IA da Alilu**, comprados antecipadamente via Asaas.

> **Modelo comercial.** O cliente compra créditos da **Alilu**. A Alilu compra capacidade da Runway **à parte**, com cartão próprio e recarga automática no painel da Runway. **Não existe repasse financeiro por compra Asaas → Runway.** Créditos não são dinheiro: não podem ser sacados nem transferidos.

## 1. Arquitetura

```
Navegador (/videos/imagem-para-video, /minha-conta/creditos-ia)
   │  imagem → Vercel Blob (upload direto, prefixo ai-video/{userId}/input/)
   │  POST /api/ai-video/generations {idempotencyKey, imageUrl, prompt, tier, duration, ratio}
   ▼
generation-service.ts
   validar → recalcular preço NO SERVIDOR → trava de preço/limites
   → criar geração (idempotente) → RESERVAR créditos (atômico)
   → provider.create() → acompanhar (cron + consulta da tela)
   → SUCESSO: copiar MP4 p/ Blob + CONSUMIR reserva | FALHA: DEVOLVER reserva
   ▼
providers/provider.ts (interface) ── runway-provider.ts (única implementação hoje)

Asaas ──Webhook──► /api/billing/asaas-webhook ──► credit-purchase-service.ts ──► carteira (PURCHASE)
Cron externo ──► /api/cron/ai-video (Bearer) ──► runAiVideoCron(): avança gerações + retenção

provedor de IA (só movimento) → validar MP4 (ffprobe) → overlays fixos (canvas + FFmpeg) → Blob → CONSUMIR
```

| Pasta/arquivo | Papel |
|---|---|
| `lib/ai-video/types.ts`, `lib/ai-video/pricing.ts` | Tipos e matemática comercial, sem acesso a banco. O simulador do admin também usa. |
| `lib/ai-video/backend/wallet-repository.ts` | Carteira e livro-razão (ledger) com movimentos atômicos. |
| `lib/ai-video/backend/pricing-repository.ts` | Configuração de preço, tabela de modelos e pacotes, todos no banco. |
| `lib/ai-video/backend/generation-*.ts` | Gerações: SQL, máquina de estados e cron. |
| `lib/ai-video/backend/providers/*` | Abstração de provedor. Para adicionar outro, implemente `ImageToVideoProvider` e registre em `provider-registry.ts`. |
| `lib/ai-video/backend/credit-purchase-*.ts` | Compra de créditos pelo Asaas, Webhook, estorno e reembolso. |
| `lib/ai-video/backend/admin-service.ts`, `lib/admin/admin-access.ts` | Telas de admin (`ADMIN_EMAILS`). |
| `db/migrations/0019_ai_video_credits.sql` | Tabelas e valores iniciais (seeds). |

## 2. Provedores e roteamento por qualidade

O usuário escolhe só **Econômica / Padrão / Premium**. O servidor decide o provedor e o modelo pela linha ativa de `ai_video_model_pricing`, e o nome do provedor nunca chega à tela. Para trocar de modelo, basta editar a tabela (admin): o código não muda.

| Qualidade | Provedor / modelo | Resolução | Durações | Custo da API | Créditos |
|---|---|---|---|---|---|
| Econômica (padrão da tela) | fal.ai `fal-ai/wan/v2.2-5b/image-to-video` | 720p, 24 fps | 5 s | US$ 0,15 por vídeo | 65 |
| Padrão | Runway `gen4_turbo` | 720p | 5 s / 10 s | US$ 0,05/s | 100 / 195 |
| Premium | Runway `gen4.5` | 720p | 5 s / 10 s | US$ 0,12/s | 230 / 450 |

Como os modelos foram escolhidos (pesquisa de 01/10/2026):

- **Wan 2.2 5B no fal.ai** foi o modelo útil mais barato encontrado: 40% abaixo do gen4_turbo, com uso comercial permitido, API de fila documentada e 720p.
- Na própria Runway, `wan3` 480p (5 créditos/s) custa o mesmo que o gen4_turbo 720p. O `gemini_omni_flash_1.1` 360p (US$ 0,18 por 5 s) só tem resolução baixa demais para Reels.
- No fal.ai, o Wan 2.2 A14B 480p sai a US$ 0,20 por 5 s e o LTX-2 Fast 1080p a US$ 0,04/s.
- Não existe modelo de qualidade aceitável perto de US$ 0,05 por 5 s. Por isso, **25 créditos por 5 s não fecham com margem** com o crédito a R$ 0,04.

### Runway

- Base: `https://api.dev.runwayml.com/v1`.
- Cabeçalhos: `Authorization: Bearer $RUNWAYML_API_SECRET` e `X-Runway-Version: 2024-11-06`.
- Criação da tarefa: `POST /v1/image_to_video` com `{ model, promptImage, promptText, ratio, duration }`.
- Consulta: `GET /v1/tasks/{id}`. Status possíveis: `PENDING`, `THROTTLED`, `RUNNING`, `SUCCEEDED`, `FAILED` e `CANCELLED`.
- Cancelamento: `DELETE /v1/tasks/{id}`.
- Proporções aceitas: `720:1280`, `960:960` e `1280:720`. Duração de 2 a 10 s.
- Classificação de falhas: `SAFETY.*` = moderação; `INPUT_PREPROCESSING.*` / `ASSET.*` = imagem inválida.

### fal.ai

- Fila REST: `POST https://queue.fal.run/{modelo}` com `Authorization: Key $FAL_KEY`, que devolve `request_id`.
- Status: `GET …/requests/{id}/status`, com os valores `IN_QUEUE`, `IN_PROGRESS` e `COMPLETED`. `COMPLETED` pode trazer `error` / `error_type`.
- Resultado: `GET …/requests/{id}`, com `video.url`. Cancelamento: `PUT …/requests/{id}/cancel`.
- Parâmetros enviados: `image_url`, `prompt`, `resolution: "720p"`, `aspect_ratio`, `num_frames: 121`, `frames_per_second: 24` e `enable_safety_checker: true`.
- O id externo guardado é `modelo::request_id`, validado antes de qualquer chamada.

### Regras comuns aos provedores

- As URLs de saída são temporárias. O MP4 final é sempre gravado no Vercel Blob.
- Erros 429, 5xx ou de rede **no envio** geram nova tentativa em 1, 3 e 10 min; depois disso, os créditos são devolvidos.
- Moderação conta *strike* para o usuário e leva a bloqueio temporário (seção 6).
- Para adicionar um provedor, implemente `ImageToVideoProvider` (`providers/provider.ts`) e registre-o em `provider-registry.ts`.

## 3. Precificação

A conta usa **margem bruta sobre a venda**, nunca "custo + X%":

```
custoTotal = custoUSD × câmbio × multiplicadorSegurança + infra
preço      = custoTotal / (1 − taxaPagamento − imposto − margemAlvo)
créditos   = ceil(preço / valorDoCrédito / 5) × 5
```

Configuração inicial (`ai_pricing_config`):

| Parâmetro | Valor inicial |
|---|---|
| Valor do crédito | R$ 0,04 |
| Margem alvo / mínima | 50% / 40% |
| Câmbio de referência | 5,50 |
| Multiplicador de segurança | 1,20 |
| Taxa de pagamento / imposto | 5% / 0% |
| Infraestrutura por geração | R$ 0,15 |
| Bônus de boas-vindas | 100 créditos |

Créditos cobrados por vídeo (todos com margem ≥ 50%):

| Qualidade | 5 s | 10 s |
|---|---|---|
| Econômica | 65 | — |
| Padrão | 100 | 195 |
| Premium | 230 | 450 |

Para um vídeo Econômico de 5 s, a conta fica assim:

```
custo   = US$ 0,15 × 5,50 × 1,2 + R$ 0,15 = R$ 1,14
preço   = R$ 1,14 / (1 − 5% − 50%)     = R$ 2,53
créditos = 63,3 / R$ 0,04 → 65 créditos (múltiplo de 5)
```

Outros parâmetros da política (admin):

| Parâmetro | Valor inicial | Para que serve |
|---|---|---|
| `retry_discount_pct` | 50% | Desconto em "Gerar novamente". |
| `max_retries_per_generation` | 3 | Limite de regenerações com desconto por vídeo. |
| `postprocess_cost_brl` | R$ 0 | Custo do FFmpeg; só registrado, não entra no preço. |
| `issue_review_threshold` | 5 | Reportes em 30 dias que marcam o usuário para revisão. |

**Prévia:** a própria qualidade **Econômica** faz o papel de prévia barata. Depois de um vídeo Econômico, a tela oferece "Gostei — gerar versão final no Padrão", que reaproveita imagem, prompt, formato e textos. Uma prévia de 10 créditos daria prejuízo: o mínimo técnico, um vídeo de 2 s, custa cerca de 40 créditos para manter a margem.

Pacotes (`ai_credit_packages`). A margem vale para o pior modelo ativo, já com a taxa de 5% descontada:

| Pacote | Créditos | Preço | Margem |
|---|---|---|---|
| Básico | 500 | R$ 19,90 | ≈ 49,7% |
| Criador | 1.500 | R$ 49,90 | ≈ 40,9% |
| Pro | 5.000 | R$ 164,90 | ≈ 40,4% |

O preço do Pro foi reajustado: a R$ 149,90 ele ficava abaixo da margem mínima.

**Trava de preço** (`PRICE_GUARD_BLOCKED`). Antes de reservar créditos, a geração é bloqueada nestes casos:

- o custo do provedor passa de `max_provider_cost_usd`;
- a margem fica abaixo da mínima;
- o gasto do dia ou do mês com o provedor passaria do limite.

Quando isso acontece, nada é reservado nem enviado. A tentativa fica registrada para o admin, e o usuário vê "temporariamente indisponível" (HTTP 503). Pacotes abaixo da margem mínima também não podem ser vendidos nem ativados.

## 4. Créditos e ledger

A tabela `ai_credit_wallets` guarda `available`, `reserved` e `unrecovered_credits`. Cada movimento gera uma linha em `ai_credit_transactions`:

| Tipo | Disponível | Reservado | Quando |
|---|---|---|---|
| `PURCHASE` | + | | Webhook confirmado |
| `BONUS` | + | | Boas-vindas (uma vez por usuário) |
| `RESERVE` | − | + | Ao criar a geração |
| `CONSUME` | | − | Vídeo pronto e copiado |
| `REFUND` | + | − | A geração falhou |
| `PURCHASE_REFUND` / `CHARGEBACK` | − (até o saldo) | | Estorno ou contestação da compra |
| `ADMIN_ADJUSTMENT` / `EXPIRE` | ± | | Ajuste manual / expiração |

**Concorrência.** O driver HTTP do Neon não tem transação, então cada movimento é **um único comando SQL**: um `update` com a condição `available + delta >= 0` dentro de uma CTE, seguido do `insert` no ledger. A chave única `(type, reference_type, reference_id)` garante que o mesmo movimento nunca é aplicado duas vezes, mesmo com cliques duplos, reentrega de Webhook ou o cron e a tela processando ao mesmo tempo.

**Idempotência.** Ela é garantida em quatro pontos:

- geração: `unique (user_id, idempotency_key)`;
- compra: `asaas_payment_id` único;
- evento do Asaas: `event_id`;
- ledger: chave de referência.

**Ordem segura.** A devolução e o consumo acontecem **antes** da troca de status. Se o processo cair entre os dois passos, o próximo ciclo só ajusta o status, sem mexer no saldo de novo.

## 5. Pagamento (Asaas)

1. `POST /api/ai-video/credits/checkout {packageCode}`. O preço vem do **banco**. O cliente Asaas é reaproveitado (de `billing_customers` ou da assinatura do Piloto). A cobrança avulsa é criada com `billingType: UNDEFINED` e `externalReference = purchase.id`. Uma cobrança pendente com menos de 24 h é reaproveitada.
2. **Nenhum crédito entra na tela de sucesso.** O crédito só entra quando o Webhook chega **e** o `GET /payments/{id}` confirma o status `CONFIRMED`, `RECEIVED` ou `RECEIVED_IN_CASH`.
3. Webhook (`/api/billing/asaas-webhook`, o mesmo da assinatura): uma cobrança **sem** `subscription` vai para `handleCreditPurchasePaymentEvent`. Cada evento faz o seguinte:
   - `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED`: marca a compra como `PAID` e lança `PURCHASE` (uma vez só).
   - `PAYMENT_DELETED`: marca a compra como `CANCELED`.
   - `PAYMENT_REFUNDED` / `PAYMENT_CHARGEBACK_REQUESTED`: marca `REFUNDED` / `CHARGEBACK` e debita **até o saldo disponível**. O que já foi usado vai para `unrecovered_credits`, que aparece em admin > custos.
4. **Reembolso pelo usuário** (direito de arrependimento, CDC): botão "Pedir reembolso" em `/minha-conta/creditos-ia`. Vale só para compras pagas, dentro de 7 dias (`purchase_refund_window_days`) e **sem nenhum crédito usado**. O fluxo é:
   1. Os créditos saem primeiro.
   2. A Alilu pede o estorno com `POST /payments/{id}/refund`.
   3. Se o Asaas recusar (boleto, por exemplo), os créditos voltam e o usuário é orientado a falar com o suporte.

   Quando o Webhook do estorno chega depois, ele não debita de novo.

Eventos que precisam estar marcados no Webhook do painel Asaas: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_DELETED`, `SUBSCRIPTION_DELETED` e `SUBSCRIPTION_INACTIVATED`.

## 6. Geração e jobs

Status: `CREATED` → `CREDIT_RESERVED` → `SUBMITTED` → `QUEUED` / `PROCESSING` (a IA gerando) → `AI_COMPLETED` → `POST_PROCESSING` (só com textos/logo) → `COMPLETED`. Em caso de falha, vai para `REFUNDED` ou `FAILED`. Depois de `COMPLETED`, vira `EXPIRED` quando a retenção apaga o MP4. `PRICE_GUARD_BLOCKED` só aparece para o admin.

A tela mostra as etapas assim:

| Status | Texto na tela |
|---|---|
| `SUBMITTED` / `QUEUED` / `PROCESSING` | "Gerando animação…" |
| `AI_COMPLETED` | "Finalizando vídeo…" |
| `POST_PROCESSING` | "Aplicando textos e identidade visual…" |
| `COMPLETED` | "Concluído" |

Regras de execução:

- **Avanço.** A geração avança pela consulta da tela (a cada 5 s) e pelo cron. Os dois usam `claimGeneration` (lock com `skip locked` e TTL de 4 min), então dois crons simultâneos nunca finalizam nem cobram duas vezes.
- **Retomada.** Quando a IA termina, a URL temporária é gravada em `AI_COMPLETED`. Se o processo cair, a finalização retoma dali, sem consultar o provedor de novo.
- **Finalização** (`finalizeGeneration`):
  1. baixa o MP4;
  2. **valida com ffprobe** (tamanho, trilha de vídeo, duração);
  3. aplica os overlays, se houver;
  4. grava no Blob;
  5. **consome** a reserva;
  6. marca `COMPLETED`.
- **Falha na finalização.** Download, FFmpeg ou storage falhando geram até 3 tentativas, com 30 s entre elas; depois, os créditos são devolvidos e o custo do provedor fica registrado.
- **Timeout.** Se a IA não terminar em 30 min, a tarefa é cancelada no provedor e os créditos são devolvidos.
- **Limites.** `max_generations_per_user_per_hour` e bloqueio por moderação.
- **Créditos insuficientes** (402): o rascunho guarda imagem, configurações e overlays; o usuário compra créditos e volta para a tela.

## 6.1 Textos e logotipos (pós-processamento)

A IA **nunca** desenha texto. Com **"Preservar textos e logotipos"** (ligado por padrão), o fluxo é este:

1. O provedor gera só o movimento. O prompt enviado ganha uma instrução para manter texto e logo estáveis, o que **ajuda, mas não garante**. O texto dos overlays nunca é enviado ao provedor.
2. `video-overlay-service.ts` desenha cada overlay em uma camada PNG do tamanho do quadro, com `@napi-rs/canvas` e fontes **embutidas** (DejaVu Sans/Serif em `lib/ai-video/backend/fonts`). Isso garante acentos certos sem depender das fontes do servidor. O texto encolhe para caber na caixa e nunca é cortado nem alterado.
3. O FFmpeg (`ffmpeg-static`) sobrepõe as camadas na ordem do `zIndex`, com janela de tempo (`enable=between(t,início,fim)`), e reencoda em H.264/yuv420p com `+faststart`.

Detalhes do modelo de overlay (`lib/ai-video/overlays.ts`, pronto para um editor completo):

- **Tipos:** `TEXT`, `URL`, `LOGO` e `IMAGE`.
- **Campos:** `x`, `y`, `width` e `height` normalizados de 0 a 1, `fontSize` (fração da altura), `fontFamily`, `fontWeight`, `textAlign`, `backgroundColor`, `textColor`, `opacity`, `startTime`, `endTime` e `zIndex`.
- **Validação no servidor:** no máximo 8 overlays e 120 caracteres por texto. Logo/imagem só do Blob do **próprio** usuário.
- **Modo simples (1ª versão da tela):** logo, URL, texto principal e texto secundário em 7 posições pré-definidas; itens na mesma posição são empilhados (`buildSimpleOverlays`).
- **Sem a opção ou sem nenhum campo preenchido:** nenhum overlay é aplicado e o vídeo da IA vai direto ao Blob, só validado.
- **Regiões protegidas:** `ProtectedRegion` (`TEXT`, `LOGO`, `FACE`, `CUSTOM`) já existe no modelo e na coluna `protected_regions`, preparada para máscara/região no futuro. Ainda não há editor nem uso.
- **Texto já presente na imagem enviada:** a IA pode distorcê-lo. A orientação na tela é reescrevê-lo como overlay. Nenhum dos provedores atuais documenta *motion brush*, máscara ou *preserve structure* na API de image-to-video.

**Validação visual automatizada** (`ai-video-overlays.test.ts`): um vídeo de teste recebe "www.alilu.com.br" e o quadro extraído do MP4 final é comparado, pixel a pixel na caixa do texto, com a camada desenhada pelo Alilu. A diferença média precisa ficar abaixo de 12/255, o que sobra é só ruído de compressão. Isso prova que o texto final é o do Alilu, nunca uma versão reescrita pela IA.

## 6.2 Política de créditos em erro

| Cenário | O que acontece |
|---|---|
| **Erro técnico**: timeout, 5xx do provedor, falha ao baixar ou ao gravar, FFmpeg falhou, geração não concluída | Devolução **automática**. |
| **Resultado inválido detectável**: MP4 vazio, sem trilha de vídeo, sem duração, provedor sem resultado | Devolução **automática**, validada com ffprobe antes de consumir. |
| **Vídeo corrompido reportado** ("Reportar problema" → corrompido / erro técnico) | O servidor baixa o arquivo e revalida. Defeito confirmado devolve os créditos já consumidos (`REFUND`, uma vez só). Se o arquivo estiver válido, a tela oferece "Gerar novamente". |
| **Usuário não gostou** (vídeo válido) | Não há devolução automática. A tela oferece **"Gerar novamente" com 50% de desconto**. |

Como funciona o **"Gerar novamente"**:

- Cria uma geração filha (`parent_generation_id`, `pricing_kind = RETRY_DISCOUNT`) com a **mesma imagem**. Prompt, duração, formato, qualidade e overlays podem ser editados.
- O preço é `ceil(preço cheio × (1 − desconto) / 5) × 5`, com piso no **ponto de equilíbrio**: a regeneração nunca fica abaixo do custo e nunca dá prejuízo.
- Ela não passa pela margem mínima (é subsidiada de propósito), mas continua sujeita ao custo máximo e aos limites diário e mensal.
- Limite de `max_retries_per_generation` regenerações por vídeo.

Como funciona o **"Reportar problema"** (`ai_video_generation_issues`):

- Tipos: texto/logo deformado, vídeo corrompido, movimento incorreto, resultado muito diferente, erro técnico e outro.
- Um reporte por vídeo.
- Com `issue_review_threshold` ou mais reportes em 30 dias, o usuário aparece em "Usuários para revisão" no admin, **sem bloqueio automático**.

**"Gostei"** é só uma métrica (`user_feedback`) e não mexe em créditos.

A idempotência continua valendo em toda a cadeia: chave por geração e ledger único por (tipo, referência), o que protege contra duplo clique, refresh, retry do job, timeout e resposta atrasada.

## 7. Armazenamento e retenção

- Entrada: `ai-video/{userId}/input/…`. O servidor só aceita URL HTTPS do Blob público do projeto **no prefixo do próprio usuário**, com até 16 MB, em JPEG, PNG ou WebP.
- Saída: `ai-video/{userId}/generated/{id}.mp4`. Fica guardada por **7 dias** (`retention_days_free`) ou **30 dias** (`retention_days_paid`) para quem já fez alguma compra. Depois disso, o cron apaga o arquivo e marca a geração como `EXPIRED`.

## 8. Segurança

- `RUNWAYML_API_SECRET` e `FAL_KEY` só existem no servidor e nunca são logadas. Toda chamada a provedor é feita pelo backend.
- O usuário nunca vê custo do provedor, modelo interno nem ID de tarefa (`ai-video-dto.ts`).
- Preço, créditos e pacote são sempre recalculados no servidor; o valor que vem do front é ignorado.
- O cron usa `Authorization: Bearer` com comparação em tempo constante. O segredo é `AI_VIDEO_CRON_SECRET`, `CRON_SECRET` ou `INSTAGRAM_SCHEDULER_SECRET`, com pelo menos 16 caracteres.
- As telas de admin (`/admin/ia/precificacao` e `/admin/ia/custos`) e a API `PATCH /api/admin/ai-video/pricing` só respondem para e-mails listados em `ADMIN_EMAILS`. Para qualquer outro usuário, as páginas retornam 404 e a API retorna 403.

## 9. Variáveis de ambiente

| Variável | Uso |
|---|---|
| `RUNWAYML_API_SECRET` | Chave da API de desenvolvedor da Runway (dev.runwayml.com): qualidades Padrão e Premium. |
| `FAL_KEY` | Chave da API do fal.ai (fal.ai/dashboard/keys): qualidade Econômica. |
| `AI_VIDEO_CRON_SECRET` | Opcional; sem ela, usa `CRON_SECRET` ou `INSTAGRAM_SCHEDULER_SECRET`. |
| `ADMIN_EMAILS` | E-mails de admin, separados por vírgula. |
| `ASAAS_*`, `BLOB_READ_WRITE_TOKEN` | Já existentes. |

## 10. Deploy (ordem)

Primeira implantação (etapa 10):

1. `npm run db:migrate` (aplica a `0019_ai_video_credits.sql`) **antes** do deploy do código.
2. Na Vercel, configure `RUNWAYML_API_SECRET`, `ADMIN_EMAILS` e, se quiser, `AI_VIDEO_CRON_SECRET`.
3. Na Runway (dev.runwayml.com), crie a organização e a chave de API, compre créditos e ative a recarga automática (*auto-billing*) com limite mensal.
4. No Asaas, marque os eventos novos no Webhook: `PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED` e `PAYMENT_DELETED`.
5. No cron externo, chame `GET https://alilu.com.br/api/cron/ai-video` **a cada 1 minuto** com `Authorization: Bearer <segredo>`.
6. Em `/admin/ia/precificacao`, confira câmbio, preços e limites. Depois faça um teste ponta a ponta com o Asaas Sandbox.

Evolução (etapa 11, faixas, overlays e regeneração):

1. `npm run db:migrate` (aplica a `0020_ai_video_tiers_overlays.sql`) **antes** do deploy. A migração renomeia as faixas: gen4_turbo vira Padrão, gen4.5 vira Premium, e entra o Econômico fal.ai.
2. Crie a conta no **fal.ai**, compre créditos (*billing*), gere uma chave em *Keys* e configure `FAL_KEY` na Vercel. Sem a chave, o Econômico falha e devolve os créditos; desative a linha no admin enquanto a chave não estiver pronta.
3. Faça o deploy do código. O `next.config.ts` já inclui os binários do ffmpeg/ffprobe e as fontes nas rotas `**/api/cron/ai-video` e `**/api/ai-video/generations`.
4. Teste um vídeo Econômico com "www.alilu.com.br" como URL e confira a legibilidade.

## 11. Testes

| Arquivo | O que cobre |
|---|---|
| `__tests__/lib/ai-video-pricing.test.ts` | Fórmula, créditos sugeridos e margem dos pacotes. |
| `__tests__/lib/ai-video-generation.test.ts` | Carteira (duplicidade, saldo negativo, bônus), fluxo completo, clique duplo, 402, trava de preço, erro definitivo ou temporário, moderação, timeout, falha na cópia e retenção. |
| `__tests__/lib/ai-video-credit-purchase.test.ts` | Checkout, Webhook idempotente, chargeback com crédito já usado, cancelamento e reembolso (prazo, uso, recusa do Asaas, outro usuário). |
| `__tests__/lib/ai-video-overlays.test.ts` | Validação e modo simples dos overlays, argumentos do FFmpeg, MP4 vazio/corrompido, logo e **validação visual** do "www.alilu.com.br". |
| `__tests__/lib/ai-video-fal-provider.test.ts` | Fila do fal.ai (envio, status, resultado), classificação de falhas, chave nunca exposta, id adulterado. |
| `__tests__/lib/ai-video-tiers-retry-issues.test.ts` | Roteamento das faixas e preços, overlays aplicados antes de consumir, overlays ignorados sem a opção, logo de outro usuário, falha do FFmpeg, MP4 inválido, regeneração com desconto (piso no custo, limite, mesma imagem, trava), reportar problema (devolução confirmada, válido, revisão) e dois crons simultâneos. |

Neste ambiente os testes rodam com `npx vitest run <arquivo> --environment node --pool threads`.
