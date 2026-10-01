# Guia de teste — Assinatura do Piloto Automático (Asaas)

Auditoria do commit `3136ea6 feat: pagamento asaas` + roteiro de teste do início ao fim.
Nenhum código foi alterado. Os testes automatizados do módulo passam (webhook, rota, gate do cron, banner, subscription-service, regras do trial).

---

## 0. Antes de tudo: 7 coisas que o código faz e que mudam o jeito de testar

1. **O uso NÃO é consumido quando você clica em "Criar automação".** Ele é consumido só quando o **cron de geração** (`/api/cron/content-automation`) gera o post de fato. É por isso que o seu print mostra "3 de 3 automações restantes hoje" mesmo com 2 automações ativas: o cron ainda não gerou nada para você.
2. **O print mostra status `NEW` (trial ainda não começou).** Dá pra saber porque a frase não tem o "— termina em X dias". O trial (`trial_started_at`) começa no **primeiro post gerado**, não quando você abre a tela.
3. **Cada automação gera no máximo 1 post por dia** (`UNIQUE (automation_id, run_date)` em `automation_runs`). Pra testar o "4º uso bloqueado" no mesmo dia você precisa de **4 automações** com o dia de hoje habilitado. Você tem 2, então crie ou duplique mais 2.
4. **O "dia" do contador é em UTC, não no horário de Brasília.** `trial_usage_date` é gravado com `toISOString()`. Na prática, o contador de 3/dia **zera às 21:00 (horário de Brasília)**. O comentário da migration diz "no fuso da automação", mas o código não faz isso. Não bloqueia o teste, mas **evite testar o limite diário perto das 21h**. Sugiro corrigir depois.
5. **O status `EXPIRED` nunca é gravado no banco.** Ele é calculado. Trial vencido continua `TRIAL` na tabela (com `trial_ends_at` no passado). Cancelada com período vencido continua `CANCELED`. A tela e a API mostram `EXPIRED`.
6. **Se o usuário assinar durante o trial, ele perde o trial na hora.** O status vira `PENDING_PAYMENT` e o Piloto fica bloqueado até o pagamento ser confirmado. É uma decisão de produto que vale você confirmar.
7. **Existe um bug no webhook que pode "perder" um evento** (detalhes na seção 11.4). Não impede o teste, mas você precisa saber como resolver se acontecer.

---

## 1. Mapa da implementação

| Peça | Arquivo |
|---|---|
| Migration (tabelas) | `db/migrations/0017_automation_billing.sql` |
| Regras (7 dias, 3/dia, R$ 19) | `lib/billing/backend/billing-types.ts` → `TRIAL_DAYS`, `TRIAL_DAILY_LIMIT`, `MONTHLY_PRICE_CENTS = 1900` |
| Decide se pode usar | `lib/billing/backend/automation-access-service.ts` (`canUseAutomation`, `reserveAutomationUse`, `releaseAutomationUse`) |
| SQL da assinatura | `lib/billing/backend/automation-subscription-repository.ts` |
| Checkout / cancelamento | `lib/billing/backend/subscription-service.ts` |
| Cliente HTTP Asaas | `lib/billing/backend/asaas-client.ts` |
| Processamento do webhook | `lib/billing/backend/asaas-webhook-service.ts` |
| Idempotência do webhook | `lib/billing/backend/asaas-webhook-events-repository.ts` |
| Onde o bloqueio acontece | `lib/content-automation/backend/content-automation-cron.ts` → `generateAndCreatePublication` (reserva o uso **antes** de chamar a IA) |
| Tela (banner) | `components/instagram/content-automation/AutomationBillingBanner.tsx`, usado em `app/instagram/piloto-automatico/page.tsx` |

### Endpoints

| Método | Rota | Para quê |
|---|---|---|
| GET | `/api/billing/automation-access` | Status atual (banner). Só leitura, exige login. |
| POST | `/api/billing/automation-subscription` | `{"action":"checkout","name","cpfCnpj","email?"}` ou `{"action":"cancel"}`. Exige login. |
| POST | `/api/billing/asaas-webhook` | Chamado pelo Asaas. Valida o header `asaas-access-token`. |
| GET/POST | `/api/cron/content-automation` | Gera os posts (é onde o uso é consumido). `Authorization: Bearer <segredo>`. |

