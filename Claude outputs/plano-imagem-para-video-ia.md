# Plano — Imagem para vídeo com IA (créditos Alilu + Runway + Asaas)

Análise feita no código atual em 01/10/2026, antes de qualquer alteração. Nada foi implementado ainda.

---

## 1. O que já existe e será reaproveitado

| Área | O que existe | Arquivos |
|---|---|---|
| Login e usuários | Auth.js com Google e código por e-mail; tabela `users`. **Não existe papel de administrador.** | `auth.ts`, `lib/instagram/backend/users-store.ts` |
| Banco | Neon Postgres com driver HTTP (`getDb()`). Esse driver **não aceita transação com vários comandos** (BEGIN/COMMIT). A concorrência no projeto é resolvida com `UPDATE … WHERE … RETURNING` atômico. Migrações em SQL puro. | `lib/db/client.ts`, `db/migrations/*.sql`, `scripts/db-migrate.ts` |
| Asaas | Cliente HTTP (criar cliente, assinatura, consultar cobrança, cancelar). Webhook com token e idempotência por `event_id`, já corrigido para reprocessar evento que falhou no meio. **Hoje o webhook ignora cobranças avulsas**, pois só trata as ligadas a uma assinatura. | `lib/billing/backend/asaas-client.ts`, `asaas-webhook-service.ts`, `asaas-webhook-events-repository.ts`, `app/api/billing/asaas-webhook/route.ts` |
| Cliente Asaas por usuário | O `asaas_customer_id` e o CPF/CNPJ ficam dentro de `automation_subscriptions`, a tabela da assinatura do Piloto. | `automation-subscription-repository.ts` |
| Armazenamento | Vercel Blob público. Upload direto do navegador com token assinado (`handleUploadPresigned` + `issueSignedToken`) e gravação no servidor com `put()`. | `app/api/instagram/media/upload/route.ts`, `app/api/videos/upload/route.ts` |
| Tarefas em segundo plano | **Não há fila nem worker.** O padrão do projeto é uma rota de cron protegida por `Bearer <segredo>`, chamada por um disparador externo (cron-job.org), com trava atômica no banco e tentativas automáticas com intervalo crescente. | `app/api/cron/content-automation`, `app/api/cron/instagram-publish` |
| Área "Vídeos" | Página da categoria e lista de ferramentas; editor de split-screen público (FFmpeg no servidor). | `app/videos/page.tsx`, `data/videos.ts`, `lib/videos/*` |
| Minha conta | Dados da conta e atalhos. Lugar natural para "Créditos de IA". | `app/minha-conta/page.tsx` |
| Componentes de tela | Botão, selo, diálogo e o banner de assinatura (referência de checkout). | `components/ui/*`, `components/instagram/content-automation/AutomationBillingBanner.tsx` |

---

## 2. O que a documentação atual da Runway diz

| Item | Valor atual | Fonte |
|---|---|---|
| API | `https://api.dev.runwayml.com/v1/`, cabeçalhos `Authorization: Bearer <chave>` e `X-Runway-Version: 2024-11-06` | guia "Using the API" |
| Criar vídeo | `POST /v1/image_to_video` com `model`, `promptImage` (URL ou data URI), `promptText`, `ratio`, `duration` | idem |
| Acompanhar | `GET /v1/tasks/{id}`; sucesso = `SUCCEEDED`, com as URLs em `output` | "Outputs" |
| URLs do vídeo | Expiram em 24–48 h. A Runway pede para baixar e guardar no próprio storage. | "Outputs" |
| Valor do crédito | US$ 0,01 por crédito Runway | "Pricing" |
| **Gen-4 Turbo** (`gen4_turbo`) | **5 créditos/s** → 5 s = US$ 0,25; 10 s = US$ 0,50 | "Pricing" |
| Gen-4.5 (`gen4.5`) | 12 créditos/s → 5 s = US$ 0,60 | "Pricing" |
| WAN 3.0 (`wan3`) | 5 / 10 / 20 créditos/s em 480p / 720p / 1080p | "Pricing" |
| Veo 3.1 | 20–40 créditos/s | "Pricing" |
| Limites | Por *tier* do projeto (gerações por dia e simultâneas); tratar 429 e 503 | "Go-live checklist" |
| Moderação | "Muitas requisições moderadas levam à **suspensão da conta**" | "Go-live checklist" |

