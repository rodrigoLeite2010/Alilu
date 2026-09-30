-- Monetização SOMENTE do Piloto Automático de Conteúdo (IA que gera e
-- agenda posts automaticamente) — o restante do Alilu continua gratuito,
-- sem paywall. Modelo: 7 dias de teste grátis (até 3 automações/dia),
-- depois assinatura recorrente mensal via Asaas (R$ 19/mês), liberada
-- somente após confirmação de pagamento via Webhook (nunca por redirect).
--
-- Migração ADITIVA (mesmo padrão de 0004+): só cria tabelas novas, não
-- mexe em nada que já existe. content_automations/content_automation_days/
-- automation_runs permanecem intocadas.
--
-- Decisão de escopo (1 linha por USUÁRIO, não por automação): o trial e a
-- assinatura são do usuário — "3 automações por dia" soma todas as
-- automações dele, não é por automação individual.

create table if not exists automation_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users (id) on delete cascade,

  status text not null default 'TRIAL'
    check (status in ('TRIAL', 'PENDING_PAYMENT', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED')),

  -- Trial: começa na primeira utilização real do Piloto Automático (nunca
  -- no simples acesso à tela) — ver AutomationAccessService.
  trial_started_at timestamptz,
  trial_ends_at timestamptz,

  -- Contador atômico do uso diário do trial (TrialDailyLimit, hoje 3/dia).
  -- "atômico" por ser alterado com um único UPDATE condicional (ver
  -- automation-subscription-repository.ts) — nunca duas requisições
  -- concorrentes conseguem ultrapassar o limite, mesmo sem transação
  -- explícita (o driver HTTP do Neon usado neste projeto não suporta
  -- BEGIN/COMMIT de várias instruções — só UPDATE...WHERE atômico, mesma
  -- técnica já usada em automation_runs/claimRunForGeneration).
  -- trial_usage_date é a data civil (no fuso da automação relevante) a
  -- que trial_usage_count se refere — comparar antes de usar o contador.
  trial_usage_date date,
  trial_usage_count int not null default 0,

  -- Asaas
  asaas_customer_id text,
  asaas_subscription_id text,

  -- CPF/CNPJ do assinante — o Asaas EXIGE isso para criar um cliente
  -- (POST /v3/customers), mas o resto do Alilu nunca coletou documento
  -- nenhum até agora. Só dígitos; coletado uma vez no checkout
  -- (SubscriptionService.startCheckout) e reaproveitado se a pessoa
  -- cancelar e assinar de novo depois.
  cpf_cnpj text,

  -- Snapshot do valor cobrado (em centavos, mesmo padrão de fin_debts/
  -- fin_goals neste projeto) no momento em que a assinatura foi criada —
  -- nunca hardcoded em código nenhum além da constante MonthlyPrice.
  monthly_price_cents int not null default 1900,

  -- started_at: quando a assinatura ficou ACTIVE pela 1ª vez.
  -- current_period_ends_at: até quando o período já pago continua
  -- liberando o Piloto (renovação normal, ou "usa até o fim do período
  -- pago" depois de cancelar).
  started_at timestamptz,
  current_period_ends_at timestamptz,
  canceled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automation_subscriptions_status_idx on automation_subscriptions (status);
create index if not exists automation_subscriptions_asaas_customer_idx on automation_subscriptions (asaas_customer_id) where asaas_customer_id is not null;
create index if not exists automation_subscriptions_asaas_subscription_idx on automation_subscriptions (asaas_subscription_id) where asaas_subscription_id is not null;

-- Idempotência de Webhook (o Asaas garante só "at least once" — o mesmo
-- evento pode chegar mais de uma vez): event_id único trava
-- reprocessamento, mesmo padrão de "insert ... on conflict do nothing"
-- já usado em automation_runs (ensureRunForDate).
create table if not exists asaas_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  -- Payload cru do evento, só para auditoria/depuração — nunca contém a
  -- API Key nem dado de cartão (o Asaas nunca manda isso no corpo do
  -- webhook, só identificadores e status).
  payload jsonb not null
);

create index if not exists asaas_webhook_events_type_idx on asaas_webhook_events (event_type, received_at desc);
