-- "Vídeos > Importar do YouTube".
--
-- O link do YouTube serve para CONSULTAR metadados públicos pela API oficial
-- (YouTube Data API v3 / oEmbed) e mostrar a prévia no player oficial. O
-- arquivo de mídia NUNCA é baixado do YouTube (Termos do YouTube e Developer
-- Policies III.E.1): o usuário envia o arquivo original que tem direito de
-- usar e só esse arquivo é guardado/editado na Alilu.
--
-- Migração ADITIVA: só tabela nova, nenhum dado existente é alterado.

create table if not exists youtube_video_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  -- video | short | live
  url_kind text not null,
  original_url text not null,
  normalized_url text not null,
  status text not null default 'ANALYZED' check (status in ('ANALYZED', 'COMPLETED', 'EXPIRED')),
  availability text not null check (availability in (
    'AVAILABLE', 'PRIVATE', 'NOT_FOUND', 'UNAVAILABLE', 'AGE_RESTRICTED', 'LIVE_NOW', 'UPCOMING', 'UNKNOWN'
  )),
  -- data_api | oembed | none
  metadata_source text not null,
  -- Metadados públicos (Developer Policies III.E.4: guardados por no máximo 30 dias;
  -- a limpeza automática apaga/atualiza — ver lib/storage-cleanup).
  title text,
  channel_title text,
  channel_id text,
  thumbnail_url text,
  youtube_duration_seconds int,
  embeddable boolean not null default false,
  made_for_kids boolean,
  region_restricted boolean not null default false,
  metadata_fetched_at timestamptz,
  -- Falha da integração no momento da consulta (cota, conexão, chave). Não guarda resposta bruta.
  error_code text,
  -- Arquivo ENVIADO PELO USUÁRIO (Vercel Blob da Alilu, videos/imports/{userId}/youtube/).
  file_url text,
  storage_path text,
  content_type text,
  file_size_bytes bigint,
  duration_seconds numeric(10, 3),
  width int,
  height int,
  video_codec text,
  has_audio boolean,
  duration_mismatch boolean not null default false,
  -- Declaração "o vídeo é meu ou tenho autorização" (obrigatória para consultar e para enviar).
  authorized_at timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists youtube_video_imports_user_idx on youtube_video_imports (user_id, created_at desc);
create index if not exists youtube_video_imports_dup_idx on youtube_video_imports (user_id, video_id) where status = 'COMPLETED';
create index if not exists youtube_video_imports_file_idx on youtube_video_imports (file_url) where file_url is not null;

-- Registro de consultas (base dos limites por minuto/dia). Separado dos
-- registros de importação para que excluir uma importação não "devolva" cota.
create table if not exists youtube_import_usage (
  id bigserial primary key,
  user_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists youtube_import_usage_user_idx on youtube_import_usage (user_id, created_at desc);