### Tabelas

**`automation_subscriptions`** (1 linha por usuário): `user_id`, `status` (`TRIAL`, `PENDING_PAYMENT`, `ACTIVE`, `PAST_DUE`, `CANCELED`, `EXPIRED`), `trial_started_at`, `trial_ends_at`, `trial_usage_date`, `trial_usage_count`, `asaas_customer_id`, `asaas_subscription_id`, `cpf_cnpj`, `monthly_price_cents`, `started_at`, `current_period_ends_at`, `canceled_at`, `created_at`, `updated_at`.

**`asaas_webhook_events`**: `event_id` (único, é a trava de idempotência), `event_type`, `received_at`, `processed_at`, `payload`.

Apoio: `automation_runs` (`automation_id`, `run_date`, `status`, `error_message`, `generation_attempt`, `next_attempt_at`, `publication_id`) e `content_automations`.

---

## 2. Variáveis de ambiente (nomes reais do código)

| Variável | Sandbox | Produção |
|---|---|---|
| `ASAAS_API_KEY` | chave gerada em **sandbox.asaas.com** → Integrações → API | chave de **www.asaas.com** |
| `ASAAS_BASE_URL` | `https://api-sandbox.asaas.com/v3` | `https://api.asaas.com/v3` |
| `ASAAS_WEBHOOK_TOKEN` | você inventa (32 a 255 caracteres, sem espaços) | **outro** valor, cadastrado no webhook de produção |

Gerar o token:
```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Onde colocar:**
- **Local:** `C:\Alilu\Utilitarios\.env.local`
- **Vercel:** Project → Settings → Environment Variables. Para o teste, marque **Preview** (não Production). Depois de salvar, faça redeploy.

**Também são necessárias para o fluxo inteiro** (já existem no projeto): `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (login), `CRON_SECRET` ou `CONTENT_AUTOMATION_CRON_SECRET` (mínimo de 16 caracteres, para disparar o cron) e `CONTENT_AI_*` (só se algum dia da automação estiver em modo IA).

> ⚠️ **O seu `.env.local` hoje tem só `DATABASE_URL` e as variáveis do Pix.** Sem `AUTH_*` o login local não funciona, e sem `CRON_SECRET` não dá pra disparar o cron. O print parece ser do site publicado.
>
> ⚠️ **Confirme se o `DATABASE_URL` do `.env.local` é o banco de produção.** Os SQLs deste guia alteram dados. O recomendado é criar um **branch de desenvolvimento no Neon** (Neon → Branches → Create branch) e usar a URL dele no teste.

**Trocar para produção depois:** mude `ASAAS_API_KEY` e `ASAAS_BASE_URL`, gere um novo `ASAAS_WEBHOOK_TOKEN` e crie o webhook no painel de **produção** do Asaas com esse token. Nada de código muda.

---

## 3. Onde rodar o teste (o Asaas não alcança `localhost`)

O webhook precisa de uma URL HTTPS pública. Três opções:

**Opção A (recomendada): Vercel Preview + banco de desenvolvimento no Neon**
- Faça deploy de uma branch, configure as variáveis em "Preview" com o `DATABASE_URL` do branch Neon de dev.
- URL do webhook: `https://<seu-preview>.vercel.app/api/billing/asaas-webhook`
- ⚠️ Se a Vercel estiver com **Deployment Protection** (Vercel Authentication) ligada nos previews, o Asaas vai receber 401/403. Desligue essa proteção para o preview ou use um domínio de staging sem proteção.

**Opção B: local + túnel**
- `npm run dev` e, em outro terminal, `cloudflared tunnel --url http://localhost:3000` (ou `ngrok http 3000`).
- URL do webhook: `https://<url-do-túnel>/api/billing/asaas-webhook`
- A URL do túnel gratuito muda toda vez que você reinicia, e aí precisa atualizar no Asaas. Também precisa completar o `.env.local` (seção 2).

