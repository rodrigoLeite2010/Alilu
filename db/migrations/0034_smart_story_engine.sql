-- SmartStoryEngine (Fase 2): histórico estruturado de Stories inteligentes
-- + configuração opcional por automação.
--
-- Migração ADITIVA e idempotente (if not exists). Nada que já existe é
-- alterado, apagado ou migrado: toda automação atual fica com
-- smart_story_enabled = false e continua gerando Stories exatamente como
-- antes. NÃO cria scheduler, publicador nem storage: a execução continua
-- sendo automation_runs + instagram_posts (camada única de publicação).
--
-- smart_story_generations guarda O QUE o motor decidiu e gerou para um
-- horário (tipo, tema, título, corpo, CTA…). Serve a três coisas:
--   1. antirrepetição real (a legenda do Story é vazia, então o histórico
--      antigo "últimas legendas" não enxerga Stories);
--   2. idempotência: UNIQUE (automation_id, scheduled_at) — um retry do
--      mesmo horário reaproveita ESTE registro (mesmo Story), nunca gera
--      outro;
--   3. diagnóstico (tipo, template, status, resultado).

alter table content_automations
  add column if not exists smart_story_enabled boolean not null default false;

alter table content_automations
  add column if not exists smart_story_config jsonb not null default '{}'::jsonb;

create table if not exists smart_story_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  automation_id uuid not null references content_automations (id) on delete cascade,
  run_id uuid references automation_runs (id) on delete set null,
  scheduled_at timestamptz not null,

  story_type text not null,
  theme text,
  template_id text,
  prompt_used text not null default '',

  headline text not null,
  body text not null default '',
  option_a text not null default '',
  option_b text not null default '',
  cta text not null default '',
  visual_mood text not null default 'neutral',
  topic text not null default '',
  used_mascot boolean not null default false,
  layout text not null default 'SINGLE' check (layout in ('SINGLE', 'SEQUENCE')),
  sequence_count int not null default 1 check (sequence_count between 1 and 4),

  -- AI = saiu do provedor e passou na validação; FALLBACK = texto curado
  -- local (a IA falhou/retornou inválido) — a automação nunca aborta.
  source text not null default 'AI' check (source in ('AI', 'FALLBACK')),
  attempts int not null default 1,
  generation_error text,

  image_url text,
  instagram_post_id uuid references instagram_posts (id) on delete set null,
  instagram_media_id text,
  status text not null default 'GENERATED'
    check (status in ('GENERATED', 'RENDERING', 'READY', 'PUBLISHING', 'PUBLISHED', 'FAILED')),
  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint smart_story_unique_slot unique (automation_id, scheduled_at)
);

create index if not exists smart_story_generations_recent_idx
  on smart_story_generations (automation_id, scheduled_at desc);
create index if not exists smart_story_generations_run_idx
  on smart_story_generations (run_id);
