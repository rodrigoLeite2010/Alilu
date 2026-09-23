-- Piloto Automático de Conteúdo: automação semanal de geração + agendamento
-- de publicações no Instagram.
--
-- Migração ADITIVA (segue a mesma convenção de 0003): só cria tabelas
-- novas e acrescenta uma coluna nova em instagram_posts. Nenhum dado
-- existente é apagado ou reescrito.
--
-- Decisão de arquitetura (auditoria prévia, ver docs/content-automation.md):
-- este módulo NUNCA fala com a Meta diretamente e nunca publica por conta
-- própria. Ele só gera conteúdo e cria/atualiza uma linha em
-- instagram_posts (a mesma entidade "publicação" de sempre); quem publica
-- continua sendo publishInstagramPublication() via o agendador já
-- existente (instagram-scheduler.ts / /api/cron/instagram-publish). Este
-- módulo ganha seu PRÓPRIO cron (/api/cron/content-automation), que só
-- GERA e AGENDA — nunca fala com a Graph API.
--
-- Multi-conta desde o início: toda automação pertence a um
-- instagram_account_id (hoje só existe a conta @alilu.tec conectada, mas
-- nada aqui assume isso — ver instagram-account-repository.ts, que já
-- permite mais de uma conta por usuário no banco).

create table if not exists content_automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  instagram_account_id uuid not null references instagram_accounts (id) on delete cascade,

  name text not null,
  description text not null default '',

  status text not null default 'PAUSED'
    check (status in ('ACTIVE', 'PAUSED', 'ARCHIVED', 'ERROR')),

  timezone text not null default 'America/Sao_Paulo',

  brand_context text not null default '',

  auto_publish boolean not null default false,
  require_approval boolean not null default true,

  generation_lead_minutes int not null default 120
    check (generation_lead_minutes >= 0 and generation_lead_minutes <= 1440),

  image_mode text not null default 'FIXED_IMAGE'
    check (image_mode in ('AUTO_TEMPLATE', 'FIXED_IMAGE', 'MEDIA_LIBRARY')),
  fixed_image_media_id uuid references instagram_media (id) on delete set null,

  video_selection text not null default 'FIXED'
    check (video_selection in ('FIXED', 'ROTATE', 'RANDOM')),
  fixed_video_media_id uuid references instagram_media (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_run_at timestamptz,
  next_run_at timestamptz
);

create index if not exists content_automations_user_idx on content_automations (user_id);
create index if not exists content_automations_account_idx on content_automations (instagram_account_id);
create index if not exists content_automations_active_idx on content_automations (status) where status = 'ACTIVE';

create table if not exists content_automation_days (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references content_automations (id) on delete cascade,

  day_of_week text not null
    check (day_of_week in ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY')),

  enabled boolean not null default false,
  content_type text not null default 'POST' check (content_type in ('POST', 'REEL')),

  prompt text not null default '',

  publish_time text not null default '09:00'
    check (publish_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),

  template_id text,
  style_config jsonb,

  image_media_id uuid references instagram_media (id) on delete set null,
  video_media_id uuid references instagram_media (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint content_automation_days_unique unique (automation_id, day_of_week)
);

create index if not exists content_automation_days_automation_idx on content_automation_days (automation_id);

create table if not exists automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references content_automations (id) on delete cascade,
  automation_day_id uuid not null references content_automation_days (id) on delete cascade,
  instagram_account_id uuid not null references instagram_accounts (id) on delete cascade,

  run_date date not null,

  status text not null default 'PENDING'
    check (status in (
      'PENDING', 'GENERATING', 'GENERATED', 'WAITING_APPROVAL', 'SCHEDULED',
      'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'
    )),

  publication_id uuid references instagram_posts (id) on delete set null,

  generation_attempt int not null default 0,
  error_message text,

  processing_lock_token text,
  processing_lock_expires_at timestamptz,

  started_at timestamptz,
  completed_at timestamptz,
  next_attempt_at timestamptz,

  created_at timestamptz not null default now(),

  constraint automation_runs_unique_per_day unique (automation_id, run_date)
);

create index if not exists automation_runs_automation_idx on automation_runs (automation_id, run_date desc);
create index if not exists automation_runs_pending_idx on automation_runs (status, next_attempt_at);

create table if not exists generation_usage (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references content_automations (id) on delete cascade,
  run_id uuid references automation_runs (id) on delete set null,
  provider text not null,
  model text not null,
  tokens_input int,
  tokens_output int,
  estimated_cost_usd numeric(10, 6),
  created_at timestamptz not null default now()
);

create index if not exists generation_usage_automation_idx on generation_usage (automation_id, created_at desc);

alter table instagram_posts add column if not exists automation_run_id uuid references automation_runs (id) on delete set null;

create index if not exists instagram_posts_automation_run_idx on instagram_posts (automation_run_id) where automation_run_id is not null;

alter table instagram_posts drop constraint if exists instagram_posts_source_check;
alter table instagram_posts add constraint instagram_posts_source_check
  check (source in ('MANUAL', 'VIRAL_POST', 'AUTOMATION'));