**Opção C: produção (alilu.com.br) com chaves Sandbox.** Não recomendo, porque os SQLs de simulação mexeriam no banco real.

---

## 4. Preparação (uma vez só)

1. **Migration:** na pasta do projeto, com o `DATABASE_URL` do banco de teste, rode `npm run db:migrate`. Confira:
   ```sql
   select * from schema_migrations order by 1 desc limit 3;   -- deve listar 0017_automation_billing
   ```
2. **Conta Sandbox:** crie a conta em `sandbox.asaas.com` e gere a chave de API (Integrações → API).
3. **Variáveis:** configure as três `ASAAS_*` e o `CRON_SECRET` (seção 2) e reinicie o `npm run dev` ou faça redeploy.
4. **Webhook no Asaas Sandbox:** Menu do usuário → **Integrações → Webhooks → Criar Webhook**:
   - **Nome:** Alilu Piloto
   - **URL:** a da seção 3, terminando em `/api/billing/asaas-webhook`
   - **E-mail:** o seu (recebe alertas de falha)
   - **Auth Token:** exatamente o valor de `ASAAS_WEBHOOK_TOKEN`
   - **Ativo:** sim
   - **Eventos:** `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `SUBSCRIPTION_DELETED`, `SUBSCRIPTION_INACTIVATED` (são os únicos que o código processa; os outros ficam só registrados)
5. **Teste rápido do webhook** (deve devolver 401, que prova que a rota existe e exige o token):
   ```powershell
   curl.exe -i -X POST https://<base>/api/billing/asaas-webhook -H "Content-Type: application/json" -d "{}"
   ```

**Comando para disparar o cron de geração** (vai ser usado várias vezes):
```powershell
curl.exe -X POST -H "Authorization: Bearer <CRON_SECRET>" https://<base>/api/cron/content-automation
```
A resposta vem como `{"processed":N,"results":[{automationId, runId, status, error?}]}`.

---

## 5. Consultas SQL úteis (nomes reais)

Troque `seu@email` pelo e-mail do usuário de teste.

```sql
-- Status da assinatura / trial
select s.status, s.trial_started_at, s.trial_ends_at, s.trial_usage_date, s.trial_usage_count,
       s.asaas_customer_id, s.asaas_subscription_id, s.started_at, s.current_period_ends_at,
       s.canceled_at, s.updated_at
from automation_subscriptions s join users u on u.id = s.user_id
where u.email = 'seu@email';

-- Execuções do cron (o que foi gerado ou bloqueado hoje)
select a.name, r.run_date, r.status, r.generation_attempt, r.next_attempt_at, r.error_message
from automation_runs r join content_automations a on a.id = r.automation_id
join users u on u.id = a.user_id
where u.email = 'seu@email' order by r.run_date desc, a.name;

-- Webhooks recebidos
select event_id, event_type, received_at, processed_at,
       payload->'payment'->>'id' as payment_id,
       payload->'subscription'->>'id' as subscription_id
from asaas_webhook_events order by received_at desc limit 20;

