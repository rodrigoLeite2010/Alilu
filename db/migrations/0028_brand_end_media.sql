-- Mídia final padrão da empresa (encerramento automático). ADITIVA:
-- nenhuma linha existente muda; tudo nasce desligado até o usuário
-- cadastrar uma mídia. Dono = user_id (mesmo isolamento do resto do Alilu).

create table if not exists brand_end_media_settings (
  user_id uuid primary key references users (id) on delete cascade,
  carousel_enabled boolean not null default false,
  reel_enabled boolean not null default false,
  -- Reels: usar o vídeo ou a imagem de encerramento (preferência: vídeo).
  reel_media_kind text not null default 'VIDEO' check (reel_media_kind in ('VIDEO', 'IMAGE')),
  split_enabled boolean not null default false,
  image_duration_seconds numeric not null default 3 check (image_duration_seconds between 1 and 10),
  -- Limite opcional para o vídeo de encerramento (null = duração original).
  max_video_seconds numeric check (max_video_seconds is null or max_video_seconds between 1 and 15),
  keep_audio boolean not null default false,
  fade_seconds numeric not null default 0.3 check (fade_seconds between 0 and 0.5),
  -- Aplica também nas telas/fluxos que não mostram a opção (ex.: Piloto Automático).
  apply_automatically boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists brand_end_media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  slot text not null check (slot in ('CAROUSEL_IMAGE', 'REEL_VIDEO', 'REEL_IMAGE', 'SPLIT_VIDEO')),
  storage_url text not null,
  storage_key text not null,
  content_type text not null,
  file_size_bytes bigint not null,
  width int not null,
  height int not null,
  duration_seconds numeric,
  video_codec text,
  fps numeric,
  has_audio boolean not null default false,
  -- Versões pré-normalizadas para emendar (por formato de saída e opções):
  -- { "<chave>": "<url>" } — evita reprocessar o encerramento a cada uso.
  normalized jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, slot)
);

-- Cache de vídeos já montados (conteúdo + encerramento) e registro do que
-- foi aplicado no Split Screen. Reaproveita o mesmo resultado para o mesmo
-- vídeo + mesmo encerramento (ex.: Reel fixo do Piloto todos os dias).
create table if not exists brand_end_media_renders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  context text not null check (context in ('REEL', 'SPLIT_SCREEN', 'AUTOMATION_REEL')),
  source_media_id uuid references instagram_media (id) on delete cascade,
  end_key text not null,
  end_media_type text not null check (end_media_type in ('VIDEO', 'IMAGE')),
  end_media_url text not null,
  result_url text not null,
  result_media_id uuid references instagram_media (id) on delete cascade,
  processing_ms int,
  created_at timestamptz not null default now()
);
create unique index if not exists brand_end_media_renders_cache_idx
  on brand_end_media_renders (user_id, source_media_id, end_key) where source_media_id is not null;
create index if not exists brand_end_media_renders_result_idx on brand_end_media_renders (result_media_id);

-- Log para admin: cada tentativa de aplicar o encerramento.
create table if not exists end_media_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  post_id uuid references instagram_posts (id) on delete set null,
  context text not null,
  media_type text,
  asset_id uuid,
  applied boolean not null,
  processing_ms int,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists end_media_events_user_idx on end_media_events (user_id, created_at desc);

-- Histórico na publicação: o que foi usado NA ÉPOCA (a configuração pode
-- mudar depois). end_media_applied também é a trava de idempotência.
alter table instagram_posts add column if not exists end_media_applied boolean not null default false;
alter table instagram_posts add column if not exists end_media_type text;
alter table instagram_posts add column if not exists end_media_url_used text;
alter table instagram_posts add column if not exists end_media_error text;
