-- "Imagem para vídeo com IA" — produto PAGO com créditos próprios (Alilu
-- Credits), comprados via Asaas (pré-pago, liberados SÓ por webhook) e
-- consumidos a cada geração. O provedor (Runway, no início) é fornecedor
-- do Alilu: o Alilu paga o provedor com saldo próprio — nunca há repasse
-- individual cliente → provedor. CRÉDITO ALILU ≠ CRÉDITO DO PROVEDOR.
--
-- Migração ADITIVA: só tabelas novas. Nada do Piloto Automático, do
-- Instagram ou da assinatura (0017) é alterado.
--
-- Concorrência: o driver HTTP do Neon não faz BEGIN/COMMIT com vários
-- comandos. Toda movimentação de saldo é um único UPDATE condicional
-- (… where available >= X returning …) — mesma técnica de
-- reserveTrialUsage (0017) — e cada lançamento do extrato tem chave única
-- (type, reference_type, reference_id): um retry nunca lança duas vezes.

-- ---------------------------------------------------------------------------
-- Carteira (saldo atual, 1 linha por usuário) e extrato auditável.
-- ---------------------------------------------------------------------------
create table if not exists ai_credit_wallets (
  user_id uuid primary key references users (id) on delete cascade,
  available int not null default 0 check (available >= 0),
  reserved int not null default 0 check (reserved >= 0),
  -- Bônus de boas-vindas: concedido no máximo uma vez (trava server-side).
  welcome_bonus_granted_at timestamptz,
  -- Estorno/chargeback de créditos já usados: o saldo nunca fica negativo;
  -- a diferença fica registrada aqui para o admin acompanhar.
  unrecovered_credits int not null default 0 check (unrecovered_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  type text not null check (type in (
    'PURCHASE', 'BONUS', 'RESERVE', 'CONSUME', 'REFUND',
    'ADMIN_ADJUSTMENT', 'EXPIRE', 'PURCHASE_REFUND', 'CHARGEBACK'
  )),
  -- Variação do saldo DISPONÍVEL (+ entra, − sai). CONSUME é 0 no
  -- disponível (os créditos já tinham saído na reserva) — o valor
  -- consumido fica em reserved_delta.
  amount int not null,
  reserved_delta int not null default 0,
  available_after int not null,
  reserved_after int not null,
  reference_type text not null,
  reference_id text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  constraint ai_credit_transactions_unique_reference unique (type, reference_type, reference_id)
);

create index if not exists ai_credit_transactions_user_idx on ai_credit_transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Regra comercial (com histórico: a linha ativa mais recente vale).
-- ---------------------------------------------------------------------------
create table if not exists ai_pricing_config (
  id uuid primary key default gen_random_uuid(),
  -- Valor de VENDA de 1 crédito Alilu (referência para converter preço em créditos).
  credit_value_brl numeric(10, 4) not null,
  target_gross_margin_pct numeric(5, 2) not null,
  minimum_gross_margin_pct numeric(5, 2) not null,
  usd_brl_reference_rate numeric(10, 4) not null,
  provider_cost_safety_multiplier numeric(6, 3) not null,
  -- Percentuais sobre a RECEITA (taxa do Asaas, impostos).
  payment_fee_pct numeric(5, 2) not null,
  tax_pct numeric(5, 2) not null,
  -- Custo fixo estimado por geração (storage, CDN, processamento, retries).
  infra_cost_brl_per_generation numeric(10, 4) not null,
  welcome_bonus_credits int not null,
  max_provider_cost_usd numeric(10, 4) not null,
  daily_provider_spend_limit_usd numeric(10, 2) not null,
  monthly_provider_spend_limit_usd numeric(10, 2) not null,
  max_generations_per_user_per_hour int not null,
  moderation_strikes_before_block int not null,
  moderation_block_hours int not null,
  retention_days_free int not null,
  retention_days_paid int not null,
  purchase_refund_window_days int not null,
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now()
);

insert into ai_pricing_config (
  credit_value_brl, target_gross_margin_pct, minimum_gross_margin_pct, usd_brl_reference_rate,
  provider_cost_safety_multiplier, payment_fee_pct, tax_pct, infra_cost_brl_per_generation,
  welcome_bonus_credits, max_provider_cost_usd, daily_provider_spend_limit_usd,
  monthly_provider_spend_limit_usd, max_generations_per_user_per_hour,
  moderation_strikes_before_block, moderation_block_hours, retention_days_free,
  retention_days_paid, purchase_refund_window_days
)
select 0.04, 50, 40, 5.50, 1.20, 5, 0, 0.15, 100, 1.50, 50, 500, 10, 3, 24, 7, 30, 7
where not exists (select 1 from ai_pricing_config);

-- ---------------------------------------------------------------------------
-- Preço por qualidade/modelo/duração. alilu_credit_cost é o que o usuário
-- paga; é calculado pela fórmula de margem (ver lib/ai-video/pricing.ts) e
-- pode ser ajustado pelo admin — o servidor recusa ativar abaixo da
-- margem mínima.
-- ---------------------------------------------------------------------------
create table if not exists ai_video_model_pricing (
  id uuid primary key default gen_random_uuid(),
  tier text not null check (tier in ('ECONOMICO', 'PADRAO', 'ALTA')),
  provider text not null,
  provider_model text not null,
  friendly_name text not null,
  resolution text not null,
  duration_seconds int not null check (duration_seconds > 0),
  provider_credits_per_second numeric(10, 3) not null,
  provider_fixed_credits numeric(10, 3) not null default 0,
  -- Valor em US$ de 1 crédito do provedor (Runway: US$ 0,01).
  provider_credit_usd numeric(10, 5) not null,
  alilu_credit_cost int not null check (alilu_credit_cost > 0),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint ai_video_model_pricing_unique unique (tier, provider_model, duration_seconds)
);

-- Runway (docs.dev.runwayml.com/guides/pricing, consultada em 01/10/2026):
-- Gen-4 Turbo = 5 créditos/s; Gen-4.5 = 12 créditos/s; 1 crédito = US$ 0,01.
-- Créditos Alilu calculados com a regra acima (margem 50% sobre a venda).
insert into ai_video_model_pricing
  (tier, provider, provider_model, friendly_name, resolution, duration_seconds,
   provider_credits_per_second, provider_credit_usd, alilu_credit_cost)
values
  ('ECONOMICO', 'runway', 'gen4_turbo', 'Econômica', '720p', 5, 5, 0.01, 100),
  ('ECONOMICO', 'runway', 'gen4_turbo', 'Econômica', '720p', 10, 5, 0.01, 195),
  ('PADRAO', 'runway', 'gen4.5', 'Padrão', '720p', 5, 12, 0.01, 230),
  ('PADRAO', 'runway', 'gen4.5', 'Padrão', '720p', 10, 12, 0.01, 450)
on conflict (tier, provider_model, duration_seconds) do nothing;

-- ---------------------------------------------------------------------------
-- Pacotes à venda (nunca hardcoded no frontend).
-- ---------------------------------------------------------------------------
create table if not exists ai_credit_packages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  credits int not null check (credits > 0),
  bonus_credits int not null default 0 check (bonus_credits >= 0),
  price_cents int not null check (price_cents > 0),
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into ai_credit_packages (code, name, credits, price_cents, display_order) values
  ('BASICO', 'Básico', 500, 1990, 1),
  ('CRIADOR', 'Criador', 1500, 4990, 2),
  ('PRO', 'Pro', 5000, 16490, 3)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Cliente Asaas por usuário, para QUALQUER produto (a assinatura do
-- Piloto continua usando automation_subscriptions — esta tabela só é lida
-- e escrita pela compra de créditos; reaproveita o customer da assinatura
-- quando existir, ver credit-purchase-service.ts).
-- ---------------------------------------------------------------------------
create table if not exists billing_customers (
  user_id uuid primary key references users (id) on delete cascade,
  asaas_customer_id text not null,
  cpf_cnpj text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  package_id uuid references ai_credit_packages (id) on delete set null,
  -- Snapshot do pacote no momento da compra (o pacote pode mudar depois).
  package_name text not null,
  credits int not null,
  bonus_credits int not null default 0,
  price_cents int not null,
  asaas_payment_id text unique,
  invoice_url text,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PAID', 'CANCELED', 'REFUNDED', 'CHARGEBACK')),
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_credit_purchases_user_idx on ai_credit_purchases (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Gerações.
-- ---------------------------------------------------------------------------
create table if not exists ai_video_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  idempotency_key text not null,
  tier text not null,
  provider text not null,
  provider_model text not null,
  prompt text not null,
  input_image_url text not null,
  duration_seconds int not null,
  aspect_ratio text not null check (aspect_ratio in ('9:16', '1:1', '16:9')),
  resolution text not null,
  credit_cost int not null,
  status text not null default 'CREATED' check (status in (
    'CREATED', 'CREDIT_RESERVED', 'SUBMITTED', 'QUEUED', 'PROCESSING',
    'COMPLETED', 'FAILED', 'REFUNDED', 'PRICE_GUARD_BLOCKED', 'EXPIRED'
  )),
  external_task_id text,
  provider_estimated_cost_usd numeric(10, 4) not null,
  provider_actual_cost_usd numeric(10, 4),
  provider_charged boolean not null default false,
  exchange_rate_reference numeric(10, 4) not null,
  estimated_cost_brl numeric(10, 4) not null,
  revenue_allocated_brl numeric(10, 4) not null,
  gross_profit_brl numeric(10, 4),
  output_video_url text,
  storage_video_url text,
  error_kind text check (error_kind is null or error_kind in ('USER_ERROR', 'TECHNICAL_ERROR')),
  error_code text,
  error_message text,
  attempts int not null default 0,
  next_check_at timestamptz,
  processing_lock_token text,
  processing_lock_expires_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  constraint ai_video_generations_idempotency unique (user_id, idempotency_key)
);

create index if not exists ai_video_generations_user_idx on ai_video_generations (user_id, created_at desc);
create index if not exists ai_video_generations_pending_idx on ai_video_generations (status, next_check_at)
  where status in ('SUBMITTED', 'QUEUED', 'PROCESSING');
create index if not exists ai_video_generations_expiry_idx on ai_video_generations (expires_at)
  where storage_video_url is not null;

-- Rascunho da tela (imagem já enviada + configurações) — sobrevive à ida
-- ao checkout para o usuário voltar sem perder nada.
create table if not exists ai_video_drafts (
  user_id uuid primary key references users (id) on delete cascade,
  input_image_url text,
  prompt text not null default '',
  tier text,
  duration_seconds int,
  aspect_ratio text,
  updated_at timestamptz not null default now()
);

-- Saldo/alertas do provedor (só admin; nunca exposto ao usuário comum).
create table if not exists ai_provider_accounts (
  provider text primary key,
  current_estimated_balance_usd numeric(12, 4),
  auto_recharge_enabled boolean not null default false,
  low_balance_threshold_usd numeric(12, 2) not null default 20,
  last_balance_check_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into ai_provider_accounts (provider) values ('runway') on conflict (provider) do nothing;