-- Webhooks gravados mas NÃO processados (ver 11.4)
select event_id, event_type, received_at from asaas_webhook_events where processed_at is null;
```

---

## 6. Teste do trial (usos 1, 2, 3 e o 4º bloqueado)

**Configuração das automações (para não gastar IA nem publicar de verdade):**
- Use **4 automações** (você já tem 2, então use **Duplicar** para chegar a 4).
- Em cada uma: o dia da semana **de hoje** habilitado, **modo de conteúdo Manual** com uma legenda (sem custo de IA), **"Modo aprovação"** (o post fica em "Aguardando aprovação" e não vai para o Instagram), **antecedência de geração = 1440** min e horário de publicação ainda hoje. Ative a automação.
- ⚠️ Evite o **modo automático** nesse teste: com o horário já no passado, o cron de publicação publicaria no Instagram de verdade.
- Faça o teste **antes das 21h** (horário de Brasília), por causa do item 0.4.
- Use um usuário **sem linha** em `automation_subscriptions` (usuário novo, ou apague a linha no banco de dev).

**Passos:**

| # | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir `/instagram/piloto-automatico` | Banner "Período de teste — **3 de 3 automações restantes hoje.**" (sem "termina em"). Na query: **nenhuma linha**. |
| 2 | Disparar o cron 1× | O cron processa as automações em sequência. Com 4 prontas, **as 3 primeiras geram** (`WAITING_APPROVAL`) e **a 4ª é bloqueada** na mesma chamada. |
| 3 | Query de assinatura | `status=TRIAL`, `trial_started_at` = agora, `trial_ends_at` = agora + 7 dias, `trial_usage_date` = hoje em **UTC**, `trial_usage_count=3` |
| 4 | Query de runs | 3 com `WAITING_APPROVAL`, 1 com `PENDING` + `error_message` = "Você atingiu o limite de 3 automações de hoje. Volte amanhã ou assine para uso ilimitado." e `next_attempt_at` em +5 min |
| 5 | Recarregar a tela | Banner "**Limite de hoje atingido**" + botão "**Assinar por R$ 19/mês**" |

Se quiser ver 1 → 2 → 3 um de cada vez, ative uma automação por vez e dispare o cron depois de cada ativação.

**Observações:**
- A 4ª automação bloqueada tenta de novo em 5, 15 e 30 min e depois fica `FAILED`. A mensagem aparece no **Histórico** dela.
- Se a geração falhar por erro interno (e não por bloqueio), o uso é **devolvido** (`releaseAutomationUse`).

---

## 7. Simular o dia seguinte

Sem mexer no relógio, direto no banco de **dev**:
```sql
update automation_subscriptions
set trial_usage_date = trial_usage_date - 1
where user_id = (select id from users where email = 'seu@email');
```
Recarregue a tela. O esperado é "**3 de 3 automações restantes hoje — termina em N dias**".

Para ver uma geração nova de verdade: as automações já têm execução com a data de hoje, então não geram de novo. Duas saídas: esperar a 4ª automação (a bloqueada) tentar outra vez, ou dispare o cron para ela gerar agora (se `next_attempt_at` já passou). Ou, no banco de dev, apague as execuções de hoje de uma automação:
```sql
delete from automation_runs where automation_id = '<id>' and run_date = current_date;
```

---

## 8. Simular o fim dos 7 dias

```sql
update automation_subscriptions
set trial_ends_at = now() - interval '1 minute'
where user_id = (select id from users where email = 'seu@email');
```
Recarregue a tela. O esperado:
- Banner "**Período de teste encerrado**" com a mensagem "Seu período de teste de 7 dias terminou. Assine para continuar usando o Piloto Automático." e o botão "**Assinar por R$ 19/mês**"
- `GET /api/billing/automation-access` (abra no navegador logado) devolve `{"allowed":false,"status":"EXPIRED",...}`
- No banco o status **continua `TRIAL`** (item 0.5)
- Um cron disparado agora bloqueia a geração (`error_message` com a mesma frase)

---

## 9. Assinar (R$ 19) e confirmar que NÃO libera antes do pagamento

**Fluxo:**
```
Botão "Assinar por R$ 19/mês" → diálogo (Nome, CPF/CNPJ, E-mail opcional) → "Continuar para o pagamento"
  → POST /api/billing/automation-subscription {"action":"checkout","name","cpfCnpj","email"}
  → subscription-service.startAutomationCheckout
      1. valida CPF (11 dígitos) ou CNPJ (14)
      2. POST /v3/customers            → cus_xxx   (reaproveita se já existir asaas_customer_id)
      3. POST /v3/subscriptions        → sub_xxx   (billingType UNDEFINED, cycle MONTHLY, value 19, nextDueDate = hoje, externalReference = user_id)
      4. grava status PENDING_PAYMENT + IDs
      5. GET /v3/subscriptions/sub_xxx/payments → invoiceUrl da 1ª cobrança
  → navegador redireciona para a invoiceUrl (checkout do Asaas)