Ainda a confirmar na referência de cada modelo, no início da implementação:
- durações e proporções (`ratio`) aceitas pelo `gen4_turbo`;
- todos os status da tarefa;
- se uma tarefa com falha é cobrada;
- se existe um endpoint de saldo da organização.

O código não terá esses valores fixos: tudo fica em tabela.

**Conclusão de preço:** com a tabela atual, o Gen-4 Turbo é a opção mais barata a 720p (empata com o WAN 3.0 em 720p custando metade). Por isso proponho Gen-4 Turbo como **Econômico** e Gen-4.5 como **Padrão**. "Alta qualidade" fica desligada até você aprovar o custo.

---

## 3. Como será a integração (decisões de arquitetura)

1. **Duas carteiras independentes.** Crédito Alilu ≠ crédito Runway. O cliente paga o Alilu (Asaas, pré-pago). O Alilu paga a Runway com saldo pré-pago e recarga automática configurada no portal da Runway. Não há repasse por vídeo.
2. **Provedor atrás de uma interface:** `ImageToVideoProvider` (`create`, `getStatus`, `estimateCost`) em `lib/ai-video/providers/`. A primeira implementação é `RunwayImageToVideoProvider`. A regra de negócio nunca importa a Runway diretamente. Mesmo padrão do `AIContentProvider` do Piloto.
3. **Concorrência sem BEGIN/COMMIT:**
   - a reserva é um único `UPDATE ai_credit_wallets SET available = available - X, reserved = reserved + X WHERE user_id = … AND available >= X RETURNING …`;
   - duas gerações simultâneas nunca gastam o mesmo saldo: o Postgres serializa as duas pela trava da linha;
   - o lançamento no extrato tem chave única `(tipo, referência)`, então um retry nunca lança duas vezes.

   Se você preferir transação de verdade, o driver WebSocket (`Pool`) do Neon também funciona, como já é usado em `db-migrate.ts`. Recomendo manter o padrão atômico do projeto.
4. **Tarefas em segundo plano:**
   - uma rota de cron nova, `/api/cron/ai-video` (a cada 1 min, mesmo disparador externo), consulta as tarefas em andamento, baixa o MP4 para o Blob, confirma o consumo ou devolve os créditos;
   - a tela também pede o status a cada ~5 s, e esse pedido pode adiantar a consulta à Runway (com trava, para nunca processar duas vezes).
5. **Preço sempre calculado no servidor.** A tela só mostra o valor. Antes de enviar para a Runway, o servidor recalcula o custo e bloqueia com `PRICE_GUARD_BLOCKED` se passar de `MaxProviderCostUsd` ou se a margem cair abaixo da mínima.
6. **Proteção da conta Runway contra suspensão:**
   - valida a imagem (tipo, tamanho, dimensões);
   - limita gerações por usuário por hora;
   - bloqueia temporariamente quem acumula recusas por moderação;
   - acompanha o total de recusas.
7. **Administração:** como não há papel de admin, proponho uma lista de e-mails na variável `ADMIN_EMAILS`, verificada no servidor, sem mudar a tabela de usuários.

---

## 4. Tabelas novas (migração `0019_ai_video_credits.sql`, só acrescenta)

