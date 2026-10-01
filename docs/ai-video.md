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

## 2. Provedor: Runway

API consultada em 01/10/2026:

- Base: `https://api.dev.runwayml.com/v1`.
- Cabeçalhos: `Authorization: Bearer $RUNWAYML_API_SECRET` e `X-Runway-Version: 2024-11-06`.
- Criação da tarefa: `POST /v1/image_to_video` com `{ model, promptImage, promptText, ratio, duration }`.
- Consulta: `GET /v1/tasks/{id}`. Status possíveis: `PENDING`, `THROTTLED`, `RUNNING`, `SUCCEEDED`, `FAILED` e `CANCELLED`.
- Cancelamento: `DELETE /v1/tasks/{id}`.
- Proporções aceitas: `720:1280` (9:16), `960:960` (1:1) e `1280:720` (16:9). Duração de 2 a 10 s; a Alilu oferece 5 e 10 s.
- As URLs de saída **expiram em 24–48 h**. Por isso o MP4 é sempre copiado para o Vercel Blob (`ai-video/{userId}/generated/{id}.mp4`).
- Preço: 1 crédito Runway = US$ 0,01. `gen4_turbo` custa 5 créditos/s e `gen4.5` custa 12 créditos/s.
- A Runway suspende contas com muitas requisições moderadas. Por isso existe o bloqueio por moderação (seção 6).

Classificação de falhas:

| Falha | Tipo | Efeito |
|---|---|---|
| `SAFETY.*` | `MODERATION` | Créditos devolvidos e um *strike* para o usuário. |
| `INPUT_PREPROCESSING.*` / `ASSET.*` | `USER_ERROR` | Créditos devolvidos; a tela pede outra imagem. |
| 429, 5xx ou rede **no envio** | Temporária | Nova tentativa em 1, 3 e 10 min; depois disso, devolução. |
| Demais casos | `TECHNICAL` | Créditos devolvidos. |

Qualidades oferecidas:

| Qualidade | Modelo | Status |
|---|---|---|
| ECONÔMICO | `gen4_turbo` | Ativa |
| PADRÃO | `gen4.5` | Ativa |
| ALTA | — | Desativada, sem linha ativa na tabela |

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

Créditos cobrados por vídeo:

| Qualidade | 5 s | 10 s |
|---|---|---|
| Econômico | 100 | 195 |
| Padrão | 230 | 450 |

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

Status: `CREATED` → `CREDIT_RESERVED` → `SUBMITTED` → `QUEUED` / `PROCESSING` → `COMPLETED` (ou `REFUNDED` / `FAILED`) → `EXPIRED` (o MP4 foi apagado pela retenção). Há ainda `PRICE_GUARD_BLOCKED`, que só aparece para o admin.

- **Avanço.** A geração avança de duas formas: por `GET /api/ai-video/generations/{id}`, que a tela consulta a cada 5 s, e pelo cron. Os dois usam `claimGeneration` (lock com `skip locked` e TTL de 4 min).
- **Intervalo de consulta.** 10 s em processamento; 30 s quando a tarefa está na fila ou houve erro na consulta.
- **Timeout.** Após 30 min a tarefa é cancelada no provedor e os créditos são devolvidos. Se o vídeo já tinha ficado pronto e só a cópia falhou, o custo do provedor fica registrado.
- **Limites por usuário:** `max_generations_per_user_per_hour`. Moderação: após `moderation_strikes_before_block` recusas em `moderation_block_hours`, o usuário fica bloqueado temporariamente (HTTP 429).
- **Créditos insuficientes** (HTTP 402, com `required`, `available` e `missing`): a tela salva um rascunho com imagem e configurações (`ai_video_drafts`) e leva para `/minha-conta/creditos-ia?voltar=…&custo=…`. Depois do pagamento, a página volta sozinha quando o saldo cobre o custo.
- **Risco aceito.** Se a rede cair *depois* de a Runway criar a tarefa e *antes* da resposta, a nova tentativa pode criar uma segunda tarefa. Isso é raro; o custo fica com a Alilu e aparece no faturamento da Runway.