```

**Passos:**
1. Clique no botão e preencha com um **CPF válido de teste** (use um gerador de CPF para testes; com CPF inválido o Asaas recusa).
2. Você é levado para a página de pagamento do Asaas Sandbox. **Não pague ainda.** Volte ao Alilu.
3. Na query de assinatura: `status=PENDING_PAYMENT`, `asaas_customer_id=cus_...` e `asaas_subscription_id=sub_...` preenchidos, `started_at` e `current_period_ends_at` **nulos**.
4. No painel Sandbox: **Clientes** mostra o cliente, **Assinaturas** mostra a de R$ 19 mensal, e **Cobranças** mostra 1 cobrança pendente com vencimento hoje.
5. Na tela: banner "**Pagamento aguardando confirmação**". Um cron disparado agora bloqueia com "Seu pagamento ainda está aguardando confirmação." ✅ Isso comprova que criar a assinatura não libera o usuário.
6. Clicar em assinar de novo **não duplica** nada (reaproveita o mesmo `sub_`).

---

## 10. Pagar no Sandbox

Qualquer uma destas formas funciona com o código:
- **Mais simples:** no painel Sandbox, abra a cobrança → **"Confirmar recebimento em dinheiro"**. Isso dispara `PAYMENT_RECEIVED`.
- **Cartão:** na `invoiceUrl`, pague com cartão. A documentação do Asaas diz para usar "um número de cartão fictício válido", com qualquer validade futura e CVV 123. Isso dispara `PAYMENT_CONFIRMED`. Os cartões documentados para **recusa** são Mastercard `5184019740373151` e Visa `4916561358240741` (servem para testar falha).
- **Pix:** exige chave Pix cadastrada na conta Sandbox (veja "Testar pagamento de QRCodes Pix" na documentação).

---

## 11. Confirmar o webhook

### 11.1 O que acontece
```
Asaas → POST /api/billing/asaas-webhook (header asaas-access-token)
  → valida o token → grava em asaas_webhook_events (event_id único)
  → GET /v3/payments/{id}        (descobre a assinatura; não confia só no corpo do evento)
  → GET /v3/subscriptions/{id}   (pega o nextDueDate)
  → status ACTIVE, started_at = agora, current_period_ends_at = nextDueDate
  → processed_at = agora