| Tabela | Para quê | Campos principais |
|---|---|---|
| `ai_credit_wallets` | Saldo atual (1 linha por usuário) | `user_id` (único), `available`, `reserved`, `welcome_bonus_granted_at`, `updated_at` |
| `ai_credit_transactions` | **Extrato auditável** | `user_id`, `type` (`PURCHASE`, `BONUS`, `RESERVE`, `CONSUME`, `REFUND`, `ADMIN_ADJUSTMENT`, `EXPIRE`, `CHARGEBACK`), `amount`, `available_after`, `reserved_after`, `reference_type`, `reference_id`, `description`, `created_at`; **único `(type, reference_type, reference_id)`** |
| `ai_credit_packages` | Pacotes à venda | `name`, `credits`, `bonus_credits`, `price_cents`, `is_active`, `display_order` |
| `ai_credit_purchases` | Compra de pacote via Asaas | `user_id`, `package_id`, snapshot de créditos e preço, `asaas_payment_id` (**único**), `status` (`PENDING`, `PAID`, `CANCELED`, `REFUNDED`), `paid_at` |
| `billing_customers` | Cliente Asaas por usuário, para qualquer produto | `user_id` (único), `asaas_customer_id`, `cpf_cnpj`. Reaproveita o que já está em `automation_subscriptions`, sem mexer nela. |
| `ai_pricing_config` | Regra comercial, com histórico | `credit_value_brl`, `target_gross_margin_pct` (50), `minimum_gross_margin_pct` (40), `usd_brl_reference_rate` (5,50), `provider_cost_safety_multiplier` (1,20), `payment_fee_pct`, `tax_pct`, `infra_cost_brl_per_generation`, `welcome_bonus_credits` (100), `max_provider_cost_usd`, `daily_provider_spend_limit_usd`, `monthly_provider_spend_limit_usd`, `effective_from`, `is_active` |
| `ai_video_model_pricing` | Preço por qualidade/modelo/duração | `tier` (`ECONOMICO`, `PADRAO`, `ALTA`), `provider`, `provider_model`, `resolution`, `duration_seconds`, `provider_credits_per_second`, `provider_fixed_credits`, `alilu_credit_cost`, `is_active` |
| `ai_video_generations` | Cada geração | `user_id`, `idempotency_key` (**único por usuário**), `tier`, `provider`, `provider_model`, `prompt`, `input_image_url`, `duration_seconds`, `aspect_ratio`, `resolution`, `credit_cost`, `status`, `external_task_id`, `provider_estimated_cost_usd`, `provider_actual_cost_usd`, `provider_charged`, `exchange_rate_reference`, `estimated_cost_brl`, `revenue_allocated_brl`, `gross_profit_brl`, `storage_video_url`, `error_kind` (`USER_ERROR` ou `TECHNICAL_ERROR`), `error_code`, `error_message`, `expires_at` (retenção), trava de processamento e datas |
| `ai_provider_accounts` | Saldo e alertas do provedor (só admin) | `provider`, `current_estimated_balance_usd`, `auto_recharge_enabled`, `low_balance_threshold_usd`, `last_balance_check_at` |

**Status da geração:** `CREATED` → `CREDIT_RESERVED` → `SUBMITTED` → `QUEUED` / `PROCESSING` → `COMPLETED`. Desvios: `FAILED` → `REFUNDED`, e `PRICE_GUARD_BLOCKED`.

---

## 5. Fluxo de créditos

1. **Bônus de boas-vindas** (100, configurável): concedido uma única vez, na primeira visita à tela. Trava no banco com `welcome_bonus_granted_at` mais a chave única do extrato.
2. **Gerar:**
   - o servidor recalcula o custo, aplica a trava de preço e cria a geração com a `idempotency_key` (duplo clique ou refresh devolvem a mesma geração);
   - faz a reserva atômica e lança `RESERVE` no extrato;
   - só depois chama a Runway.
3. **Sucesso:** o MP4 vai para o Blob, os créditos passam de reservados a consumidos (lançamento `CONSUME`) e o lucro do vídeo fica gravado.
4. **Falha sem cobrança da Runway** (recusa antes de gerar, 4xx, imagem inválida, moderação): devolução total (`REFUND`).
5. **Falha com cobrança da Runway:** devolve os créditos ao cliente, como você preferiu, e grava `provider_charged = true` e o custo como prejuízo operacional.
6. **Créditos não são dinheiro:** sem saque nem transferência. O texto aparece na tela e nos termos.

