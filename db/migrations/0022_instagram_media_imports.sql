-- "Vídeos > Importar do Instagram": o usuário cola o link de um Reel/post
-- PÚBLICO, um provedor externo documentado (Apify — nunca raspagem
-- própria, nunca login/cookie do usuário) resolve a mídia, a tela mostra
-- a prévia e o arquivo é copiado para o storage do Alilu (a URL do
-- provedor expira). Só conteúdo próprio ou autorizado (declaração
-- obrigatória, registrada em authorized_at).
--
-- Migração ADITIVA: só tabelas novas.

create table if not exists instagram_media_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  original_url text not null,
  normalized_url text not null,
  -- reel | post | tv | manual (upload manual de fallback)
  url_kind text not null,
  shortcode text,
  status text not null default 'PENDING' check (status in (
    'PENDING', 'RESOLVING', 'READY', 'IMPORTING', 'COMPLETED', 'FAILED', 'UNSUPPORTED', 'PRIVATE_CONTENT', 'INVALID_URL'
  )),
  provider text not null,
  provider_request_id text,
  -- Itens resolvidos (carrossel pode ter vários): [{ mediaType, mediaUrl, thumbnailUrl, contentType }].
  -- As URLs são temporárias do provedor — só usadas para a prévia e o download.
  resolved_items jsonb not null default '[]'::jsonb,
  selected_index int,
  media_type text check (media_type is null or media_type in ('VIDEO', 'IMAGE')),
  thumbnail_url text,
  imported_file_url text,
  storage_path text,
  content_type text,
  file_size_bytes bigint,
  duration_seconds numeric(10, 3),
  width int,
  height int,
  video_codec text,
  has_audio boolean,
  provider_cost_usd numeric(10, 5) not null default 0,
  error_code text,
  error_message text,
  -- Declaração "o conteúdo é meu ou tenho autorização" (obrigatória).
  authorized_at timestamptz not null,
  execution_ms int,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists instagram_media_imports_user_idx on instagram_media_imports (user_id, created_at desc);
create index if not exists instagram_media_imports_dup_idx on instagram_media_imports (user_id, normalized_url)
  where status = 'COMPLETED';

-- Limites e custo (1 linha; editável no admin).
create table if not exists instagram_import_settings (
  id int primary key default 1 check (id = 1),
  max_imports_per_day int not null default 20,
  max_imported_video_size_mb int not null default 100,
  max_imported_duration_minutes int not null default 10,
  -- Custo estimado por resolução no provedor (Apify "Instagram Downloader
  -- API": US$ 0,43–1,20 por 1.000 — usamos o teto). Só registrado: o
  -- usuário NÃO paga créditos por importar.
  provider_cost_usd numeric(10, 5) not null default 0.0012,
  updated_at timestamptz not null default now()
);

insert into instagram_import_settings (id) values (1) on conflict (id) do nothing;
