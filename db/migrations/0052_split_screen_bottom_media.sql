-- Split Screen: mídia FIXA da parte de baixo, uma por conta do Instagram.
-- ADITIVA: nada existente muda. Ao abrir o editor (ou importar um vídeo do
-- Instagram), a parte de baixo já vem preenchida com a mídia da conta
-- escolhida — sem precisar enviar o arquivo de novo pelo celular.
create table if not exists split_screen_bottom_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  instagram_account_id uuid not null references instagram_accounts (id) on delete cascade,
  media_kind text not null check (media_kind in ('VIDEO', 'IMAGE')),
  storage_url text not null,
  storage_key text not null,
  content_type text not null,
  file_size_bytes bigint not null,
  width int not null,
  height int not null,
  duration_seconds numeric,
  has_audio boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instagram_account_id)
);
create index if not exists split_screen_bottom_media_user_idx on split_screen_bottom_media (user_id);
