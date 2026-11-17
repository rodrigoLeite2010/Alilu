-- Radar Viral Inteligente: descoberta, classificação (Viral Score),
-- controle de direitos e reabastecimento automático das Filas de vídeos.
--
-- Migração ADITIVA e segura para produção:
--   * só cria tabelas novas;
--   * acrescenta colunas com valor padrão NEUTRO em video_queues
--     (block_duplicate_files = false, reframe_mode = 'NONE',
--     max_duration_seconds = null) — filas existentes continuam exatamente
--     como estão;
--   * acrescenta colunas anuláveis em video_queue_items (hash do arquivo e
--     URL do arquivo original quando o vídeo é adaptado para 9:16);
--   * nenhum registro existente é alterado.
--
-- O radar NÃO publica nada: ele só cria itens na Fila de vídeos ligada a
-- ele (e somente para material próprio/licenciado). Importação, horários e
-- publicação continuam no fluxo existente (fila → agendador → Meta).

-- 1) Opções novas da Fila (usadas pelas filas criadas pelo radar; padrão neutro).
alter table video_queues add column if not exists block_duplicate_files boolean not null default false;
alter table video_queues add column if not exists reframe_mode text not null default 'NONE';
alter table video_queues drop constraint if exists video_queues_reframe_mode_check;
alter table video_queues add constraint video_queues_reframe_mode_check check (reframe_mode in ('NONE', 'FIT_9_16'));
alter table video_queues add column if not exists max_duration_seconds int;
alter table video_queues drop constraint if exists video_queues_max_duration_check;
alter table video_queues add constraint video_queues_max_duration_check
  check (max_duration_seconds is null or max_duration_seconds between 3 and 900);

alter table video_queue_items add column if not exists content_sha256 text;
alter table video_queue_items add column if not exists original_blob_url text;
create index if not exists video_queue_items_sha_idx on video_queue_items (user_id, content_sha256) where content_sha256 is not null;

-- 2) Radares.
create table if not exists viral_radars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null,
  category text not null,
  theme text not null,
  keywords text[] not null default '{}',
  hashtags text[] not null default '{}',
  language text not null default 'pt',
  region text not null default 'BR',
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED', 'ARCHIVED')),
  pause_reason text,
  -- Frequência da pesquisa (180 = 3 h, 360 = 6 h, 720 = 12 h, 1440 = 1 dia; personalizada 60–10080).
  frequency_minutes int not null default 360 check (frequency_minutes between 60 and 10080),
  -- Critérios: {minViews, minLikes, minComments, maxAgeHours, minScore, maxSelectedPerRun}.
  criteria jsonb not null default '{}'::jsonb,
  -- Pesos do Viral Score (somam 100): {velocity, likeRate, commentRate, recency, relevance}.
  score_weights jsonb not null default '{}'::jsonb,
  -- Modos: automático (só próprio/licenciado) e supervisionado (terceiros aguardam aprovação).
  auto_mode boolean not null default true,
  supervised_mode boolean not null default true,
  -- Fila de vídeos EXISTENTE que recebe os vídeos autorizados (contas, horários e publicação ficam nela).
  queue_id uuid references video_queues (id) on delete set null,
  queue_min int not null default 5 check (queue_min between 0 and 500),
  queue_target int not null default 15 check (queue_target between 1 and 1000),
  priority_mode text not null default 'SCORE' check (priority_mode in ('FIFO', 'SCORE')),
  -- Legendas: modelo da fila ou IA (com fallback para o modelo).
  caption_mode text not null default 'TEMPLATE' check (caption_mode in ('TEMPLATE', 'AI')),
  caption_style text not null default 'NEWS',
  ai_classification boolean not null default false,
  ai_daily_cap int not null default 20 check (ai_daily_cap between 0 and 500),
  -- Execução.
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_status_message text,
  consecutive_failures int not null default 0,
  backoff_until timestamptz,
  last_refill_attempt_at timestamptz,
  empty_refill_streak int not null default 0,
  run_lock_token text,
  run_lock_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists viral_radars_user_idx on viral_radars (user_id, created_at desc);
create index if not exists viral_radars_due_idx on viral_radars (status, next_run_at);
-- Uma fila pertence a no máximo um radar (sem misturar vídeos entre radares).
create unique index if not exists viral_radars_queue_unique on viral_radars (queue_id) where queue_id is not null and status <> 'ARCHIVED';