```

### 11.2 Onde conferir
- **No Asaas:** Menu → Integrações → **Logs de Webhooks**. Deve aparecer o POST com resposta **200** e corpo `{"received":true,"status":"processed"}`.
- **Nos logs do servidor** (Vercel → Deployment → Logs, ou o terminal do `npm run dev`): `{"scope":"billing","event":"webhook.received","status":"processed","eventType":"PAYMENT_RECEIVED"}`. Se der erro: `webhook.auth_failed` (token diferente) ou `webhook.crash` (com a mensagem).
- **No banco:** a query de webhooks mostra `event_id` (`evt_...`), `event_type`, `payment_id` e `processed_at` preenchido. A query de assinatura mostra `status` **`PENDING_PAYMENT` → `ACTIVE`**, com `started_at` e `current_period_ends_at` preenchidos.
- **Na tela:** banner "**Assinatura ativa** — Postagens automáticas sem limite diário — renova em dd/mm/aaaa" e o botão "Cancelar assinatura".
- **Liberação de fato:** apague uma execução de hoje (seção 7) e dispare o cron. O post é gerado e `trial_usage_count` **não muda**.

> O `user_id` vai no Asaas como `externalReference` da assinatura. O código localiza a linha pelo `asaas_subscription_id`.
>
> `current_period_ends_at` fica igual à data da próxima cobrança às 00:00 UTC (21:00 do dia anterior, no horário de Brasília).

### 11.3 Idempotência (evento duplicado)
No Logs de Webhooks do Asaas, reenvie o mesmo evento. Ou mande manualmente, copiando o `payload` da tabela:
```powershell
curl.exe -X POST https://<base>/api/billing/asaas-webhook -H "Content-Type: application/json" -H "asaas-access-token: <ASAAS_WEBHOOK_TOKEN>" -d "{\"id\":\"<mesmo evt_...>\",\"event\":\"PAYMENT_RECEIVED\",\"payment\":{\"object\":\"payment\",\"id\":\"<pay_...>\"}}"
```
O esperado: HTTP 200 com `{"received":true,"status":"duplicate"}`, **uma única linha** com aquele `event_id` e `updated_at` da assinatura sem mudança.
```sql
select event_id, count(*) from asaas_webhook_events group by 1 having count(*) > 1;  -- deve voltar vazio
```

### 11.4 ⚠️ Bug conhecido: evento gravado mas não processado
O evento é gravado **antes** de ser processado. Se o processamento falhar (por exemplo, `ASAAS_API_KEY` errada fazendo o `GET /payments` quebrar), a rota devolve 500 e o Asaas reenvia. Só que o reenvio cai como `duplicate` e **nunca é processado**. Sintoma: webhook 200 no Asaas, assinatura parada em `PENDING_PAYMENT` e `processed_at` nulo. Como resolver no teste:
```sql
delete from asaas_webhook_events where processed_at is null and event_id = '<evt_...>';
```
Depois reenvie pelo Logs do Asaas. Recomendo corrigir no código antes de ir para produção: tratar como duplicado só quando `processed_at` não for nulo.

Outro ponto: depois de **15 falhas seguidas** o Asaas **interrompe a fila** do webhook. Se isso acontecer, reative a fila em Integrações → Webhooks.

---

## 12. Pagamento vencido (PAST_DUE)

Com a assinatura `ACTIVE`:
- **Pelo Sandbox:** o Asaas tem uma ação de sandbox para **forçar o vencimento** de uma cobrança (anunciada no changelog "Novas ações de Sandbox para testar status de cobranças"). Aplique na próxima cobrança da assinatura (Assinaturas → sua assinatura → cobranças). Isso dispara `PAYMENT_OVERDUE`.
- **Alternativa garantida:** mande o evento manualmente com um `event_id` **novo** e o `id` de uma cobrança real dessa assinatura. O código busca a cobrança no Asaas só para descobrir a assinatura, sem conferir o status dela:
  ```powershell
  curl.exe -X POST https://<base>/api/billing/asaas-webhook -H "Content-Type: application/json" -H "asaas-access-token: <TOKEN>" -d "{\"id\":\"evt_teste_overdue_1\",\"event\":\"PAYMENT_OVERDUE\",\"payment\":{\"object\":\"payment\",\"id\":\"<pay_...>\"}}"
  ```

O esperado: `status=PAST_DUE`, banner "**Pagamento em atraso**" e o cron bloqueando com "Seu pagamento está em atraso...". Nada que já foi agendado é apagado.

**Voltar para ativo:** confirme o recebimento da cobrança (ou mande um `PAYMENT_RECEIVED` com outro `event_id`). O esperado é `ACTIVE` de novo.

---

## 13. Cancelamento

1. Com status `ACTIVE`, clique em **"Cancelar assinatura"** e confirme.
2. O fluxo: `POST /api/billing/automation-subscription {"action":"cancel"}` → `DELETE /v3/subscriptions/{id}` no Asaas → **só depois** o status local vira `CANCELED`.
3. O esperado:
   - Banco: `status=CANCELED`, `canceled_at` = agora, `current_period_ends_at` **igual ao de antes** (não é apagado)
   - Asaas: assinatura removida/inativa, sem novas cobranças futuras
   - Tela: "**Assinatura cancelada** — Você ainda tem acesso ao Piloto Automático até dd/mm/aaaa"
   - O cron **continua gerando** até essa data
4. O Asaas manda `SUBSCRIPTION_DELETED`. Ele é gravado, mas não muda nada (a linha já está `CANCELED`).
5. **Simular o fim do período pago:**
   ```sql
   update automation_subscriptions set current_period_ends_at = now() - interval '1 minute'
   where user_id = (select id from users where email = 'seu@email');
   ```
   O esperado: banner "Período de teste encerrado" com o texto "Sua assinatura terminou." e o botão para assinar de novo. Assinar de novo **reaproveita** o mesmo `asaas_customer_id`.
6. Um `PAYMENT_RECEIVED` atrasado **não reativa** uma assinatura `CANCELED` (proteção intencional).

---

## 14. Confirmar que o resto continua grátis

**Por que continua grátis:** o único ponto que chama o bloqueio é `content-automation-cron.ts`. Nenhuma outra rota importa `lib/billing` (existe teste automatizado: "TESTE 6 — ferramentas manuais nunca são afetadas").

Com um usuário de trial vencido (seção 8) ou `PAST_DUE`, teste:
- [ ] Ferramentas de PDF (juntar, dividir, girar, assinar, marca d'água, converter)
- [ ] Geradores (recibo, Base64 etc.) e calculadoras (juros compostos, SAC/Price)
- [ ] Educação financeira e área `/financeiro` (assinaturas mensais, envelopes, dívidas, metas)
- [ ] Loterias
- [ ] Criar post manual e carrossel manual no editor do Instagram, e agendar publicação manual
- [ ] Posts já agendados continuam sendo publicados pelo `/api/cron/instagram-publish`
- [ ] A tela do Piloto **abre** normalmente (só informa, não trava a tela). Criar e editar automação também funciona; o que é bloqueado é só a **geração**.

---

## 15. Checklist final

- [ ] Criar branch de dev no Neon e usar o `DATABASE_URL` dele
- [ ] `npm run db:migrate` → `0017_automation_billing` aplicada
- [ ] Criar conta Sandbox e gerar a `ASAAS_API_KEY`
- [ ] Configurar `ASAAS_API_KEY`, `ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3` e `ASAAS_WEBHOOK_TOKEN`
- [ ] Configurar `CRON_SECRET` (e `AUTH_*` se for rodar localmente)
- [ ] Subir o ambiente (Vercel Preview sem proteção, ou local + túnel)
- [ ] Cadastrar o webhook (URL, token e os 5 eventos) → teste com `{}` devolve 401
- [ ] Usuário sem linha em `automation_subscriptions` → banner "3 de 3"
- [ ] 4 automações (Manual + Modo aprovação + antecedência 1440) → disparar o cron
- [ ] 3 geradas, `trial_usage_count=3`, trial de 7 dias iniciado
- [ ] 4ª bloqueada com a mensagem de limite
- [ ] Simular o dia seguinte → "3 de 3" de novo
- [ ] Simular os 7 dias → EXPIRED + botão de assinar
- [ ] Assinar → `PENDING_PAYMENT` com `cus_`/`sub_` e Piloto bloqueado
- [ ] Confirmar recebimento no Sandbox → webhook 200 "processed"
- [ ] `ACTIVE`, `current_period_ends_at` preenchido, banner "Assinatura ativa"
- [ ] Cron gera sem consumir `trial_usage_count`
- [ ] Reenviar o mesmo evento → "duplicate", sem duplicar nada
- [ ] `PAYMENT_OVERDUE` → `PAST_DUE` e bloqueio → pagar → `ACTIVE`
- [ ] Cancelar → `CANCELED` + `canceled_at`, acesso até o fim do período, assinatura removida no Asaas
- [ ] Vencer o período → EXPIRED
- [ ] Funcionalidades gratuitas OK com o usuário bloqueado
- [ ] (Antes de produção) corrigir o bug 11.4 e decidir sobre UTC vs. Brasília (item 0.4)
- [ ] Produção: nova chave, `https://api.asaas.com/v3`, novo token e novo webhook no painel de produção

---

Referências Asaas: [Criar webhook pela aplicação web](https://docs.asaas.com/docs/criar-novo-webhook-pela-aplicacao-web) · [Receber eventos no endpoint](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook) · [Eventos de cobrança](https://docs.asaas.com/docs/webhook-para-cobrancas) · [Testando cartão](https://docs.asaas.com/docs/testando-pagamento-com-cart%C3%A3o-de-cr%C3%A9dito) · [Ações de Sandbox](https://docs.asaas.com/changelog/novas-a%C3%A7%C3%B5es-de-sandbox-para-testar-status-de-cobran%C3%A7as) · [FAQ Sandbox](https://docs.asaas.com/docs/faq-sandbox)
