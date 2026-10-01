-- "Imagem para vídeo com IA" — evolução (etapa 11):
--   * faixas ECONÔMICO / PADRÃO / PREMIUM (o usuário nunca vê o provedor);
--   * Econômico passa a usar o fal.ai (Wan 2.2 5B — US$ 0,15 por vídeo de
--     até 5 s, fal.ai/models/fal-ai/wan/v2.2-5b/image-to-video, consultado
--     em 01/10/2026); gen4_turbo vira PADRÃO e gen4.5 vira PREMIUM;
--   * textos/logos aplicados DEPOIS da IA (pós-processamento FFmpeg);
--   * gerar novamente com desconto, reportar problema.
--
-- Migração ADITIVA (só colunas/tabelas novas + troca de rótulos das
-- linhas de preço já existentes). Nada fora do módulo de vídeo com IA.

-- 1) Faixas: ALTA → PREMIUM.
alter table ai_video_model_pricing drop constraint if exists ai_video_model_pricing_tier_check;
update ai_video_model_pricing set tier = 'PREMIUM', friendly_name = 'Premium'
  where provider = 'runway' and provider_model = 'gen4.5' and tier = 'PADRAO';
update ai_video_model_pricing set tier = 'PADRAO', friendly_name = 'Padrão'
  where provider = 'runway' and provider_model = 'gen4_turbo' and tier = 'ECONOMICO';
update ai_video_model_pricing set tier = 'PREMIUM' where tier = 'ALTA';
alter table ai_video_model_pricing add constraint ai_video_model_pricing_tier_check
  check (tier in ('ECONOMICO', 'PADRAO', 'PREMIUM'));

-- fal.ai cobra por vídeo (até 5 s): provider_fixed_credits = 15 × US$ 0,01 = US$ 0,15.
-- 65 créditos = margem ≥ 50% com a configuração inicial (câmbio 5,50, segurança 1,2,
-- infra R$ 0,15, taxa 5%) — ver lib/ai-video/pricing.ts.
insert into ai_video_model_pricing
  (tier, provider, provider_model, friendly_name, resolution, duration_seconds,
   provider_credits_per_second, provider_fixed_credits, provider_credit_usd, alilu_credit_cost)
values
  ('ECONOMICO', 'fal', 'fal-ai/wan/v2.2-5b/image-to-video', 'Econômica', '720p', 5, 0, 15, 0.01, 65)
on conflict (tier, provider_model, duration_seconds) do nothing;

insert into ai_provider_accounts (provider) values ('fal') on conflict (provider) do nothing;

-- 2) Política nova (na mesma linha versionada de ai_pricing_config).
alter table ai_pricing_config add column if not exists retry_discount_pct numeric(5, 2) not null default 50;
alter table ai_pricing_config add column if not exists max_retries_per_generation int not null default 3;
-- Custo de infraestrutura EXTRA estimado do pós-processamento (FFmpeg) —
-- só registrado internamente; não entra no preço por padrão (0).
alter table ai_pricing_config add column if not exists postprocess_cost_brl numeric(10, 4) not null default 0;
-- Reportes manuais acima disso em 30 dias marcam o usuário para revisão (sem bloquear).
alter table ai_pricing_config add column if not exists issue_review_threshold int not null default 5;

-- 3) Geração: overlays, preservação, regeneração, novos status.
alter table ai_video_generations drop constraint if exists ai_video_generations_status_check;
alter table ai_video_generations add constraint ai_video_generations_status_check check (status in (
  'CREATED', 'CREDIT_RESERVED', 'SUBMITTED', 'QUEUED', 'PROCESSING',
  'AI_COMPLETED', 'POST_PROCESSING',
  'COMPLETED', 'FAILED', 'REFUNDED', 'PRICE_GUARD_BLOCKED', 'EXPIRED'
));
alter table ai_video_generations add column if not exists preserve_text boolean not null default false;
-- Lista de overlays (lib/ai-video/overlays.ts), coordenadas normalizadas 0..1.
alter table ai_video_generations add column if not exists overlays jsonb not null default '[]'::jsonb;
-- Preparado para evolução (máscara/região protegida) — ainda sem editor.
alter table ai_video_generations add column if not exists protected_regions jsonb not null default '[]'::jsonb;
alter table ai_video_generations add column if not exists parent_generation_id uuid references ai_video_generations (id) on delete set null;
-- 'FULL' (preço cheio) | 'RETRY_DISCOUNT' (gerar novamente com desconto).
alter table ai_video_generations add column if not exists pricing_kind text not null default 'FULL'
  check (pricing_kind in ('FULL', 'RETRY_DISCOUNT'));
alter table ai_video_generations add column if not exists list_credit_cost int;
alter table ai_video_generations add column if not exists postprocess_attempts int not null default 0;
alter table ai_video_generations add column if not exists user_feedback text
  check (user_feedback is null or user_feedback in ('LIKED'));

create index if not exists ai_video_generations_parent_idx on ai_video_generations (parent_generation_id)
  where parent_generation_id is not null;
drop index if exists ai_video_generations_pending_idx;
create index if not exists ai_video_generations_pending_idx on ai_video_generations (status, next_check_at)
  where status in ('CREDIT_RESERVED', 'SUBMITTED', 'QUEUED', 'PROCESSING', 'AI_COMPLETED', 'POST_PROCESSING');

alter table ai_video_drafts add column if not exists preserve_text boolean;
alter table ai_video_drafts add column if not exists overlays jsonb;

-- 4) Reportar problema.
create table if not exists ai_video_generation_issues (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references ai_video_generations (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  issue_type text not null check (issue_type in (
    'TEXT_LOGO_DEFORMED', 'VIDEO_CORRUPTED', 'WRONG_MOTION', 'TOO_DIFFERENT', 'TECHNICAL_ERROR', 'OTHER'
  )),
  description text not null default '',
  -- O que o sistema fez: REFUNDED (revalidação confirmou defeito),
  -- RETRY_OFFERED (vídeo válido → regeneração com desconto), PENDING_REVIEW.
  resolution text not null default 'PENDING_REVIEW'
    check (resolution in ('REFUNDED', 'RETRY_OFFERED', 'PENDING_REVIEW')),
  created_at timestamptz not null default now(),
  -- Um reporte por geração por usuário (sem spam de reportes).
  constraint ai_video_generation_issues_unique unique (generation_id, user_id)
);
create index if not exists ai_video_generation_issues_user_idx on ai_video_generation_issues (user_id, created_at desc);