---

## 6. Integração com o Asaas

- **Novo no cliente HTTP:** `createAsaasPayment` (`POST /v3/payments`, cobrança avulsa com `billingType: UNDEFINED` e `externalReference = id da compra`). O usuário paga pela `invoiceUrl`, como na assinatura.
- **Cliente Asaas:** usa `billing_customers`. Se a pessoa já tiver cliente criado pela assinatura do Piloto, reaproveita. Senão, cria um novo (exige CPF/CNPJ, igual ao checkout atual).
- **Webhook — única mudança em código já existente:**
  - hoje, cobrança "sem assinatura" é ignorada;
  - passa a procurar `ai_credit_purchases.asaas_payment_id`;
  - em `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`: marca a compra como `PAID` e lança `PURCHASE` uma única vez (compra única pelo id do pagamento + chave única do extrato).
- **Estorno e chargeback** (`PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED`): retira do saldo disponível o que ainda não foi usado e registra a diferença para o admin. Esses dois eventos precisam ser marcados no webhook do painel do Asaas.
- **Nunca credita** porque o checkout foi criado ou porque o usuário voltou da tela de pagamento.
- **Voltar para a geração:**
  - a imagem enviada e as configurações ficam salvas como rascunho no servidor;
  - depois do pagamento, a tela de créditos acompanha o saldo e volta sozinha para a geração com tudo preenchido.

---

## 7. Fluxo Runway

`POST /api/ai-video/generations` → validação + reserva → `create()` na Runway → grava `external_task_id`.

O cron e a tela chamam `getStatus()`:
- `SUCCEEDED`: baixa o MP4 para o Blob (`ai-video/{userId}/…mp4`) e confirma o consumo;
- `FAILED`: classifica o erro e devolve os créditos;
- 429/503: nova tentativa com intervalo crescente;
- sem resposta por tempo demais: falha técnica e devolução.

A URL da Runway nunca é mostrada ao usuário, só a do Blob.

**Retenção:** o cron apaga do Blob os vídeos vencidos (7 dias sem compra, 30 dias para quem comprou; configurável) e marca a geração como expirada.

---

## 8. Precificação

**Fórmula com margem de verdade:**
```
custoBRL      = custoUSD × câmbio de referência (5,50) × multiplicador de segurança (1,20)
custoTotal    = custoBRL + infraestrutura por geração + taxa de pagamento + imposto
preçoVenda    = custoTotal / (1 − margem alvo)
créditos      = arredondar para cima (preçoVenda / valor do crédito)
```

**Exemplo com a tabela atual (Econômico, 5 s):**

| Etapa | Valor |
|---|---|
| Custo na Runway | US$ 0,25 |
| Em reais (×5,50) | R$ 1,375 |
| Com segurança (×1,20) | R$ 1,65 |
| Infraestrutura | + R$ 0,15 → R$ 1,80 |
| Venda com margem de 50% | R$ 3,60 |
| Créditos (a R$ 0,036 cada) | **100 créditos** |

**Os pacotes do prompt, conferidos contra a margem mínima de 40%** (custo de R$ 1,80 por vídeo de 100 créditos, antes da taxa do Asaas):

| Pacote | Preço | R$ por 100 créditos | Margem bruta |
|---|---|---|---|
| Básico — 500 | R$ 19,90 | R$ 3,98 | 54,8% |
| Criador — 1.500 | R$ 49,90 | R$ 3,33 | 45,9% |
| Pro — 5.000 | R$ 149,90 | R$ 3,00 | **40,0%**, no limite |

Com a taxa do Asaas o Pro fica **abaixo** de 40%. O sistema vai acusar isso no painel de precificação e não deixa ativar um pacote abaixo da margem mínima.