## 7. Armazenamento e retenção

- Entrada: `ai-video/{userId}/input/…`. O servidor só aceita URL HTTPS do Blob público do projeto **no prefixo do próprio usuário**, com até 16 MB, em JPEG, PNG ou WebP.
- Saída: `ai-video/{userId}/generated/{id}.mp4`. Fica guardada por **7 dias** (`retention_days_free`) ou **30 dias** (`retention_days_paid`) para quem já fez alguma compra. Depois disso, o cron apaga o arquivo e marca a geração como `EXPIRED`.

## 8. Segurança

- `RUNWAYML_API_SECRET` só existe no servidor e nunca é logada. Toda chamada ao provedor é feita pelo backend.
- O usuário nunca vê custo do provedor, modelo interno nem ID de tarefa (`ai-video-dto.ts`).
- Preço, créditos e pacote são sempre recalculados no servidor; o valor que vem do front é ignorado.
- O cron usa `Authorization: Bearer` com comparação em tempo constante. O segredo é `AI_VIDEO_CRON_SECRET`, `CRON_SECRET` ou `INSTAGRAM_SCHEDULER_SECRET`, com pelo menos 16 caracteres.
- As telas de admin (`/admin/ia/precificacao` e `/admin/ia/custos`) e a API `PATCH /api/admin/ai-video/pricing` só respondem para e-mails listados em `ADMIN_EMAILS`. Para qualquer outro usuário, as páginas retornam 404 e a API retorna 403.

## 9. Variáveis de ambiente

| Variável | Uso |
|---|---|
| `RUNWAYML_API_SECRET` | Chave da API de desenvolvedor da Runway (dev.runwayml.com). |
| `AI_VIDEO_CRON_SECRET` | Opcional; sem ela, usa `CRON_SECRET` ou `INSTAGRAM_SCHEDULER_SECRET`. |
| `ADMIN_EMAILS` | E-mails de admin, separados por vírgula. |
| `ASAAS_*`, `BLOB_READ_WRITE_TOKEN` | Já existentes. |

## 10. Deploy (ordem)

1. `npm run db:migrate` (aplica a `0019_ai_video_credits.sql`) **antes** do deploy do código.
2. Na Vercel, configure `RUNWAYML_API_SECRET`, `ADMIN_EMAILS` e, se quiser, `AI_VIDEO_CRON_SECRET`.
3. Na Runway (dev.runwayml.com), crie a organização e a chave de API, compre créditos e ative a recarga automática (*auto-billing*) com limite mensal.
4. No Asaas, marque os eventos novos no Webhook: `PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED` e `PAYMENT_DELETED`.
5. No cron externo, chame `GET https://alilu.com.br/api/cron/ai-video` **a cada 1 minuto** com `Authorization: Bearer <segredo>`.
6. Em `/admin/ia/precificacao`, confira câmbio, preços da Runway e limites. Depois faça um teste ponta a ponta com o Asaas Sandbox.

## 11. Testes

| Arquivo | O que cobre |
|---|---|
| `__tests__/lib/ai-video-pricing.test.ts` | Fórmula, créditos sugeridos e margem dos pacotes. |
| `__tests__/lib/ai-video-generation.test.ts` | Carteira (duplicidade, saldo negativo, bônus), fluxo completo, clique duplo, 402, trava de preço, erro definitivo ou temporário, moderação, timeout, falha na cópia e retenção. |
| `__tests__/lib/ai-video-credit-purchase.test.ts` | Checkout, Webhook idempotente, chargeback com crédito já usado, cancelamento e reembolso (prazo, uso, recusa do Asaas, outro usuário). |

Neste ambiente os testes rodam com `npx vitest run <arquivo> --environment node --pool threads`.
