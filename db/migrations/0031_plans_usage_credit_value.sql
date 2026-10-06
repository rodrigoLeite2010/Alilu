-- Modelo comercial híbrido: ASSINATURA (publicação automática) + CRÉDITOS (IA cara).
--
--   AUTOMATION (R$ 19)  → Piloto Automático com conteúdo MANUAL, sem IA, sem limite.
--   CREATOR  (R$ 24,90) → + IA: 90 publicações com IA por ciclo de cobrança.
--   PRO      (R$ 49,90) → + IA: 300 publicações com IA por ciclo de cobrança.
--   Importador de Instagram: só planos pagos (qualquer um dos três).
--
-- Migração ADITIVA (mesmo padrão de 0004+). Reaproveita automation_subscriptions
-- (assinatura), asaas_webhook_events, ai_credit_* (carteira/extrato) e
-- generation_usage (uso de IA de texto). Os preços e limites dos planos vivem
-- em lib/billing/plans.ts — nunca no banco nem no frontend.

-- ---------------------------------------------------------------------------
-- 1) Plano da assinatura. Quem já assinava (R$ 19) continua no plano AUTOMATION
--    — o DEFAULT cobre as linhas existentes sem reescrever nada.
-- ---------------------------------------------------------------------------
alter table automation_subscriptions add column if not exists plan_code text not null default 'AUTOMATION';
alter table automation_subscriptions drop constraint if exists automation_subscriptions_plan_code_check;
alter table automation_subscriptions add constraint automation_subscriptions_plan_code_check
  check (plan_code in ('AUTOMATION', 'CREATOR', 'PRO'));

-- Downgrade agendado para o próximo ciclo (nunca reduz o limite no meio do período pago).
alter table automation_subscriptions add column if not exists pending_plan_code text;
alter table automation_subscriptions drop constraint if exists automation_subscriptions_pending_plan_code_check;
alter table automation_subscriptions add constraint automation_subscriptions_pending_plan_code_check
  check (pending_plan_code is null or pending_plan_code in ('AUTOMATION', 'CREATOR', 'PRO'));

-- ---------------------------------------------------------------------------
-- 2) Uso da franquia de publicações com IA, por ciclo de cobrança.
--    cycle_key = data (YYYY-MM-DD) em que o ciclo termina (current_period_ends_at):
--    quando o pagamento renova, a data muda e o contador "zera" sozinho, sem cron.
--    Reserva/devolução são UM comando SQL cada (o driver HTTP do Neon não faz
--    BEGIN/COMMIT com vários comandos) — mesma técnica da carteira de créditos.
-- ---------------------------------------------------------------------------
create table if not exists plan_usage_cycles (
  user_id uuid not null references users (id) on delete cascade,
  cycle_key text not null,
  plan_code text not null,
  used int not null default 0 check (used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, cycle_key)
);

-- Cada reserva tem referência única (type + id): retry, clique duplo e
-- reprocessamento nunca contam duas vezes.
create table if not exists plan_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  cycle_key text not null,
  reference_type text not null,
  reference_id text not null,
  status text not null default 'RESERVED' check (status in ('RESERVED', 'RELEASED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_usage_events_unique_reference unique (user_id, reference_type, reference_id)
);

create index if not exists plan_usage_events_user_idx on plan_usage_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3) Uso de IA de texto por usuário (custo real, só análise interna — o usuário
--    nunca é cobrado por token). generation_usage já guarda tokens/modelo do
--    Piloto; passa a aceitar também usos avulsos (ex.: legenda do compositor).
-- ---------------------------------------------------------------------------
alter table generation_usage alter column automation_id drop not null;
alter table generation_usage add column if not exists user_id uuid references users (id) on delete set null;
alter table generation_usage add column if not exists feature text;
create index if not exists generation_usage_user_idx on generation_usage (user_id, feature, created_at desc) where user_id is not null;

-- ---------------------------------------------------------------------------
-- 4) Crédito Alilu: 100 créditos = R$ 5,00 (R$ 0,05 por crédito; antes R$ 0,04).
--    Nova versão da regra comercial (a anterior fica no histórico) e preços de
--    vídeo recalculados com a MESMA fórmula de margem de lib/ai-video/pricing.ts
--    (margem alvo preservada). Saldos existentes não são alterados.
-- ---------------------------------------------------------------------------
insert into ai_pricing_config (
  credit_value_brl, target_gross_margin_pct, minimum_gross_margin_pct, usd_brl_reference_rate,
  provider_cost_safety_multiplier, payment_fee_pct, tax_pct, infra_cost_brl_per_generation,
  welcome_bonus_credits, max_provider_cost_usd, daily_provider_spend_limit_usd,
  monthly_provider_spend_limit_usd, max_generations_per_user_per_hour,
  moderation_strikes_before_block, moderation_block_hours, retention_days_free,
  retention_days_paid, purchase_refund_window_days, retry_discount_pct, max_retries_per_generation,
  postprocess_cost_brl, issue_review_threshold, max_concurrent_generations_per_user
)
select
  0.05, target_gross_margin_pct, minimum_gross_margin_pct, usd_brl_reference_rate,
  provider_cost_safety_multiplier, payment_fee_pct, tax_pct, infra_cost_brl_per_generation,
  welcome_bonus_credits, max_provider_cost_usd, daily_provider_spend_limit_usd,
  monthly_provider_spend_limit_usd, max_generations_per_user_per_hour,
  moderation_strikes_before_block, moderation_block_hours, retention_days_free,
  retention_days_paid, purchase_refund_window_days, retry_discount_pct, max_retries_per_generation,
  postprocess_cost_brl, issue_review_threshold, max_concurrent_generations_per_user
from ai_pricing_config
where is_active and effective_from <= now() and credit_value_brl <> 0.05
order by effective_from desc, created_at desc
limit 1;

-- custo total por geração (R$) = custo do provedor × câmbio × segurança + infra;
-- preço = custo / (1 − taxa − imposto − margem); créditos = ceil(preço / valor do crédito / 5) × 5.
update ai_video_model_pricing p
set alilu_credit_cost = greatest(5, ceil(
      (
        ((p.provider_credits_per_second * p.duration_seconds + p.provider_fixed_credits) * p.provider_credit_usd)
          * c.usd_brl_reference_rate * c.provider_cost_safety_multiplier
        + c.infra_cost_brl_per_generation
      )
      / (1 - c.payment_fee_pct / 100 - c.tax_pct / 100 - c.target_gross_margin_pct / 100)
      / c.credit_value_brl / 5
    ) * 5)::int,
    updated_at = now()
from (
  select * from ai_pricing_config
  where is_active and effective_from <= now()
  order by effective_from desc, created_at desc
  limit 1
) c
where c.credit_value_brl = 0.05 and p.is_active;

-- Pacotes: 100 créditos = R$ 5 (sem desconto progressivo; bonus_credits fica
-- pronto para promoções). Os pacotes antigos ficam inativos (compras antigas
-- guardam um snapshot, então o histórico não muda).
update ai_credit_packages set is_active = false, updated_at = now() where code in ('BASICO', 'CRIADOR', 'PRO');

insert into ai_credit_packages (code, name, credits, bonus_credits, price_cents, display_order, is_active) values
  ('C100', '100 créditos', 100, 0, 500, 1, true),
  ('C500', '500 créditos', 500, 0, 2500, 2, true),
  ('C1000', '1.000 créditos', 1000, 0, 5000, 3, true),
  ('C2000', '2.000 créditos', 2000, 0, 10000, 4, true)
on conflict (code) do nothing;
