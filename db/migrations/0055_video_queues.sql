-- Filas de vídeos (Games / GTA 6 e outros temas): importação em lote por
-- links + distribuição automática nos horários livres das contas escolhidas.
--
-- Migração ADITIVA e segura para produção:
--   * só cria tabelas novas e acrescenta UMA coluna anulável em
--     instagram_posts (sem valor padrão — nenhuma linha existente muda);
--   * o CHECK de instagram_posts.source é recriado com TODOS os valores já
--     aceitos + 'VIDEO_QUEUE' (nenhum valor existente deixa de ser válido);
--   * nenhum agendamento, publicação ou automação existente é alterado.
--
-- A fila NÃO publica nada sozinha: quando um vídeo está pronto e chega a
-- vez dele, ela cria uma publicação normal (instagram_posts, post_type
-- 'reels', source 'VIDEO_QUEUE') + destinos do Facebook
-- (social_publication_destinations). Daí em diante o agendador já
-- existente (/api/cron/instagram-publish) publica, com os mesmos claims,
-- locks, retentativas e controles de duplicidade de sempre.

-- 1) Origem "fila de vídeos" para as publicações criadas pela fila.
alter table instagram_posts drop constraint if exists instagram_posts_source_check;
alter table instagram_posts add constraint instagram_posts_source_check
  check (source in ('MANUAL', 'VIRAL_POST', 'AUTOMATION', 'VIDEO_QUEUE'));

-- 2) Item da fila que originou a publicação. Índice único PARCIAL: no
--    máximo UMA publicação não cancelada por item — mesmo que o planejador
--    rode duas vezes (cron simultâneo, timeout, reinício), a segunda
--    inserção falha e a publicação existente é reaproveitada.
alter table instagram_posts add column if not exists video_queue_item_id uuid;
create unique index if not exists instagram_posts_video_queue_item_unique
  on instagram_posts (video_queue_item_id)
  where video_queue_item_id is not null and status <> 'CANCELLED';

-- 3) Filas.
create table if not exists video_queues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null,
  -- Catálogo em lib/video-queue/catalog.ts (ex.: 'games' / 'gta-6').
  category text not null,
  theme text not null,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED')),
  pause_reason text,
  -- true = pausada automaticamente (conta/Página desconectada).
  paused_by_system boolean not null default false,
  -- Destinos EXPLÍCITOS (nunca há troca automática de conta).
  instagram_account_id uuid not null references instagram_accounts (id) on delete cascade,
  publish_to_instagram boolean not null default true,
  facebook_page_ids uuid[] not null default '{}',
  -- Programação.
  timezone text not null default 'America/Sao_Paulo',
  start_date date,
  posts_per_day int not null default 3 check (posts_per_day between 1 and 24),
  publish_times text[] not null,
  -- 0 = domingo … 6 = sábado.
  weekdays int[] not null default '{0,1,2,3,4,5,6}',
  min_interval_minutes int not null default 60 check (min_interval_minutes between 0 and 1440),
  allow_same_slot boolean not null default false,
  order_mode text not null default 'POSITION' check (order_mode in ('POSITION', 'REVERSE')),
  not_ready_policy text not null default 'NEXT_READY' check (not_ready_policy in ('WAIT', 'NEXT_READY')),
  -- Até quantas horas à frente as publicações são efetivamente criadas no agendador.
  materialize_ahead_hours int not null default 48 check (materialize_ahead_hours between 1 and 720),
  -- Legendas.
  caption_template text not null default '',
  facebook_caption_template text,
  -- Declaração de direitos (obrigatória para criar a fila).
  rights_confirmed_at timestamptz not null,
  -- Lock do planejamento (um planejador por fila de cada vez).
  planning_lock_token text,
  planning_lock_expires_at timestamptz,
  last_planned_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_queues_user_idx on video_queues (user_id, created_at desc);
create index if not exists video_queues_status_idx on video_queues (status);

-- 4) Itens (um por link/vídeo).
create table if not exists video_queue_items (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references video_queues (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  position int not null,
  source_url text not null,
  normalized_url text not null,
  source_kind text not null
    check (source_kind in ('DIRECT', 'INSTAGRAM', 'YOUTUBE', 'TIKTOK', 'OTHER_PLATFORM', 'UPLOAD')),
  status text not null default 'PENDING' check (status in (
    'PENDING', 'VALIDATING', 'IMPORTING', 'PROCESSING', 'READY',
    'WAITING_FILE', 'ERROR', 'CANCELLED', 'SCHEDULED', 'PUBLISHED'
  )),
  status_message text,
  error_code text,
  attempts_count int not null default 0,
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  processing_lock_token text,
  processing_lock_expires_at timestamptz,
  -- Arquivo importado (Vercel Blob, prefixo video-queue/ — fora da limpeza automática de importações).
  instagram_import_id uuid,
  blob_url text,
  blob_path text,
  thumbnail_url text,
  content_type text,
  file_size_bytes bigint,
  duration_seconds numeric,
  width int,
  height int,
  video_codec text,
  has_audio boolean,
  -- Incompatibilidade com Reels do Facebook (null = compatível/desconhecido).
  facebook_incompatible_reason text,
  -- Conteúdo.
  title text,
  caption text,
  facebook_caption text,
  -- Publicação criada no agendador existente.
  post_id uuid references instagram_posts (id) on delete set null,
  scheduled_at_utc timestamptz,
  facebook_note text,
  authorized_at timestamptz not null,
  imported_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_queue_items_queue_idx on video_queue_items (queue_id, position);
create index if not exists video_queue_items_worker_idx on video_queue_items (status, next_attempt_at);
create index if not exists video_queue_items_post_idx on video_queue_items (post_id);
-- Link duplicado na MESMA fila (itens cancelados não contam).
create unique index if not exists video_queue_items_queue_url_unique
  on video_queue_items (queue_id, normalized_url)
  where status <> 'CANCELLED';

-- 5) Histórico (só acumula; sem tokens nem URLs assinadas).
create table if not exists video_queue_events (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references video_queues (id) on delete cascade,
  item_id uuid references video_queue_items (id) on delete set null,
  event text not null,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists video_queue_events_queue_idx on video_queue_events (queue_id, created_at desc);