-- 3) Fontes de pesquisa de cada radar, com o tipo de autorização declarado.
create table if not exists viral_radar_sources (
  id uuid primary key default gen_random_uuid(),
  radar_id uuid not null references viral_radars (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  type text not null check (type in ('YOUTUBE_SEARCH', 'YOUTUBE_CHANNEL', 'RSS', 'INSTAGRAM_HASHTAG', 'TIKTOK')),
  label text not null default '',
  enabled boolean not null default true,
  -- {url} (RSS) | {channelId} (YOUTUBE_CHANNEL) | {} (pesquisa usa as palavras-chave do radar).
  config jsonb not null default '{}'::jsonb,
  -- Direitos sobre os VÍDEOS desta fonte: NONE (terceiros), OWN (próprio), LICENSED (licença).
  license text not null default 'NONE' check (license in ('NONE', 'OWN', 'LICENSED')),
  -- {edit, republish, commercial}: a importação automática exige os três.
  license_scope jsonb not null default '{}'::jsonb,
  license_note text,
  license_evidence_url text,
  license_declared_at timestamptz,
  -- Fonte oficial/confiável para checagem de fatos dos roteiros originais.
  trusted_for_facts boolean not null default false,
  last_fetched_at timestamptz,
  last_error text,
  consecutive_errors int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists viral_radar_sources_radar_idx on viral_radar_sources (radar_id);

-- 4) Candidatos descobertos (uma linha por identidade de origem em cada radar).
create table if not exists viral_candidates (
  id uuid primary key default gen_random_uuid(),
  radar_id uuid not null references viral_radars (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  source_id uuid references viral_radar_sources (id) on delete set null,
  platform text not null check (platform in ('YOUTUBE', 'RSS', 'INSTAGRAM', 'TIKTOK')),
  external_id text not null,
  url text not null,
  normalized_url text not null,
  media_url text,
  title text,
  description text,
  author_name text,
  author_id text,
  published_at timestamptz,
  thumbnail_url text,
  duration_seconds numeric,
  -- Últimas métricas observadas (null = indisponível; nunca estimadas).
  views bigint,
  likes bigint,
  comments bigint,
  metrics_observed_at timestamptz,
  -- Viral Score (0–100), componentes, versão da fórmula e justificativa.
  score numeric,
  score_components jsonb,
  score_version text,
  score_reason text,
  scored_at timestamptz,
  -- Direitos.
  authorization_status text not null default 'NOT_AUTHORIZED'
    check (authorization_status in ('AUTHORIZED', 'NOT_AUTHORIZED', 'PENDING_REVIEW')),
  authorization_type text check (authorization_type in ('OWN', 'LICENSED', 'MANUAL_APPROVAL')),
  authorization_scope jsonb,
  authorization_note text,
  authorized_at timestamptz,
  -- Etapa no radar. Depois de QUEUED o andamento vem do item da fila.
  status text not null default 'DISCOVERED' check (status in (
    'DISCOVERED', 'CLASSIFIED', 'AWAITING_AUTHORIZATION', 'ELIGIBLE', 'QUEUED',
    'REFERENCE', 'IGNORED', 'UNAVAILABLE', 'FILTERED'
  )),
  -- Destino: A = importação autorizada, B = referência p/ conteúdo original, C = aguardando autorização/revisão.
  route text check (route in ('A', 'B', 'C')),
  filter_reason text,
  queue_item_id uuid references video_queue_items (id) on delete set null,
  ai_analysis jsonb,
  ai_analyzed_at timestamptz,
  brief jsonb,
  brief_generated_at timestamptz,
  caption_meta jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists viral_candidates_identity_unique on viral_candidates (radar_id, platform, external_id);
create index if not exists viral_candidates_radar_idx on viral_candidates (radar_id, status, score desc nulls last);
create index if not exists viral_candidates_url_idx on viral_candidates (user_id, normalized_url);
create index if not exists viral_candidates_item_idx on viral_candidates (queue_item_id);

-- 5) Histórico de métricas observadas (base do crescimento real).
create table if not exists viral_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references viral_candidates (id) on delete cascade,
  observed_at timestamptz not null,
  views bigint,
  likes bigint,
  comments bigint,
  provider text not null
);

create index if not exists viral_metric_snapshots_candidate_idx on viral_metric_snapshots (candidate_id, observed_at desc);

-- 6) Execuções do radar (cron, reabastecimento, manual).
create table if not exists viral_radar_executions (
  id uuid primary key default gen_random_uuid(),
  radar_id uuid not null references viral_radars (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  trigger text not null check (trigger in ('SCHEDULE', 'REFILL', 'MANUAL')),
  status text not null default 'RUNNING' check (status in ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'SKIPPED', 'ABANDONED')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  discovered int not null default 0,
  new_candidates int not null default 0,
  refreshed int not null default 0,
  scored int not null default 0,
  queued int not null default 0,
  awaiting int not null default 0,
  references_count int not null default 0,
  quota_units int not null default 0,
  ai_calls int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  message text
);

create index if not exists viral_radar_executions_radar_idx on viral_radar_executions (radar_id, started_at desc);
create index if not exists viral_radar_executions_running_idx on viral_radar_executions (status) where status = 'RUNNING';

-- 7) Eventos auditáveis (transições de candidatos e ações do usuário).
create table if not exists viral_radar_events (
  id uuid primary key default gen_random_uuid(),
  radar_id uuid not null references viral_radars (id) on delete cascade,
  candidate_id uuid references viral_candidates (id) on delete set null,
  event text not null,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists viral_radar_events_radar_idx on viral_radar_events (radar_id, created_at desc);

-- 8) Consumo de cota por provedor e dia (controle de custo global).
create table if not exists viral_provider_usage (
  provider text not null,
  usage_date date not null,
  units int not null default 0,
  primary key (provider, usage_date)
);

-- 9) Cache de consultas (ex.: mesma pesquisa no YouTube dentro da janela de cache).
create table if not exists viral_query_cache (
  cache_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- 10) Métricas das publicações PRÓPRIAS (monitoramento de resultados).
create table if not exists viral_post_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  radar_id uuid not null references viral_radars (id) on delete cascade,
  queue_item_id uuid references video_queue_items (id) on delete set null,
  post_id uuid references instagram_posts (id) on delete set null,
  platform text not null check (platform in ('instagram', 'facebook')),
  external_id text not null,
  observed_at timestamptz not null default now(),
  views bigint,
  reach bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  -- Campos que a API não devolveu (permissão ausente etc.) — nunca estimados.
  unavailable text[] not null default '{}'
);

create index if not exists viral_post_metrics_radar_idx on viral_post_metrics (radar_id, observed_at desc);
create index if not exists viral_post_metrics_external_idx on viral_post_metrics (platform, external_id, observed_at desc);