**Painel do admin:**
- simulação ("se eu cobrar 80 ou 120 créditos, qual a margem?");
- receita, custo de API, taxas e lucro do dia e do mês;
- análise por modelo;
- reconciliação: créditos consumidos versus custo estimado, e o saldo da Runway se a API disponibilizar.

**Limites de gasto:**
- diário e mensal com a Runway: novas gerações ficam bloqueadas e o admin é avisado;
- alerta de saldo baixo do provedor (só no admin).

---

## 9. Arquivos

**Novos** (área exclusiva desta funcionalidade, sem risco de conflito):
- `db/migrations/0019_ai_video_credits.sql`
- `lib/ai-video/` → tipos, configuração e cálculo de preço (puro, testável), carteira e extrato, gerações, serviço de geração, cron, provedores (`provider.ts`, `runway-provider.ts`)
- `lib/billing/backend/billing-customer-repository.ts`, `credit-purchase-service.ts`, `credit-purchase-repository.ts`
- `app/api/ai-video/generations/route.ts`, `app/api/ai-video/generations/[id]/route.ts`, `app/api/ai-video/upload/route.ts`, `app/api/ai-video/wallet/route.ts`, `app/api/ai-video/credits/checkout/route.ts`
- `app/api/cron/ai-video/route.ts`
- `app/videos/imagem-para-video/page.tsx`, `app/minha-conta/creditos-ia/page.tsx`, `app/admin/ia/precificacao/page.tsx`, `app/admin/ia/custos/page.tsx`
- `components/ai-video/*` (gerador, saldo, modal de créditos insuficientes, pacotes, histórico)
- `lib/admin/admin-access.ts` (`ADMIN_EMAILS`)
- `docs/ai-video.md`
- testes em `__tests__/lib/ai-video-*.test.ts` e `__tests__/components/AiVideo*.test.tsx`

**Já existentes, mudança mínima:**

| Arquivo | Mudança |
|---|---|
| `lib/billing/backend/asaas-client.ts` | +1 função: `createAsaasPayment` |
| `lib/billing/backend/asaas-webhook-service.ts` | ramo para cobrança avulsa de créditos, mais estorno e chargeback |
| `data/videos.ts` | +1 ferramenta na lista |
| `app/minha-conta/page.tsx` | +1 atalho "Créditos de IA" |
| `.env.example` | `RUNWAYML_API_SECRET`, `AI_VIDEO_CRON_SECRET` (opcional), `ADMIN_EMAILS` |

Nenhuma mudança em `components/ui/*`, layout, cabeçalho, home ou no Piloto Automático.

---

## 10. Riscos de conflito com o outro agente e riscos do produto

**Conflito de arquivos:**
- O outro agente mexeu recentemente em `components/ui/*`, home, layout, cabeçalho e `.codex-temp/`. Eu só **uso** esses componentes, não altero nenhum.
- `data/videos.ts` e `app/minha-conta/page.tsx` podem estar na lista dele. Confiro o diff na hora e faço só a inclusão de uma linha.
- Ao terminar, listo exatamente os arquivos alterados e criados e não faço commit de nada fora do escopo.

**Riscos do produto:**
- **Conta da Runway suspensa por moderação.** É o maior risco operacional; está mitigado no item 3.6.
- **Direito de arrependimento (CDC, art. 49):** compra online pode ser cancelada em 7 dias. Créditos ainda não usados provavelmente precisam ser reembolsáveis nesse prazo. Vale confirmar com seu contador ou advogado. Não sou advogado; a regra fica configurável.
- **Abuso do bônus:** o bônus grátis custa ~R$ 1,80 por conta nova. Contas Google novas em série podem explorar. Limitar por conta, e o admin vê o total gasto em bônus.
- **Plano da Vercel:** o print das variáveis mostrou o selo "Hobby", mas o código comenta "Pro". Isso não bloqueia nada, porque o cron é externo e baixar um MP4 de 5–10 s cabe com folga em 60 s, mas vale confirmar.
- **Câmbio e preço da Runway podem mudar.** Por isso a trava de preço e a tabela com histórico (`effective_from`).
